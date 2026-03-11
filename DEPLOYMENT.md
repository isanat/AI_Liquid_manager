# Deployment Guide

This guide covers deploying the AI Liquidity Manager to various platforms.

## Quick Start: Railway (Recommended)

Railway is the best option for this project because it supports:
- ✅ Python + Node.js in one project
- ✅ PostgreSQL + Redis built-in
- ✅ Docker containers
- ✅ Auto-deploy from GitHub
- ✅ Free tier ($5/month credit)

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

### Step 2: Login to Railway

```bash
railway login
```

### Step 3: Create New Project

```bash
railway project create ai-liquidity-manager
```

### Step 4: Add Database Services

```bash
# Add PostgreSQL
railway add --plugin postgresql

# Add Redis
railway add --plugin redis
```

### Step 5: Deploy AI Engine

```bash
railway up --service ai-engine --dockerfile Dockerfile.ai
```

### Step 6: Deploy Frontend

```bash
railway up --service frontend
```

### Step 7: Configure Variables

```bash
# Connect frontend to AI engine
railway variables --service frontend set AI_ENGINE_URL=https://${{ai-engine.RAILWAY_PUBLIC_DOMAIN}}

# Connect to database
railway variables --service frontend set DATABASE_URL=${{postgres.DATABASE_URL}}
railway variables --service ai-engine set DATABASE_URL=${{postgres.DATABASE_URL}}

# Connect to Redis
railway variables --service frontend set REDIS_URL=${{redis.REDIS_URL}}
railway variables --service ai-engine set REDIS_URL=${{redis.REDIS_URL}}
```

### Step 8: Open Dashboard

```bash
railway open
```

---

## Alternative: Docker Compose (Local)

For local development and testing:

```bash
# Start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services will be available at:
- Frontend: http://localhost:3000
- AI Engine: http://localhost:8000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

---

## Alternative: Fly.io

Fly.io is another good option with edge computing:

### Step 1: Install Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
```

### Step 2: Login

```bash
flyctl auth login
```

### Step 3: Create Apps

```bash
flyctl apps create ai-liquidity-engine
flyctl apps create ai-liquidity-frontend
```

### Step 4: Deploy

```bash
# AI Engine
flyctl deploy --app ai-liquidity-engine --dockerfile Dockerfile.ai

# Frontend
flyctl deploy --app ai-liquidity-frontend
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        RAILWAY CLOUD                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │   Frontend   │────▶│  AI Engine   │────▶│  PostgreSQL │ │
│  │  (Next.js)   │     │   (Python)   │     │             │ │
│  │   Port 3000  │     │   Port 8000  │     │  Port 5432  │ │
│  └──────────────┘     └──────────────┘     └─────────────┘ │
│         │                    │                              │
│         │                    ▼                              │
│         │            ┌──────────────┐                      │
│         └───────────▶│    Redis     │                      │
│                      │   (Cache)    │                      │
│                      │  Port 6379   │                      │
│                      └──────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

### Frontend (Next.js)
```
AI_ENGINE_URL=https://your-ai-engine.railway.app
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### AI Engine (Python)
```
MODEL_PATH=/app/models/saved
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
PORT=8000
```

---

## Cost Estimate (Railway)

| Service | Tier | Est. Cost |
|---------|------|-----------|
| Frontend | Starter | ~$1-2/mo |
| AI Engine | Starter | ~$2-3/mo |
| PostgreSQL | Starter | ~$1/mo |
| Redis | Starter | ~$1/mo |
| **Total** | | **~$5-7/mo** |

Free tier gives $5/month credit, so it's essentially free for development.

---

## Monitoring

Railway provides:
- Real-time logs
- Metrics (CPU, Memory, Network)
- Deploy history
- Automatic restarts

View dashboard:
```bash
railway open
```

---

## Troubleshooting

### AI Engine won't start
```bash
# Check logs
railway logs --service ai-engine

# Check health
curl https://your-ai-engine.railway.app/health
```

### Database connection issues
```bash
# Check variables
railway variables --service ai-engine

# Test connection
railway connect postgres
```

### Frontend can't reach AI Engine
```bash
# Verify AI_ENGINE_URL
railway variables --service frontend

# Check if AI engine is healthy
railway status --service ai-engine
```
