"""
Risk Configuration - Shared Parameters

Este módulo garante que backtest e execução real usem os MESMOS parâmetros.
Qualquer discrepância causa expectativas irreais e perdas financeiras.

USO:
    from risk.risk_config import RiskConfig

    # No backtest
    config = RiskConfig.load()
    backtester = LiquidityBacktester(
        gas_cost_multiplier=config.gas_cost_multiplier,
        slippage_bps=config.slippage_bps,
        max_rebalances_per_day=config.max_rebalances_per_day,
        fee_tier=config.fee_tier,
    )

    # No keeper
    if not config.can_rebalance(today_count, current_volatility):
        logger.warn("Rebalance blocked by risk config")
        return
"""
import os
import json
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum
import structlog

logger = structlog.get_logger()


class FeeTier(Enum):
    """Uniswap V3 fee tiers"""
    TIER_005 = 500     # 0.05% - stable pairs
    TIER_030 = 3000    # 0.30% - most pairs
    TIER_100 = 10000   # 1.00% - exotic pairs


@dataclass
class GasCosts:
    """
    Gas costs em USD (Arbitrum One).

    Valores baseados em médias de 2024-2025.
    Multiplicador aplica-se para conservadorismo.
    """
    mint: float = 0.12        # $0.12 - adicionar liquidez
    burn: float = 0.10        # $0.10 - remover liquidez
    collect: float = 0.06     # $0.06 - coletar fees
    swap: float = 0.04        # $0.04 - swap interno
    rebalance_full: float = 0.35  # $0.35 - rebalance completo (burn + mint + collect)

    def total_for_rebalance(self, include_collect: bool = True) -> float:
        """Custo total de um rebalance"""
        total = self.rebalance_full
        if include_collect:
            total += self.collect
        return total


@dataclass
class SharedParameters:
    """
    Parâmetros que DEVEM ser idênticos entre backtest e produção.

    ALTERAR QUALQUER PARÂMETRO AQUI REQUER:
    1. Atualizar no Coolify (variáveis de ambiente)
    2. Atualizar no código de backtest
    3. Rodar novo backtest para validar
    4. Documentar no changelog
    """

    # ─── Pool e Fee Tier ───────────────────────────────────────────────────────
    fee_tier: int = 500  # 0.05% pool (WETH/USDC on Arbitrum)
    tick_spacing: int = 10  # Matches 0.05% fee tier

    # ─── Custos de Transação ───────────────────────────────────────────────────
    gas_costs: GasCosts = field(default_factory=GasCosts)
    gas_cost_multiplier: float = 1.5  # 50% margem de segurança
    slippage_bps: int = 10  # 0.10% slippage esperado

    # ─── Limites de Frequência ─────────────────────────────────────────────────
    max_rebalances_per_day: int = 3
    min_time_between_rebalances_minutes: int = 60  # 1 hora mínimo

    # ─── Range Management ──────────────────────────────────────────────────────
    default_range_width_pct: float = 6.0  # +/- 6% do preço atual
    max_range_width_pct: float = 15.0     # Limite máximo
    min_range_width_pct: float = 2.0      # Limite mínimo

    # ─── Allocation ────────────────────────────────────────────────────────────
    default_deploy_pct: float = 80.0  # 80% do idle deployado
    min_position_size_usd: float = 100.0  # Mínimo $100 por posição
    max_single_position_pct: float = 50.0  # Max 50% do capital em uma posição

    # ─── Custos Reais (para validação) ─────────────────────────────────────────
    # Estes devem ser medidos em produção e comparados com backtest
    measured_gas_costs: Dict[str, float] = field(default_factory=dict)
    measured_slippage_bps: float = 0.0


@dataclass
class VolatilityThresholds:
    """Limites de volatilidade para circuit breakers"""
    # Pausar operações se volatilidade exceder
    pause_threshold_1d: float = 0.15    # 15% em 1 dia = pausar
    pause_threshold_7d: float = 0.25    # 25% em 7 dias = pausar

    # Warning levels (não pausa, mas loga)
    warning_threshold_1d: float = 0.10  # 10% = warning
    warning_threshold_7d: float = 0.18  # 18% = warning

    # Volatilidade alta = ranges mais amplos
    high_vol_regime_threshold: float = 0.08  # 8% = regime de alta vol


@dataclass
class RiskConfig:
    """
    Configuração completa de risco.

    Carregada de variáveis de ambiente ou arquivo de config.
    Única fonte de verdade para backtest e produção.
    """
    shared: SharedParameters = field(default_factory=SharedParameters)
    volatility: VolatilityThresholds = field(default_factory=VolatilityThresholds)

    # ─── Metadados ─────────────────────────────────────────────────────────────
    config_version: str = "1.0.0"
    last_updated: str = ""
    environment: str = "development"

    @classmethod
    def load(cls, env_prefix: str = "RISK_") -> 'RiskConfig':
        """
        Carrega configuração de variáveis de ambiente.

        Variáveis suportadas:
            RISK_FEE_TIER=500
            RISK_MAX_REBALANCES_PER_DAY=3
            RISK_GAS_COST_MULTIPLIER=1.5
            RISK_SLIPPAGE_BPS=10
            RISK_DEFAULT_RANGE_WIDTH_PCT=6.0
            RISK_DEFAULT_DEPLOY_PCT=80.0
            RISK_PAUSE_THRESHOLD_1D=0.15
        """
        def get_float(key: str, default: float) -> float:
            val = os.getenv(f"{env_prefix}{key}")
            return float(val) if val else default

        def get_int(key: str, default: int) -> int:
            val = os.getenv(f"{env_prefix}{key}")
            return int(val) if val else default

        shared = SharedParameters(
            fee_tier=get_int("FEE_TIER", 500),
            tick_spacing=get_int("TICK_SPACING", 10),
            gas_cost_multiplier=get_float("GAS_COST_MULTIPLIER", 1.5),
            slippage_bps=get_int("SLIPPAGE_BPS", 10),
            max_rebalances_per_day=get_int("MAX_REBALANCES_PER_DAY", 3),
            min_time_between_rebalances_minutes=get_int("MIN_TIME_BETWEEN_REBALANCES_MINUTES", 60),
            default_range_width_pct=get_float("DEFAULT_RANGE_WIDTH_PCT", 6.0),
            max_range_width_pct=get_float("MAX_RANGE_WIDTH_PCT", 15.0),
            min_range_width_pct=get_float("MIN_RANGE_WIDTH_PCT", 2.0),
            default_deploy_pct=get_float("DEFAULT_DEPLOY_PCT", 80.0),
            min_position_size_usd=get_float("MIN_POSITION_SIZE_USD", 100.0),
            max_single_position_pct=get_float("MAX_SINGLE_POSITION_PCT", 50.0),
        )

        volatility = VolatilityThresholds(
            pause_threshold_1d=get_float("PAUSE_THRESHOLD_1D", 0.15),
            pause_threshold_7d=get_float("PAUSE_THRESHOLD_7D", 0.25),
            warning_threshold_1d=get_float("WARNING_THRESHOLD_1D", 0.10),
            warning_threshold_7d=get_float("WARNING_THRESHOLD_7D", 0.18),
            high_vol_regime_threshold=get_float("HIGH_VOL_REGIME_THRESHOLD", 0.08),
        )

        config = cls(
            shared=shared,
            volatility=volatility,
            last_updated=datetime.utcnow().isoformat(),
            environment=os.getenv("NODE_ENV", "development"),
        )

        logger.info("Risk config loaded",
                   fee_tier=shared.fee_tier,
                   max_rebalances=shared.max_rebalances_per_day,
                   gas_multiplier=shared.gas_cost_multiplier,
                   slippage_bps=shared.slippage_bps,
                   environment=config.environment)

        return config

    def to_json(self) -> str:
        """Exporta config para JSON (para auditoria)"""
        data = {
            'config_version': self.config_version,
            'last_updated': self.last_updated,
            'environment': self.environment,
            'shared': asdict(self.shared),
            'volatility': asdict(self.volatility),
        }
        # Handle nested GasCosts dataclass
        data['shared']['gas_costs'] = asdict(self.shared.gas_costs)
        return json.dumps(data, indent=2)

    def validate_consistency(self, other: 'RiskConfig') -> List[str]:
        """
        Compara duas configs e retorna discrepâncias.

        Uso: Validar que config do backtest = config de produção
        """
        discrepancies = []

        if self.shared.fee_tier != other.shared.fee_tier:
            discrepancies.append(
                f"Fee tier mismatch: backtest={self.shared.fee_tier}, "
                f"production={other.shared.fee_tier}"
            )

        if self.shared.max_rebalances_per_day != other.shared.max_rebalances_per_day:
            discrepancies.append(
                f"Max rebalances mismatch: backtest={self.shared.max_rebalances_per_day}, "
                f"production={other.shared.max_rebalances_per_day}"
            )

        if self.shared.gas_cost_multiplier != other.shared.gas_cost_multiplier:
            discrepancies.append(
                f"Gas multiplier mismatch: backtest={self.shared.gas_cost_multiplier}, "
                f"production={other.shared.gas_cost_multiplier}"
            )

        if self.shared.slippage_bps != other.shared.slippage_bps:
            discrepancies.append(
                f"Slippage mismatch: backtest={self.shared.slippage_bps}bps, "
                f"production={other.shared.slippage_bps}bps"
            )

        return discrepancies

    def can_rebalance(
        self,
        today_count: int,
        current_volatility_1d: float,
        last_rebalance_minutes_ago: int,
    ) -> tuple[bool, str]:
        """
        Verifica se rebalance é permitido.

        Returns:
            (can_rebalance: bool, reason: str)
        """
        # Check count limit
        if today_count >= self.shared.max_rebalances_per_day:
            return False, f"Max rebalances per day reached ({today_count}/{self.shared.max_rebalances_per_day})"

        # Check time since last
        if last_rebalance_minutes_ago < self.shared.min_time_between_rebalances_minutes:
            return False, f"Too soon since last rebalance ({last_rebalance_minutes_ago}min < {self.shared.min_time_between_rebalances_minutes}min)"

        # Check volatility
        if current_volatility_1d > self.volatility.pause_threshold_1d:
            return False, f"Volatility too high ({current_volatility_1d:.1%} > {self.volatility.pause_threshold_1d:.1%})"

        return True, "OK"

    def get_adjusted_gas_cost(self, operation: str) -> float:
        """Retorna custo de gas ajustado pelo multiplicador"""
        base_cost = getattr(self.shared.gas_costs, operation, 0.1)
        return base_cost * self.shared.gas_cost_multiplier

    def validate_range_width(self, proposed_width_pct: float) -> float:
        """Clampa range width aos limites configurados"""
        return max(
            self.shared.min_range_width_pct,
            min(self.shared.max_range_width_pct, proposed_width_pct)
        )

    def validate_deploy_amount(
        self,
        idle_amount: float,
        proposed_deploy: float,
        current_total_deployed: float,
        total_capital: float,
    ) -> tuple[float, str]:
        """
        Valida e ajusta valor a ser deployado.

        Returns:
            (adjusted_amount: float, reason: str)
        """
        # Não pode exceder idle
        if proposed_deploy > idle_amount:
            proposed_deploy = idle_amount

        # Respeitar deploy_pct
        max_deploy = idle_amount * (self.shared.default_deploy_pct / 100)
        if proposed_deploy > max_deploy:
            proposed_deploy = max_deploy

        # Verificar limite de posição única
        if proposed_deploy > total_capital * (self.shared.max_single_position_pct / 100):
            proposed_deploy = total_capital * (self.shared.max_single_position_pct / 100)

        # Mínimo
        if proposed_deploy < self.shared.min_position_size_usd:
            return 0, f"Amount below minimum position size (${proposed_deploy:.0f} < ${self.shared.min_position_size_usd:.0f})"

        return proposed_deploy, "OK"


# Configuração global (carregada na inicialização)
_global_config: Optional[RiskConfig] = None


def get_risk_config() -> RiskConfig:
    """Retorna config global, carregando se necessário"""
    global _global_config
    if _global_config is None:
        _global_config = RiskConfig.load()
    return _global_config


def reset_risk_config():
    """Reset config global (para testes)"""
    global _global_config
    _global_config = None
