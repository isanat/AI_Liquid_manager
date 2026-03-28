# Risk Management System

> **Última atualização:** 2025-03-28
> **Versão:** 1.0.0

---

## 📋 Visão Geral

O sistema de risco garante operação segura do vault através de três camadas de proteção:

1. **Shared Parameters** - Parâmetros idênticos entre backtest e produção
2. **Protection Limits** - Limites explícitos de operação
3. **Pilot Phases** - Deploy progressivo de capital

---

## 🔄 Shared Parameters

### Por que é crítico?

Discrepâncias entre backtest e produção causam:
- Expectativas irreais de retorno
- Custos subestimados
- Perdas não previstas

### Parâmetros Sincronizados

| Parâmetro | Valor Padrão | Descrição |
|-----------|-------------|-----------|
| `fee_tier` | 500 | 0.05% pool (WETH/USDC) |
| `max_rebalances_per_day` | 3 | Limite de operações diárias |
| `gas_cost_multiplier` | 1.5 | Margem de segurança 50% |
| `slippage_bps` | 10 | 0.10% slippage |
| `default_deploy_pct` | 80% | % do idle deployado |

### Custos de Gas (Arbitrum)

| Operação | Custo Base | Com Margem (1.5x) |
|----------|-----------|-------------------|
| Mint | $0.12 | $0.18 |
| Burn | $0.10 | $0.15 |
| Collect | $0.06 | $0.09 |
| Rebalance Full | $0.35 | $0.525 |

### Como Configurar

Variáveis de ambiente com prefixo `RISK_`:

```bash
RISK_FEE_TIER=500
RISK_MAX_REBALANCES_PER_DAY=3
RISK_GAS_COST_MULTIPLIER=1.5
RISK_SLIPPAGE_BPS=10
RISK_DEFAULT_RANGE_WIDTH_PCT=6.0
RISK_PAUSE_THRESHOLD_1D=0.15
```

---

## 🛡️ Protection Limits

### Limites de Frequência

| Limite | Valor | Ação se Excedido |
|--------|-------|------------------|
| Max rebalances/dia | 3 | BLOCK |
| Min tempo entre rebalances | 60 min | BLOCK |

### Limites de Volatilidade

| Métrica | Warning | Pausa |
|---------|---------|-------|
| Volatilidade 1d | > 10% | > 15% |
| Volatilidade 7d | > 18% | > 25% |

### Limites de Exposição

| Limite | Valor |
|--------|-------|
| Max exposição por ciclo | 50% do idle |
| Max exposição total | 90% do TVL |
| Min cash buffer | 10% |

### Limites de Perda

| Limite | Valor | Ação |
|--------|-------|------|
| Perda diária max | 5% | PAUSE |
| Perda semanal max | 10% | PAUSE |
| Gas cost diário max | 1% TVL | BLOCK |

### Circuit Breaker

```
CLOSED → (3 falhas) → OPEN → (60 min) → HALF_OPEN → (teste) → CLOSED/OPEN
```

---

## 🚀 Pilot Phases

### Fases e Critérios

#### 1. SMOKE_TEST ($100)
**Duração:** 7 dias

Critérios para passar:
- [ ] Min 5 dias de operação
- [ ] Return > -10%
- [ ] Max drawdown < 15%
- [ ] Min 1 rebalance

**Objetivo:** Validar funcionamento técnico

---

#### 2. PILOT_1K ($1,000)
**Duração:** 14 dias

Critérios para passar:
- [ ] Min 10 dias de operação
- [ ] Return > -5%
- [ ] Max drawdown < 12%
- [ ] Sharpe > 0
- [ ] Min 3 rebalances
- [ ] Gas < 2% do capital

**Objetivo:** Validar performance básica

---

#### 3. PILOT_10K ($10,000)
**Duração:** 30 dias

Critérios para passar:
- [ ] Min 21 dias de operação
- [ ] Return > -3%
- [ ] Max drawdown < 10%
- [ ] Sharpe > 0.5
- [ ] Min 5 rebalances
- [ ] Max 1 falha
- [ ] Gas < 1% do capital

**Objetivo:** Validar escalabilidade

---

#### 4. PRODUCTION ($50,000+)
**Duração:** Contínua (reavaliação anual)

Critérios de manutenção:
- [ ] Return > 0%
- [ ] Max drawdown < 15%
- [ ] Sharpe > 1.0

---

## 📊 API Endpoints

### GET `/risk/status`
Status completo do sistema de risco.

### POST `/risk/pilot/promote`
Promove para próxima fase (se critérios atendidos).

### POST `/risk/pilot/pause?reason=X`
Pausa o pilot.

### POST `/risk/pilot/resume`
Retoma o pilot.

### POST `/risk/vault/{address}/pause`
Pausa um vault específico.

### POST `/risk/vault/{address}/resume`
Retoma um vault.

### POST `/risk/circuit-breaker/{address}/reset`
Reseta circuit breaker de um vault.

### GET `/risk/config/validate`
Valida consistência entre backtest e produção.

---

## 🔧 Uso no Código

### Backtest

```python
from risk.risk_config import get_risk_config
from backtesting.backtester import LiquidityBacktester

# Backtest usa config compartilhada automaticamente
backtester = LiquidityBacktester(
    initial_capital=100_000,
    # Parâmetros carregados do RiskConfig se não especificados
)
```

### Keeper

```python
from risk.protection_limits import get_protection_limits
from risk.pilot_phases import get_pilot_manager

limits = get_protection_limits()
pilot = get_pilot_manager()

# Check antes de rebalance
allowed, breaches = limits.check_limits(
    vault_address=vault,
    current_volatility_1d=0.08,
    ...
)

if not allowed:
    logger.warning(f"Rebalance blocked: {breaches}")
    return

# Verificar limite de capital
can_deploy, reason = pilot.can_deploy(amount)
if not can_deploy:
    logger.warning(f"Deploy blocked: {reason}")
    return

# Registrar resultado
limits.record_rebalance(vault, gas_cost=0.15, amount_deployed=1000)
pilot.record_rebalance(success=True, gas_cost=0.15)
```

---

## 📁 Arquivos

```
ai_engine/
├── risk/
│   ├── __init__.py
│   ├── risk_config.py      # Parâmetros compartilhados
│   ├── protection_limits.py # Limites e circuit breakers
│   └── pilot_phases.py     # Fases progressivas
├── api/
│   └── risk_routes.py      # API endpoints
├── keeper/
│   └── keeper.py           # Integrado com risk
└── backtesting/
    └── backtester.py       # Usa config compartilhada
```

---

## ⚠️ Troubleshooting

### Pilot não promove automaticamente

Verificar critérios:
```bash
curl http://localhost:8000/risk/status
```

### Vault pausado inesperadamente

Verificar motivo:
```bash
curl http://localhost:8000/risk/status | jq '.protection.paused_vaults'
```

### Circuit breaker aberto

Resetar manualmente:
```bash
curl -X POST http://localhost:8000/risk/circuit-breaker/0x.../reset
```

---

## 📝 Checklist de Deploy

- [ ] Configurar variáveis `RISK_*` no Coolify
- [ ] Criar diretório `/app/data` para pilot_state.json
- [ ] Verificar que pilot inicia em SMOKE_TEST
- [ ] Testar circuit breaker manualmente
- [ ] Validar que backtest usa mesmos parâmetros
