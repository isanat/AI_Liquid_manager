"""
AI Liquidity Manager - Main Entry Point

Run the AI engine as a standalone service.
"""
import os
import asyncio
import argparse
from pathlib import Path

from models.strategy_model import LiquidityStrategyModel, RuleBasedFallback
from features.feature_engineering import FeatureEngineer
from backtesting.backtester import LiquidityBacktester, generate_synthetic_history
import structlog

logger = structlog.get_logger()


def train_model(output_path: str = "models/saved"):
    """Train model with synthetic data"""
    import numpy as np
    
    logger.info("Training model with synthetic data...")
    
    n_samples = 10000
    
    # Generate synthetic training data
    X = np.random.randn(n_samples, 29) * 0.1
    
    # Target 1: Range width
    y_range = 4 + X[:, 5] * 20 + np.random.randn(n_samples) * 2
    y_range = np.clip(y_range, 2, 20)
    
    # Target 2: Allocation
    y_allocation = np.zeros((n_samples, 3))
    for i in range(n_samples):
        vol = X[i, 5]
        if vol > 0.05:
            y_allocation[i] = [60, 30, 5]
        elif vol < -0.05:
            y_allocation[i] = [75, 15, 10]
        else:
            y_allocation[i] = [70, 20, 10]
        y_allocation[i] += np.random.randn(3) * 2
    
    # Target 3: Regime
    y_regime = np.zeros(n_samples)
    for i in range(n_samples):
        velocity = X[i, 3]
        volatility = X[i, 5]
        
        if abs(velocity) > 0.5:
            y_regime[i] = 0
        elif volatility > 0.5:
            y_regime[i] = 2
        elif volatility < -0.5:
            y_regime[i] = 3
        else:
            y_regime[i] = 1
    
    # Train
    model = LiquidityStrategyModel()
    metrics = model.train(X, y_range, y_allocation, y_regime)
    
    # Save
    output = Path(output_path)
    model.save(output)
    
    logger.info("Model trained and saved", 
                output=str(output), 
                metrics=metrics,
                version=model.model_version)
    
    return model, metrics


def run_backtest(days: int = 30, capital: float = 100_000):
    """Run backtest with rule-based strategy"""
    import numpy as np
    
    logger.info("Running backtest...", days=days, capital=capital)
    
    # Generate data
    history = generate_synthetic_history(days=days, volatility=0.05)
    
    # Run backtest
    backtester = LiquidityBacktester(initial_capital=capital)
    results = backtester.run(history, use_rule_fallback=True)
    
    print("\n" + "="*50)
    print("BACKTEST RESULTS")
    print("="*50)
    print(f"Total Return:      {results.total_return:>12.2%}")
    print(f"APR:               {results.apr:>12.2%}")
    print(f"Sharpe Ratio:      {results.sharpe_ratio:>12.2f}")
    print(f"Max Drawdown:      {results.max_drawdown:>12.2%}")
    print("-"*50)
    print(f"Fees Collected:    ${results.fees_collected:>10,.2f}")
    print(f"Impermanent Loss:  ${results.impermanent_loss:>10,.2f}")
    print(f"Rebalances:        {results.rebalance_count:>12}")
    print(f"Gas Costs:         ${results.total_gas_cost:>10,.2f}")
    print("-"*50)
    print(f"HODL Return:       {results.hodl_return:>12.2%}")
    print(f"vs HODL:           {results.vs_hodl:>12.2%}")
    print("="*50 + "\n")
    
    return results


def test_inference():
    """Test inference with sample data"""
    from models.types import MarketFeatures
    
    logger.info("Testing inference...")
    
    # Create sample features
    features = MarketFeatures(
        price=1850.0,
        twap_1h=1848.0,
        twap_24h=1845.0,
        price_velocity=0.001,
        price_acceleration=0.0001,
        volatility_1d=0.035,
        volatility_7d=0.042,
        volatility_30d=0.038,
        realized_volatility=0.35,
        parkinson_volatility=0.32,
        garman_klass_volatility=0.33,
        volume_1h=500_000,
        volume_24h=12_000_000,
        volume_7d_avg=10_000_000,
        volume_spike_ratio=1.2,
        volume_trend=0.05,
        total_liquidity=25_000_000,
        active_liquidity=12_000_000,
        liquidity_depth=8_000_000,
        liquidity_concentration=0.5,
        fee_rate_24h=0.0003,
        fee_rate_7d_avg=0.00028,
        fee_trend=0.02,
        hour_of_day=14,
        day_of_week=2,
        is_weekend=False,
        price_drift=0.002,
        range_position=0.55,
        liquidity_efficiency=28.5,
    )
    
    # Try to load model
    model_path = Path("models/saved")
    if model_path.exists():
        model = LiquidityStrategyModel()
        model.load(model_path)
        output = model.predict(features)
        logger.info("Model inference complete", model_version=model.model_version)
    else:
        output = RuleBasedFallback.predict(features)
        logger.info("Rule-based fallback used")
    
    print("\n" + "="*50)
    print("INFERENCE OUTPUT")
    print("="*50)
    print(f"Range Width:       ±{output.range_width:.1f}%")
    print(f"Range Bias:        {output.range_bias:>10.2f}")
    print(f"Rebalance Thresh:  {output.rebalance_threshold:>10.2f}")
    print("-"*50)
    print(f"Core Alloc:        {output.core_allocation:>10.1f}%")
    print(f"Defensive Alloc:   {output.defensive_allocation:>10.1f}%")
    print(f"Opportunistic:     {output.opportunistic_allocation:>10.1f}%")
    print(f"Cash Buffer:       {output.cash_buffer:>10.1f}%")
    print("-"*50)
    print(f"Detected Regime:   {output.detected_regime.value:>12}")
    print(f"Regime Confidence: {output.regime_confidence:>12.1%}")
    print(f"Overall Confidence:{output.confidence:>12.1%}")
    print("-"*50)
    print(f"Reasoning: {output.reasoning}")
    print("="*50 + "\n")
    
    return output


def main():
    parser = argparse.ArgumentParser(description="AI Liquidity Manager")
    parser.add_argument("command", choices=["train", "backtest", "inference", "all"],
                       help="Command to run")
    parser.add_argument("--days", type=int, default=30, help="Backtest days")
    parser.add_argument("--capital", type=float, default=100_000, help="Initial capital")
    parser.add_argument("--output", default="models/saved", help="Model output path")
    
    args = parser.parse_args()
    
    if args.command == "train":
        train_model(args.output)
    
    elif args.command == "backtest":
        run_backtest(args.days, args.capital)
    
    elif args.command == "inference":
        test_inference()
    
    elif args.command == "all":
        print("\n" + "="*60)
        print("AI LIQUIDITY MANAGER - FULL TEST")
        print("="*60 + "\n")
        
        train_model(args.output)
        run_backtest(args.days, args.capital)
        test_inference()
        
        print("\n✅ All tests completed successfully!")


if __name__ == "__main__":
    main()
