# 🚀 Deploy Guide - Render.com

O **Render** é uma alternativa superior ao Railway para o seu caso:
- ✅ **Free tier permanente** (não expira)
- ✅ **Sem cartão de crédito obrigatório**
- ✅ **Deploy automático via GitHub**
- ✅ **SSL automático**
- ✅ **Domínio gratuito**

---

## 📋 Pré-requisitos

1. Conta no GitHub (já tem)
2. Conta no Render (gratuita)
3. Repositório: `isanat/AI_Liquid_manager`

---

## 🔧 Deploy Passo a Passo

### Passo 1: Criar Conta no Render

1. Acesse: https://render.com
2. Clique em **"Get Started for Free"**
3. Conecte com GitHub (recomendado)

### Passo 2: Deploy do AI Engine (Python)

1. **Dashboard** → **New +** → **Web Service**
2. **Connect repository:** `isanat/AI_Liquid_manager`
3. **Configure:**

```
Name: ai-liquidity-engine
Region: Oregon (mais rápido para Brasil)
Branch: master
Root Directory: (deixe vazio)
Runtime: Python 3
Build Command: pip install -r ai_engine/requirements.txt
Start Command: python -m uvicorn ai_engine.api.main:app --host 0.0.0.0 --port $PORT
Instance Type: Free
```

4. **Environment Variables:**
```
PYTHONUNBUFFERED=1
PYTHONPATH=/opt/render/project/src
```

5. **Create Web Service**

### Passo 3: Deploy do Frontend (Next.js)

1. **Dashboard** → **New +** → **Web Service**
2. **Configure:**

```
Name: ai-liquidity-frontend
Region: Oregon
Branch: master
Runtime: Node
Build Command: bun install && bun run build
Start Command: node server.js
Instance Type: Free
```

3. **Environment Variables:**
```
AI_ENGINE_URL=https://ai-liquidity-engine.onrender.com
NODE_ENV=production
```

4. **Create Web Service**

### Passo 4: Adicionar PostgreSQL (Opcional)

1. **Dashboard** → **New +** → **PostgreSQL**
2. **Configure:**
```
Name: liquidity-db
Region: Oregon
PostgreSQL Version: 15
Instance Type: Free
```

3. **Connection string** será fornecida automaticamente

---

## 🔄 Auto-Deploy

O Render automaticamente:
- Monitora seu repositório GitHub
- Faz deploy a cada push no branch master
- Reinicia serviços se crashar

---

## 💰 Custos

| Serviço | Plano | Custo |
|---------|-------|-------|
| AI Engine | Free | $0 |
| Frontend | Free | $0 |
| PostgreSQL | Free | $0 |
| **Total** | | **$0/mês** |

**Limite Free Tier:**
- 750 horas/mês por serviço
- Spins down após inatividade (15 min para acordar)

---

## 🆚 Comparativo: Railway vs Render

| Feature | Railway | Render |
|---------|---------|--------|
| Free tier | Expira | ✅ Permanente |
| Cartão | Obrigatório | ✅ Opcional |
| Deploy | Complexo | ✅ Simples |
| PORT issue | Problemas | ✅ Automático |
| API token | Limitado | ✅ Completo |
| PostgreSQL free | Não | ✅ Sim |
| Logs | Bom | ✅ Bom |

---

## 📝 URLs Finais

Após deploy:

```
Frontend:  https://ai-liquidity-frontend.onrender.com
API:       https://ai-liquidity-engine.onrender.com
API Docs:  https://ai-liquidity-engine.onrender.com/docs
Health:    https://ai-liquidity-engine.onrender.com/health
```

---

## ⚠️ Notas Importantes

1. **Cold Start:** Free tier "adormece" após 15 min de inatividade
   - Primeira requisição demora ~30 segundos
   - Depois fica rápido

2. **750 horas/mês:** Suficiente para 1 serviço 24/7
   - Para 2 serviços: 15 horas/dia cada
   - Ou use 1 serviço principal

3. **Upgrade:** Se precisar 24/7 sem cold start
   - Starter plan: $7/mês
   - Inclui mais recursos

---

## 🔗 Links

- **Render Dashboard:** https://dashboard.render.com
- **Docs:** https://render.com/docs
- **Status:** https://status.render.com
