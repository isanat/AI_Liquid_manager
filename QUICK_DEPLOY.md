# 🚀 Render.com Deploy - 5 Minutos

## ⚡ Deploy Manual (Mais Fácil)

### Passo 1: Acesse o Render
👉 **https://dashboard.render.com**

### Passo 2: Crie o AI Engine (Python)

1. Clique **"New +"** → **"Web Service"**

2. Conecte seu GitHub: `isanat/AI_Liquid_manager`

3. Configure:

```
┌─────────────────────────────────────────────────────┐
│ Name:          ai-liquidity-engine                  │
│ Region:        Oregon                               │
│ Branch:        master                               │
│ Root:          (deixe vazio)                        │
│ Runtime:       Python 3                             │
│ Build Command: pip install -r ai_engine/requirements.txt │
│ Start Command: python -m ai_engine.api.main --host 0.0.0.0 --port $PORT │
│ Instance Type: Free                                 │
└─────────────────────────────────────────────────────┘
```

4. **Environment Variables** (clique "Add Environment Variable"):

```
PYTHONUNBUFFERED = 1
PYTHONPATH = /opt/render/project/src
```

5. **Advanced** → **Health Check Path**: `/health`

6. Clique **"Create Web Service"**

---

### Passo 3: Aguarde o Deploy (~3 min)

O Render vai:
- Fazer clone do GitHub
- Instalar dependências
- Iniciar o serviço
- Verificar health check

---

### Passo 4: Verifique se funcionou

Acesse: `https://ai-liquidity-engine.onrender.com/health`

Resposta esperada:
```json
{
  "status": "healthy",
  "model_loaded": false,
  "model_version": "rule-based-v1",
  "uptime_seconds": 10.5
}
```

---

## 📋 URLs Finais

Após deploy bem-sucedido:

| Serviço | URL |
|---------|-----|
| API | https://ai-liquidity-engine.onrender.com |
| Docs | https://ai-liquidity-engine.onrender.com/docs |
| Health | https://ai-liquidity-engine.onrender.com/health |

---

## ⚠️ Troubleshooting

### Erro: "Failed to install dependencies"
```
Solução: Verifique se requirements.txt está correto
```

### Erro: "Health check failed"
```
Solução: Aguarde 2-3 minutos para o serviço iniciar
```

### Erro: "Application crashed"
```
Solução: Verifique os logs em tempo real
```

---

## 📞 Suporte

- **Render Status:** https://status.render.com
- **Docs:** https://render.com/docs/deploy-python
- **Discord:** https://discord.gg/render
