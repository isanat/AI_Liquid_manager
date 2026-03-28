"""
Model Quality Validation Framework

Este módulo separa claramente:
1. Bootstrap Model: Modelo treinado com dados sintéticos/regras - OK para desenvolvimento
2. Production Model: Modelo treinado com dados reais - Requer validação rigorosa

Regras de aceite obrigatórias para promover modelo de bootstrap para produção.
"""
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import structlog

logger = structlog.get_logger()


class ModelTier(Enum):
    """Níveis de confiança do modelo"""
    BOOTSTRAP = "bootstrap"      # Treinado com sintéticos/regras
    CANDIDATE = "candidate"      # Treinado com dados reais, em validação
    PRODUCTION = "production"    # Validado e aprovado para produção


class RegimeType(Enum):
    """Tipos de regime de mercado para análise segmentada"""
    TREND_UP = "trend_up"
    TREND_DOWN = "trend_down"
    RANGE = "range"
    HIGH_VOL = "high_vol"
    LOW_VOL = "low_vol"


@dataclass
class AcceptanceThresholds:
    """
    Métricas de aceite obrigatórias por janela temporal.
    
    Um modelo só pode ser promovido a PRODUCTION se passar TODOS os thresholds.
    """
    # ─── Janela 30 dias ─────────────────────────────────────────────────────
    # Mínimo para modelo ser considerado
    window_30d: Dict[str, Tuple[float, float]] = field(default_factory=lambda: {
        'max_drawdown': (0.0, 0.15),      # Max 15% drawdown
        'sharpe_ratio': (0.8, 10.0),      # Min 0.8 Sharpe
        'total_return': (-0.05, 1.0),     # Min -5% return (survival)
        'win_rate': (0.45, 1.0),          # Min 45% win rate
        'turnover_ratio': (0.0, 5.0),     # Max 5x turnover/mês
    })
    
    # ─── Janela 90 dias ─────────────────────────────────────────────────────
    # Médio prazo - mais rigoroso
    window_90d: Dict[str, Tuple[float, float]] = field(default_factory=lambda: {
        'max_drawdown': (0.0, 0.20),      # Max 20% drawdown
        'sharpe_ratio': (1.0, 10.0),      # Min 1.0 Sharpe
        'total_return': (0.02, 1.0),      # Min 2% return
        'win_rate': (0.48, 1.0),          # Min 48% win rate
        'turnover_ratio': (0.0, 4.0),     # Max 4x turnover/mês
        'consistency': (0.5, 1.0),        # Min 50% meses positivos
    })
    
    # ─── Janela 365 dias (1 ano) ─────────────────────────────────────────────
    # Longo prazo - mais rigoroso ainda
    window_365d: Dict[str, Tuple[float, float]] = field(default_factory=lambda: {
        'max_drawdown': (0.0, 0.25),      # Max 25% drawdown
        'sharpe_ratio': (1.2, 10.0),      # Min 1.2 Sharpe
        'total_return': (0.08, 1.0),      # Min 8% return anual
        'win_rate': (0.50, 1.0),          # Min 50% win rate
        'turnover_ratio': (0.0, 3.0),     # Max 3x turnover/mês
        'consistency': (0.60, 1.0),       # Min 60% meses positivos
        'vs_benchmark': (-0.05, 1.0),     # Min -5% vs HODL
    })
    
    # ─── Por Regime de Mercado ───────────────────────────────────────────────
    # Performance mínima em cada regime
    by_regime: Dict[str, Dict[str, Tuple[float, float]]] = field(default_factory=lambda: {
        RegimeType.TREND_UP.value: {
            'return': (0.02, 1.0),        # Min 2% em tendência de alta
            'capture': (0.60, 1.0),       # Capturar 60%+ do movimento
        },
        RegimeType.TREND_DOWN.value: {
            'return': (-0.05, 0.10),      # Max -5% em tendência de baixa
            'protection': (0.80, 1.0),    # Proteger 80%+ do downside
        },
        RegimeType.RANGE.value: {
            'return': (0.01, 0.20),       # Min 1% em range
            'fee_capture': (0.50, 1.0),   # Capturar 50%+ das fees
        },
        RegimeType.HIGH_VOL.value: {
            'max_drawdown': (0.0, 0.15),  # Max 15% dd em alta vol
            'return': (-0.03, 0.10),      # Sobreviver alta vol
        },
        RegimeType.LOW_VOL.value: {
            'return': (0.005, 0.10),      # Min 0.5% em baixa vol
            'turnover': (0.0, 2.0),       # Baixo turnover
        },
    })


@dataclass
class ValidationMetric:
    """Resultado de uma métrica de validação"""
    name: str
    value: float
    min_threshold: float
    max_threshold: float
    passed: bool
    margin: float  # Quão próximo do limite (1.0 = no limite, >1 = passou com folga)
    
    @property
    def status(self) -> str:
        if self.passed:
            if self.margin > 1.5:
                return "✅ PASS (strong)"
            return "✅ PASS"
        else:
            if self.margin > 0.8:
                return "⚠️ FAIL (close)"
            return "❌ FAIL"


@dataclass
class ValidationResult:
    """Resultado completo da validação de um modelo"""
    model_tier: ModelTier
    model_version: str
    timestamp: datetime
    window_days: int
    
    # Métricas gerais
    metrics: List[ValidationMetric] = field(default_factory=list)
    
    # Métricas por regime
    regime_metrics: Dict[str, List[ValidationMetric]] = field(default_factory=dict)
    
    # Resultado final
    all_passed: bool = False
    overall_score: float = 0.0  # 0-100
    
    # Recomendação
    recommendation: str = ""
    can_promote: bool = False
    
    def summary(self) -> str:
        """Retorna resumo legível para logs"""
        lines = [
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"MODEL VALIDATION: {self.model_version}",
            f"Tier: {self.model_tier.value.upper()} | Window: {self.window_days}d",
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ]
        
        # Métricas gerais
        for m in self.metrics:
            lines.append(f"  {m.status:20} {m.name:20} = {m.value:.4f} (lim: {m.min_threshold:.2f}-{m.max_threshold:.2f})")
        
        if self.regime_metrics:
            lines.append(f"───────────────────────────────────────────────────────")
            lines.append(f"  BY REGIME:")
            for regime, metrics in self.regime_metrics.items():
                regime_passed = all(m.passed for m in metrics)
                status = "✅" if regime_passed else "❌"
                lines.append(f"  {status} {regime:15}")
                for m in metrics:
                    lines.append(f"      {m.status:18} {m.name:15} = {m.value:.4f}")
        
        lines.append(f"───────────────────────────────────────────────────────")
        lines.append(f"  OVERALL: {'✅ PASSED' if self.all_passed else '❌ FAILED'} | Score: {self.overall_score:.1f}/100")
        lines.append(f"  {self.recommendation}")
        lines.append(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        return "\n".join(lines)


class ModelValidator:
    """
    Valida modelos de ML para promover de bootstrap para produção.
    
    Uso:
        validator = ModelValidator()
        result = validator.validate(backtest_results, model_version="2.0.0")
        print(result.summary())
        
        if result.can_promote:
            promote_model_to_production(model)
    """
    
    def __init__(self, thresholds: Optional[AcceptanceThresholds] = None):
        self.thresholds = thresholds or AcceptanceThresholds()
    
    def validate(
        self,
        backtest_results,  # BacktestResult do backtester.py
        model_version: str,
        model_tier: ModelTier = ModelTier.BOOTSTRAP,
        regime_breakdown: Optional[Dict[str, Dict]] = None,
    ) -> ValidationResult:
        """
        Valida resultados de backtest contra thresholds.
        
        Args:
            backtest_results: Resultados do backtest
            model_version: Versão do modelo
            model_tier: Nível atual do modelo
            regime_breakdown: Métricas segmentadas por regime (opcional)
        
        Returns:
            ValidationResult com todos os checks
        """
        # Determinar qual janela usar
        window_days = 30  # Default
        if hasattr(backtest_results, 'window_days'):
            window_days = backtest_results.window_days
        
        # Selecionar thresholds apropriados
        if window_days <= 45:
            thresholds_dict = self.thresholds.window_30d
        elif window_days <= 120:
            thresholds_dict = self.thresholds.window_90d
        else:
            thresholds_dict = self.thresholds.window_365d
        
        # Validar métricas gerais
        metrics = self._validate_metrics(backtest_results, thresholds_dict)
        
        # Validar por regime se disponível
        regime_metrics = {}
        if regime_breakdown:
            regime_metrics = self._validate_by_regime(regime_breakdown)
        
        # Calcular score geral
        all_metrics = metrics + [m for rm in regime_metrics.values() for m in rm]
        passed_count = sum(1 for m in all_metrics if m.passed)
        total_count = len(all_metrics)
        overall_score = (passed_count / total_count * 100) if total_count > 0 else 0
        
        # Todos passaram?
        all_passed = all(m.passed for m in metrics)
        if regime_metrics:
            all_passed = all_passed and all(
                all(m.passed for m in rms) 
                for rms in regime_metrics.values()
            )
        
        # Gerar recomendação
        recommendation = self._generate_recommendation(
            model_tier, all_passed, overall_score, metrics
        )
        
        # Pode promover?
        can_promote = all_passed and overall_score >= 70
        
        return ValidationResult(
            model_tier=model_tier,
            model_version=model_version,
            timestamp=datetime.utcnow(),
            window_days=window_days,
            metrics=metrics,
            regime_metrics=regime_metrics,
            all_passed=all_passed,
            overall_score=overall_score,
            recommendation=recommendation,
            can_promote=can_promote,
        )
    
    def _validate_metrics(
        self, 
        results, 
        thresholds: Dict[str, Tuple[float, float]]
    ) -> List[ValidationMetric]:
        """Valida métricas contra thresholds"""
        metrics = []
        
        # Mapear resultados para métricas
        result_values = {
            'max_drawdown': results.max_drawdown,
            'sharpe_ratio': results.sharpe_ratio,
            'total_return': results.total_return,
            'win_rate': self._calculate_win_rate(results),
            'turnover_ratio': self._calculate_turnover(results),
            'consistency': self._calculate_consistency(results),
            'vs_benchmark': results.vs_hodl,
        }
        
        for name, (min_val, max_val) in thresholds.items():
            value = result_values.get(name, 0.0)
            
            # Check se está no range
            passed = min_val <= value <= max_val
            
            # Calcular margem (quão longe do limite)
            if passed:
                # Distância normalizada do limite mais próximo
                range_size = max_val - min_val
                dist_from_min = (value - min_val) / range_size if range_size > 0 else 1
                dist_from_max = (max_val - value) / range_size if range_size > 0 else 1
                margin = 1 + min(dist_from_min, dist_from_max)
            else:
                # Quão longe passou do limite
                if value < min_val:
                    margin = value / min_val if min_val > 0 else 0
                else:
                    margin = max_val / value if value > 0 else 0
            
            metrics.append(ValidationMetric(
                name=name,
                value=value,
                min_threshold=min_val,
                max_threshold=max_val,
                passed=passed,
                margin=margin,
            ))
        
        return metrics
    
    def _validate_by_regime(
        self, 
        regime_breakdown: Dict[str, Dict]
    ) -> Dict[str, List[ValidationMetric]]:
        """Valida métricas por regime de mercado"""
        regime_metrics = {}
        
        for regime, data in regime_breakdown.items():
            thresholds = self.thresholds.by_regime.get(regime, {})
            if not thresholds:
                continue
            
            metrics = []
            for name, (min_val, max_val) in thresholds.items():
                value = data.get(name, 0.0)
                passed = min_val <= value <= max_val
                
                if passed:
                    range_size = max_val - min_val
                    margin = 1 + min(
                        (value - min_val) / range_size if range_size > 0 else 1,
                        (max_val - value) / range_size if range_size > 0 else 1
                    )
                else:
                    margin = 0.5
            
                metrics.append(ValidationMetric(
                    name=name,
                    value=value,
                    min_threshold=min_val,
                    max_threshold=max_val,
                    passed=passed,
                    margin=margin,
                ))
            
            regime_metrics[regime] = metrics
        
        return regime_metrics
    
    def _calculate_win_rate(self, results) -> float:
        """Calcula taxa de trades lucrativos"""
        if not hasattr(results, 'trades') or not results.trades:
            return 0.5  # Unknown
        
        profitable = sum(
            1 for t in results.trades 
            if t.details.get('pnl', 0) > 0
        )
        total = len(results.trades)
        return profitable / total if total > 0 else 0.5
    
    def _calculate_turnover(self, results) -> float:
        """Calcula razão de turnover (rebalances/capital)"""
        if not hasattr(results, 'rebalance_count'):
            return 0.0
        
        # Turnover = rebalances * 2 / capital médio
        # Normalizado para "vezes por mês"
        rebalances = results.rebalance_count
        days = getattr(results, 'window_days', 30)
        monthly_rate = rebalances / (days / 30) if days > 0 else 0
        
        return monthly_rate
    
    def _calculate_consistency(self, results) -> float:
        """Calcula % de períodos com retorno positivo"""
        if not hasattr(results, 'daily_returns') or not results.daily_returns:
            return 0.5
        
        positive = sum(1 for r in results.daily_returns if r > 0)
        total = len(results.daily_returns)
        return positive / total if total > 0 else 0.5
    
    def _generate_recommendation(
        self,
        tier: ModelTier,
        all_passed: bool,
        score: float,
        metrics: List[ValidationMetric],
    ) -> str:
        """Gera recomendação em linguagem natural"""
        if all_passed and score >= 80:
            return "✨ EXCELLENT: Modelo pronto para produção. Promover imediatamente."
        elif all_passed and score >= 70:
            return "✅ APPROVED: Modelo aprovado para produção. Monitorar de perto."
        elif score >= 60:
            failed = [m.name for m in metrics if not m.passed]
            return f"⚠️ CONDITIONAL: Aprovado com ressalvas. Falhas: {', '.join(failed)}"
        elif score >= 40:
            return "🔄 NEEDS WORK: Modelo necessita mais dados/treinamento antes de produção."
        else:
            return "❌ REJECTED: Modelo não atende requisitos mínimos. Não usar em produção."


def validate_model_for_production(
    backtest_results,
    model_version: str,
    current_tier: ModelTier = ModelTier.BOOTSTRAP,
) -> ValidationResult:
    """
    Função de conveniência para validar modelo.
    
    Uso:
        from validation.model_validator import validate_model_for_production
        
        result = validate_model_for_production(backtest_results, "2.0.0")
        print(result.summary())
        
        if result.can_promote:
            print("Modelo aprovado para produção!")
    """
    validator = ModelValidator()
    return validator.validate(
        backtest_results=backtest_results,
        model_version=model_version,
        model_tier=current_tier,
    )
