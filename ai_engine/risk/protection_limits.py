"""
Protection Limits - Circuit Breakers e Limites de Proteção

Implementa limites explícitos para proteger contra:
- Excesso de operações (custos de gas)
- Volatilidade extrema (perdas de IL)
- Exposição descontrolada (risco de capital)

Estes limites são HARD LIMITS - não podem ser bypassados sem intervenção manual.
"""
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from enum import Enum
from collections import defaultdict
import structlog

from .risk_config import get_risk_config, RiskConfig

logger = structlog.get_logger()


class LimitType(Enum):
    """Tipos de limites de proteção"""
    REBALANCE_COUNT = "rebalance_count"
    TIME_INTERVAL = "time_interval"
    VOLATILITY = "volatility"
    EXPOSURE = "exposure"
    CAPITAL_LOSS = "capital_loss"
    GAS_COST = "gas_cost"


class LimitAction(Enum):
    """Ações quando limite é atingido"""
    WARN = "warn"          # Log warning, permite operação
    BLOCK = "block"        # Bloqueia operação
    PAUSE = "pause"        # Pausa vault completamente
    ALERT = "alert"        # Envia alerta externo


@dataclass
class LimitBreach:
    """Registro de violação de limite"""
    limit_type: LimitType
    action_taken: LimitAction
    timestamp: datetime
    value: float
    threshold: float
    message: str
    vault_address: Optional[str] = None


@dataclass
class DailyStats:
    """Estatísticas diárias por vault"""
    date: str
    rebalance_count: int = 0
    total_gas_spent: float = 0.0
    total_deployed: float = 0.0
    total_collected: float = 0.0
    capital_start: float = 0.0
    capital_end: float = 0.0
    max_drawdown: float = 0.0
    last_rebalance_time: Optional[datetime] = None


@dataclass
class ProtectionLimits:
    """
    Limites de proteção explícitos.

    Estes limites são salvos em disco para persistência entre restarts.
    """
    # ─── Limites de Frequência ────────────────────────────────────────────────
    max_rebalances_per_day: int = 3
    min_minutes_between_rebalances: int = 60

    # ─── Limites de Volatilidade ──────────────────────────────────────────────
    volatility_pause_threshold_1d: float = 0.15    # 15% = pausar
    volatility_pause_threshold_7d: float = 0.25    # 25% = pausar
    volatility_warning_threshold_1d: float = 0.10  # 10% = warning

    # ─── Limites de Exposição ─────────────────────────────────────────────────
    max_exposure_per_cycle_pct: float = 50.0    # Max 50% do idle por ciclo
    max_total_exposure_pct: float = 90.0        # Max 90% do TVL deployado
    min_cash_buffer_pct: float = 10.0           # Min 10% em cash

    # ─── Limites de Perda ─────────────────────────────────────────────────────
    max_daily_loss_pct: float = 5.0             # 5% perda diária = pausar
    max_weekly_loss_pct: float = 10.0           # 10% perda semanal = pausar
    max_gas_cost_per_day_pct: float = 1.0       # Max 1% do TVL em gas/dia

    # ─── Estado (persistido) ──────────────────────────────────────────────────
    daily_stats: Dict[str, DailyStats] = field(default_factory=dict)
    breach_history: List[LimitBreach] = field(default_factory=list)
    paused_vaults: Dict[str, str] = field(default_factory=dict)  # vault -> reason
    last_reset_date: str = ""

    def __post_init__(self):
        self._check_daily_reset()

    def _check_daily_reset(self):
        """Reseta contadores diários se mudou o dia"""
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        if self.last_reset_date != today:
            logger.info("Protection limits: daily reset", date=today)

            # Arquivar stats do dia anterior
            for vault, stats in self.daily_stats.items():
                stats.capital_end = 0  # Será atualizado no próximo ciclo
                # Manter stats para histórico

            # Limpar paused vaults antigos (exceto os com pausa permanente)
            self.paused_vaults = {
                v: r for v, r in self.paused_vaults.items()
                if "permanent" in r.lower()
            }

            self.last_reset_date = today

    def get_or_create_stats(self, vault_address: str) -> DailyStats:
        """Retorna stats do dia para um vault"""
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        key = f"{vault_address}:{today}"

        if key not in self.daily_stats:
            self.daily_stats[key] = DailyStats(date=today)

        return self.daily_stats[key]

    def record_rebalance(
        self,
        vault_address: str,
        gas_cost: float,
        amount_deployed: float,
    ):
        """Registra um rebalance para tracking de limites"""
        stats = self.get_or_create_stats(vault_address)
        stats.rebalance_count += 1
        stats.total_gas_spent += gas_cost
        stats.total_deployed += amount_deployed
        stats.last_rebalance_time = datetime.now(timezone.utc)

        logger.info("Protection: rebalance recorded",
                   vault=vault_address[:10],
                   count=stats.rebalance_count,
                   gas=gas_cost,
                   deployed=amount_deployed)

    def check_limits(
        self,
        vault_address: str,
        current_volatility_1d: float,
        current_volatility_7d: float,
        current_tvl: float,
        idle_amount: float,
        proposed_deploy: float,
    ) -> Tuple[bool, List[LimitBreach]]:
        """
        Verifica todos os limites antes de uma operação.

        Returns:
            (allowed: bool, breaches: List[LimitBreach])
        """
        self._check_daily_reset()

        breaches = []
        stats = self.get_or_create_stats(vault_address)

        # ─── Check: Vault pausado ─────────────────────────────────────────────

        if vault_address in self.paused_vaults:
            breach = LimitBreach(
                limit_type=LimitType.CAPITAL_LOSS,  # Reusing for pause
                action_taken=LimitAction.BLOCK,
                timestamp=datetime.now(timezone.utc),
                value=0,
                threshold=0,
                message=f"Vault paused: {self.paused_vaults[vault_address]}",
                vault_address=vault_address,
            )
            breaches.append(breach)
            return False, breaches

        # ─── Check: Rebalance count ───────────────────────────────────────────

        if stats.rebalance_count >= self.max_rebalances_per_day:
            breach = LimitBreach(
                limit_type=LimitType.REBALANCE_COUNT,
                action_taken=LimitAction.BLOCK,
                timestamp=datetime.now(timezone.utc),
                value=stats.rebalance_count,
                threshold=self.max_rebalances_per_day,
                message=f"Max rebalances reached: {stats.rebalance_count}/{self.max_rebalances_per_day}",
                vault_address=vault_address,
            )
            breaches.append(breach)

        # ─── Check: Time interval ─────────────────────────────────────────────

        if stats.last_rebalance_time:
            minutes_ago = (datetime.now(timezone.utc) - stats.last_rebalance_time).total_seconds() / 60
            if minutes_ago < self.min_minutes_between_rebalances:
                breach = LimitBreach(
                    limit_type=LimitType.TIME_INTERVAL,
                    action_taken=LimitAction.BLOCK,
                    timestamp=datetime.now(timezone.utc),
                    value=minutes_ago,
                    threshold=self.min_minutes_between_rebalances,
                    message=f"Too soon: {minutes_ago:.0f}min < {self.min_minutes_between_rebalances}min required",
                    vault_address=vault_address,
                )
                breaches.append(breach)

        # ─── Check: Volatility ────────────────────────────────────────────────

        if current_volatility_1d > self.volatility_pause_threshold_1d:
            breach = LimitBreach(
                limit_type=LimitType.VOLATILITY,
                action_taken=LimitAction.PAUSE,
                timestamp=datetime.now(timezone.utc),
                value=current_volatility_1d,
                threshold=self.volatility_pause_threshold_1d,
                message=f"CRITICAL: Volatility {current_volatility_1d:.1%} > {self.volatility_pause_threshold_1d:.1%} - PAUSING",
                vault_address=vault_address,
            )
            breaches.append(breach)
            self.paused_vaults[vault_address] = f"Volatility {current_volatility_1d:.1%}"

        elif current_volatility_1d > self.volatility_warning_threshold_1d:
            breach = LimitBreach(
                limit_type=LimitType.VOLATILITY,
                action_taken=LimitAction.WARN,
                timestamp=datetime.now(timezone.utc),
                value=current_volatility_1d,
                threshold=self.volatility_warning_threshold_1d,
                message=f"High volatility: {current_volatility_1d:.1%}",
                vault_address=vault_address,
            )
            breaches.append(breach)

        # ─── Check: Exposure per cycle ────────────────────────────────────────

        exposure_pct = (proposed_deploy / idle_amount * 100) if idle_amount > 0 else 0
        if exposure_pct > self.max_exposure_per_cycle_pct:
            breach = LimitBreach(
                limit_type=LimitType.EXPOSURE,
                action_taken=LimitAction.WARN,  # Ajusta automaticamente
                timestamp=datetime.now(timezone.utc),
                value=exposure_pct,
                threshold=self.max_exposure_per_cycle_pct,
                message=f"Exposure adjusted: {exposure_pct:.1f}% -> {self.max_exposure_per_cycle_pct:.1f}%",
                vault_address=vault_address,
            )
            breaches.append(breach)

        # ─── Check: Gas cost ──────────────────────────────────────────────────

        if current_tvl > 0:
            gas_pct = (stats.total_gas_spent / current_tvl) * 100
            if gas_pct > self.max_gas_cost_per_day_pct:
                breach = LimitBreach(
                    limit_type=LimitType.GAS_COST,
                    action_taken=LimitAction.BLOCK,
                    timestamp=datetime.now(timezone.utc),
                    value=gas_pct,
                    threshold=self.max_gas_cost_per_day_pct,
                    message=f"Gas cost too high: {gas_pct:.2f}% of TVL",
                    vault_address=vault_address,
                )
                breaches.append(breach)

        # ─── Registrar breaches ───────────────────────────────────────────────

        for breach in breaches:
            self.breach_history.append(breach)
            logger.warning("Protection: limit check",
                          limit_type=breach.limit_type.value,
                          action=breach.action_taken.value,
                          message=breach.message)

        # Permitir se não há blocagens
        blocked = any(b.action_taken in (LimitAction.BLOCK, LimitAction.PAUSE) for b in breaches)
        return not blocked, breaches

    def pause_vault(self, vault_address: str, reason: str):
        """Pausa um vault manualmente"""
        self.paused_vaults[vault_address] = reason
        logger.warning("Protection: vault paused",
                      vault=vault_address[:10],
                      reason=reason)

    def resume_vault(self, vault_address: str) -> bool:
        """Retoma um vault pausado"""
        if vault_address in self.paused_vaults:
            reason = self.paused_vaults.pop(vault_address)
            logger.info("Protection: vault resumed",
                       vault=vault_address[:10],
                       was_paused_for=reason)
            return True
        return False

    def get_status(self) -> Dict:
        """Retorna status atual para monitoramento"""
        return {
            "paused_vaults": self.paused_vaults,
            "daily_stats": {
                k: {
                    "rebalances": v.rebalance_count,
                    "gas_spent": v.total_gas_spent,
                    "deployed": v.total_deployed,
                }
                for k, v in self.daily_stats.items()
            },
            "recent_breaches": [
                {
                    "type": b.limit_type.value,
                    "action": b.action_taken.value,
                    "message": b.message,
                    "time": b.timestamp.isoformat(),
                }
                for b in self.breach_history[-10:]
            ],
            "limits": {
                "max_rebalances_per_day": self.max_rebalances_per_day,
                "min_minutes_between": self.min_minutes_between_rebalances,
                "volatility_pause": self.volatility_pause_threshold_1d,
                "max_exposure_per_cycle": self.max_exposure_per_cycle_pct,
            },
        }


class CircuitBreaker:
    """
    Circuit Breaker pattern para proteção automática.

    Estados:
    - CLOSED: Operação normal
    - OPEN: Bloqueado (após falhas/limite)
    - HALF_OPEN: Testando se pode voltar ao normal
    """

    class State(Enum):
        CLOSED = "closed"
        OPEN = "open"
        HALF_OPEN = "half_open"

    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout_minutes: int = 60,
        half_open_max_calls: int = 1,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout_minutes = recovery_timeout_minutes
        self.half_open_max_calls = half_open_max_calls

        self.state = self.State.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.half_open_calls = 0

    def can_execute(self) -> Tuple[bool, str]:
        """Verifica se operação pode ser executada"""
        if self.state == self.State.CLOSED:
            return True, "Circuit closed - normal operation"

        if self.state == self.State.OPEN:
            # Check if recovery timeout passed
            if self.last_failure_time:
                elapsed = datetime.now(timezone.utc) - self.last_failure_time
                if elapsed > timedelta(minutes=self.recovery_timeout_minutes):
                    self.state = self.State.HALF_OPEN
                    self.half_open_calls = 0
                    logger.info("Circuit breaker: entering HALF_OPEN")
                    return True, "Circuit half-open - testing"

            return False, f"Circuit open - retry after {self.recovery_timeout_minutes}min"

        if self.state == self.State.HALF_OPEN:
            if self.half_open_calls < self.half_open_max_calls:
                self.half_open_calls += 1
                return True, "Circuit half-open - limited calls"

            return False, "Circuit half-open - max test calls reached"

        return False, "Unknown state"

    def record_success(self):
        """Registra operação bem-sucedida"""
        if self.state == self.State.HALF_OPEN:
            # Success in half-open -> close circuit
            self.state = self.State.CLOSED
            self.failure_count = 0
            logger.info("Circuit breaker: CLOSED (recovered)")

    def record_failure(self, reason: str = ""):
        """Registra falha"""
        self.failure_count += 1
        self.last_failure_time = datetime.now(timezone.utc)

        if self.state == self.State.HALF_OPEN:
            # Failure in half-open -> open circuit
            self.state = self.State.OPEN
            logger.warning("Circuit breaker: OPEN (failed in half-open)", reason=reason)

        elif self.failure_count >= self.failure_threshold:
            self.state = self.State.OPEN
            logger.warning("Circuit breaker: OPEN (threshold reached)",
                          failures=self.failure_count,
                          threshold=self.failure_threshold,
                          reason=reason)

    def force_reset(self):
        """Reset manual do circuit breaker"""
        self.state = self.State.CLOSED
        self.failure_count = 0
        self.half_open_calls = 0
        logger.info("Circuit breaker: manually reset")


# Instância global de limites
_global_limits: Optional[ProtectionLimits] = None
_global_circuit_breakers: Dict[str, CircuitBreaker] = defaultdict(
    lambda: CircuitBreaker()
)


def get_protection_limits() -> ProtectionLimits:
    """Retorna limites globais"""
    global _global_limits
    if _global_limits is None:
        _global_limits = ProtectionLimits()
    return _global_limits


def get_circuit_breaker(vault_address: str) -> CircuitBreaker:
    """Retorna circuit breaker para um vault"""
    return _global_circuit_breakers[vault_address]
