"""
AI Liquidity Manager - Backtesting Framework

Simulates LP performance with historical data to validate strategies.
"""
import sys
from pathlib import Path

# Ensure ai_engine package root is importable
_ai_engine = str(Path(__file__).resolve().parent.parent)
if _ai_engine not in sys.path:
    sys.path.insert(0, _ai_engine)

import numpy as np
import pandas as pd
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import structlog

from models.types import MarketRegime, StrategyOutput
from models.strategy_model import LiquidityStrategyModel, RuleBasedFallback
from features.feature_engineering import FeatureEngineer, MarketFeatures

logger = structlog.get_logger()


@dataclass
class Position:
    """Simulated LP position"""
    tick_lower: int
    tick_upper: int
    liquidity: float
    token0_amount: float
    token1_amount: float
    fees_earned_0: float
    fees_earned_1: float
    entry_price: float
    entry_time: datetime
    is_active: bool = True


@dataclass
class Trade:
    """Record of a trade/rebalance"""
    timestamp: datetime
    action: str  # 'mint', 'burn', 'collect', 'rebalance'
    gas_cost: float
    slippage_cost: float
    details: Dict = field(default_factory=dict)


@dataclass
class BacktestResult:
    """Results from a backtest run"""
    # Performance metrics
    total_return: float
    apr: float
    sharpe_ratio: float
    max_drawdown: float
    
    # LP specific
    fees_collected: float
    impermanent_loss: float
    rebalance_count: int
    total_gas_cost: float
    total_slippage_cost: float
    
    # Comparison
    hodl_return: float  # Simple hold strategy
    vs_hodl: float  # Outperformance
    
    # Detailed data
    equity_curve: List[float] = field(default_factory=list)
    positions: List[Position] = field(default_factory=list)
    trades: List[Trade] = field(default_factory=list)
    daily_returns: List[float] = field(default_factory=list)


class LiquidityBacktester:
    """
    Backtests LP strategies with realistic assumptions:
    - Gas costs per transaction
    - Slippage on swaps
    - Fee accrual based on volume in range
    - Impermanent loss calculation
    """
    
    # Gas costs (estimated for Arbitrum)
    GAS_COSTS = {
        'mint': 0.10,       # $0.10
        'burn': 0.08,       # $0.08
        'collect': 0.05,    # $0.05
        'swap': 0.03,       # $0.03
    }
    
    def __init__(
        self,
        initial_capital: float = 100_000,
        gas_cost_multiplier: float = 1.0,
        slippage_bps: int = 10,
        max_rebalances_per_day: int = 5,
        fee_tier: int = 3000,  # 0.3%
    ):
        self.initial_capital = initial_capital
        self.gas_cost_multiplier = gas_cost_multiplier
        self.slippage_bps = slippage_bps
        self.max_rebalances_per_day = max_rebalances_per_day
        self.fee_tier = fee_tier
        
        # State
        self.cash = initial_capital
        self.positions: List[Position] = []
        self.trades: List[Trade] = []
        self.equity_curve: List[float] = []
        self.daily_rebalances: Dict[str, int] = {}
        
    def run(
        self,
        price_history: pd.DataFrame,
        model: Optional[LiquidityStrategyModel] = None,
        use_rule_fallback: bool = True,
    ) -> BacktestResult:
        """
        Run backtest with historical price data.
        
        Args:
            price_history: DataFrame with columns:
                - timestamp: datetime
                - price: float
                - volume_24h: float
                - liquidity: float
                - fees_24h: float (optional)
            model: Trained LiquidityStrategyModel (uses rules if None)
            use_rule_fallback: Use rules if model not trained
        
        Returns:
            BacktestResult with performance metrics
        """
        logger.info("Starting backtest", 
                   start=price_history['timestamp'].min(),
                   end=price_history['timestamp'].max(),
                   initial_capital=self.initial_capital)
        
        feature_engineer = FeatureEngineer()
        
        for idx, row in price_history.iterrows():
            timestamp = row['timestamp']
            price = row['price']
            volume_24h = row.get('volume_24h', 0)
            liquidity = row.get('liquidity', 0)
            fees_24h = row.get('fees_24h', 0)
            
            # Update feature history
            feature_engineer.update(
                price=price,
                volume_24h=volume_24h,
                liquidity=liquidity,
                fees_24h=fees_24h,
                timestamp=timestamp,
            )
            
            # Compute features
            features = feature_engineer.compute_features(
                current_price=price,
                current_tick=self._price_to_tick(price),
                total_liquidity=liquidity,
                active_liquidity=liquidity * 0.5,
                volume_1h=volume_24h / 24,
                volume_24h=volume_24h,
                timestamp=timestamp,
            )
            
            # Get strategy output
            if model and model.is_trained:
                output = model.predict(features)
            elif use_rule_fallback:
                output = RuleBasedFallback.predict(features)
            else:
                raise ValueError("No model available and fallback disabled")
            
            # Update positions (accrue fees)
            self._update_positions(price, volume_24h, liquidity)
            
            # Check for rebalance
            date_key = timestamp.strftime('%Y-%m-%d')
            if date_key not in self.daily_rebalances:
                self.daily_rebalances[date_key] = 0
            
            if self.daily_rebalances[date_key] < self.max_rebalances_per_day:
                rebalance_decision = self._should_rebalance(price, features, output)
                if rebalance_decision:
                    self._rebalance(price, output, timestamp)
                    self.daily_rebalances[date_key] += 1
            
            # Record equity
            equity = self._calculate_equity(price)
            self.equity_curve.append(equity)
        
        return self._compute_results(price_history)
    
    def _price_to_tick(self, price: float) -> int:
        """Convert price to tick (assuming 1.0001 tick spacing)"""
        return int(np.log(price) / np.log(1.0001))
    
    def _tick_to_price(self, tick: int) -> float:
        """Convert tick to price"""
        return 1.0001 ** tick
    
    def _update_positions(self, current_price: float, volume_24h: float, total_liquidity: float):
        """
        Update positions with fee accrual.
        
        Fee accrual model:
        - Fees = Volume * Fee Rate * (Position Liquidity / Total Liquidity in Range)
        """
        for pos in self.positions:
            if not pos.is_active:
                continue
            
            # Check if in range
            price_lower = self._tick_to_price(pos.tick_lower)
            price_upper = self._tick_to_price(pos.tick_upper)
            in_range = price_lower <= current_price <= price_upper
            
            if in_range and pos.liquidity > 0:
                # Estimate fee accrual
                # Simplified: assume position captures proportional volume
                volume_in_range = volume_24h * 0.3  # Assume 30% of volume in our range
                fee_rate = self.fee_tier / 1_000_000  # e.g., 3000 -> 0.003
                
                # Our share of liquidity in range
                our_share = min(pos.liquidity / (total_liquidity * 0.5), 1.0)
                
                # Fees earned (in token1 terms)
                fees = volume_in_range * fee_rate * our_share
                pos.fees_earned_1 += fees
    
    def _should_rebalance(
        self, 
        current_price: float, 
        features: MarketFeatures,
        output: StrategyOutput
    ) -> bool:
        """Determine if rebalancing is needed"""
        
        # No active positions - need to deploy
        if not any(p.is_active for p in self.positions):
            return True
        
        # Check if price is outside current range
        for pos in self.positions:
            if not pos.is_active:
                continue
            
            price_lower = self._tick_to_price(pos.tick_lower)
            price_upper = self._tick_to_price(pos.tick_upper)
            
            # Price outside range
            if current_price < price_lower * 0.98 or current_price > price_upper * 1.02:
                return True
            
            # Volatility regime change
            if output.detected_regime == MarketRegime.HIGH_VOL:
                if features.volatility_1d > output.rebalance_threshold:
                    return True
        
        # Time-based rebalance (every 3 days)
        if self.positions:
            oldest = min(p.entry_time for p in self.positions if p.is_active)
            if datetime.utcnow() - oldest > timedelta(days=3):
                return True
        
        return False
    
    def _rebalance(self, price: float, output: StrategyOutput, timestamp: datetime):
        """
        Execute rebalance:
        1. Close existing positions
        2. Calculate new ranges
        3. Open new positions
        """
        gas_cost = 0
        slippage_cost = 0
        
        # Close existing positions
        for pos in self.positions:
            if pos.is_active:
                # Collect fees
                self.cash += pos.fees_earned_1
                pos.fees_earned_1 = 0
                
                # Burn position
                pos.is_active = False
                gas_cost += self.GAS_COSTS['burn'] * self.gas_cost_multiplier
                gas_cost += self.GAS_COSTS['collect'] * self.gas_cost_multiplier
                
                # Return capital (with IL)
                il = self._calculate_il(price, pos.entry_price)
                returned = (pos.token0_amount * price + pos.token1_amount) * (1 - il)
                self.cash += returned
        
        # Calculate new ranges
        tick = self._price_to_tick(price)
        range_width = output.range_width / 100  # Convert to decimal
        tick_spacing = 60  # For 0.3% fee tier
        
        # Core position
        core_pct = output.core_allocation / 100
        core_lower = tick - int(range_width * 10000 / tick_spacing) * tick_spacing
        core_upper = tick + int(range_width * 10000 / tick_spacing) * tick_spacing
        
        capital_core = self.cash * core_pct
        if capital_core > 1000:  # Minimum position size
            pos = Position(
                tick_lower=core_lower,
                tick_upper=core_upper,
                liquidity=capital_core / price,  # Simplified
                token0_amount=capital_core / price * 0.5,
                token1_amount=capital_core * 0.5,
                fees_earned_0=0,
                fees_earned_1=0,
                entry_price=price,
                entry_time=timestamp,
            )
            self.positions.append(pos)
            self.cash -= capital_core
            gas_cost += self.GAS_COSTS['mint'] * self.gas_cost_multiplier
        
        # Defensive position (if significant allocation)
        def_pct = output.defensive_allocation / 100
        capital_def = self.cash * def_pct / (1 - core_pct)
        
        if capital_def > 1000:
            def_lower = tick - int(range_width * 3 * 10000 / tick_spacing) * tick_spacing
            def_upper = tick + int(range_width * 3 * 10000 / tick_spacing) * tick_spacing
            
            pos = Position(
                tick_lower=def_lower,
                tick_upper=def_upper,
                liquidity=capital_def / price,
                token0_amount=capital_def / price * 0.5,
                token1_amount=capital_def * 0.5,
                fees_earned_0=0,
                fees_earned_1=0,
                entry_price=price,
                entry_time=timestamp,
            )
            self.positions.append(pos)
            self.cash -= capital_def
            gas_cost += self.GAS_COSTS['mint'] * self.gas_cost_multiplier
        
        # Record trade
        self.trades.append(Trade(
            timestamp=timestamp,
            action='rebalance',
            gas_cost=gas_cost,
            slippage_cost=slippage_cost,
            details={
                'price': price,
                'range_width': output.range_width,
                'regime': output.detected_regime.value,
            }
        ))
        
        self.cash -= gas_cost
    
    def _calculate_il(self, current_price: float, entry_price: float) -> float:
        """
        Calculate impermanent loss.
        
        IL formula: IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1
        """
        if entry_price <= 0:
            return 0
        
        ratio = current_price / entry_price
        il = 2 * np.sqrt(ratio) / (1 + ratio) - 1
        return abs(il)
    
    def _calculate_equity(self, current_price: float) -> float:
        """Calculate total equity at current prices"""
        equity = self.cash
        
        for pos in self.positions:
            if pos.is_active:
                # Position value
                value = pos.token0_amount * current_price + pos.token1_amount
                
                # Add uncollected fees
                value += pos.fees_earned_1
                
                # Subtract IL
                il = self._calculate_il(current_price, pos.entry_price)
                value *= (1 - il)
                
                equity += value
        
        return equity
    
    def _compute_results(self, price_history: pd.DataFrame) -> BacktestResult:
        """Compute final metrics from backtest"""
        
        equity_arr = np.array(self.equity_curve)
        
        # Basic returns
        total_return = (equity_arr[-1] - self.initial_capital) / self.initial_capital
        
        # Time period
        start_date = price_history['timestamp'].min()
        end_date = price_history['timestamp'].max()
        days = (end_date - start_date).days
        years = max(days / 365, 1/365)
        
        # APR
        apr = (1 + total_return) ** (1 / years) - 1
        
        # Daily returns
        daily_returns = np.diff(equity_arr) / equity_arr[:-1]
        
        # Sharpe ratio (assuming 4% risk-free rate)
        risk_free = 0.04 / 365
        excess_returns = daily_returns - risk_free
        sharpe = np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(365) if np.std(excess_returns) > 0 else 0
        
        # Max drawdown
        peak = np.maximum.accumulate(equity_arr)
        drawdown = (peak - equity_arr) / peak
        max_drawdown = np.max(drawdown)
        
        # HODL comparison
        initial_price = price_history['price'].iloc[0]
        final_price = price_history['price'].iloc[-1]
        hodl_return = (final_price - initial_price) / initial_price
        vs_hodl = total_return - hodl_return
        
        # Fee collection
        total_fees = sum(
            pos.fees_earned_1 for pos in self.positions 
            if not pos.is_active
        )
        # Add fees from active positions
        for pos in self.positions:
            if pos.is_active:
                total_fees += pos.fees_earned_1
        
        # Total IL
        total_il = 0
        for pos in self.positions:
            total_il += self._calculate_il(price_history['price'].iloc[-1], pos.entry_price) * \
                       (pos.token0_amount * price_history['price'].iloc[-1] + pos.token1_amount)
        
        # Costs
        total_gas = sum(t.gas_cost for t in self.trades)
        total_slippage = sum(t.slippage_cost for t in self.trades)
        
        return BacktestResult(
            total_return=total_return,
            apr=apr,
            sharpe_ratio=sharpe,
            max_drawdown=max_drawdown,
            fees_collected=total_fees,
            impermanent_loss=total_il,
            rebalance_count=len([t for t in self.trades if t.action == 'rebalance']),
            total_gas_cost=total_gas,
            total_slippage_cost=total_slippage,
            hodl_return=hodl_return,
            vs_hodl=vs_hodl,
            equity_curve=self.equity_curve,
            positions=self.positions,
            trades=self.trades,
            daily_returns=daily_returns.tolist(),
        )


def generate_synthetic_history(
    days: int = 30,
    start_price: float = 1850,
    volatility: float = 0.04,
    trend: float = 0.0,
) -> pd.DataFrame:
    """
    Generate synthetic price history for testing.
    
    Uses geometric Brownian motion with:
    - Specified daily volatility
    - Optional trend component
    - Realistic volume patterns
    """
    np.random.seed(42)
    
    hours = days * 24
    timestamps = pd.date_range(
        start=datetime.utcnow() - timedelta(days=days),
        periods=hours,
        freq='h'
    )
    
    # Generate prices with GBM
    dt = 1/24  # Hourly
    drift = trend * dt
    diffusion = volatility * np.sqrt(dt)
    
    returns = np.random.normal(drift, diffusion, hours)
    prices = start_price * np.exp(np.cumsum(returns))
    
    # Generate volume (higher during market hours, with occasional spikes)
    base_volume = 15_000_000  # $15M daily volume
    
    volume_pattern = np.zeros(hours)
    for i in range(hours):
        hour_of_day = timestamps[i].hour
        
        # Higher volume during US market hours
        if 14 <= hour_of_day <= 21:  # 9am-4pm EST
            volume_pattern[i] = 1.5
        elif 8 <= hour_of_day <= 14:
            volume_pattern[i] = 1.2
        else:
            volume_pattern[i] = 0.7
        
        # Random spikes
        if np.random.random() < 0.02:
            volume_pattern[i] *= 3
    
    volumes = base_volume * volume_pattern * (0.8 + 0.4 * np.random.random(hours))
    
    # Liquidity (relatively stable)
    liquidity = 25_000_000 * (0.9 + 0.2 * np.random.random(hours))
    
    # Fees (proportional to volume)
    fees = volumes * 0.003  # 0.3% fee tier
    
    return pd.DataFrame({
        'timestamp': timestamps,
        'price': prices,
        'volume_24h': volumes,
        'liquidity': liquidity,
        'fees_24h': fees,
    })


if __name__ == '__main__':
    # Quick test
    print("Running backtest...")
    
    # Generate test data
    history = generate_synthetic_history(days=30, volatility=0.05)
    
    # Run backtest
    backtester = LiquidityBacktester(
        initial_capital=100_000,
        gas_cost_multiplier=1.0,
    )
    
    results = backtester.run(history, use_rule_fallback=True)
    
    print(f"\n=== Backtest Results ===")
    print(f"Total Return: {results.total_return:.2%}")
    print(f"APR: {results.apr:.2%}")
    print(f"Sharpe Ratio: {results.sharpe_ratio:.2f}")
    print(f"Max Drawdown: {results.max_drawdown:.2%}")
    print(f"Fees Collected: ${results.fees_collected:,.2f}")
    print(f"Impermanent Loss: ${results.impermanent_loss:,.2f}")
    print(f"Rebalances: {results.rebalance_count}")
    print(f"Gas Costs: ${results.total_gas_cost:,.2f}")
    print(f"vs HODL: {results.vs_hodl:.2%}")
