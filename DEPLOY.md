# 🚀 Deploy Guide - AI Liquidity Manager

## ⚠️ Railway Status

O Railway informou que o **trial expirou**. Para usar Railway, você precisa:

1. Acessar https://railway.app
2. Ir em **Settings** → **Billing**
3. Adicionar um cartão (Hobby plan: $5/mês com $5 crédito)

---

## ✅ Opção Gratuita: Docker Compose

Execute tudo localmente com um comando:

```bash
# Clone o repositório
git clone https://github.com/isanat/AI_Liquid_manager.git
cd AI_Liquid_manager

# Execute o deploy
chmod +x local-deploy.sh
./local-deploy.sh
```

### Serviços Disponíveis:

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Frontend** | http://localhost:3000 | Dashboard Next.js |
| **AI Engine** | http://localhost:8000 | API Python |
| **API Docs** | http://localhost:8000/docs | Swagger UI |
| **PostgreSQL** | localhost:5432 | Banco de dados |
| **Redis** | localhost:6379 | Cache |

### Comandos Úteis:

```bash
# Ver logs de todos os serviços
docker compose logs -f

# Ver logs específicos
docker compose logs -f ai-engine
docker compose logs -f frontend

# Parar todos os serviços
docker compose down

# Reiniciar um serviço
docker compose restart ai-engine

# Remover volumes (reset total)
docker compose down -v
```

---

## 🆓 Alternativas Gratuitas

### 1. Fly.io (Recomendado)

```bash
# Instalar CLI
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Deploy AI Engine
flyctl apps create ai-liquidity-engine
flyctl deploy --dockerfile Dockerfile.ai

# Deploy Frontend
flyctl apps create ai-liquidity-frontend
flyctl deploy --dockerfile Dockerfile
```

**Free tier:** 3 VMs, 3GB volume, 160GB outbound/mês

### 2. Render.com

```bash
# Via Dashboard
1. Acesse https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Select Dockerfile.ai
5. Deploy
```

**Free tier:** 750 horas/mês

### 3. Google Cloud Run

```bash
# Build e push
gcloud builds submit --tag gcr.io/PROJECT_ID/ai-engine

# Deploy
gcloud run deploy ai-engine \
  --image gcr.io/PROJECT_ID/ai-engine \
  --platform managed \
  --allow-unauthenticated
```

**Free tier:** 2 milhões de requests/mês

---

## 📊 Comparativo

| Plataforma | Free Tier | Python | Node.js | DB | Redis |
|------------|-----------|--------|---------|-----|-------|
| **Docker Local** | ✅ Ilimitado | ✅ | ✅ | ✅ | ✅ |
| **Fly.io** | ✅ Generoso | ✅ | ✅ | ✅ | ✅ |
| **Render** | ✅ Limitado | ✅ | ✅ | ❌ | ❌ |
| **Railway** | ❌ Trial | ✅ | ✅ | ✅ | ✅ |
| **Cloud Run** | ✅ Generoso | ✅ | ✅ | ❌ | ❌ |

---

## 🔧 Desenvolvimento Local (sem Docker)

### Frontend:

```bash
bun install
bun run dev
# → http://localhost:3000
```

### AI Engine:

```bash
cd ai-engine
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
# → http://localhost:8000
```

### Testar API:

```bash
# Health check
curl http://localhost:8000/health

# Inference
curl -X POST http://localhost:8000/inference \
  -H "Content-Type: application/json" \
  -d '{
    "price": 1850,
    "volume_1h": 500000,
    "volume_24h": 12000000,
    "total_liquidity": 25000000,
    "active_liquidity": 12000000
  }'
```

---

## 📝 Próximos Passos

1. ✅ **Deploy local** - Docker Compose funciona agora
2. 🔄 **Adicionar cartão no Railway** - Para usar cloud
3. 🔄 **Ou usar Fly.io** - Alternativa gratuita
4. 📋 **Integrar dados reais** - Uniswap V3 subgraph
5. 📋 **Smart Contracts** - Vault.sol, Strategy.sol

---

## 🆘 Suporte

Se encontrar problemas:

1. Verifique se Docker está rodando: `docker ps`
2. Verifique logs: `docker compose logs -f`
3. Rebuild: `docker compose up --build -d`
4. Reset total: `docker compose down -v && docker compose up --build -d`
