'use client';

import { useState } from 'react';
import {
  BookOpen, ChevronRight, Shield, Layers, Brain, Zap,
  Code2, Server, Database, GitBranch, Cpu, DollarSign,
  ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function Section({ id, icon: Icon, color, title, badge, children }: {
  id: string; icon: React.ElementType; color: string; title: string; badge?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="bg-zinc-900/50 border-zinc-800" id={id}>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-zinc-800`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <CardTitle className="text-zinc-100 text-base">{title}</CardTitle>
              {badge && <Badge variant="outline" className="mt-1 text-[10px] text-zinc-400 border-zinc-700">{badge}</Badge>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
        </div>
      </CardHeader>
      {open && <CardContent className="pt-0 space-y-4">{children}</CardContent>}
    </Card>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-emerald-400 bg-zinc-800/80 px-1.5 py-0.5 rounded text-xs">{children}</code>;
}

function Block({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-lg bg-zinc-950/80 border border-zinc-800">
      {title && <div className="px-4 py-2 border-b border-zinc-800 text-[10px] text-zinc-500 font-mono">{title}</div>}
      <pre className="p-4 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre">{children}</pre>
    </div>
  );
}

function Row({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-zinc-800/50 last:border-0">
      <div>
        <p className="text-xs font-medium text-zinc-300">{label}</p>
        {detail && <p className="text-[10px] text-zinc-500 mt-0.5">{detail}</p>}
      </div>
      <span className="text-xs font-mono text-emerald-400 text-right ml-4 shrink-0">{value}</span>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
          <Shield className="h-3 w-3" />
          <span>Admin</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-300">Como Funciona</span>
        </div>
        <h1 className="text-3xl font-bold text-zinc-100">Documentação Técnica Completa</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Tudo que você precisa saber para entender, operar e customizar o sistema.
        </p>
      </div>

      {/* TOC */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="pt-4">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Índice</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
            {[
              ['#architecture', '1. Arquitectura'],
              ['#contract', '2. Contrato Inteligente'],
              ['#ai', '3. Motor de IA'],
              ['#keeper', '4. Keeper Bot'],
              ['#fees', '5. Modelo de Taxas'],
              ['#data', '6. Fontes de Dados'],
              ['#frontend', '7. Frontend'],
              ['#env', '8. Variáveis de Ambiente'],
              ['#flow', '9. Fluxo Completo'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-xs text-zinc-400 hover:text-violet-400 transition-colors py-0.5 flex items-center gap-1">
                <ChevronRight className="h-2.5 w-2.5" />{label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 1. Architecture */}
      <Section id="architecture" icon={Layers} color="text-violet-400" title="1. Arquitectura do Sistema" badge="Overview">
        <p className="text-sm text-zinc-400 leading-relaxed">
          O sistema é composto por <strong className="text-zinc-200">três serviços independentes</strong> que comunicam entre si.
          O frontend serve os investidores, o motor de IA gera estratégias, e o contrato na blockchain custodia os activos.
        </p>
        <Block title="Diagrama de Camadas">{`
CAMADA DE UTILIZADOR
  ┌─────────────────────────────────────────────────────┐
  │  Frontend (Next.js)  ←→  Wallet (MetaMask/WalletConnect) │
  └──────────────────────────────┬──────────────────────┘
                                 │
CAMADA DE LÓGICA
  ┌──────────────────────────────▼──────────────────────┐
  │  AI Engine (FastAPI Python)                          │
  │  ├── LightGBM: Range Width Predictor                 │
  │  ├── LightGBM: Capital Allocator                     │
  │  ├── LightGBM: Market Regime Classifier              │
  │  └── Keeper Bot (APScheduler — a cada 15 min)        │
  └──────────────────────────────┬──────────────────────┘
                                 │
CAMADA DE BLOCKCHAIN
  ┌──────────────────────────────▼──────────────────────┐
  │  Contrato AILiquidVault (Solidity ERC-4626)          │
  │  ├── Custódia USDC dos investidores                  │
  │  ├── Emissão de shares vAI                           │
  │  └── Posições LP no Uniswap V3                       │
  └─────────────────────────────────────────────────────┘
                                 │
CAMADA DE DEX
  ┌──────────────────────────────▼──────────────────────┐
  │  Uniswap V3 (Arbitrum One)                           │
  │  Pool: USDC/WETH 0.05% → gera fees de trading       │
  └─────────────────────────────────────────────────────┘`}
        </Block>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: 'Frontend', tech: 'Next.js 15 / React / Tailwind', port: ':3000', color: 'text-violet-400' },
            { name: 'AI Engine', tech: 'FastAPI / LightGBM / Python 3.11', port: ':8000', color: 'text-emerald-400' },
            { name: 'Blockchain', tech: 'Solidity 0.8.24 / Arbitrum One', port: 'Chain ID 42161', color: 'text-cyan-400' },
          ].map(s => (
            <div key={s.name} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <p className={`text-xs font-bold ${s.color}`}>{s.name}</p>
              <p className="text-[10px] text-zinc-500 mt-1">{s.tech}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">{s.port}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 2. Smart Contract */}
      <Section id="contract" icon={Shield} color="text-cyan-400" title="2. Contrato Inteligente — AILiquidVault">
        <p className="text-sm text-zinc-400 leading-relaxed">
          O coração do sistema é um contrato <strong className="text-zinc-200">ERC-4626</strong> — o padrão de vault tokenizado do Ethereum.
          Os investidores depositam USDC e recebem shares <Mono>vAI</Mono> que representam a sua quota do vault.
          À medida que o vault ganha fees de LP, o preço das shares sobe automaticamente.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            {[
              { label: 'Standard', value: 'ERC-4626 (Tokenized Vault)' },
              { label: 'Activo aceite', value: 'USDC (6 decimais)' },
              { label: 'Share Token', value: 'vAI (18 decimais)' },
              { label: 'Controlo acesso', value: 'Ownable2Step + Pausable' },
              { label: 'Reentrancy', value: 'ReentrancyGuard (OpenZeppelin)' },
              { label: 'DEX alvo', value: 'Uniswap V3 NPM' },
            ].map(r => <Row key={r.label} label={r.label} value={r.value} />)}
          </div>
          <div className="space-y-1">
            {[
              { label: 'Taxa de Gestão', value: '200 BPS (2%/ano)', detail: 'acumulada a cada interacção' },
              { label: 'Taxa de Performance', value: '2000 BPS (20%)', detail: 'sobre lucro acima do HWM' },
              { label: 'Máx. Taxa Gestão', value: '500 BPS (5%)' },
              { label: 'Máx. Taxa Perf.', value: '3000 BPS (30%)' },
              { label: 'Fee Tier Pool', value: '500 BPS (0.05%)' },
              { label: 'Tick Spacing', value: '10 ticks' },
            ].map(r => <Row key={r.label} label={r.label} value={r.value} detail={r.detail} />)}
          </div>
        </div>
        <Block title="totalAssets() — Como é calculado o valor total">{`
// O vault sabe exatamente quanto vale:
function totalAssets() public view override returns (uint256) {
    return
        IERC20(asset()).balanceOf(address(this))  // USDC idle no vault
        + deployedCapital;                          // USDC nas posições LP
}

// Preço de cada share (em USDC, 6 decimais):
function sharePrice() external view returns (uint256) {
    uint256 supply = totalSupply();
    if (supply == 0) return 1e6;              // 1 USDC inicial
    return (totalAssets() * 1e18) / supply;  // sobe quando fees entram
}`}
        </Block>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-400">Roles e Permissões</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { role: 'owner', perms: ['setFees()', 'setStrategyManager()', 'pause()', 'emergencyExit()'], color: 'text-rose-400' },
              { role: 'strategyManager (keeper)', perms: ['rebalance()', 'collectFees()'], color: 'text-amber-400' },
              { role: 'depositor (qualquer)', perms: ['deposit()', 'mint()', 'withdraw()', 'redeem()'], color: 'text-emerald-400' },
            ].map(r => (
              <div key={r.role} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${r.color} mb-2`}>{r.role}</p>
                {r.perms.map(p => (
                  <p key={p} className="text-[10px] font-mono text-zinc-400">{p}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 3. AI Engine */}
      <Section id="ai" icon={Brain} color="text-violet-400" title="3. Motor de Inteligência Artificial" badge="LightGBM">
        <p className="text-sm text-zinc-400 leading-relaxed">
          Em vez de um LLM (lento, caro, imprevisível), o sistema usa <strong className="text-zinc-200">LightGBM</strong> —
          um gradient boosted decision tree que corre em {'<'}10ms, é determinístico e treina com dados reais da blockchain.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: 'Range Width Predictor', type: 'Regressão', desc: 'Decide a largura ±% da range (4%–15%)', color: 'text-violet-400' },
            { name: 'Capital Allocator', type: 'Multi-Regressão', desc: 'Divide o capital: core/defensivo/oportunista', color: 'text-emerald-400' },
            { name: 'Regime Classifier', type: 'Classificação', desc: 'Detecta: TREND / RANGE / HIGH_VOL / LOW_VOL', color: 'text-cyan-400' },
          ].map(m => (
            <div key={m.name} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-1">
              <Badge variant="outline" className="text-[9px] border-zinc-600 text-zinc-400">{m.type}</Badge>
              <p className={`text-xs font-semibold ${m.color}`}>{m.name}</p>
              <p className="text-[10px] text-zinc-500">{m.desc}</p>
            </div>
          ))}
        </div>
        <Block title="29 Features de Input — O que a IA analisa">{`
PREÇO (5 features)
  price, twap_1h, twap_24h, price_velocity, price_acceleration

VOLATILIDADE (6 features)
  volatility_1d, volatility_7d, volatility_30d,
  realized_volatility, parkinson_volatility, garman_klass_volatility

VOLUME (5 features)
  volume_1h, volume_24h, volume_7d_avg, volume_spike_ratio, volume_trend

LIQUIDEZ (4 features)
  total_liquidity, active_liquidity, liquidity_depth, liquidity_concentration

FEES (3 features)
  fee_rate_24h, fee_rate_7d_avg, fee_trend

TEMPO (3 features)
  hour_of_day [0-23], day_of_week [0-6], is_weekend [bool]

DERIVADAS (3 features)
  price_drift, range_position, liquidity_efficiency`}
        </Block>
        <Block title="Output — O que a IA decide em cada ciclo">{`
{
  "current_price": 2500.0,        // Preço actual ETH/USDC
  "range_width":   0.06,          // ±6% à volta do preço actual
  "core_pct":      0.70,          // Deploy 70% do capital idle
  "confidence":    0.85,          // Confiança do modelo
  "regime":        "range",       // Estado do mercado detectado
  "model_version": "lgbm-v1-loaded"
}`}
        </Block>
        <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
          <p className="text-xs font-semibold text-zinc-300 mb-2">Hierarquia de Fallback (se não há dados)</p>
          <div className="space-y-1">
            {[
              ['1°', 'Modelo LightGBM treinado em disco', 'text-emerald-400'],
              ['2°', 'Re-treino automático com The Graph (dados reais)', 'text-cyan-400'],
              ['3°', 'Re-treino com CoinGecko (365 dias histórico)', 'text-amber-400'],
              ['4°', 'Re-treino com dados sintéticos (GBM simulado)', 'text-orange-400'],
              ['5°', 'Regras determinísticas (sem ML — seguro mas básico)', 'text-red-400'],
            ].map(([n, label, color]) => (
              <div key={n as string} className="flex items-center gap-2 text-[11px]">
                <span className={`font-bold ${color} w-4 shrink-0`}>{n as string}</span>
                <span className="text-zinc-400">{label as string}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 4. Keeper Bot */}
      <Section id="keeper" icon={Zap} color="text-amber-400" title="4. Keeper Bot — Execução Automática">
        <p className="text-sm text-zinc-400 leading-relaxed">
          O keeper é um processo Python que corre a cada <strong className="text-zinc-200">15 minutos</strong>.
          Chama a IA, converte as sugestões em ticks Uniswap V3, executa o rebalance on-chain, e colecta fees.
          Nunca pára — é o "motor" do sistema.
        </p>
        <Block title="Ciclo Completo (cada 15 minutos)">{`
PASSO 1: Verificar se vault não está pausado
  ← vault.paused() == false → continua

PASSO 2: Ler USDC idle no vault
  ← IERC20(USDC).balanceOf(vault) → ex: $50,000

PASSO 3: Chamar IA /predict
  → GET http://ai-engine:8000/predict
  ← { current_price: 2500, range_width: 0.06, core_pct: 0.70 }

PASSO 4: Calcular ticks Uniswap V3
  lower_price = 2500 × (1 - 0.06) = $2,350
  upper_price = 2500 × (1 + 0.06) = $2,650

  tick = floor(ln(price × 1e12) / ln(1.0001))
  → Arredondado ao tick spacing (10)
  → Clamped: [-887272, +887272]

PASSO 5: Calcular USDC a deployar
  amount = $50,000 × min(core_pct=0.70, USDC_DEPLOY_PCT=0.80)
         = $50,000 × 0.70 = $35,000 USDC

PASSO 6: vault.rebalance(tickLower, tickUpper, 35000e6, 0)
  → Fecha todas as posições LP existentes
  → Abre nova posição no range calculado
  → deployedCapital += 35,000
  → _chargePerformanceFee() se houve lucro

PASSO 7: vault.collectFees()
  → Colecta fees acumuladas das posições
  → USDC + WETH voltam ao vault

PASSO 8: Actualizar keeper_state
  → last_run, last_tx_hash, total_rebalances
  → Disponível em GET /keeper/status`}
        </Block>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Gas Rebalance', value: '~800,000 gas', detail: 'Buffer: 110% do gas atual' },
            { label: 'Gas collectFees', value: '~300,000 gas', detail: 'Por posição ativa' },
            { label: 'Timeout TX', value: '120 segundos', detail: 'Antes de considerar falha' },
            { label: 'Intervalo', value: '15 min (900s)', detail: 'Configurável via REBALANCE_INTERVAL' },
          ].map(r => <Row key={r.label} label={r.label} value={r.value} detail={r.detail} />)}
        </div>
      </Section>

      {/* 5. Fee Model */}
      <Section id="fees" icon={DollarSign} color="text-emerald-400" title="5. Modelo de Taxas Detalhado">
        <p className="text-sm text-zinc-400 leading-relaxed">
          O vault tem <strong className="text-zinc-200">dois tipos de taxa</strong> que geram receita para o operador.
          Ambas são cobradas automaticamente on-chain em cada interacção, sem intervenção manual.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-2">
            <p className="text-xs font-bold text-emerald-400">Taxa de Gestão (Management Fee)</p>
            <p className="text-2xl font-bold text-zinc-100">2% / ano</p>
            <p className="text-[10px] text-zinc-500">200 BPS — Acumulada proporcionalmente por segundo em cada depósito/levantamento</p>
            <Block title="Fórmula">{`feeAssets = totalAssets
  × managementFeeBps (200)
  × elapsedSeconds
  ÷ (10,000 × 365 days)

→ Convertido em shares vAI
→ Mintado para feeRecipient`}
            </Block>
          </div>
          <div className="p-4 rounded-lg bg-violet-500/5 border border-violet-500/20 space-y-2">
            <p className="text-xs font-bold text-violet-400">Taxa de Performance</p>
            <p className="text-2xl font-bold text-zinc-100">20% do lucro</p>
            <p className="text-[10px] text-zinc-500">2000 BPS — Cobrada apenas sobre lucro ACIMA do high-water mark</p>
            <Block title="Fórmula">{`if (totalAssets > highWaterMark):
  profit = totalAssets - highWaterMark
  feeAssets = profit × 20%
  highWaterMark = totalAssets ← reset

→ Convertido em shares vAI
→ Mintado para feeRecipient`}
            </Block>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
          <p className="text-xs font-semibold text-zinc-300 mb-2">Exemplo: Vault de $1M com $300k de lucro</p>
          <div className="space-y-1 text-xs text-zinc-400">
            <div className="flex justify-between"><span>AUM Total</span><span className="font-mono text-zinc-100">$1,000,000</span></div>
            <div className="flex justify-between"><span>Taxa de Gestão anual (2%)</span><span className="font-mono text-emerald-400">$20,000</span></div>
            <div className="flex justify-between"><span>Lucro acima HWM</span><span className="font-mono text-zinc-100">$300,000</span></div>
            <div className="flex justify-between"><span>Taxa de Performance (20%)</span><span className="font-mono text-emerald-400">$60,000</span></div>
            <div className="flex justify-between border-t border-zinc-700 pt-1 mt-1"><span className="font-semibold text-zinc-200">Total anual para o operador</span><span className="font-mono text-emerald-400 font-bold">$80,000</span></div>
          </div>
        </div>
      </Section>

      {/* 6. Data Sources */}
      <Section id="data" icon={Database} color="text-cyan-400" title="6. Fontes de Dados">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-2">
            <p className="text-xs font-bold text-cyan-400">The Graph — Subgraph Uniswap V3</p>
            <p className="text-[10px] text-zinc-500">Dados on-chain: preço horário, volume, TVL, fees, liquidez por tick</p>
            <p className="text-[10px] font-mono text-zinc-600">Subgraph ID: 5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV</p>
            <Badge variant="outline" className="text-[9px] text-cyan-400 border-cyan-500/30">API Key necessária para produção</Badge>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-2">
            <p className="text-xs font-bold text-amber-400">CoinGecko — Preço ETH</p>
            <p className="text-[10px] text-zinc-500">Fallback gratuito: histórico 365 dias, 30 req/min sem API key</p>
            <p className="text-[10px] font-mono text-zinc-600">api.coingecko.com/api/v3/coins/ethereum/market_chart</p>
            <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30">Gratuito — sem key necessária</Badge>
          </div>
        </div>
      </Section>

      {/* 7. Frontend */}
      <Section id="frontend" icon={Code2} color="text-violet-400" title="7. Frontend — Stack Técnico">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            {[
              { label: 'Framework', value: 'Next.js 15 (App Router)' },
              { label: 'UI Library', value: 'shadcn/ui + Radix UI' },
              { label: 'Styling', value: 'Tailwind CSS v3' },
              { label: 'Web3', value: 'Wagmi v2 + Viem v2' },
              { label: 'Wallet', value: 'WalletConnect + MetaMask' },
              { label: 'Estado', value: 'Zustand + React Query' },
              { label: 'Charts', value: 'Recharts' },
            ].map(r => <Row key={r.label} label={r.label} value={r.value} />)}
          </div>
          <div className="space-y-1">
            {[
              { label: 'Rota principal', value: '/ → Dashboard' },
              { label: 'Rota admin', value: '/admin → Esta área' },
              { label: 'API market data', value: '/api/liquidity' },
              { label: 'API vault', value: '/api/vault' },
              { label: 'API AI proxy', value: '/api/ai' },
              { label: 'Refresh de mercado', value: 'Cada 30 segundos' },
              { label: 'Refresh de preços', value: 'Cada 5 minutos' },
            ].map(r => <Row key={r.label} label={r.label} value={r.value} />)}
          </div>
        </div>
      </Section>

      {/* 8. Env Vars */}
      <Section id="env" icon={Server} color="text-orange-400" title="8. Variáveis de Ambiente">
        <Block title="AI Engine / Keeper (obrigatórias)">{`
VAULT_ADDRESS          = "0xF9FD652453801749768e5660bbE624Ee90bE39a3"
KEEPER_PRIVATE_KEY     = "0x..."         # EOA do strategy manager
RPC_URL_ARBITRUM       = "https://arb1.arbitrum.io/rpc"
AI_ENGINE_URL          = "http://localhost:8000"

# Opcionais
THE_GRAPH_API_KEY      = "..."           # Aumenta rate limits
THE_GRAPH_API_KEY2     = "..."           # Chave de backup
REBALANCE_INTERVAL     = "15"           # Minutos (default: 15)
USDC_DEPLOY_PCT        = "80"           # % a deployar (default: 80)
POOL_ADDRESS           = "0xC6962004f452bE9203591991D15f6b388e09E8D0"`}
        </Block>
        <Block title="Frontend (Next.js)">{`
NEXT_PUBLIC_VAULT_ADDRESS         = "0xF9FD652453801749768e5660bbE624Ee90bE39a3"
NEXT_PUBLIC_CHAIN_ID              = "42161"   # 42161=Mainnet, 421614=Sepolia
NEXT_PUBLIC_AI_ENGINE_URL         = "https://your-ai-engine.onrender.com"
NEXT_PUBLIC_WC_PROJECT_ID         = "..."     # WalletConnect Project ID
AI_ENGINE_URL                     = "http://ai-engine:8000"  # Server-side
THE_GRAPH_API_KEY                 = "..."     # Server-side proxy`}
        </Block>
      </Section>

      {/* 9. Full Flow */}
      <Section id="flow" icon={GitBranch} color="text-rose-400" title="9. Fluxo Completo — Depósito ao Rendimento">
        <Block title="Jornada completa de $10,000 USDC">{`
01. Investidor aprova USDC: ERC20.approve(vault, 10000e6)
02. Investidor deposita:    vault.deposit(10000e6, investidor)
    ├── _chargeManagementFee() ← acumula taxa desde última interacção
    ├── Transfere 10,000 USDC do investidor → vault
    ├── Minta shares vAI = 10,000 / sharePrice
    └── highWaterMark = totalAssets [se primeiro depósito]

03. [15 min depois] Keeper executa ciclo:
    ├── Chama AI /predict → {range_width: 6%, core_pct: 70%}
    ├── Calcula ticks: $2350–$2650 → tickLower/tickUpper
    ├── vault.rebalance(tickLower, tickUpper, 7000e6, 0)
    │   ├── Fecha posições antigas
    │   ├── Abre posição LP Uniswap V3: $7,000 USDC na range
    │   ├── deployedCapital = $7,000
    │   └── _chargePerformanceFee() se totalAssets > HWM
    └── vault.collectFees() ← fees acumuladas voltam ao vault

04. [Traders swapam através da pool]
    Cada swap que passa pela range $2350–$2650:
    → Taxa de 0.05% é dividida pelos LPs proporcional
    → Ex: $10M de volume = $5,000 em fees

05. [15 min depois] Keeper volta:
    ├── collectFees() ← $5,000 de fees entram no vault
    ├── totalAssets = $10,000 idle + $7,000 LP + $5,000 fees = $22,000
    └── sharePrice subiu: $22,000 / totalShares ← todos os holders ganham

06. Investidor levanta:
    vault.redeem(sharesAmount, investidor, investidor)
    ├── _chargeManagementFee()
    ├── USDC out = sharesAmount × sharePrice [agora mais alto]
    └── Transfere USDC → investidor`}
        </Block>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <Cpu className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-xs text-zinc-300">
            <strong className="text-emerald-400">Resultado:</strong> O investidor recebe de volta os $10,000 originais
            + a sua quota dos fees de LP colectados, descontadas as taxas do vault.
            Tudo automático, 24/7, sem intervenção humana.
          </p>
        </div>
      </Section>

      {/* Back */}
      <div className="flex items-center gap-2 pt-4">
        <a href="/admin" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowRight className="h-3 w-3 rotate-180" /> Voltar ao Admin Dashboard
        </a>
      </div>

    </div>
  );
}
