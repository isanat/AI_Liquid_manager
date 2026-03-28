"""
Pilot Phases - Progressive Capital Deployment

Sistema de fases para deploy progressivo de capital.
Começa com smoke test ($100) e escala com critérios de passagem.

FILOSOFIA:
- "Fail fast, fail small" - problemas aparecem em small scale
- Critérios objetivos - sem subjetividade
- Escalonamento automático - se passar, sobe sozinho
- Pausa automática - se falhar, para e alerta

FASES:
1. SMOKE_TEST   - $100 USD, 7 dias, valida funcionamento técnico
2. PILOT_1K     - $1,000 USD, 14 dias, valida performance básica
3. PILOT_10K    - $10,000 USD, 30 dias, valida escalabilidade
4. PRODUCTION   - $50,000+ USD, operação normal
"""
import os
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from enum import Enum
from pathlib import Path
import structlog

logger = structlog.get_logger()


class PilotPhase(Enum):
    """Fases do programa de pilot"""
    SMOKE_TEST = "smoke_test"      # $100 - Teste técnico
    PILOT_1K = "pilot_1k"          # $1,000 - Validação inicial
    PILOT_10K = "pilot_10k"        # $10,000 - Pré-produção
    PRODUCTION = "production"      # $50,000+ - Operação normal
    PAUSED = "paused"              # Pausado por falha ou manual


@dataclass
class PassCriteria:
    """Critérios para passar para próxima fase"""
    # ─── Tempo mínimo ────────────────────────────────────────────────────────
    min_duration_days: int = 7

    # ─── Performance mínima ──────────────────────────────────────────────────
    min_return_pct: float = -5.0      # Não pode perder mais que 5%
    max_drawdown_pct: float = 10.0    # Max 10% drawdown
    min_sharpe: float = 0.0           # Sharpe >= 0 (não pode ser negativo)

    # ─── Operacional ─────────────────────────────────────────────────────────
    min_rebalances: int = 3           # Mínimo de operações para ter significância
    max_failed_rebalances: int = 2    # Max 2 falhas

    # ─── Custos ──────────────────────────────────────────────────────────────
    max_gas_cost_pct: float = 2.0     # Gas < 2% do capital

    # ─── Estabilidade ────────────────────────────────────────────────────────
    max_price_deviation_pct: float = 15.0  # Preço não pode desviar muito do oracle


@dataclass
class PhaseConfig:
    """Configuração de cada fase"""
    phase: PilotPhase
    max_capital_usd: float
    duration_days: int
    pass_criteria: PassCriteria
    description: str = ""
    auto_promote: bool = True  # Se True, promove automaticamente ao passar


# Configurações padrão de cada fase
PHASE_CONFIGS: Dict[PilotPhase, PhaseConfig] = {
    PilotPhase.SMOKE_TEST: PhaseConfig(
        phase=PilotPhase.SMOKE_TEST,
        max_capital_usd=100.0,
        duration_days=7,
        pass_criteria=PassCriteria(
            min_duration_days=5,
            min_return_pct=-10.0,      # Smoke test é tolerante
            max_drawdown_pct=15.0,
            min_sharpe=-0.5,
            min_rebalances=1,
            max_failed_rebalances=3,
            max_gas_cost_pct=5.0,
        ),
        description="Smoke test - valida funcionamento técnico",
        auto_promote=True,
    ),
    PilotPhase.PILOT_1K: PhaseConfig(
        phase=PilotPhase.PILOT_1K,
        max_capital_usd=1_000.0,
        duration_days=14,
        pass_criteria=PassCriteria(
            min_duration_days=10,
            min_return_pct=-5.0,
            max_drawdown_pct=12.0,
            min_sharpe=0.0,
            min_rebalances=3,
            max_failed_rebalances=2,
            max_gas_cost_pct=2.0,
        ),
        description="Pilot $1K - valida performance básica",
        auto_promote=True,
    ),
    PilotPhase.PILOT_10K: PhaseConfig(
        phase=PilotPhase.PILOT_10K,
        max_capital_usd=10_000.0,
        duration_days=30,
        pass_criteria=PassCriteria(
            min_duration_days=21,
            min_return_pct=-3.0,
            max_drawdown_pct=10.0,
            min_sharpe=0.5,
            min_rebalances=5,
            max_failed_rebalances=1,
            max_gas_cost_pct=1.0,
        ),
        description="Pilot $10K - valida escalabilidade",
        auto_promote=True,
    ),
    PilotPhase.PRODUCTION: PhaseConfig(
        phase=PilotPhase.PRODUCTION,
        max_capital_usd=500_000.0,
        duration_days=365,  # Re-avaliação anual
        pass_criteria=PassCriteria(
            min_duration_days=90,
            min_return_pct=0.0,
            max_drawdown_pct=15.0,
            min_sharpe=1.0,
            min_rebalances=10,
            max_failed_rebalances=3,
            max_gas_cost_pct=1.0,
        ),
        description="Production - operação normal",
        auto_promote=False,  # Não auto-promove
    ),
}


@dataclass
class PhaseMetrics:
    """Métricas coletadas durante uma fase"""
    start_time: datetime
    end_time: Optional[datetime] = None

    # Performance
    start_capital: float = 0.0
    end_capital: float = 0.0
    total_return_pct: float = 0.0
    max_drawdown_pct: float = 0.0
    sharpe_ratio: float = 0.0

    # Operações
    total_rebalances: int = 0
    successful_rebalances: int = 0
    failed_rebalances: int = 0

    # Custos
    total_gas_cost: float = 0.0
    gas_cost_pct: float = 0.0

    # Daily returns for sharpe
    daily_returns: List[float] = field(default_factory=list)

    def calculate_metrics(self) -> Dict:
        """Calcula métricas derivadas"""
        if self.end_capital > 0 and self.start_capital > 0:
            self.total_return_pct = (self.end_capital - self.start_capital) / self.start_capital * 100

        if self.start_capital > 0:
            self.gas_cost_pct = self.total_gas_cost / self.start_capital * 100

        # Sharpe from daily returns
        if len(self.daily_returns) > 5:
            import numpy as np
            returns = np.array(self.daily_returns)
            risk_free = 0.04 / 365  # 4% annual
            excess = returns - risk_free
            if np.std(excess) > 0:
                self.sharpe_ratio = np.mean(excess) / np.std(excess) * np.sqrt(365)

        return {
            "return_pct": self.total_return_pct,
            "max_drawdown_pct": self.max_drawdown_pct,
            "sharpe_ratio": self.sharpe_ratio,
            "gas_cost_pct": self.gas_cost_pct,
            "success_rate": self.successful_rebalances / max(self.total_rebalances, 1),
        }


@dataclass
class PhaseResult:
    """Resultado da avaliação de uma fase"""
    phase: PilotPhase
    passed: bool
    metrics: PhaseMetrics
    criteria_results: Dict[str, Tuple[bool, str]]  # criterion -> (passed, message)
    recommendation: str
    can_promote: bool = False
    promotion_ready_date: Optional[datetime] = None


class PilotPhaseManager:
    """
    Gerencia fases do pilot com critérios de passagem.

    Uso:
        manager = PilotPhaseManager()
        manager.start_phase(PilotPhase.SMOKE_TEST)

        # Durante operação
        manager.record_rebalance(success=True, gas_cost=0.35)
        manager.update_capital(100, 105)
        manager.record_daily_return(0.01)

        # Avaliar
        result = manager.evaluate_phase()
        if result.can_promote:
            manager.promote_to_next_phase()
    """

    def __init__(self, state_file: Optional[str] = None):
        self.state_file = state_file or os.getenv(
            "PILOT_STATE_FILE",
            "/app/data/pilot_state.json"
        )
        self.current_phase: PilotPhase = PilotPhase.SMOKE_TEST
        self.current_metrics: Optional[PhaseMetrics] = None
        self.phase_history: List[PhaseResult] = []
        self.vault_address: Optional[str] = None

        self._load_state()

    def _load_state(self):
        """Carrega estado do arquivo"""
        try:
            path = Path(self.state_file)
            if path.exists():
                data = json.loads(path.read_text())
                self.current_phase = PilotPhase(data.get("current_phase", "smoke_test"))
                self.vault_address = data.get("vault_address")

                if data.get("metrics"):
                    m = data["metrics"]
                    self.current_metrics = PhaseMetrics(
                        start_time=datetime.fromisoformat(m["start_time"]),
                        end_time=datetime.fromisoformat(m["end_time"]) if m.get("end_time") else None,
                        start_capital=m.get("start_capital", 0),
                        end_capital=m.get("end_capital", 0),
                        total_rebalances=m.get("total_rebalances", 0),
                        successful_rebalances=m.get("successful_rebalances", 0),
                        failed_rebalances=m.get("failed_rebalances", 0),
                        total_gas_cost=m.get("total_gas_cost", 0),
                        max_drawdown_pct=m.get("max_drawdown_pct", 0),
                        daily_returns=m.get("daily_returns", []),
                    )

                logger.info("Pilot state loaded",
                           phase=self.current_phase.value,
                           state_file=self.state_file)

        except Exception as e:
            logger.warning("Could not load pilot state, starting fresh", error=str(e))
            self.current_phase = PilotPhase.SMOKE_TEST

    def _save_state(self):
        """Salva estado no arquivo"""
        try:
            path = Path(self.state_file)
            path.parent.mkdir(parents=True, exist_ok=True)

            data = {
                "current_phase": self.current_phase.value,
                "vault_address": self.vault_address,
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "metrics": {
                    "start_time": self.current_metrics.start_time.isoformat() if self.current_metrics else None,
                    "end_time": self.current_metrics.end_time.isoformat() if self.current_metrics and self.current_metrics.end_time else None,
                    "start_capital": self.current_metrics.start_capital if self.current_metrics else 0,
                    "end_capital": self.current_metrics.end_capital if self.current_metrics else 0,
                    "total_rebalances": self.current_metrics.total_rebalances if self.current_metrics else 0,
                    "successful_rebalances": self.current_metrics.successful_rebalances if self.current_metrics else 0,
                    "failed_rebalances": self.current_metrics.failed_rebalances if self.current_metrics else 0,
                    "total_gas_cost": self.current_metrics.total_gas_cost if self.current_metrics else 0,
                    "max_drawdown_pct": self.current_metrics.max_drawdown_pct if self.current_metrics else 0,
                    "daily_returns": self.current_metrics.daily_returns if self.current_metrics else [],
                } if self.current_metrics else None,
            }

            path.write_text(json.dumps(data, indent=2))
            logger.debug("Pilot state saved", path=str(path))

        except Exception as e:
            logger.error("Failed to save pilot state", error=str(e))

    def start_phase(
        self,
        phase: PilotPhase,
        vault_address: str,
        initial_capital: float,
    ) -> PhaseMetrics:
        """Inicia uma nova fase"""
        self.current_phase = phase
        self.vault_address = vault_address

        config = PHASE_CONFIGS[phase]
        self.current_metrics = PhaseMetrics(
            start_time=datetime.now(timezone.utc),
            start_capital=min(initial_capital, config.max_capital_usd),
        )

        self._save_state()

        logger.info("Pilot phase started",
                   phase=phase.value,
                   max_capital=config.max_capital_usd,
                   duration_days=config.duration_days,
                   vault=vault_address[:10])

        return self.current_metrics

    def record_rebalance(self, success: bool, gas_cost: float):
        """Registra um rebalance"""
        if not self.current_metrics:
            logger.warning("No active phase metrics")
            return

        self.current_metrics.total_rebalances += 1
        if success:
            self.current_metrics.successful_rebalances += 1
        else:
            self.current_metrics.failed_rebalances += 1

        self.current_metrics.total_gas_cost += gas_cost
        self._save_state()

    def update_capital(self, current_capital: float, max_drawdown: float = 0):
        """Atualiza capital e drawdown"""
        if not self.current_metrics:
            return

        self.current_metrics.end_capital = current_capital
        if max_drawdown > self.current_metrics.max_drawdown_pct:
            self.current_metrics.max_drawdown_pct = max_drawdown

        self._save_state()

    def record_daily_return(self, return_pct: float):
        """Registra retorno diário"""
        if not self.current_metrics:
            return

        self.current_metrics.daily_returns.append(return_pct)
        self._save_state()

    def get_max_allowed_capital(self) -> float:
        """Retorna capital máximo permitido para fase atual"""
        config = PHASE_CONFIGS[self.current_phase]
        return config.max_capital_usd

    def can_deploy(self, amount: float) -> Tuple[bool, str]:
        """Verifica se pode deployar determinado valor"""
        max_capital = self.get_max_allowed_capital()

        if amount > max_capital:
            return False, f"Amount ${amount:,.0f} exceeds phase limit ${max_capital:,.0f}"

        if self.current_phase == PilotPhase.PAUSED:
            return False, "Pilot is paused"

        return True, "OK"

    def evaluate_phase(self) -> PhaseResult:
        """Avalia se fase atual passou nos critérios"""
        config = PHASE_CONFIGS[self.current_phase]
        criteria = config.pass_criteria
        metrics = self.current_metrics or PhaseMetrics(start_time=datetime.now(timezone.utc))

        now = datetime.now(timezone.utc)
        duration_days = (now - metrics.start_time).days

        criteria_results: Dict[str, Tuple[bool, str]] = {}

        # ─── Duration check ────────────────────────────────────────────────────
        criteria_results["duration"] = (
            duration_days >= criteria.min_duration_days,
            f"{duration_days}/{criteria.min_duration_days} days"
        )

        # ─── Return check ──────────────────────────────────────────────────────
        metrics.calculate_metrics()
        criteria_results["return"] = (
            metrics.total_return_pct >= criteria.min_return_pct,
            f"{metrics.total_return_pct:.1f}% >= {criteria.min_return_pct:.1f}%"
        )

        # ─── Drawdown check ────────────────────────────────────────────────────
        criteria_results["drawdown"] = (
            metrics.max_drawdown_pct <= criteria.max_drawdown_pct,
            f"{metrics.max_drawdown_pct:.1f}% <= {criteria.max_drawdown_pct:.1f}%"
        )

        # ─── Sharpe check ──────────────────────────────────────────────────────
        criteria_results["sharpe"] = (
            metrics.sharpe_ratio >= criteria.min_sharpe,
            f"{metrics.sharpe_ratio:.2f} >= {criteria.min_sharpe:.2f}"
        )

        # ─── Rebalances check ──────────────────────────────────────────────────
        criteria_results["rebalances"] = (
            metrics.total_rebalances >= criteria.min_rebalances,
            f"{metrics.total_rebalances}/{criteria.min_rebalances}"
        )

        # ─── Failed rebalances check ───────────────────────────────────────────
        criteria_results["failures"] = (
            metrics.failed_rebalances <= criteria.max_failed_rebalances,
            f"{metrics.failed_rebalances}/{criteria.max_failed_rebalances} failed"
        )

        # ─── Gas cost check ────────────────────────────────────────────────────
        criteria_results["gas_cost"] = (
            metrics.gas_cost_pct <= criteria.max_gas_cost_pct,
            f"{metrics.gas_cost_pct:.2f}% <= {criteria.max_gas_cost_pct:.1f}%"
        )

        # ─── Resultado ─────────────────────────────────────────────────────────
        all_passed = all(passed for passed, _ in criteria_results.values())

        # Can promote?
        can_promote = all_passed and config.auto_promote
        promotion_date = now + timedelta(days=1) if can_promote else None

        # Recommendation
        if all_passed:
            if can_promote:
                recommendation = f"✅ Phase passed! Ready to promote to {self._next_phase().value}"
            else:
                recommendation = "✅ Phase passed! Manual promotion required."
        else:
            failed = [k for k, (p, _) in criteria_results.items() if not p]
            recommendation = f"⚠️ Phase not passed. Issues: {', '.join(failed)}"

        result = PhaseResult(
            phase=self.current_phase,
            passed=all_passed,
            metrics=metrics,
            criteria_results=criteria_results,
            recommendation=recommendation,
            can_promote=can_promote,
            promotion_ready_date=promotion_date,
        )

        logger.info("Phase evaluated",
                   phase=self.current_phase.value,
                   passed=all_passed,
                   can_promote=can_promote)

        return result

    def _next_phase(self) -> PilotPhase:
        """Retorna próxima fase"""
        order = [
            PilotPhase.SMOKE_TEST,
            PilotPhase.PILOT_1K,
            PilotPhase.PILOT_10K,
            PilotPhase.PRODUCTION,
        ]

        try:
            idx = order.index(self.current_phase)
            if idx < len(order) - 1:
                return order[idx + 1]
        except ValueError:
            pass

        return self.current_phase

    def promote_to_next_phase(self) -> bool:
        """Promove para próxima fase"""
        if self.current_phase == PilotPhase.PRODUCTION:
            logger.info("Already in production phase")
            return False

        if self.current_phase == PilotPhase.PAUSED:
            logger.warning("Cannot promote from paused state")
            return False

        result = self.evaluate_phase()
        if not result.can_promote:
            logger.warning("Cannot promote - criteria not met",
                          recommendation=result.recommendation)
            return False

        # Archive current phase
        self.phase_history.append(result)

        # Move to next phase
        next_phase = self._next_phase()
        logger.info("Promoting phase",
                   from_phase=self.current_phase.value,
                   to_phase=next_phase.value)

        self.current_phase = next_phase
        self.current_metrics = None  # Reset metrics for new phase
        self._save_state()

        return True

    def pause(self, reason: str):
        """Pausa o pilot"""
        logger.warning("Pilot paused", reason=reason)
        self.current_phase = PilotPhase.PAUSED
        self._save_state()

    def resume(self) -> bool:
        """Retoma o pilot"""
        if self.current_phase != PilotPhase.PAUSED:
            return False

        # Volta para fase anterior à pausa
        if self.phase_history:
            last_phase = self.phase_history[-1].phase
            self.current_phase = last_phase
        else:
            self.current_phase = PilotPhase.SMOKE_TEST

        logger.info("Pilot resumed", phase=self.current_phase.value)
        self._save_state()
        return True

    def get_status(self) -> Dict:
        """Retorna status completo do pilot"""
        config = PHASE_CONFIGS.get(self.current_phase, PHASE_CONFIGS[PilotPhase.SMOKE_TEST])

        return {
            "current_phase": self.current_phase.value,
            "max_capital": config.max_capital_usd,
            "duration_days": config.duration_days,
            "vault_address": self.vault_address,
            "metrics": {
                "start_time": self.current_metrics.start_time.isoformat() if self.current_metrics else None,
                "start_capital": self.current_metrics.start_capital if self.current_metrics else 0,
                "end_capital": self.current_metrics.end_capital if self.current_metrics else 0,
                "return_pct": self.current_metrics.total_return_pct if self.current_metrics else 0,
                "max_drawdown": self.current_metrics.max_drawdown_pct if self.current_metrics else 0,
                "rebalances": self.current_metrics.total_rebalances if self.current_metrics else 0,
                "gas_cost": self.current_metrics.total_gas_cost if self.current_metrics else 0,
            },
            "phase_history": [
                {
                    "phase": r.phase.value,
                    "passed": r.passed,
                    "recommendation": r.recommendation,
                }
                for r in self.phase_history
            ],
            "pass_criteria": {
                k: v for k, v in asdict(config.pass_criteria).items()
            },
        }


def asdict(dataclass_obj) -> dict:
    """Helper to convert dataclass to dict"""
    import dataclasses
    return dataclasses.asdict(dataclass_obj)


# Instância global
_global_pilot_manager: Optional[PilotPhaseManager] = None


def get_pilot_manager() -> PilotPhaseManager:
    """Retorna manager global"""
    global _global_pilot_manager
    if _global_pilot_manager is None:
        _global_pilot_manager = PilotPhaseManager()
    return _global_pilot_manager
