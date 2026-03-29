"""
AI Liquidity Manager - Core Types and Configurations
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from datetime import datetime
import numpy as np
from pydantic import BaseModel


class MarketRegime(str, Enum):
    TREND = "trend"
    RANGE = "range"
    HIGH_VOL = "high-vol"
    LOW_VOL = "low-vol"


class RiskLevel(str, Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


@dataclass
class MarketFeatures:
    """Input features for the ML model"""
    # Price features
    price: float
    twap_1h: float
    twap_24h: float
    price_velocity: float  # Rate of change
    price_acceleration: float  # Second derivative
    
    # Volatility features
    volatility_1d: float
    volatility_7d: float
    volatility_30d: float
    realized_volatility: float
    parkinson_volatility: float  # High-low based
    garman_klass_volatility: float  # OHLC based
    
    # Volume features
    volume_1h: float
    volume_24h: float
    volume_7d_avg: float
    volume_spike_ratio: float  # Current vs avg
    volume_trend: float  # Increasing/decreasing
    
    # Liquidity features
    total_liquidity: float
    active_liquidity: float
    liquidity_depth: float
    liquidity_concentration: float  # How concentrated around current price
    
    # Fee features
    fee_rate_24h: float
    fee_rate_7d_avg: float
    fee_trend: float
    
    # Time features
    hour_of_day: int
    day_of_week: int
    is_weekend: bool
    
    # Derived features
    price_drift: float  # Trend direction
    range_position: float  # Where in recent range (0-1)
    liquidity_efficiency: float  # Fees per liquidity
    
    def to_array(self) -> np.ndarray:
        """Convert to numpy array for model input"""
        return np.array([
            self.price,
            self.twap_1h,
            self.twap_24h,
            self.price_velocity,
            self.price_acceleration,
            self.volatility_1d,
            self.volatility_7d,
            self.volatility_30d,
            self.realized_volatility,
            self.parkinson_volatility,
            self.garman_klass_volatility,
            self.volume_1h,
            self.volume_24h,
            self.volume_7d_avg,
            self.volume_spike_ratio,
            self.volume_trend,
            self.total_liquidity,
            self.active_liquidity,
            self.liquidity_depth,
            self.liquidity_concentration,
            self.fee_rate_24h,
            self.fee_rate_7d_avg,
            self.fee_trend,
            self.hour_of_day,
            self.day_of_week,
            float(self.is_weekend),
            self.price_drift,
            self.range_position,
            self.liquidity_efficiency,
        ])


@dataclass
class StrategyOutput:
    """Output from the AI model"""
    # Range parameters
    range_width: float  # ± percentage
    range_bias: float  # -1 to 1 (downward to upward bias)
    
    # Allocation
    core_allocation: float  # 60-80%
    defensive_allocation: float  # 10-30%
    opportunistic_allocation: float  # 2-10%
    cash_buffer: float  # ~5%
    
    # Rebalance parameters
    rebalance_threshold: float  # Score threshold
    min_rebalance_interval: int  # Minutes
    
    # Confidence
    confidence: float  # 0-1
    model_version: str
    
    # Regime
    detected_regime: MarketRegime
    regime_confidence: float
    
    # Reasoning
    feature_importance: dict = field(default_factory=dict)
    reasoning: str = ""


@dataclass
class RebalanceDecision:
    """Decision on whether to rebalance"""
    should_rebalance: bool
    score: float
    components: dict  # Individual score components
    recommended_action: str
    urgency: str  # low, medium, high


class Position(BaseModel):
    """LP Position representation"""
    position_id: str
    pool_address: str
    token0: str
    token1: str
    tick_lower: int
    tick_upper: int
    liquidity: int
    in_range: bool
    fees_earned_0: float
    fees_earned_1: float
    created_at: datetime
    last_rebalance: datetime


class PoolState(BaseModel):
    """Current pool state"""
    pool_address: str
    token0: str
    token1: str
    fee_tier: int
    sqrt_price_x96: int
    tick: int
    liquidity: int
    tvl_usd: float
    volume_24h: float
    fees_24h: float
    timestamp: datetime


# API Models
class InferenceRequest(BaseModel):
    """Request for AI inference"""
    pool_address: str
    features: Optional[dict] = None  # If None, fetch from data layer


class InferenceResponse(BaseModel):
    """Response from AI inference"""
    success: bool
    output: Optional[StrategyOutput] = None
    features_used: Optional[dict] = None
    error: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)


class BacktestConfig(BaseModel):
    """Configuration for backtesting"""
    start_date: datetime
    end_date: datetime
    initial_capital: float
    pool_address: str
    rebalance_interval_minutes: int = 15
    max_rebalances_per_day: int = 5
    gas_cost_usd: float = 5.0
    slippage_bps: int = 10
