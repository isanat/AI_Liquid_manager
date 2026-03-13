'use client';

import {
  Globe, ChevronRight, Shield, DollarSign, TrendingUp,
  Users, Zap, CheckCircle, Package, Settings,
  ArrowRight, Star, Building2, Rocket, Lock,
  BarChart3, Coins, RefreshCw, FileText, Server,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function Check({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
      <span className="text-xs text-zinc-300">{children}</span>
    </div>
  );
}

function Step({ n, icon: Icon, color, title, desc, sub }: {
  n: string; icon: React.ElementType; color: string; title: string; desc: string; sub?: string[];
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="w-px flex-1 bg-zinc-800 my-1 min-h-[20px]" />
      </div>
      <div className="pb-6">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className={`text-[9px] border-zinc-700 ${color}`}>Passo {n}</Badge>
          <p className="text-sm font-semibold text-zinc-100">{title}</p>
        </div>
        <p className="text-xs text-zinc-500">{desc}</p>
        {sub && <div className="mt-2 space-y-1">{sub.map(s => <Check key={s}>{s}</Check>)}</div>}
      </div>
    </div>
  );
}

export default function WhitelabelPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
          <Shield className="h-3 w-3" />
          <span>Admin</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-300">Guia White-Label</span>
        </div>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20">
            <Globe className="h-7 w-7 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Guia de Revenda White-Label</h1>
            <p className="text-zinc-400 mt-1 text-sm max-w-2xl">
              Como transformar este sistema numa empresa de gestão de fundos DeFi.
              Tudo que você precisa para lançar, vender e lucrar — mesmo sem saber programar.
            </p>
          </div>
        </div>
      </div>

      {/* What is it */}
      <Card className="bg-gradient-to-br from-violet-500/10 to-zinc-900/50 border-violet-500/20">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Star className="h-5 w-5 text-violet-400" />
            O que é este Sistema?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            O <strong className="text-violet-300">AI Liquid Manager</strong> é uma plataforma completa de
            <strong className="text-zinc-100"> gestão automatizada de liquidez em DeFi</strong>.
            Em termos simples: os seus clientes depositam USDC, a IA gere o dinheiro deles em pools de liquidez
            do Uniswap V3, e você ganha uma percentagem de todo o dinheiro gerido — automaticamente, 24/7, sem intervenção humana.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Building2, color: 'text-violet-400', label: 'Gestor de Fundo', desc: 'Você é o operador. Define as taxas. Recebe as comissões.' },
              { icon: Users,     color: 'text-emerald-400', label: 'Os seus Clientes', desc: 'Depositam USDC. Recebem rendimentos automáticos.' },
              { icon: Zap,       color: 'text-amber-400',   label: 'A IA Trabalha', desc: 'Gere o capital 24/7. Você não faz nada.' },
            ].map(c => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-center">
                  <Icon className={`h-6 w-6 ${c.color} mx-auto mb-2`} />
                  <p className={`text-xs font-bold ${c.color}`}>{c.label}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Streams */}
      <div>
        <h2 className="text-xl font-bold text-zinc-100 mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-400" />
          Como Você Ganha Dinheiro — 3 Fontes de Receita
        </h2>
        <div className="grid grid-cols-1 gap-4">

          {/* Stream 1 */}
          <Card className="bg-zinc-900/50 border-zinc-800 hover:border-emerald-500/30 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <RefreshCw className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-1">Fonte 1 — Passiva e Contínua</Badge>
                    <CardTitle className="text-zinc-100">Taxa de Gestão Anual (2%)</CardTitle>
                    <CardDescription>Cobrada automaticamente sobre todo o AUM (Assets Under Management)</CardDescription>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-emerald-400">2%</p>
                  <p className="text-[10px] text-zinc-500">ao ano</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-400 leading-relaxed">
                A cada segundo que o vault está activo, <strong className="text-zinc-200">2% ao ano</strong> do total de activos
                é automaticamente acumulado como receita sua. Não importa se o mercado sobe ou cai —
                você sempre ganha pela gestão do capital.
              </p>
              <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-xs font-semibold text-zinc-300 mb-3">Exemplos de receita mensal por volume de AUM:</p>
                <div className="space-y-2">
                  {[
                    ['$100,000 AUM',   '$167 / mês',  '$2,000 / ano'],
                    ['$500,000 AUM',   '$833 / mês',  '$10,000 / ano'],
                    ['$1,000,000 AUM', '$1,667 / mês', '$20,000 / ano'],
                    ['$5,000,000 AUM', '$8,333 / mês', '$100,000 / ano'],
                  ].map(([aum, month, year]) => (
                    <div key={aum} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400 w-36">{aum}</span>
                      <span className="font-mono text-emerald-400 w-28 text-center">{month}</span>
                      <span className="font-mono text-zinc-500">{year}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                Cobrada on-chain automaticamente. Você recebe shares vAI que pode resgatar para USDC a qualquer momento.
              </div>
            </CardContent>
          </Card>

          {/* Stream 2 */}
          <Card className="bg-zinc-900/50 border-zinc-800 hover:border-violet-500/30 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10">
                    <TrendingUp className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 mb-1">Fonte 2 — Partilha de Lucro</Badge>
                    <CardTitle className="text-zinc-100">Taxa de Performance (20% do lucro)</CardTitle>
                    <CardDescription>Só paga quando os clientes ganham — alinhamento total de interesses</CardDescription>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-violet-400">20%</p>
                  <p className="text-[10px] text-zinc-500">do lucro</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-400 leading-relaxed">
                Sempre que o vault gera lucro <strong className="text-zinc-200">acima do máximo histórico (high-water mark)</strong>,
                você recebe 20% desse lucro. Este mecanismo é justo: só cobra quando o cliente está realmente a ganhar
                face ao melhor ponto anterior.
              </p>
              <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-xs font-semibold text-zinc-300 mb-3">Como o High-Water Mark protege o cliente:</p>
                <div className="space-y-2 text-xs text-zinc-400">
                  <div className="flex gap-2"><span className="text-violet-400 font-bold">Mês 1:</span><span>Vault sobe de $1M → $1.2M. Lucro: $200k. Você recebe: $40k (20%)</span></div>
                  <div className="flex gap-2"><span className="text-rose-400 font-bold">Mês 2:</span><span>Vault cai de $1.2M → $1.1M. Você NÃO recebe taxa de performance.</span></div>
                  <div className="flex gap-2"><span className="text-violet-400 font-bold">Mês 3:</span><span>Vault sobe de $1.1M → $1.25M. Lucro acima de $1.2M: $50k. Você recebe: $10k</span></div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <p className="text-xs font-semibold text-zinc-300 mb-2">Exemplo realista: Vault de $1M, APY de 25%</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-400"><span>Lucro gerado (25% APY)</span><span className="font-mono text-zinc-100">$250,000</span></div>
                  <div className="flex justify-between text-zinc-400"><span>Sua taxa de performance (20%)</span><span className="font-mono text-violet-400">$50,000</span></div>
                  <div className="flex justify-between text-zinc-400"><span>+ Taxa de gestão (2%)</span><span className="font-mono text-emerald-400">$20,000</span></div>
                  <div className="flex justify-between border-t border-zinc-700 pt-1 mt-1 font-semibold"><span className="text-zinc-200">Total anual</span><span className="font-mono text-emerald-400">$70,000</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stream 3 */}
          <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/30 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Coins className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 mb-1">Fonte 3 — Indirecta (Opcional)</Badge>
                    <CardTitle className="text-zinc-100">Spread de Acesso (Setup Fee / Licença)</CardTitle>
                    <CardDescription>Modelo SaaS: você cobra aos seus clientes para acederem à plataforma</CardDescription>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-amber-400">Livre</p>
                  <p className="text-[10px] text-zinc-500">você define</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-400 leading-relaxed">
                Além das taxas automáticas do vault, você pode criar o seu próprio modelo de acesso:
                cobrar uma mensalidade aos clientes para usar a plataforma, uma taxa de onboarding,
                ou vender acesso a grandes investidores com depósito mínimo.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { model: 'Mensalidade SaaS', example: '$99–$499/mês por cliente', icon: RefreshCw, color: 'text-amber-400' },
                  { model: 'Setup Fee', example: '$500–$2,000 por cliente', icon: Package, color: 'text-cyan-400' },
                  { model: 'Depósito Mínimo', example: '$10,000 para aceder', icon: Lock, color: 'text-violet-400' },
                ].map(m => {
                  const Icon = m.icon;
                  return (
                    <div key={m.model} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                      <Icon className={`h-4 w-4 ${m.color} mb-1`} />
                      <p className={`text-xs font-semibold ${m.color}`}>{m.model}</p>
                      <p className="text-[10px] text-zinc-500 mt-1">{m.example}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Who is this for */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-400" />
            Para Quem Vender? — Perfis de Cliente Ideal
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {[
            {
              title: 'Investidores Crypto Experientes',
              desc: 'Já têm USDC, entendem DeFi básico, querem rendimento passivo sem gerir posições LP manualmente.',
              points: ['Têm $5k–$100k em crypto', 'Frustrações com gestão manual', 'Querem APY > staking simples'],
              badge: 'Alto Potencial', badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            },
            {
              title: 'Pequenos Fundos / Family Offices',
              desc: 'Querem exposição DeFi mas sem equipa técnica. Buscam gestor delegado que entregue resultados auditáveis.',
              points: ['$50k–$1M para alocar', 'Necessitam de relatórios', 'Valorizam transparência on-chain'],
              badge: 'Maior Ticket', badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
            },
            {
              title: 'DAOs / Tesourarias Web3',
              desc: 'Organizações com tesouraria em USDC que querem rendimento sem vender os activos.',
              points: ['Tesouraria idle a render 0%', 'Votação on-chain para decisões', 'Transparência total necessária'],
              badge: 'Contratos Recorrentes', badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
            },
            {
              title: 'Influencers / Comunidades Crypto',
              desc: 'Creators com audiência em DeFi que querem monetizar apresentando a plataforma à comunidade.',
              points: ['Leverage de audiência existente', 'Modelo afiliado possível', 'Ganham % do AUM que trazem'],
              badge: 'Canal de Distribuição', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            },
          ].map(p => (
            <div key={p.title} className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-100">{p.title}</p>
                <Badge variant="outline" className={`text-[9px] shrink-0 ${p.badgeColor}`}>{p.badge}</Badge>
              </div>
              <p className="text-[11px] text-zinc-500">{p.desc}</p>
              <div className="space-y-1">
                {p.points.map(pt => <Check key={pt}>{pt}</Check>)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* What you own vs what you need */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-100 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              O que você recebe neste sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {[
              'Contrato Solidity auditável e deployável',
              'Motor IA com 3 modelos LightGBM',
              'Keeper bot que rebalanceia automaticamente',
              'Dashboard Web completo para investidores',
              'Área administrativa (esta que está a ver)',
              'Documentação técnica e de negócio',
              'API REST documentada',
              'Configurável (taxas, rede, pool, intervalo)',
              'Deploy 1-clique no Render.com',
              'Código-fonte 100% seu',
            ].map(i => <Check key={i}>{i}</Check>)}
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-100 flex items-center gap-2">
              <Settings className="h-4 w-4 text-amber-400" />
              O que você precisa providenciar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {[
              'Servidor de hosting (Render.com — grátis para começar)',
              'RPC Arbitrum (Alchemy gratuito até certo volume)',
              'API Key The Graph (grátis até rate limit)',
              'Carteira Ethereum (keeper EOA — endereço dedicado)',
              'ETH na carteira keeper para gas (~$20 para começar)',
              'WalletConnect Project ID (grátis)',
              'Domínio próprio (opcional, $10/ano)',
              'Identidade legal (para receber pagamentos de clientes)',
            ].map(i => (
              <div key={i} className="flex items-start gap-2">
                <div className="h-3.5 w-3.5 rounded-full border border-amber-500/50 shrink-0 mt-0.5 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                </div>
                <span className="text-xs text-zinc-400">{i}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Launch Roadmap */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Rocket className="h-5 w-5 text-violet-400" />
            Roadmap para Lançar em 7 Dias
          </CardTitle>
          <CardDescription>Plano passo a passo para estar operacional</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col">
            <Step n="1" icon={Settings}    color="text-cyan-400"    title="Configurar Ambiente (Dia 1)"
              desc="Criar contas nos serviços necessários e configurar variáveis de ambiente."
              sub={['Criar conta Render.com (grátis)', 'Criar projecto Alchemy (RPC Arbitrum gratuito)', 'Criar API Key no The Graph', 'Criar WalletConnect Project ID']} />
            <Step n="2" icon={Shield}      color="text-violet-400"  title="Deploy do Contrato (Dia 2)"
              desc="Fazer deploy do AILiquidVault na rede de teste (Arbitrum Sepolia) e depois produção (Arbitrum One)."
              sub={['Testar no Sepolia com USDC de teste', 'Verificar contrato no Arbiscan', 'Anotar endereço do vault deployado']} />
            <Step n="3" icon={Server}      color="text-emerald-400" title="Deploy dos Serviços (Dia 3)"
              desc="Fazer deploy do AI Engine e Frontend no Render.com com as variáveis de ambiente configuradas."
              sub={['Deploy AI Engine (Python)', 'Deploy Frontend (Next.js)', 'Ligar VAULT_ADDRESS e KEEPER_PRIVATE_KEY']} />
            <Step n="4" icon={BarChart3}   color="text-amber-400"   title="Testar o Sistema Completo (Dia 4)"
              desc="Fazer depósito de teste, verificar que o keeper rebalanceia, confirmar fees a acumular."
              sub={['Depositar $100 USDC de teste', 'Verificar keeper status em /admin/system', 'Confirmar fee acumulada ao feeRecipient']} />
            <Step n="5" icon={FileText}    color="text-rose-400"    title="Preparar Material de Venda (Dia 5–6)"
              desc="Criar pitch, definir o seu branding, e preparar materiais para clientes."
              sub={['Personalizar nome/logo no frontend', 'Definir as taxas (default 2%+20% ou customize)', 'Criar 1-pager para apresentar a investidores']} />
            <Step n="6" icon={Users}       color="text-violet-400"  title="Primeiro Cliente (Dia 7)"
              desc="Onboarding do primeiro investidor real e início da geração de receita recorrente." />
          </div>
        </CardContent>
      </Card>

      {/* Customization Guide */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-400" />
            Personalização White-Label
          </CardTitle>
          <CardDescription>O que você pode mudar para ter o seu próprio produto</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                category: 'Configuração de Taxas',
                color: 'text-emerald-400',
                items: [
                  'Taxa gestão: 0% a 5% ao ano (configurável via setFees())',
                  'Taxa performance: 0% a 30% do lucro (configurável)',
                  'Endereço recebedor das taxas (feeRecipient)',
                  'Percentagem de USDC a deployar por ciclo (USDC_DEPLOY_PCT)',
                ],
              },
              {
                category: 'Pool e Estratégia',
                color: 'text-violet-400',
                items: [
                  'Pool Uniswap V3 alvo (qualquer USDC/TOKEN)',
                  'Intervalo de rebalance (REBALANCE_INTERVAL)',
                  'Rede blockchain (Arbitrum One, Polygon, Base, etc.)',
                  'Parâmetros do modelo IA (range, alocação)',
                ],
              },
              {
                category: 'Branding e UI',
                color: 'text-cyan-400',
                items: [
                  'Nome do vault e símbolo do share (ERC-20)',
                  'Logo e cores no frontend',
                  'Domínio próprio (ex: fund.seusite.com)',
                  'Textos, idioma e moeda de exibição',
                ],
              },
              {
                category: 'Modelo de Negócio',
                color: 'text-amber-400',
                items: [
                  'Depósito mínimo por investidor',
                  'Lista branca de carteiras permitidas',
                  'KYC/KYB (integração própria)',
                  'Relatórios automáticos para clientes',
                ],
              },
            ].map(cat => (
              <div key={cat.category} className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-2">
                <p className={`text-xs font-bold ${cat.color} flex items-center gap-1.5`}>
                  <Settings className="h-3 w-3" /> {cat.category}
                </p>
                <div className="space-y-1">
                  {cat.items.map(i => <Check key={i}>{i}</Check>)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue summary */}
      <Card className="bg-gradient-to-br from-emerald-500/10 to-zinc-900/50 border-emerald-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="h-6 w-6 text-emerald-400" />
            <div>
              <p className="text-lg font-bold text-zinc-100">Resumo: Quanto você pode ganhar?</p>
              <p className="text-xs text-zinc-500">Projecção conservadora com 10 clientes de $50k cada = $500k AUM</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 text-center">
              <p className="text-xs text-zinc-500 mb-1">Taxa de Gestão (2%)</p>
              <p className="text-2xl font-bold text-emerald-400">$10,000</p>
              <p className="text-xs text-zinc-600">por ano, garantido</p>
            </div>
            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 text-center">
              <p className="text-xs text-zinc-500 mb-1">Tax. Performance (20% × 25% APY)</p>
              <p className="text-2xl font-bold text-violet-400">$25,000</p>
              <p className="text-xs text-zinc-600">por ano, se APY = 25%</p>
            </div>
            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 text-center">
              <p className="text-xs text-zinc-500 mb-1">Total anual estimado</p>
              <p className="text-2xl font-bold text-zinc-100">$35,000</p>
              <p className="text-xs text-zinc-600">~$2,917 / mês</p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-600 mt-3 text-center">
            * Projecção ilustrativa. Rendimentos reais dependem das condições de mercado, volume de trading no pool e gestão de capital.
            Performance passada não garante resultados futuros.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <a href="/admin" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowRight className="h-3 w-3 rotate-180" /> Voltar ao Admin
        </a>
        <a href="/admin/revenue" className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
          Ver Calculadora de Receita <ArrowRight className="h-3 w-3" />
        </a>
      </div>

    </div>
  );
}
