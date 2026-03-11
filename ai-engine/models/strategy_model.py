"""
AI Liquidity Manager - LightGBM Strategy Model

This model predicts:
1. Optimal range width (regression)
2. Capital allocation (multi-output regression)
3. Rebalance threshold (regression)
4. Market regime (classification)
"""
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, List
from pathlib import Path
import joblib
import lightgbm as lgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, accuracy_score
import structlog

from models.types import MarketFeatures, StrategyOutput, MarketRegime

logger = structlog.get_logger()


@dataclass
class ModelConfig:
    """Configuration for the LightGBM model"""
    # Range prediction model
    range_num_leaves: int = 31
    range_learning_rate: float = 0.05
    range_n_estimators: int = 200
    range_max_depth: int = 6
    
    # Allocation model
    allocation_num_leaves: int = 31
    allocation_learning_rate: float = 0.05
    allocation_n_estimators: int = 200
    allocation_max_depth: int = 6
    
    # Regime classification model
    regime_num_leaves: int = 15
    regime_learning_rate: float = 0.1
    regime_n_estimators: int = 100
    regime_max_depth: int = 4
    
    # Training
    validation_splits: int = 5
    early_stopping_rounds: int = 20
    
    # Feature engineering
    use_feature_selection: bool = True
    n_top_features: int = 20


class LiquidityStrategyModel:
    """
    Multi-task LightGBM model for liquidity management.
    
    Tasks:
    1. Predict optimal range width based on volatility regime
    2. Predict optimal capital allocation
    3. Classify market regime
    """
    
    FEATURE_NAMES = [
        'price', 'twap_1h', 'twap_24h', 'price_velocity', 'price_acceleration',
        'volatility_1d', 'volatility_7d', 'volatility_30d', 'realized_volatility',
        'parkinson_volatility', 'garman_klass_volatility',
        'volume_1h', 'volume_24h', 'volume_7d_avg', 'volume_spike_ratio', 'volume_trend',
        'total_liquidity', 'active_liquidity', 'liquidity_depth', 'liquidity_concentration',
        'fee_rate_24h', 'fee_rate_7d_avg', 'fee_trend',
        'hour_of_day', 'day_of_week', 'is_weekend',
        'price_drift', 'range_position', 'liquidity_efficiency',
    ]
    
    def __init__(self, config: Optional[ModelConfig] = None):
        self.config = config or ModelConfig()
        self.range_model: Optional[lgb.LGBMRegressor] = None
        self.allocation_model: Optional[lgb.LGBMRegressor] = None
        self.regime_model: Optional[lgb.LGBMClassifier] = None
        self.scaler = StandardScaler()
        self.feature_importance: Dict[str, float] = {}
        self.is_trained = False
        self.model_version = "1.0.0"
        
    def _create_range_model(self) -> lgb.LGBMRegressor:
        """Create the range width prediction model"""
        return lgb.LGBMRegressor(
            objective='regression',
            metric='rmse',
            num_leaves=self.config.range_num_leaves,
            learning_rate=self.config.range_learning_rate,
            n_estimators=self.config.range_n_estimators,
            max_depth=self.config.range_max_depth,
            min_child_samples=20,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=0.1,
            random_state=42,
            verbose=-1,
        )
    
    def _create_allocation_model(self) -> lgb.LGBMRegressor:
        """Create the capital allocation model (multi-output)"""
        return lgb.LGBMRegressor(
            objective='regression',
            metric='rmse',
            num_leaves=self.config.allocation_num_leaves,
            learning_rate=self.config.allocation_learning_rate,
            n_estimators=self.config.allocation_n_estimators,
            max_depth=self.config.allocation_max_depth,
            min_child_samples=20,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=0.1,
            random_state=42,
            verbose=-1,
        )
    
    def _create_regime_model(self) -> lgb.LGBMClassifier:
        """Create the market regime classification model"""
        return lgb.LGBMClassifier(
            objective='multiclass',
            metric='multi_logloss',
            num_class=4,  # trend, range, high-vol, low-vol
            num_leaves=self.config.regime_num_leaves,
            learning_rate=self.config.regime_learning_rate,
            n_estimators=self.config.regime_n_estimators,
            max_depth=self.config.regime_max_depth,
            min_child_samples=20,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=0.1,
            random_state=42,
            verbose=-1,
        )
    
    def train(
        self,
        X: np.ndarray,
        y_range: np.ndarray,
        y_allocation: np.ndarray,
        y_regime: np.ndarray,
    ) -> Dict[str, float]:
        """
        Train all models with time-series cross-validation.
        
        Args:
            X: Feature matrix (n_samples, n_features)
            y_range: Target range widths (n_samples,)
            y_allocation: Target allocations (n_samples, 3) - core, def, opp
            y_regime: Target regimes (n_samples,) - encoded as 0-3
        
        Returns:
            Dictionary of validation metrics
        """
        logger.info("Starting model training", n_samples=X.shape[0])
        
        # Initialize models
        self.range_model = self._create_range_model()
        self.allocation_model = self._create_allocation_model()
        self.regime_model = self._create_regime_model()
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Time-series cross-validation
        tscv = TimeSeriesSplit(n_splits=self.config.validation_splits)
        
        metrics = {
            'range_rmse': [],
            'allocation_rmse': [],
            'regime_accuracy': [],
        }
        
        for fold, (train_idx, val_idx) in enumerate(tscv.split(X_scaled)):
            X_train, X_val = X_scaled[train_idx], X_scaled[val_idx]
            y_range_train, y_range_val = y_range[train_idx], y_range[val_idx]
            y_alloc_train, y_alloc_val = y_allocation[train_idx], y_allocation[val_idx]
            y_regime_train, y_regime_val = y_regime[train_idx], y_regime[val_idx]
            
            # Train range model
            self.range_model.fit(
                X_train, y_range_train,
                eval_set=[(X_val, y_range_val)],
                callbacks=[lgb.early_stopping(self.config.early_stopping_rounds)]
            )
            range_pred = self.range_model.predict(X_val)
            metrics['range_rmse'].append(np.sqrt(mean_squared_error(y_range_val, range_pred)))
            
            # Train allocation model
            self.allocation_model.fit(
                X_train, y_alloc_train,
                eval_set=[(X_val, y_alloc_val)],
                callbacks=[lgb.early_stopping(self.config.early_stopping_rounds)]
            )
            alloc_pred = self.allocation_model.predict(X_val)
            metrics['allocation_rmse'].append(np.sqrt(mean_squared_error(y_alloc_val, alloc_pred)))
            
            # Train regime model
            self.regime_model.fit(
                X_train, y_regime_train,
                eval_set=[(X_val, y_regime_val)],
                callbacks=[lgb.early_stopping(self.config.early_stopping_rounds)]
            )
            regime_pred = self.regime_model.predict(X_val)
            metrics['regime_accuracy'].append(accuracy_score(y_regime_val, regime_pred))
            
            logger.info(f"Fold {fold + 1} completed", 
                       range_rmse=metrics['range_rmse'][-1],
                       regime_acc=metrics['regime_accuracy'][-1])
        
        # Retrain on full data
        self.range_model.fit(X_scaled, y_range)
        self.allocation_model.fit(X_scaled, y_allocation)
        self.regime_model.fit(X_scaled, y_regime)
        
        # Compute feature importance (average across models)
        self._compute_feature_importance()
        
        self.is_trained = True
        
        # Average metrics
        final_metrics = {k: np.mean(v) for k, v in metrics.items()}
        logger.info("Training completed", metrics=final_metrics)
        
        return final_metrics
    
    def _compute_feature_importance(self):
        """Compute aggregated feature importance"""
        importance = {}
        
        for name, model in [
            ('range', self.range_model),
            ('allocation', self.allocation_model),
            ('regime', self.regime_model),
        ]:
            imp = model.feature_importances_
            for i, fname in enumerate(self.FEATURE_NAMES):
                if fname not in importance:
                    importance[fname] = 0
                importance[fname] += imp[i]
        
        # Normalize
        total = sum(importance.values())
        self.feature_importance = {k: v / total for k, v in importance.items()}
    
    def predict(self, features: MarketFeatures) -> StrategyOutput:
        """
        Generate strategy output from market features.
        
        Args:
            features: MarketFeatures dataclass with current market data
        
        Returns:
            StrategyOutput with recommended parameters
        """
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")
        
        # Prepare input
        X = features.to_array().reshape(1, -1)
        X_scaled = self.scaler.transform(X)
        
        # Predict range width
        range_width = float(self.range_model.predict(X_scaled)[0])
        range_width = max(2.0, min(20.0, range_width))  # Clamp to reasonable range
        
        # Predict allocation
        allocation = self.allocation_model.predict(X_scaled)[0]
        core_alloc = float(np.clip(allocation[0], 50, 85))
        def_alloc = float(np.clip(allocation[1], 10, 35))
        opp_alloc = float(np.clip(allocation[2], 2, 15))
        
        # Normalize to sum to ~95% (leave 5% cash buffer)
        total = core_alloc + def_alloc + opp_alloc
        core_alloc = (core_alloc / total) * 95
        def_alloc = (def_alloc / total) * 95
        opp_alloc = (opp_alloc / total) * 95
        
        # Predict regime
        regime_proba = self.regime_model.predict_proba(X_scaled)[0]
        regime_idx = np.argmax(regime_proba)
        regime_confidence = float(regime_proba[regime_idx])
        regimes = [MarketRegime.TREND, MarketRegime.RANGE, MarketRegime.HIGH_VOL, MarketRegime.LOW_VOL]
        detected_regime = regimes[regime_idx]
        
        # Calculate confidence based on prediction certainty
        confidence = regime_confidence * 0.6 + (1 - np.std(allocation) / 100) * 0.4
        
        # Generate reasoning
        reasoning = self._generate_reasoning(features, detected_regime, range_width)
        
        # Rebalance threshold based on volatility
        rebalance_threshold = 0.05 + features.volatility_1d * 0.5
        
        return StrategyOutput(
            range_width=range_width,
            range_bias=features.price_drift * 10,  # Scale drift to bias
            core_allocation=core_alloc,
            defensive_allocation=def_alloc,
            opportunistic_allocation=opp_alloc,
            cash_buffer=5.0,
            rebalance_threshold=rebalance_threshold,
            min_rebalance_interval=15,
            confidence=confidence,
            model_version=self.model_version,
            detected_regime=detected_regime,
            regime_confidence=regime_confidence,
            feature_importance=self.feature_importance,
            reasoning=reasoning,
        )
    
    def _generate_reasoning(
        self, 
        features: MarketFeatures, 
        regime: MarketRegime, 
        range_width: float
    ) -> str:
        """Generate human-readable reasoning for the decision"""
        reasons = []
        
        # Volatility context
        if features.volatility_1d > 0.05:
            reasons.append("High volatility detected")
        elif features.volatility_1d < 0.02:
            reasons.append("Low volatility environment")
        
        # Volume context
        if features.volume_spike_ratio > 2.0:
            reasons.append("significant volume spike")
        
        # Regime context
        regime_reasons = {
            MarketRegime.TREND: "trending market conditions",
            MarketRegime.RANGE: "range-bound market",
            MarketRegime.HIGH_VOL: "high volatility regime",
            MarketRegime.LOW_VOL: "low volatility regime",
        }
        reasons.append(f"Detected {regime_reasons[regime]}")
        
        # Price drift
        if abs(features.price_drift) > 0.005:
            direction = "upward" if features.price_drift > 0 else "downward"
            reasons.append(f"biasing range {direction}")
        
        return ". ".join(reasons[:3]) + "." if reasons else "Standard allocation applied."
    
    def save(self, path: Path):
        """Save models to disk"""
        path.mkdir(parents=True, exist_ok=True)
        
        joblib.dump(self.range_model, path / "range_model.joblib")
        joblib.dump(self.allocation_model, path / "allocation_model.joblib")
        joblib.dump(self.regime_model, path / "regime_model.joblib")
        joblib.dump(self.scaler, path / "scaler.joblib")
        joblib.dump({
            'feature_importance': self.feature_importance,
            'model_version': self.model_version,
            'config': self.config,
        }, path / "metadata.joblib")
        
        logger.info("Models saved", path=str(path))
    
    def load(self, path: Path):
        """Load models from disk"""
        self.range_model = joblib.load(path / "range_model.joblib")
        self.allocation_model = joblib.load(path / "allocation_model.joblib")
        self.regime_model = joblib.load(path / "regime_model.joblib")
        self.scaler = joblib.load(path / "scaler.joblib")
        
        metadata = joblib.load(path / "metadata.joblib")
        self.feature_importance = metadata['feature_importance']
        self.model_version = metadata['model_version']
        self.is_trained = True
        
        logger.info("Models loaded", path=str(path), version=self.model_version)


class RuleBasedFallback:
    """
    Rule-based fallback when ML model is not available.
    Uses simple heuristics based on volatility.
    """
    
    @staticmethod
    def predict(features: MarketFeatures) -> StrategyOutput:
        """Generate strategy using simple rules"""
        
        # Range width based on volatility (k=2)
        range_width = features.volatility_1d * 200  # vol * 2 * 100
        range_width = max(4.0, min(15.0, range_width))
        
        # Allocation based on volatility regime
        if features.volatility_1d > 0.05:
            # High vol - wider ranges, more defensive
            core, defensive, opportunistic = 60, 30, 5
        elif features.volatility_1d < 0.02:
            # Low vol - tight ranges, more opportunistic
            core, defensive, opportunistic = 75, 15, 10
        else:
            # Normal
            core, defensive, opportunistic = 70, 20, 10
        
        # Adjust for volume spike
        if features.volume_spike_ratio > 2.0:
            opportunistic = min(opportunistic + 5, 15)
            core -= 5
        
        # Detect regime
        if abs(features.price_velocity) > 0.005:
            regime = MarketRegime.TREND
        elif features.volatility_1d > 0.05:
            regime = MarketRegime.HIGH_VOL
        elif features.volatility_1d < 0.02:
            regime = MarketRegime.LOW_VOL
        else:
            regime = MarketRegime.RANGE
        
        return StrategyOutput(
            range_width=range_width,
            range_bias=features.price_drift * 10,
            core_allocation=float(core),
            defensive_allocation=float(defensive),
            opportunistic_allocation=float(opportunistic),
            cash_buffer=5.0,
            rebalance_threshold=0.05 + features.volatility_1d * 0.5,
            min_rebalance_interval=15,
            confidence=0.7,  # Lower confidence for rules
            model_version="rule-based-v1",
            detected_regime=regime,
            regime_confidence=0.7,
            reasoning=f"Rule-based decision: {regime.value} regime with {features.volatility_1d:.2%} volatility.",
        )
