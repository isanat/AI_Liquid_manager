# AI Liquidity Manager

<p align="center">
  <strong>Institutional-grade AI-powered liquidity management for Uniswap V3 and Orca</strong>
</p>

<p align="center">
  Adaptive range optimization • Regime detection • Automated rebalancing
</p>

---

## 🏗️ Architecture

```
Investors
   ↓
Vault Contract (Capital Custody)
   ↓
Strategy Controller (Orchestration)
   ↓
AI Strategy Engine (Parameter Generation)
   ↓
Range Optimizer (Tick Calculation)
   ↓
Execution Engine (Transaction Management)
   ↓
DEX Pools (Uniswap V3 / Orca)
```

---

## 🚀 Deployment Options

### Option 1: Railway (Recommended) ⭐

Railway supports Python + Node.js + PostgreSQL + Redis in one project.

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
./railway-deploy.sh
```

**Free tier:** $5/month credit (covers dev usage)

### Option 2: Docker Compose (Local)

```bash
# Start all services
docker-compose up --build -d

# Services:
# - Frontend:    http://localhost:3000
# - AI Engine:   http://localhost:8000
# - PostgreSQL:  localhost:5432
# - Redis:       localhost:6379
```

### Option 3: Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
flyctl deploy --dockerfile Dockerfile.ai
```

---

## 🛠️ Local Development

### Prerequisites
- Node.js 18+ or Bun
- Python 3.11+
- PostgreSQL (optional, for persistence)
- Redis (optional, for caching)

### Quick Start

```bash
# Install frontend dependencies
bun install

# Run Next.js dev server
bun run dev

# In another terminal, run AI engine
cd ai-engine
pip install -r requirements.txt
python main.py inference  # Test inference
python main.py backtest   # Run backtest
```

### Run AI Engine API

```bash
cd ai-engine
uvicorn api.main:app --reload --port 8000
```

API will be available at http://localhost:8000

---

## 📡 API Endpoints

### AI Engine (Port 8000)

```bash
# Health check
GET /health

# Run ML inference
POST /inference
{
  "price": 1850,
  "volume_24h": 12000000,
  "total_liquidity": 25000000,
  "active_liquidity": 12000000,
  "volume_1h": 500000
}

# Run backtest
POST /backtest
{
  "days": 30,
  "initial_capital": 100000
}

# Train model
POST /train
```

### Frontend (Port 3000)

```bash
# Dashboard data
GET /api/liquidity?action=full

# Proxy to AI engine
POST /api/ai?action=inference
```

---

## 🧠 AI Model

### Why LightGBM (not LLM)?

| Metric | LLM (GPT/Claude) | LightGBM |
|--------|------------------|----------|
| Latency | 1-5 seconds | <10ms |
| Cost per request | $0.01-0.05 | ~$0.00001 |
| Consistency | Variable | Deterministic |
| Training with own data | Complex | Native |

**For trading/liquidity: ML is superior to LLMs.**

### Model Outputs

```python
StrategyOutput:
  range_width: 7.0           # ±7% range
  core_allocation: 70%       # Core range (±6%)
  defensive_allocation: 20%  # Wide range (±20%)
  opportunistic: 10%         # Tight range (±2%)
  detected_regime: "range"   # trend/range/high-vol/low-vol
  confidence: 0.85           # Model confidence
```

### Features (29 inputs)

- **Price:** price, twap, velocity, acceleration, drift
- **Volatility:** 1d/7d/30d, realized, Parkinson, Garman-Klass
- **Volume:** volume, spike_ratio, trend
- **Liquidity:** total, active, depth, concentration
- **Fees:** rate_24h, rate_7d_avg, trend
- **Time:** hour, day_of_week, is_weekend

---

## 📊 Features

### Layer 1 — Vault Manager
- Deposit/withdrawal processing
- Share issuance and NAV calculation
- Capital custody and accounting

### Layer 2 — Strategy Controller
- Orchestration of all components
- 15-minute cycle management
- Phase tracking

### Layer 3 — Data Layer
- Real-time market metrics collection
- Volatility metrics (1D, 7D, realized)
- Volume analysis and spike detection

### Layer 4 — AI Strategy Engine
- LightGBM for fast inference
- Rule-based fallback when model unavailable

### Layer 5 — Range Optimizer
- Dynamic range width calculation
- Capital allocation optimization

### Layer 6 — Execution Engine
- Position management
- Fee collection automation
- Slippage control

---

## 📈 Capital Allocation

### Normal Volatility (< 4%)
```
Core: 70% | Defensive: 20% | Opportunistic: 10%
```

### High Volatility (> 5%)
```
Core: 60% | Defensive: 30% | Opportunistic: 5%
```

---

## 🗺️ Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| MVP Dashboard | ✅ | Next.js dashboard with simulated data |
| AI Engine | ✅ | LightGBM model + FastAPI |
| Deployment | ✅ | Railway/Fly.io config |
| Real Data | 🚧 | Uniswap V3 subgraph integration |
| Smart Contracts | 📋 | Vault.sol, Strategy.sol |
| Multi-Pool | 📋 | ETH/USDC, ARB/ETH, SOL/USDC |
| Hedging | 📋 | LP + Perp short integration |

---

## 📁 Project Structure

```
ai-liquidity-manager/
├── src/                      # Next.js frontend
│   ├── app/
│   │   ├── page.tsx          # Main dashboard
│   │   ├── api/              # API routes
│   │   └── globals.css
│   ├── components/
│   │   ├── liquidity-dashboard.tsx
│   │   └── ui/               # shadcn components
│   └── lib/
│       ├── liquidity-store.ts
│       └── ai-engine-client.ts
├── ai-engine/                # Python AI backend
│   ├── models/
│   │   ├── types.py
│   │   └── strategy_model.py
│   ├── features/
│   │   └── feature_engineering.py
│   ├── backtesting/
│   │   └── backtester.py
│   ├── api/
│   │   └── main.py           # FastAPI service
│   └── main.py               # CLI entry point
├── docker-compose.yml
├── Dockerfile                # Frontend
├── Dockerfile.ai             # AI Engine
├── railway.toml
└── DEPLOYMENT.md
```

---

## 💰 Cost Estimate (Railway)

| Service | Est. Cost |
|---------|-----------|
| Frontend | ~$1-2/mo |
| AI Engine | ~$2-3/mo |
| PostgreSQL | ~$1/mo |
| Redis | ~$1/mo |
| **Total** | **~$5-7/mo** |

Free tier: $5/month credit

---

## 📄 License

MIT

---

<p align="center">
  Built with ❤️ for DeFi
</p>
