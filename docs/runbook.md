# Runbook: Incidentes e Rotação de Chaves

> **Última atualização:** 2025-03-28
> **Responsável:** Equipe de Operações

---

## 📋 Índice

1. [Secrets Críticos](#secrets-críticos)
2. [Procedimento de Rotação](#procedimento-de-rotação)
3. [Resposta a Incidentes](#resposta-a-incidentes)
4. [Checklists](#checklists)
5. [Contatos e Comunicação](#contatos-e-comunicação)

---

## 🔐 Secrets Críticos

| Secret | Variável | Risco | Rotação | Observações |
|--------|----------|-------|---------|-------------|
| Keeper Private Key | `KEEPER_PRIVATE_KEY` | **ALTO** | Imediata | Chave que assina transações do vault |
| RPC URL Arbitrum | `RPC_URL_ARBITRUM` | **MÉDIO** | 24h | Endpoint RPC para blockchain |
| Database URL | `DATABASE_URL` | **ALTO** | Imediata | PostgreSQL connection string |
| Redis URL | `REDIS_URL` | **MÉDIO** | 24h | Cache e filas |
| Keeper Trigger Secret | `KEEPER_TRIGGER_SECRET` | **ALTO** | Imediata | Autenticação para trigger manual |
| AI Engine URL | `AI_ENGINE_URL` | **BAIXO** | 48h | Endpoint interno do AI engine |

---

## 🔄 Procedimento de Rotação

### KEEPER_PRIVATE_KEY (ALTA PRIORIDADE)

**Tempo estimado:** 15 minutos

#### Passo 1: Preparação
```bash
# 1. Gerar nova chave em ambiente seguro (offline preferencial)
# Usar wallet Ethereum compatível (MetaMask, hardware wallet, etc.)

# 2. Verificar endereço da nova chave
# Exemplo: Nova chave = 0xABC...123

# 3. Verificar se vault já está pausado (opcional, recomendado)
```

#### Passo 2: Verificação de Permissões
```bash
# A nova chave NÃO precisa de permissões específicas no vault
# O keeper opera através do strategy_manager do contrato

# Verificar se vault está acessível:
curl -X POST https://aitradinglab.cloud/api/vault \
  -H "Content-Type: application/json" \
  -d '{"action":"status"}'
```

#### Passo 3: Rotação no Coolify
1. Acessar Coolify Dashboard: `http://164.68.126.14:8000`
2. Navegar: Applications → ai-liquid-manager → Environment Variables
3. Localizar `KEEPER_PRIVATE_KEY`
4. Atualizar valor com nova chave
5. **NÃO** salvar ainda - preparar rollback

#### Passo 4: Deploy e Validação
```bash
# 1. Salvar variável no Coolify
# 2. Trigger deploy automático ou manual
# 3. Aguardar 2-3 minutos para aplicação reiniciar

# 4. Testar novo keeper
curl -X POST https://aitradinglab.cloud/api/keeper/trigger \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $KEEPER_TRIGGER_SECRET"

# 5. Verificar logs do AI Engine
# Deve aparecer: "Keeper cycle completed successfully"
```

#### Passo 5: Comunicação
```
[CANAL #ops]
🔐 ROTAÇÃO KEEPER_PRIVATE_KEY
- Timestamp: YYYY-MM-DD HH:MM UTC
- Executado por: [nome]
- Status: ✅ Sucesso / ❌ Falha
- Nova chave: 0xABC...123 (primeiros/últimos caracteres)
- Tx de teste: [hash se aplicável]
```

---

### RPC_URL_ARBITRUM (MÉDIA PRIORIDADE)

**Tempo estimado:** 10 minutos

#### Provedores Recomendados
| Provedor | URL | Rate Limit |
|----------|-----|------------|
| Arbitrum Official | `https://arb1.arbitrum.io/rpc` | Alto |
| Alchemy | `https://arb-mainnet.g.alchemy.com/v2/{KEY}` | Variável |
| Infura | `https://arbitrum-mainnet.infura.io/v3/{KEY}` | Variável |
| Ankr | `https://rpc.ankr.com/arbitrum` | Médio |

#### Passo 1: Obter Novo RPC
```bash
# Testar conectividade do novo RPC
curl -X POST https://novo-rpc-url \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

#### Passo 2: Atualizar no Coolify
1. Environment Variables → `RPC_URL_ARBITRUM`
2. Atualizar URL
3. Deploy

#### Passo 3: Validar
```bash
# Verificar se aplicação consegue ler vault
curl https://aitradinglab.cloud/api/vault
# Deve retornar TVL e share price
```

---

### KEEPER_TRIGGER_SECRET (ALTA PRIORIDADE)

**Tempo estimado:** 5 minutos

#### Passo 1: Gerar Novo Secret
```bash
# Gerar secret aleatório seguro
openssl rand -hex 32
# Output: 64 caracteres hexadecimais
```

#### Passo 2: Atualizar Variáveis
1. Coolify → Environment Variables → `KEEPER_TRIGGER_SECRET`
2. Atualizar valor
3. Deploy

#### Passo 3: Comunicar Nova Equipe
- Distribuir novo secret apenas para administradores autorizados
- Documentar em gestor de senhas seguro (1Password, Bitwarden, etc.)

---

## 🚨 Resposta a Incidentes

### Cenário 1: Vazamento de KEEPER_PRIVATE_KEY

**Severidade:** CRÍTICA
**SLA de Resposta:** 15 minutos

#### Detecção
- Monitoramento de transações não autorizadas no vault
- Alertas de segurança externos
- Denúncia de terceiros

#### Ação Imediata
1. **PAUSAR VAULT** (se possível)
   ```bash
   # Via contrato (requer owner)
   # Function: pause()
   ```

2. **Rotacionar chave** (ver procedimento acima)

3. **Investigar**
   - Verificar transações recentes: https://arbiscan.io/address/{vault}
   - Verificar logs do AI Engine
   - Identificar origem do vazamento

4. **Comunicar**
   - Notificar equipe de segurança
   - Preparar comunicado para investidores se necessário

---

### Cenário 2: RPC Indisponível

**Severidade:** ALTA
**SLA de Resposta:** 30 minutos

#### Sintomas
- Dashboard mostra "Fallback" ou erro
- Keeper falha ao executar
- Transações não são broadcastadas

#### Ação
1. Verificar status do provedor RPC atual
2. Rotacionar para backup RPC
3. Validar funcionamento

---

### Cenário 3: Keeper Não Executa

**Severidade:** MÉDIA
**SLA de Resposta:** 1 hora

#### Diagnóstico
```bash
# 1. Verificar status do AI Engine
curl http://164.68.126.14:8001/health

# 2. Verificar status do keeper
curl http://164.68.126.14:8001/keeper/status

# 3. Verificar logs do container
docker logs ai-liquid-manager-ai-engine-1 --tail 100
```

#### Ações
1. Reiniciar AI Engine container
2. Verificar variáveis de ambiente
3. Executar trigger manual para teste

---

## ✅ Checklists

### Pre-Deploy Checklist

```markdown
## Rede e Ambiente
- [ ] NEXT_PUBLIC_CHAIN_ID = 42161 (mainnet) ou 421614 (testnet)
- [ ] RPC_URL_ARBITRUM configurado e acessível
- [ ] VAULT_USDC_ADDRESS corresponde ao chain ID
- [ ] VAULT_USDT_ADDRESS corresponde ao chain ID

## Secrets
- [ ] KEEPER_PRIVATE_KEY configurado
- [ ] KEEPER_TRIGGER_SECRET configurado
- [ ] DATABASE_URL acessível
- [ ] AI_ENGINE_URL interno configurado

## Validação
- [ ] Health check passou
- [ ] Log de validação de rede sem erros
- [ ] Keeper status = running
```

### Pós-Rotação Checklist

```markdown
## Validação
- [ ] Novo secret/variável aplicado
- [ ] Deploy concluído com sucesso
- [ ] Health check passou
- [ ] Keeper trigger responde 200 OK
- [ ] Vault read funciona (TVL visível)

## Auditoria
- [ ] Log de rotação registrado
- [ ] Comunicação enviada para #ops
- [ ] Documentação atualizada
```

---

## 📞 Contatos e Comunicação

### Canais de Comunicação
| Canal | Uso |
|-------|-----|
| #ops | Operações diárias, rotações, alertas |
| #security | Incidentes de segurança, vazamentos |
| #incidents | Resposta a incidentes críticos |

### Escalação
| Nível | Tempo | Responsável |
|-------|-------|-------------|
| L1 | 0-15 min | Operador de plantão |
| L2 | 15-60 min | Tech Lead |
| L3 | 60+ min | CTO / Founder |

### Contatos de Emergência
- **Operações:** [definir]
- **Tech Lead:** [definir]
- **CTO:** [definir]

---

## 📝 Histórico de Rotações

| Data | Secret Rotacionado | Executado por | Status |
|------|-------------------|---------------|--------|
| - | - | - | - |

> Mantenha este registro atualizado após cada rotação.

---

## 🔗 Links Úteis

- **Coolify Dashboard:** http://164.68.126.14:8000
- **Aplicação:** https://aitradinglab.cloud
- **Arbiscan (Vault USDC):** https://arbiscan.io/address/0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C
- **Arbiscan (Vault USDT):** https://arbiscan.io/address/0x12a20d3569da6DD2d99E7bC95748283B10729c4C
- **Repositório:** https://github.com/isanat/AI_Liquid_manager
