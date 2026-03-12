"""
AI Liquidity Manager - FastAPI Service

Endpoints:
  GET  /health                         — health check
  GET  /predict                        — keeper endpoint: current strategy params + price
  POST /inference                      — run model on provided market data
  POST /inference/pool/{pool_address}  — run model fetching live data from The Graph
  POST /backtest                       — backtest against real or synthetic history
  POST /train                          — train model on real data from The Graph
  GET  /features/importance            — feature importance from trained model
  GET  /pools                          — list of supported pools
  GET  /keeper/status                  — keeper bot last run status
"""
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional
import logging

# Ensure ai_engine package is importable whether started via uvicorn or python -m
_pkg_root = str(Path(__file__).resolve().parent.parent.parent)
if _pkg_root not in sys.path:
    sys.path.insert(0, _pkg_root)
_ai_engine = str(Path(__file__).resolve().parent.parent)
if _ai_engine not in sys.path:
    sys.path.insert(0, _ai_engine)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)s  %(levelname)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI Liquidity Manager",
    description="ML-powered liquidity management for Uniswap V3",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Cannot be True with wildcard origins
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ── Pydantic models ───────────────────────────────────────────────────────────

class MarketDataInput(BaseModel):
    price: float
    twap_1h: Optional[float] = None
    twap_24h: Optional[float] = None
    volume_1h: float
    volume_24h: float
    total_liquidity: float
    active_liquidity: float
    tick: Optional[int] = None


class StrategyOutput(BaseModel):
    range_width: float
    range_bias: float
    core_allocation: float
    defensive_allocation: float
    opportunistic_allocation: float
    cash_buffer: float
    rebalance_threshold: float
    confidence: float
    detected_regime: str
    regime_confidence: float
    reasoning: str
    model_version: str


class BacktestConfig(BaseModel):
    days: int = 30
    initial_capital: float = 100_000
    volatility: float = 0.04
    trend: float = 0.0
    pool_address: Optional[str] = None  # if provided, fetches real data from The Graph


class BacktestResult(BaseModel):
    total_return: float
    apr: float
    sharpe_ratio: float
    max_drawdown: float
    fees_collected: float
    impermanent_loss: float
    rebalance_count: int
    total_gas_cost: float
    vs_hodl: float
    data_source: str = "synthetic"


class TrainConfig(BaseModel):
    pool_address: Optional[str] = None
    days: int = 90
    use_synthetic_fallback: bool = True


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: Optional[str]
    uptime_seconds: float
    data_source: str


# ── Global state ─────────────────────────────────────────────────────────────

_start_time = datetime.utcnow()
_strategy_model = None        # LiquidityStrategyModel instance once trained
_model_version = "rule-based-v1"


def _rule_based(data: MarketDataInput) -> StrategyOutput:
    """
    Deterministic rule-based inference — used before ML model is trained.
    No random numbers.
    """
    price_drift = (
        (data.price - data.twap_24h) / data.twap_24h
        if data.twap_24h and data.twap_24h > 0
        else 0.0
    )
    volume_7d_avg = data.volume_24h
    volume_spike_ratio = (
        data.volume_24h / volume_7d_avg if volume_7d_avg > 0 else 1.0
    )
    # Approximate 1-day realized volatility from price vs TWAP drift
    volatility = abs(price_drift) * 5 + 0.02
    volatility = min(volatility, 0.15)

    range_width = volatility * 200
    range_width = max(4.0, min(15.0, range_width))

    if volatility > 0.05:
        core, defensive, opportunistic = 60.0, 30.0, 5.0
        regime = "high-vol"
    elif volatility < 0.02:
        core, defensive, opportunistic = 75.0, 15.0, 10.0
        regime = "low-vol"
    else:
        core, defensive, opportunistic = 70.0, 20.0, 10.0
        regime = "range"

    if volume_spike_ratio > 2.0:
        opportunistic = min(opportunistic + 5, 15.0)
        core -= 5.0

    if abs(price_drift) > 0.005:
        regime = "trend"

    reasons = []
    if volatility > 0.05:
        reasons.append("High volatility — widening ranges")
    if volume_spike_ratio > 2.0:
        reasons.append("Volume spike — boosting opportunistic allocation")
    if abs(price_drift) > 0.01:
        direction = "upward" if price_drift > 0 else "downward"
        reasons.append(f"Price drift {direction}")
    reasoning = (
        ". ".join(reasons)
        if reasons
        else "Normal market conditions — standard allocation applied."
    )

    return StrategyOutput(
        range_width=round(range_width, 2),
        range_bias=round(price_drift * 10, 4),
        core_allocation=round(core, 1),
        defensive_allocation=round(defensive, 1),
        opportunistic_allocation=round(opportunistic, 1),
        cash_buffer=5.0,
        rebalance_threshold=round(0.05 + volatility * 0.5, 4),
        confidence=0.72,
        detected_regime=regime,
        regime_confidence=0.78,
        reasoning=reasoning,
        model_version=_model_version,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "AI Liquidity Manager",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse)
async def health():
    graph_key = "configured" if os.getenv("THE_GRAPH_API_KEY") else "missing (rate-limited)"
    return HealthResponse(
        status="healthy",
        model_loaded=_strategy_model is not None,
        model_version=_model_version,
        uptime_seconds=(datetime.utcnow() - _start_time).total_seconds(),
        data_source=f"The Graph (key: {graph_key})",
    )


@app.get("/pools")
async def list_pools():
    """List known pool aliases for live inference and backtesting."""
    from data.graph_client import KNOWN_POOLS
    return {"pools": KNOWN_POOLS}


@app.post("/inference", response_model=StrategyOutput)
async def inference(data: MarketDataInput):
    """Run inference on caller-supplied market data."""
    try:
        logger.info(f"Inference price={data.price} vol24h={data.volume_24h}")
        if _strategy_model and _strategy_model.is_trained:
            from features.feature_engineering import FeatureEngineer
            fe = FeatureEngineer()
            fe.update(
                price=data.price,
                volume_24h=data.volume_24h,
                liquidity=data.total_liquidity,
                fees_24h=data.volume_24h * 0.003,
            )
            features = fe.compute_features(
                current_price=data.price,
                current_tick=data.tick or 0,
                total_liquidity=data.total_liquidity,
                active_liquidity=data.active_liquidity,
                volume_1h=data.volume_1h,
                volume_24h=data.volume_24h,
                twap_1h=data.twap_1h,
                twap_24h=data.twap_24h,
            )
            out = _strategy_model.predict(features)
            return StrategyOutput(
                range_width=out.range_width,
                range_bias=out.range_bias,
                core_allocation=out.core_allocation,
                defensive_allocation=out.defensive_allocation,
                opportunistic_allocation=out.opportunistic_allocation,
                cash_buffer=out.cash_buffer,
                rebalance_threshold=out.rebalance_threshold,
                confidence=out.confidence,
                detected_regime=out.detected_regime.value,
                regime_confidence=out.regime_confidence,
                reasoning=out.reasoning,
                model_version=out.model_version,
            )
        return _rule_based(data)
    except Exception as e:
        logger.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/inference/pool/{pool_address}", response_model=StrategyOutput)
async def inference_for_pool(pool_address: str):
    """
    Run inference by fetching live market data from The Graph.
    Accepts pool contract address (0x…) or alias from /pools.
    """
    try:
        from data.graph_client import KNOWN_POOLS
        resolved = KNOWN_POOLS.get(pool_address, pool_address)
        logger.info(f"Live pool inference pool={resolved}")

        from features.feature_engineering import DataFetcher
        fetcher = DataFetcher()
        features = await fetcher.get_features(resolved)

        if _strategy_model and _strategy_model.is_trained:
            out = _strategy_model.predict(features)
            return StrategyOutput(
                range_width=out.range_width,
                range_bias=out.range_bias,
                core_allocation=out.core_allocation,
                defensive_allocation=out.defensive_allocation,
                opportunistic_allocation=out.opportunistic_allocation,
                cash_buffer=out.cash_buffer,
                rebalance_threshold=out.rebalance_threshold,
                confidence=out.confidence,
                detected_regime=out.detected_regime.value,
                regime_confidence=out.regime_confidence,
                reasoning=out.reasoning,
                model_version=out.model_version,
            )

        data = MarketDataInput(
            price=features.price,
            twap_1h=features.twap_1h,
            twap_24h=features.twap_24h,
            volume_1h=features.volume_1h,
            volume_24h=features.volume_24h,
            total_liquidity=features.total_liquidity,
            active_liquidity=features.active_liquidity,
        )
        return _rule_based(data)

    except Exception as e:
        logger.error(f"Pool inference error pool={pool_address}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backtest", response_model=BacktestResult)
async def run_backtest(config: BacktestConfig):
    """
    Run backtest.
    - pool_address provided → fetches real daily OHLCV from The Graph
    - otherwise → geometric Brownian motion (deterministic seed=42)
    """
    import pandas as pd
    from backtesting.backtester import LiquidityBacktester, generate_synthetic_history

    data_source = "synthetic"
    df = None

    if config.pool_address:
        from data.graph_client import fetch_pool_day_data, KNOWN_POOLS
        resolved = KNOWN_POOLS.get(config.pool_address, config.pool_address)
        logger.info(f"Backtest with real data pool={resolved} days={config.days}")
        rows = await fetch_pool_day_data(resolved, days=config.days)

        if rows:
            records = []
            for row in rows:
                p = float(row.get("token0Price") or 0)
                if p <= 0:
                    continue
                records.append({
                    "timestamp": pd.Timestamp(int(row["date"]), unit="s"),
                    "price": p,
                    "volume_24h": float(row.get("volumeUSD") or 0),
                    "liquidity": float(row.get("tvlUSD") or 0),
                    "fees_24h": float(row.get("feesUSD") or 0),
                })
            if records:
                df = pd.DataFrame(records)
                data_source = f"the-graph:{resolved[:10]}"

    if df is None:
        df = generate_synthetic_history(
            days=config.days,
            volatility=config.volatility,
            trend=config.trend,
        )

    backtester = LiquidityBacktester(
        initial_capital=config.initial_capital,
        fee_tier=3000,
    )
    results = backtester.run(df, use_rule_fallback=True)

    return BacktestResult(
        total_return=round(results.total_return, 6),
        apr=round(results.apr, 6),
        sharpe_ratio=round(results.sharpe_ratio, 4),
        max_drawdown=round(results.max_drawdown, 6),
        fees_collected=round(results.fees_collected, 2),
        impermanent_loss=round(results.impermanent_loss, 2),
        rebalance_count=results.rebalance_count,
        total_gas_cost=round(results.total_gas_cost, 4),
        vs_hodl=round(results.vs_hodl, 6),
        data_source=data_source,
    )


async def _fetch_coingecko_history(days: int = 365):
    """
    Fetch daily ETH/USD OHLCV from CoinGecko free API (no key needed).
    Returns a DataFrame with columns: timestamp, price, volume_24h, liquidity, fees_24h
    or None on failure.
    """
    import pandas as pd

    url = (
        f"https://api.coingecko.com/api/v3/coins/ethereum/market_chart"
        f"?vs_currency=usd&days={days}&interval=daily"
    )
    try:
        async with __import__("httpx").AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers={"Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json()

        prices  = data.get("prices", [])          # [[ts_ms, price], …]
        volumes = data.get("total_volumes", [])   # [[ts_ms, vol], …]

        if len(prices) < 20:
            return None

        vol_map = {int(ts): v for ts, v in volumes}

        records = []
        for ts_ms, price in prices:
            if price <= 0:
                continue
            ts_s = int(ts_ms) // 1000
            vol = vol_map.get(int(ts_ms), 0)
            # Estimate LP fees: Uniswap V3 ETH/USDC 0.3% pool ≈ 0.3% * volume * 0.25 (in-range fraction)
            fees = vol * 0.003 * 0.25
            # Estimate TVL from volume (rough: TVL ≈ 30× daily volume for ETH/USDC 0.3%)
            tvl = vol * 30
            records.append({
                "timestamp": pd.Timestamp(ts_s, unit="s"),
                "price": price,
                "volume_24h": vol,
                "liquidity": tvl,
                "fees_24h": fees,
            })

        return pd.DataFrame(records) if records else None

    except Exception as e:
        logger.warning(f"CoinGecko fetch failed: {e}")
        return None


@app.post("/train")
async def train_model(config: TrainConfig):
    """
    Train the LightGBM model on real Uniswap V3 pool data from The Graph.
    Falls back to synthetic data if The Graph is unavailable.
    """
    global _strategy_model, _model_version

    import numpy as np
    import pandas as pd
    from backtesting.backtester import generate_synthetic_history
    from features.feature_engineering import FeatureEngineer
    from models.strategy_model import LiquidityStrategyModel, RuleBasedFallback
    from models.types import MarketRegime
    from data.graph_client import fetch_pool_day_data, DEFAULT_POOL, KNOWN_POOLS

    pool = KNOWN_POOLS.get(config.pool_address or "", config.pool_address or DEFAULT_POOL)
    logger.info(f"Training model pool={pool} days={config.days}")

    rows = await fetch_pool_day_data(pool, days=config.days)
    data_source = "synthetic"

    if rows:
        records = []
        for row in rows:
            p = float(row.get("token0Price") or 0)
            if p <= 0:
                continue
            records.append({
                "timestamp": pd.Timestamp(int(row["date"]), unit="s"),
                "price": p,
                "volume_24h": float(row.get("volumeUSD") or 0),
                "liquidity": float(row.get("tvlUSD") or 0),
                "fees_24h": float(row.get("feesUSD") or 0),
            })
        if records:
            df = pd.DataFrame(records)
            data_source = "the-graph"
            logger.info(f"Real data loaded for training rows={len(df)}")
        else:
            rows = []

    if not rows:
        # ── CoinGecko fallback: free, no API key, up to 365 days ─────────────
        cg_df = await _fetch_coingecko_history(days=min(config.days, 365))
        if cg_df is not None and len(cg_df) >= 20:
            df = cg_df
            data_source = "coingecko"
            logger.info(f"CoinGecko data loaded for training rows={len(df)}")
        elif not config.use_synthetic_fallback:
            raise HTTPException(
                status_code=503,
                detail="The Graph returned no data and synthetic fallback is disabled.",
            )
        else:
            df = generate_synthetic_history(days=max(config.days, 90), volatility=0.04)

    # ── Build feature matrix from history ────────────────────────────────────
    fe = FeatureEngineer()
    X_rows, y_range_rows, y_alloc_rows, y_regime_rows = [], [], [], []

    for _, row in df.iterrows():
        price = float(row["price"])
        if price <= 0:
            continue
        vol24 = float(row.get("volume_24h", 0))
        liq = float(row.get("liquidity", 0))
        fees = float(row.get("fees_24h", 0))
        ts = row["timestamp"]

        fe.update(price=price, volume_24h=vol24, liquidity=liq, fees_24h=fees, timestamp=ts)

        if len(fe.price_history) < 5:
            continue

        features = fe.compute_features(
            current_price=price,
            current_tick=int(np.log(price) / np.log(1.0001)),
            total_liquidity=liq,
            active_liquidity=liq * 0.5,
            volume_1h=vol24 / 24,
            volume_24h=vol24,
            timestamp=ts,
        )

        X_rows.append(features.to_array())

        rb = RuleBasedFallback.predict(features)
        y_range_rows.append(rb.range_width)
        y_alloc_rows.append([rb.core_allocation, rb.defensive_allocation, rb.opportunistic_allocation])

        regime_map = {
            MarketRegime.TREND: 0,
            MarketRegime.RANGE: 1,
            MarketRegime.HIGH_VOL: 2,
            MarketRegime.LOW_VOL: 3,
        }
        y_regime_rows.append(int(regime_map.get(rb.detected_regime, 1)))

    if len(X_rows) < 20:
        return {
            "success": False,
            "message": f"Not enough data points to train (need ≥20, got {len(X_rows)})",
            "data_source": data_source,
        }

    import numpy as np
    X = np.array(X_rows)
    y_range = np.array(y_range_rows, dtype=np.float64)
    y_alloc = np.array(y_alloc_rows, dtype=np.float64)
    y_regime = np.array(y_regime_rows, dtype=np.int32)
    y_regime = np.clip(y_regime, 0, 3)  # Ensure valid labels

    logger.info(f"Training data shapes: X={X.shape} y_range={y_range.shape} y_alloc={y_alloc.shape} y_regime={y_regime.shape}")
    logger.info(f"y_regime unique values: {np.unique(y_regime).tolist()}")

    model = LiquidityStrategyModel()
    try:
        metrics = model.train(X, y_range, y_alloc, y_regime)
    except Exception as e:
        logger.error(f"Training failed: {e}")
        detail = (
            f"Training failed: {e} | "
            f"X.shape={X.shape}, y_regime unique={np.unique(y_regime).tolist()}, "
            f"y_regime dtype={y_regime.dtype}"
        )
        raise HTTPException(status_code=500, detail=detail)

    save_path = Path(__file__).parent.parent / "models" / "saved"
    model.save(save_path)
    _strategy_model = model
    _model_version = f"lgbm-v1-{data_source}"

    logger.info(f"Training complete samples={len(X_rows)} metrics={metrics}")
    return {
        "success": True,
        "message": f"Trained on {len(X_rows)} samples from {data_source}",
        "model_version": _model_version,
        "metrics": {k: round(float(v), 6) for k, v in metrics.items()},
        "data_source": data_source,
        "training_samples": len(X_rows),
    }


@app.get("/predict")
async def predict_for_keeper():
    """
    Keeper endpoint — returns current strategy parameters + ETH price.
    Called by keeper.py every 15 minutes to decide tick range and allocation.
    Response keys: current_price, range_width, core_pct, confidence, regime.
    """
    try:
        # Try to get live price from CoinGecko
        current_price = 2500.0
        try:
            async with __import__("httpx").AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": "ethereum", "vs_currencies": "usd"},
                )
                resp.raise_for_status()
                current_price = float(resp.json()["ethereum"]["usd"])
        except Exception:
            pass  # Use default

        if _strategy_model and _strategy_model.is_trained:
            from features.feature_engineering import FeatureEngineer
            fe = FeatureEngineer()
            fe.update(price=current_price, volume_24h=300_000_000, liquidity=500_000_000, fees_24h=90_000)
            features = fe.compute_features(
                current_price=current_price,
                current_tick=int(__import__("math").log(current_price * 1e12) / __import__("math").log(1.0001)),
                total_liquidity=500_000_000,
                active_liquidity=250_000_000,
                volume_1h=12_500_000,
                volume_24h=300_000_000,
            )
            out = _strategy_model.predict(features)
            return {
                "current_price": current_price,
                "range_width":   out.range_width / 100.0,  # convert % → fraction
                "core_pct":      out.core_allocation / 100.0,
                "confidence":    out.confidence,
                "regime":        out.detected_regime.value if hasattr(out.detected_regime, "value") else str(out.detected_regime),
                "model_version": _model_version,
            }

        # Rule-based fallback
        return {
            "current_price": current_price,
            "range_width":   0.06,
            "core_pct":      0.70,
            "confidence":    0.72,
            "regime":        "range",
            "model_version": _model_version,
        }
    except Exception as e:
        logger.error(f"/predict error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/keeper/status")
async def keeper_status():
    """Returns last execution status of the on-chain keeper bot."""
    from keeper.keeper import keeper_state
    return keeper_state


@app.get("/features/importance")
async def feature_importance():
    """Feature importance from trained model, or rule-based ranking."""
    if _strategy_model and _strategy_model.is_trained:
        return {
            "feature_importance": _strategy_model.feature_importance,
            "model_version": _model_version,
            "source": "trained_model",
        }
    return {
        "feature_importance": {
            "volatility_1d": 0.18,
            "volume_spike_ratio": 0.15,
            "price_drift": 0.12,
            "liquidity_concentration": 0.10,
            "volume_24h": 0.08,
            "total_liquidity": 0.07,
            "fee_rate_24h": 0.06,
            "realized_volatility": 0.05,
            "price_velocity": 0.05,
            "hour_of_day": 0.04,
            "day_of_week": 0.03,
            "is_weekend": 0.02,
            "garman_klass_volatility": 0.02,
            "parkinson_volatility": 0.02,
            "volume_trend": 0.01,
        },
        "model_version": _model_version,
        "source": "rule_based_ranking",
    }


# ── Startup: load model + start keeper scheduler ──────────────────────────────

@app.on_event("startup")
async def _startup():
    global _strategy_model, _model_version
    save_path = Path(__file__).parent.parent / "models" / "saved"

    # 1. Try to load a previously saved model first (fastest)
    if save_path.exists():
        try:
            from models.strategy_model import LiquidityStrategyModel
            model = LiquidityStrategyModel()
            model.load(save_path)
            _strategy_model = model
            _model_version = "lgbm-v1-loaded"
            logger.info(f"Loaded saved model path={save_path}")
        except Exception as e:
            logger.info(f"No saved model or load failed: {e}")
            import asyncio
            asyncio.create_task(_auto_train())
    else:
        # 2. No saved model — auto-train in background using CoinGecko data
        logger.info("No saved model found — auto-training with CoinGecko data (background)")
        import asyncio
        asyncio.create_task(_auto_train())

    # 3. Start keeper scheduler (only if env vars are configured)
    _start_keeper_scheduler()


async def _auto_train():
    """Train model at startup using CoinGecko data (no API key needed)."""
    global _strategy_model, _model_version
    try:
        import numpy as np
        import pandas as pd
        from backtesting.backtester import generate_synthetic_history
        from features.feature_engineering import FeatureEngineer
        from models.strategy_model import LiquidityStrategyModel, RuleBasedFallback
        from models.types import MarketRegime

        # Fetch real data
        df = await _fetch_coingecko_history(days=365)
        data_source = "coingecko"
        if df is None or len(df) < 20:
            logger.warning("CoinGecko unavailable at startup — using synthetic data")
            df = generate_synthetic_history(days=365, volatility=0.04)
            data_source = "synthetic"

        logger.info(f"Auto-train: {len(df)} rows from {data_source}")

        fe = FeatureEngineer()
        X_rows, y_range_rows, y_alloc_rows, y_regime_rows = [], [], [], []
        regime_map = {
            MarketRegime.TREND: 0, MarketRegime.RANGE: 1,
            MarketRegime.HIGH_VOL: 2, MarketRegime.LOW_VOL: 3,
        }

        for _, row in df.iterrows():
            price = float(row["price"])
            if price <= 0:
                continue
            vol24 = float(row.get("volume_24h", 0))
            liq   = float(row.get("liquidity", 0))
            fees  = float(row.get("fees_24h", 0))
            ts    = row["timestamp"]
            fe.update(price=price, volume_24h=vol24, liquidity=liq, fees_24h=fees, timestamp=ts)
            if len(fe.price_history) < 5:
                continue
            features = fe.compute_features(
                current_price=price,
                current_tick=int(np.log(price) / np.log(1.0001)),
                total_liquidity=liq,
                active_liquidity=liq * 0.5,
                volume_1h=vol24 / 24,
                volume_24h=vol24,
                timestamp=ts,
            )
            X_rows.append(features.to_array())
            rb = RuleBasedFallback.predict(features)
            y_range_rows.append(rb.range_width)
            y_alloc_rows.append([rb.core_allocation, rb.defensive_allocation, rb.opportunistic_allocation])
            y_regime_rows.append(int(regime_map.get(rb.detected_regime, 1)))

        if len(X_rows) < 20:
            logger.error(f"Auto-train: not enough samples ({len(X_rows)}), keeping rule-based")
            return

        X        = np.array(X_rows)
        y_range  = np.array(y_range_rows, dtype=np.float64)
        y_alloc  = np.array(y_alloc_rows, dtype=np.float64)
        y_regime = np.clip(np.array(y_regime_rows, dtype=np.int32), 0, 3)

        model = LiquidityStrategyModel()
        model.train(X, y_range, y_alloc, y_regime)

        # Save so next restart loads instantly
        save_path = Path(__file__).parent.parent / "models" / "saved"
        save_path.mkdir(parents=True, exist_ok=True)
        model.save(save_path)

        _strategy_model = model
        _model_version = f"lgbm-v1-{data_source}-auto"
        logger.info(f"Auto-train complete: {len(X_rows)} samples, source={data_source}, version={_model_version}")

    except Exception as e:
        logger.error(f"Auto-train failed: {e}")


def _start_keeper_scheduler():
    """Start APScheduler if VAULT_ADDRESS and KEEPER_PRIVATE_KEY are set."""
    vault_addr   = os.getenv("VAULT_ADDRESS")
    keeper_key   = os.getenv("KEEPER_PRIVATE_KEY")
    rpc_url      = os.getenv("RPC_URL_ARBITRUM")

    if not (vault_addr and keeper_key and rpc_url):
        logger.info(
            "Keeper scheduler disabled — set VAULT_ADDRESS, KEEPER_PRIVATE_KEY, "
            "and RPC_URL_ARBITRUM to enable automated rebalancing"
        )
        return

    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from keeper.keeper import keeper_job

        interval_minutes = int(os.getenv("REBALANCE_INTERVAL", "15"))
        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            keeper_job,
            trigger="interval",
            minutes=interval_minutes,
            id="keeper",
            name="AI Vault Keeper",
            max_instances=1,
            coalesce=True,
        )
        scheduler.start()
        logger.info(
            f"Keeper scheduler started — rebalancing every {interval_minutes} minutes"
        )
    except ImportError:
        logger.warning("apscheduler not installed — keeper scheduler disabled. Run: pip install apscheduler")
    except Exception as e:
        logger.error(f"Failed to start keeper scheduler: {e}")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    logger.info(f"Starting AI Liquidity Manager port={port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
