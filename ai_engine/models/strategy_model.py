"""
AI Liquidity Manager - LightGBM Strategy Model

This model predicts:
1. Optimal range width (regression)
2. Capital allocation (multi-output regression)
3. Rebalance threshold (regression)
4. Market regime (classification)
"""
import sys
from pathlib import Path as _Path

_ai_engine = str(_Path(__file__).resolve().parent.parent)
if _ai_engine not in sys.path:
    sys.path.insert(0, _ai_engine)

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
        self.alloc_core_model: Optional[lgb.LGBMRegressor] = None
        self.alloc_def_model: Optional[lgb.LGBMRegressor] = None
        self.alloc_opp_model: Optional[lgb.LGBMRegressor] = None
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
            num_leaves=self.config.regime_num_leaves,
            learning_rate=self.config.regime_learning_rate,
            n_estimators=self.config.regime_n_estimators,
            max_depth=self.config.regime_max_depth,
            min_child_samples=5,
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
        self.alloc_core_model = self._create_allocation_model()
        self.alloc_def_model = self._create_allocation_model()
        self.alloc_opp_model = self._create_allocation_model()
        self.regime_model = self._create_regime_model()

        # Split allocation targets into 3 separate 1D arrays
        y_alloc_core = y_allocation[:, 0]
        y_alloc_def = y_allocation[:, 1]
        y_alloc_opp = y_allocation[:, 2]

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Time-series cross-validation (reduce splits for small datasets)
        n_splits = min(self.config.validation_splits, max(2, X.shape[0] // 30))
        tscv = TimeSeriesSplit(n_splits=n_splits)

        metrics = {
            'range_rmse': [],
            'allocation_rmse': [],
            'regime_accuracy': [],
        }

        # Use 80/20 split for validation instead of CV (safer for small datasets)
        split_idx = int(X_scaled.shape[0] * 0.8)
        X_train, X_val = X_scaled[:split_idx], X_scaled[split_idx:]
        y_range_train, y_range_val = y_range[:split_idx], y_range[split_idx:]
        y_regime_train, y_regime_val = y_regime[:split_idx], y_regime[split_idx:]

        # Train range model
        self.range_model.fit(X_train, y_range_train)
        range_pred = self.range_model.predict(X_val)
        metrics['range_rmse'].append(np.sqrt(mean_squared_error(y_range_val, range_pred)))

        # Train 3 allocation models
        alloc_rmses = []
        for model, y_full in [
            (self.alloc_core_model, y_alloc_core),
            (self.alloc_def_model, y_alloc_def),
            (self.alloc_opp_model, y_alloc_opp),
        ]:
            model.fit(X_train, y_full[:split_idx])
            pred = model.predict(X_val)
            alloc_rmses.append(np.sqrt(mean_squared_error(y_full[split_idx:], pred)))
        metrics['allocation_rmse'].append(np.mean(alloc_rmses))

        # Train regime classifier
        y_regime_int = y_regime.astype(np.int32)
        self.regime_model.fit(X_train, y_regime_int[:split_idx])
        regime_pred = self.regime_model.predict(X_val)
        metrics['regime_accuracy'].append(accuracy_score(y_regime_int[split_idx:], regime_pred))

        # Retrain all models on full data for production use
        self.range_model.fit(X_scaled, y_range)
        self.alloc_core_model.fit(X_scaled, y_alloc_core)
        self.alloc_def_model.fit(X_scaled, y_alloc_def)
        self.alloc_opp_model.fit(X_scaled, y_alloc_opp)
        self.regime_model.fit(X_scaled, y_regime_int)
        
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
            ('alloc_core', self.alloc_core_model),
            ('alloc_def', self.alloc_def_model),
            ('alloc_opp', self.alloc_opp_model),
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
        
        # Predict allocation (3 separate models)
        core_alloc = float(np.clip(self.alloc_core_model.predict(X_scaled)[0], 50, 85))
        def_alloc = float(np.clip(self.alloc_def_model.predict(X_scaled)[0], 10, 35))
        opp_alloc = float(np.clip(self.alloc_opp_model.predict(X_scaled)[0], 2, 15))
        
        # Normalize to sum to ~95% (leave 5% cash buffer)
        total = core_alloc + def_alloc + opp_alloc
        core_alloc = (core_alloc / total) * 95
        def_alloc = (def_alloc / total) * 95
        opp_alloc = (opp_alloc / total) * 95
        
        # Predict regime — map model classes back to regime enum
        regime_pred = int(self.regime_model.predict(X_scaled)[0])
        regime_proba = self.regime_model.predict_proba(X_scaled)[0]
        regime_confidence = float(np.max(regime_proba))
        regime_map = {0: MarketRegime.TREND, 1: MarketRegime.RANGE, 2: MarketRegime.HIGH_VOL, 3: MarketRegime.LOW_VOL}
        detected_regime = regime_map.get(regime_pred, MarketRegime.RANGE)
        
        # Calculate confidence based on prediction certainty
        alloc_std = np.std([core_alloc, def_alloc, opp_alloc])
        confidence = regime_confidence * 0.6 + (1 - alloc_std / 100) * 0.4
        
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
        """Save models to disk. Raises RuntimeError on failure to avoid silent partial writes."""
        path.mkdir(parents=True, exist_ok=True)
        try:
            joblib.dump(self.range_model, path / "range_model.joblib")
            joblib.dump(self.alloc_core_model, path / "alloc_core_model.joblib")
            joblib.dump(self.alloc_def_model, path / "alloc_def_model.joblib")
            joblib.dump(self.alloc_opp_model, path / "alloc_opp_model.joblib")
            joblib.dump(self.regime_model, path / "regime_model.joblib")
            joblib.dump(self.scaler, path / "scaler.joblib")
            joblib.dump({
                'feature_importance': self.feature_importance,
                'model_version': self.model_version,
                'config': self.config,
            }, path / "metadata.joblib")
            logger.info("Models saved", path=str(path))
        except Exception as exc:
            raise RuntimeError(f"Failed to save models to {path}: {exc}") from exc

    def load(self, path: Path):
        """Load models from disk. Raises RuntimeError on missing or corrupt files."""
        try:
            self.range_model = joblib.load(path / "range_model.joblib")
            self.alloc_core_model = joblib.load(path / "alloc_core_model.joblib")
            self.alloc_def_model = joblib.load(path / "alloc_def_model.joblib")
            self.alloc_opp_model = joblib.load(path / "alloc_opp_model.joblib")
            self.regime_model = joblib.load(path / "regime_model.joblib")
            self.scaler = joblib.load(path / "scaler.joblib")

            metadata = joblib.load(path / "metadata.joblib")
            self.feature_importance = metadata['feature_importance']
            self.model_version = metadata['model_version']
            self.is_trained = True
            logger.info("Models loaded", path=str(path), version=self.model_version)
        except Exception as exc:
            raise RuntimeError(f"Failed to load models from {path}: {exc}") from exc


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
