'use client';

import Link from 'next/link';
import {
  BookOpen, Globe, Activity, Code2, DollarSign,
  TrendingUp, Shield, Zap, ChevronRight, Brain,
  Layers, ArrowUpRight, FileText, Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const quickCards = [
  {
    href: '/admin/docs',
    icon: BookOpen,
    color: 'from-violet-500/20 to-violet-500/5',
    iconColor: 'text-violet-400',
    badge: 'Documentação',
    badgeClass: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    title: 'Como o Sistema Funciona',
    desc: 'Arquitectura completa, fluxo de dados, contratos, IA e keeper bot.',
  },
  {
    href: '/admin/whitelabel',
    icon: Globe,
    color: 'from-emerald-500/20 to-emerald-500/5',
    iconColor: 'text-emerald-400',
    badge: 'White-Label',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    title: 'Guia para Revender',
    desc: 'Como ganhar dinheiro com o sistema. Fontes de receita, configuração e lançamento.',
  },
  {
    href: '/admin/system',
    icon: Activity,
    color: 'from-cyan-500/20 to-cyan-500/5',
    iconColor: 'text-cyan-400',
    badge: 'Monitorização',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    title: 'Sistema ao Vivo',
    desc: 'Status dos serviços, keeper bot, variáveis de ambiente e health checks.',
  },
  {
    href: '/admin/api',
    icon: Code2,
    color: 'from-amber-500/20 to-amber-500/5',
    iconColor: 'text-amber-400',
    badge: 'API',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    title: 'API Reference',
    desc: 'Todos os endpoints documentados com exemplos de request e response.',
  },
  {
    href: '/admin/revenue',
    icon: DollarSign,
    color: 'from-rose-500/20 to-rose-500/5',
    iconColor: 'text-rose-400',
    badge: 'Receita',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    title: 'Calculadora de Receita',
    desc: 'Simule quanto você ganha com diferentes volumes de AUM (Assets Under Management).',
  },
];

const systemSpecs = [
  { label: 'Taxa de Gestão', value: '2% ao ano', detail: '200 BPS — acumulada por bloco' },
  { label: 'Taxa de Performance', value: '20% do lucro', detail: '2000 BPS — acima do high-water mark' },
  { label: 'Ciclo do Keeper', value: 'Cada 15 min', detail: 'APScheduler automático' },
  { label: 'Modelo AI', value: 'LightGBM', detail: '29 features, 3 modelos, latência <10ms' },
  { label: 'Pool Alvo', value: 'USDC/WETH 0.05%', detail: 'Uniswap V3 — Arbitrum One' },
  { label: 'Redes Suportadas', value: 'Arbitrum', detail: 'One (prod) + Sepolia (test)' },
  { label: 'Contrato', value: 'ERC-4626', detail: 'Vault tokenizado — share token vAI' },
  { label: 'Alocação Típica', value: '70% core', detail: '20% defensiva + 10% oportunista' },
];

const architecture = [
  { step: '1', icon: DollarSign, color: 'text-emerald-400', title: 'Investidor deposita USDC', desc: 'Recebe vAI shares proporcionais ao NAV actual' },
  { step: '2', icon: Brain,       color: 'text-violet-400', title: 'IA analisa o mercado',     desc: '29 features → LightGBM → range + alocação + regime' },
  { step: '3', icon: Zap,         color: 'text-amber-400',  title: 'Keeper executa on-chain',  desc: 'A cada 15 min: fecha posições antigas, abre nova range' },
  { step: '4', icon: Layers,      color: 'text-cyan-400',   title: 'LP gera fees de trading',  desc: 'Pool Uniswap V3 cobra 0.05% em cada swap que passa pela range' },
  { step: '5', icon: TrendingUp,  color: 'text-rose-400',   title: 'Taxas aumentam o NAV',     desc: 'Fees colectadas voltam ao vault → share price sobe → todos ganham' },
];

export default function AdminPage() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
          <Shield className="h-3 w-3" />
          <span>Área Administrativa</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-300">Dashboard</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">
          AI Liquid Manager
        </h1>
        <p className="text-zinc-400 max-w-2xl">
          Sistema institucional de gestão automatizada de liquidez com IA.
          Tudo que você precisa para operar, documentar e revender esta plataforma.
        </p>
      </div>

      {/* Quick Nav Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickCards.map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <Card className={`bg-gradient-to-br ${card.color} border-zinc-800/60 hover:border-zinc-700 transition-all hover:-translate-y-0.5 cursor-pointer h-full`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg bg-zinc-900/50`}>
                      <Icon className={`h-5 w-5 ${card.iconColor}`} />
                    </div>
                    <Badge variant="outline" className={card.badgeClass}>{card.badge}</Badge>
                  </div>
                  <CardTitle className="text-base text-zinc-100 mt-2">{card.title}</CardTitle>
                  <CardDescription className="text-zinc-400 text-xs leading-relaxed">{card.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`flex items-center gap-1 text-xs ${card.iconColor} font-medium`}>
                    Ver mais <ArrowUpRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* How it works — 5 steps */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-400" />
            Fluxo Completo em 5 Passos
          </CardTitle>
          <CardDescription>Como o dinheiro dos investidores gera retorno automaticamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-0">
            {architecture.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="flex gap-4">
                  {/* Line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center shrink-0 z-10`}>
                      <Icon className={`h-4 w-4 ${step.color}`} />
                    </div>
                    {i < architecture.length - 1 && (
                      <div className="w-px flex-1 bg-zinc-800 my-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-5">
                    <p className="text-sm font-semibold text-zinc-100">{step.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* System Specs */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Settings className="h-5 w-5 text-cyan-400" />
            Especificações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {systemSpecs.map(spec => (
              <div key={spec.label} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-1">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{spec.label}</p>
                <p className="text-sm font-bold text-zinc-100">{spec.value}</p>
                <p className="text-[10px] text-zinc-500">{spec.detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
