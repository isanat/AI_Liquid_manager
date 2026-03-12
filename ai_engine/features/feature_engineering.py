"""
AI Liquidity Manager - Feature Engineering

Converts raw market data into ML features.
"""
import numpy as np
import pandas as pd
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
import structlog

from models.types import MarketFeatures

logger = structlog.get_logger()


@dataclass
class OHLCV:
    """Price candle data"""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class FeatureEngineer:
    """
    Transforms raw market data into features for the ML model.
    
    Handles:
    - Volatility calculations (realized, Parkinson, Garman-Klass)
    - Volume profile analysis
    - Liquidity metrics
    - Time-based features
    """
    
    def __init__(self, lookback_periods: int = 100):
        self.lookback_periods = lookback_periods
        self.price_history: List[OHLCV] = []
        self.volume_history: List[float] = []
        self.liquidity_history: List[float] = []
        self.fee_history: List[float] = []
    
    def update(
        self,
        price: float,
        volume_24h: float,
        liquidity: float,
        fees_24h: float,
        twap_1h: Optional[float] = None,
        twap_24h: Optional[float] = None,
        timestamp: Optional[datetime] = None,
    ):
        """Update with new data point"""
        ts = timestamp or datetime.utcnow()
        
        # Create OHLCV (simplified - in production use real OHLCV)
        if self.price_history:
            last = self.price_history[-1]
            ohlcv = OHLCV(
                timestamp=ts,
                open=last.close,
                high=max(last.close, price),
                low=min(last.close, price),
                close=price,
                volume=volume_24h / 24,  # Hourly volume estimate
            )
        else:
            ohlcv = OHLCV(
                timestamp=ts,
                open=price,
                high=price,
                low=price,
                close=price,
                volume=volume_24h / 24,
            )
        
        self.price_history.append(ohlcv)
        self.volume_history.append(volume_24h)
        self.liquidity_history.append(liquidity)
        self.fee_history.append(fees_24h)
        
        # Keep only lookback period
        if len(self.price_history) > self.lookback_periods:
            self.price_history = self.price_history[-self.lookback_periods:]
            self.volume_history = self.volume_history[-self.lookback_periods:]
            self.liquidity_history = self.liquidity_history[-self.lookback_periods:]
            self.fee_history = self.fee_history[-self.lookback_periods:]
    
    def compute_features(
        self,
        current_price: float,
        current_tick: int,
        total_liquidity: float,
        active_liquidity: float,
        volume_1h: float,
        volume_24h: float,
        twap_1h: Optional[float] = None,
        twap_24h: Optional[float] = None,
        timestamp: Optional[datetime] = None,
    ) -> MarketFeatures:
        """
        Compute all features from current state and history.
        
        Returns:
            MarketFeatures dataclass ready for model input
        """
        ts = timestamp or datetime.utcnow()
        
        # Default TWAPs
        twap_1h = twap_1h or current_price
        twap_24h = twap_24h or current_price
        
        # === Price Features ===
        prices = [c.close for c in self.price_history] if self.price_history else [current_price]
        
        # Price velocity (first derivative)
        price_velocity = self._compute_velocity(prices, periods=min(24, len(prices)))
        
        # Price acceleration (second derivative)
        price_acceleration = self._compute_acceleration(prices, periods=min(24, len(prices)))
        
        # Price drift
        price_drift = (current_price - twap_24h) / twap_24h if twap_24h > 0 else 0
        
        # === Volatility Features ===
        volatility_1d = self._compute_volatility(prices, periods=min(24, len(prices)))
        volatility_7d = self._compute_volatility(prices, periods=min(168, len(prices)))
        volatility_30d = self._compute_volatility(prices, periods=min(720, len(prices)))
        
        realized_volatility = volatility_1d * np.sqrt(365)
        
        # Parkinson volatility (high-low based)
        parkinson_volatility = self._compute_parkinson_volatility()
        
        # Garman-Klass volatility (OHLC based)
        garman_klass_volatility = self._compute_garman_klass_volatility()
        
        # === Volume Features ===
        volume_7d_avg = np.mean(self.volume_history[-168:]) if len(self.volume_history) >= 24 else volume_24h
        volume_spike_ratio = volume_24h / volume_7d_avg if volume_7d_avg > 0 else 1.0
        volume_trend = self._compute_trend(self.volume_history[-24:]) if len(self.volume_history) >= 24 else 0
        
        # === Liquidity Features ===
        liquidity_depth = total_liquidity * 0.3  # Estimate
        liquidity_concentration = active_liquidity / total_liquidity if total_liquidity > 0 else 0.5
        
        # Liquidity efficiency (fees per liquidity)
        if self.fee_history and self.liquidity_history:
            fee_rate_24h = self.fee_history[-1] / self.liquidity_history[-1] if self.liquidity_history[-1] > 0 else 0
            fee_rate_7d_avg = np.mean([f/l for f, l in zip(self.fee_history[-168:], self.liquidity_history[-168:]) if l > 0]) if len(self.fee_history) >= 24 else fee_rate_24h
        else:
            fee_rate_24h = 0
            fee_rate_7d_avg = 0
        
        fee_trend = self._compute_trend(self.fee_history[-24:]) if len(self.fee_history) >= 24 else 0
        liquidity_efficiency = fee_rate_24h * 365 * 100  # Annualized APY %
        
        # === Time Features ===
        hour_of_day = ts.hour
        day_of_week = ts.weekday()
        is_weekend = day_of_week >= 5
        
        # === Derived Features ===
        # Range position (where in recent high-low range)
        if len(prices) >= 24:
            recent_high = max(prices[-24:])
            recent_low = min(prices[-24:])
            price_range = recent_high - recent_low
            range_position = (current_price - recent_low) / price_range if price_range > 0 else 0.5
        else:
            range_position = 0.5
        
        return MarketFeatures(
            price=current_price,
            twap_1h=twap_1h,
            twap_24h=twap_24h,
            price_velocity=price_velocity,
            price_acceleration=price_acceleration,
            volatility_1d=volatility_1d,
            volatility_7d=volatility_7d,
            volatility_30d=volatility_30d,
            realized_volatility=realized_volatility,
            parkinson_volatility=parkinson_volatility,
            garman_klass_volatility=garman_klass_volatility,
            volume_1h=volume_1h,
            volume_24h=volume_24h,
            volume_7d_avg=volume_7d_avg,
            volume_spike_ratio=volume_spike_ratio,
            volume_trend=volume_trend,
            total_liquidity=total_liquidity,
            active_liquidity=active_liquidity,
            liquidity_depth=liquidity_depth,
            liquidity_concentration=liquidity_concentration,
            fee_rate_24h=fee_rate_24h,
            fee_rate_7d_avg=fee_rate_7d_avg,
            fee_trend=fee_trend,
            hour_of_day=hour_of_day,
            day_of_week=day_of_week,
            is_weekend=is_weekend,
            price_drift=price_drift,
            range_position=range_position,
            liquidity_efficiency=liquidity_efficiency,
        )
    
    def _compute_volatility(self, prices: List[float], periods: int) -> float:
        """Compute annualized volatility from returns"""
        if len(prices) < 2:
            return 0.04  # Default 4%
        
        prices_arr = np.array(prices[-periods:])
        returns = np.diff(np.log(prices_arr))
        
        if len(returns) == 0:
            return 0.04
        
        # Annualize (assuming hourly data)
        return float(np.std(returns) * np.sqrt(24 * 365))
    
    def _compute_velocity(self, prices: List[float], periods: int) -> float:
        """Compute price velocity (rate of change)"""
        if len(prices) < 2:
            return 0.0
        
        prices_arr = np.array(prices[-periods:])
        returns = np.diff(np.log(prices_arr))
        
        # Average hourly return
        return float(np.mean(returns))
    
    def _compute_acceleration(self, prices: List[float], periods: int) -> float:
        """Compute price acceleration (change in velocity)"""
        if len(prices) < 3:
            return 0.0
        
        prices_arr = np.array(prices[-periods:])
        returns = np.diff(np.log(prices_arr))
        
        if len(returns) < 2:
            return 0.0
        
        # Second derivative
        acceleration = np.diff(returns)
        return float(np.mean(acceleration))
    
    def _compute_parkinson_volatility(self) -> float:
        """
        Parkinson volatility estimator using high-low prices.
        More efficient than close-to-close for continuous markets.
        """
        if len(self.price_history) < 2:
            return 0.04
        
        hl_ratios = []
        for candle in self.price_history[-24:]:
            if candle.high > 0 and candle.low > 0:
                hl_ratios.append(np.log(candle.high / candle.low))
        
        if not hl_ratios:
            return 0.04
        
        # Parkinson formula
        k = 1 / (4 * np.log(2))
        variance = k * np.mean(np.array(hl_ratios) ** 2)
        
        return float(np.sqrt(variance * 24 * 365))
    
    def _compute_garman_klass_volatility(self) -> float:
        """
        Garman-Klass volatility estimator using OHLC.
        Even more efficient for markets with good OHLC data.
        """
        if len(self.price_history) < 2:
            return 0.04
        
        gk_values = []
        for candle in self.price_history[-24:]:
            if candle.open > 0 and candle.close > 0:
                hl = np.log(candle.high / candle.low)
                co = np.log(candle.close / candle.open)
                gk = 0.5 * hl ** 2 - (2 * np.log(2) - 1) * co ** 2
                gk_values.append(gk)
        
        if not gk_values:
            return 0.04
        
        return float(np.sqrt(np.mean(gk_values) * 24 * 365))
    
    def _compute_trend(self, values: List[float]) -> float:
        """Compute trend direction (-1 to 1)"""
        if len(values) < 2:
            return 0.0
        
        values_arr = np.array(values)
        x = np.arange(len(values_arr))
        
        # Linear regression slope
        slope = np.polyfit(x, values_arr, 1)[0]
        
        # Normalize by average value
        avg = np.mean(values_arr)
        return float(slope / avg) if avg > 0 else 0.0


class DataFetcher:
    """
    Fetches real data from The Graph (Uniswap V3 subgraph).
    Falls back gracefully to defaults when The Graph is unavailable.

    Set THE_GRAPH_API_KEY env var for higher rate limits.
    """

    def __init__(self, rpc_url: str = "", subgraph_url: Optional[str] = None):
        self.rpc_url = rpc_url
        self.feature_engineer = FeatureEngineer()

    async def fetch_pool_state(self, pool_address: str) -> Dict[str, Any]:
        """Fetch current pool state from The Graph."""
        from data.graph_client import fetch_pool_state
        state = await fetch_pool_state(pool_address)
        if state:
            return {
                'pool_address': pool_address,
                'sqrt_price_x96': int(state.get('sqrtPrice', 0)),
                'tick': int(state.get('tick', 0)),
                'liquidity': int(state.get('liquidity', 0)),
                'token0_price': float(state.get('token0Price', 0)),
                'token1_price': float(state.get('token1Price', 0)),
                'tvl_usd': float(state.get('totalValueLockedUSD', 0)),
                'volume_usd': float(state.get('volumeUSD', 0)),
                'fee_tier': int(state.get('feeTier', 3000)),
                'timestamp': datetime.utcnow(),
            }
        # Fallback defaults (data unavailable)
        return {
            'pool_address': pool_address,
            'sqrt_price_x96': 0,
            'tick': 0,
            'liquidity': 0,
            'timestamp': datetime.utcnow(),
        }

    async def fetch_historical_data(
        self,
        pool_address: str,
        hours: int = 168,
    ) -> List[Dict[str, Any]]:
        """Fetch hourly historical snapshots from The Graph."""
        from data.graph_client import fetch_pool_hour_data
        return await fetch_pool_hour_data(pool_address, hours)

    async def get_features(self, pool_address: str) -> MarketFeatures:
        """
        Fetch real pool data from The Graph and compute ML features.
        Falls back to safe defaults if data is unavailable.
        """
        state = await self.fetch_pool_state(pool_address)
        history = await self.fetch_historical_data(pool_address, hours=168)

        price = state.get('token0_price') or 0.0
        tvl = state.get('tvl_usd') or 0.0

        # Feed historical rows into feature history
        for row in history[:-1]:
            p = float(row.get('token0Price', price) or price)
            if p <= 0:
                continue
            v = float(row.get('volumeUSD', 0) or 0)
            liq = float(row.get('tvlUSD', tvl) or tvl)
            fees = float(row.get('feesUSD', 0) or 0)
            ts_unix = int(row.get('periodStartUnix', 0) or 0)
            ts = datetime.fromtimestamp(ts_unix, tz=timezone.utc) if ts_unix else datetime.utcnow()
            self.feature_engineer.update(
                price=p,
                volume_24h=v * 24,   # hourly → daily equivalent
                liquidity=liq,
                fees_24h=fees * 24,
                timestamp=ts,
            )

        # Use latest row for current snapshot
        if history:
            latest = history[-1]
            current_price = float(latest.get('token0Price', price) or price)
            volume_24h = float(latest.get('volumeUSD', 0) or 0) * 24
            fees_24h = float(latest.get('feesUSD', 0) or 0) * 24
            total_liquidity = float(latest.get('tvlUSD', tvl) or tvl)
        else:
            current_price = price or 1850.0
            volume_24h = 12_000_000.0
            fees_24h = 36_000.0
            total_liquidity = tvl or 25_000_000.0

        current_tick = state.get('tick') or 0
        raw_liquidity = state.get('liquidity') or 0
        active_liquidity = float(raw_liquidity) if raw_liquidity else (total_liquidity * 0.5)

        return self.feature_engineer.compute_features(
            current_price=current_price,
            current_tick=current_tick,
            total_liquidity=total_liquidity,
            active_liquidity=active_liquidity,
            volume_1h=volume_24h / 24,
            volume_24h=volume_24h,
        )
