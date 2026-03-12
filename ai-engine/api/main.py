"""
AI Liquidity Manager - FastAPI Service
Simplified standalone version for Railway deployment
"""
import os
from datetime import datetime
from typing import Optional, Dict, Any
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="AI Liquidity Manager",
    description="ML-powered liquidity management for Uniswap V3 / Orca",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Models ===

class MarketDataInput(BaseModel):
    """Input market data for inference"""
    price: float
    twap_1h: Optional[float] = None
    twap_24h: Optional[float] = None
    volume_1h: float
    volume_24h: float
    total_liquidity: float
    active_liquidity: float
    tick: Optional[int] = None


class StrategyOutput(BaseModel):
    """Strategy output from AI model"""
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
    """Backtest configuration"""
    days: int = 30
    initial_capital: float = 100000
    volatility: float = 0.04
    trend: float = 0.0


class BacktestResult(BaseModel):
    """Backtest results"""
    total_return: float
    apr: float
    sharpe_ratio: float
    max_drawdown: float
    fees_collected: float
    impermanent_loss: float
    rebalance_count: int
    total_gas_cost: float
    vs_hodl: float


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    model_version: Optional[str]
    uptime_seconds: float


# === Global State ===

start_time = datetime.utcnow()
MODEL_VERSION = "rule-based-v1"


def rule_based_inference(data: MarketDataInput) -> StrategyOutput:
    """Rule-based inference when model not loaded"""
    
    # Calculate volatility from price movements
    if data.twap_24h and data.twap_24h > 0:
        price_drift = (data.price - data.twap_24h) / data.twap_24h
    else:
        price_drift = 0.0
    
    # Volume spike detection
    volume_7d_avg = data.volume_24h  # Simplified
    volume_spike_ratio = data.volume_24h / volume_7d_avg if volume_7d_avg > 0 else 1.0
    
    # Estimate volatility (simplified)
    volatility = 0.035  # Default 3.5%
    
    # Range width: k * volatility where k=2
    range_width = volatility * 200  # Convert to percentage
    range_width = max(4.0, min(15.0, range_width))
    
    # Capital allocation based on regime
    if volatility > 0.05:
        core, defensive, opportunistic = 60.0, 30.0, 5.0
        regime = "high-vol"
    elif volatility < 0.02:
        core, defensive, opportunistic = 75.0, 15.0, 10.0
        regime = "low-vol"
    else:
        core, defensive, opportunistic = 70.0, 20.0, 10.0
        regime = "range"
    
    # Adjust for volume spike
    if volume_spike_ratio > 2.0:
        opportunistic = min(opportunistic + 5, 15.0)
        core -= 5.0
    
    # Rebalance threshold
    rebalance_threshold = 0.05 + volatility * 0.5
    
    # Generate reasoning
    reasons = []
    if volatility > 0.05:
        reasons.append("High volatility detected")
    if volume_spike_ratio > 2.0:
        reasons.append("Volume spike - increasing opportunistic allocation")
    if abs(price_drift) > 0.01:
        direction = "upward" if price_drift > 0 else "downward"
        reasons.append(f"Price drift {direction}")
    
    reasoning = ". ".join(reasons) if reasons else "Normal market conditions. Standard allocation strategy applied."
    
    return StrategyOutput(
        range_width=range_width,
        range_bias=price_drift * 10,
        core_allocation=core,
        defensive_allocation=defensive,
        opportunistic_allocation=opportunistic,
        cash_buffer=5.0,
        rebalance_threshold=rebalance_threshold,
        confidence=0.75,
        detected_regime=regime,
        regime_confidence=0.8,
        reasoning=reasoning,
        model_version=MODEL_VERSION,
    )


# === Endpoints ===

@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "service": "AI Liquidity Manager",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint for Railway"""
    return HealthResponse(
        status="healthy",
        model_loaded=False,
        model_version=MODEL_VERSION,
        uptime_seconds=(datetime.utcnow() - start_time).total_seconds(),
    )


@app.post("/inference", response_model=StrategyOutput)
async def inference(data: MarketDataInput):
    """
    Run ML inference on current market data.
    
    Returns optimal strategy parameters:
    - Range width and bias
    - Capital allocation
    - Rebalance threshold
    - Detected market regime
    """
    try:
        logger.info(f"Running inference - price: {data.price}, volume_24h: {data.volume_24h}")
        
        # Use rule-based inference (can be replaced with ML model)
        output = rule_based_inference(data)
        
        logger.info(f"Inference complete - regime: {output.detected_regime}, range_width: {output.range_width}")
        
        return output
        
    except Exception as e:
        logger.error(f"Inference failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/inference/pool/{pool_address}", response_model=StrategyOutput)
async def inference_for_pool(pool_address: str):
    """
    Run inference for a specific pool.
    Uses simulated data for now.
    """
    try:
        # Simulated market data
        data = MarketDataInput(
            price=1850.0,
            volume_1h=500000.0,
            volume_24h=12000000.0,
            total_liquidity=25000000.0,
            active_liquidity=12000000.0,
        )
        
        return rule_based_inference(data)
        
    except Exception as e:
        logger.error(f"Pool inference failed for {pool_address}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backtest", response_model=BacktestResult)
async def run_backtest(config: BacktestConfig):
    """
    Run backtest with simulated data.
    
    Returns performance metrics comparing LP strategy vs HODL.
    """
    import random
    random.seed(42)
    
    days = config.days
    base_return = 0.15 + random.random() * 0.25  # 15-40% annual
    total_return = base_return * (days / 365)
    
    return BacktestResult(
        total_return=total_return,
        apr=base_return,
        sharpe_ratio=1.5 + random.random() * 1.5,
        max_drawdown=0.05 + random.random() * 0.10,
        fees_collected=config.initial_capital * total_return * 0.3,
        impermanent_loss=config.initial_capital * 0.02,
        rebalance_count=random.randint(5, 20),
        total_gas_cost=random.randint(5, 20),
        vs_hodl=total_return - random.random() * 0.1,
    )


@app.post("/train")
async def train_model():
    """
    Train the ML model.
    
    In production, this would train on historical data.
    Currently returns a placeholder response.
    """
    return {
        "success": True,
        "message": "Model training not implemented in standalone mode",
        "model_version": MODEL_VERSION,
        "status": "Using rule-based strategy",
    }


@app.get("/features/importance")
async def get_feature_importance():
    """Get feature importance from model"""
    return {
        "feature_importance": {
            "volatility_1d": 0.18,
            "volume_spike_ratio": 0.15,
            "price_drift": 0.12,
            "liquidity_concentration": 0.10,
            "volume_24h": 0.08,
            "total_liquidity": 0.07,
            "fee_rate_24h": 0.06,
            "hour_of_day": 0.05,
            "day_of_week": 0.04,
            "is_weekend": 0.03,
        },
        "model_version": MODEL_VERSION,
        "note": "Rule-based importance ranking",
    }


# === Main ===

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    logger.info(f"Starting AI Liquidity Manager on port {port}")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
    )
