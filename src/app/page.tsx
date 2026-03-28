'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowRight,
  Shield,
  TrendingUp,
  Zap,
  AlertTriangle,
  CheckCircle,
  Wallet,
  BarChart3,
  Clock,
  Coins,
  ChevronRight,
} from 'lucide-react';
import { WalletConnect, ACTIVE_CHAIN_ID } from '@/components/wallet-connect';
import { NetworkGuard } from '@/components/network-guard';
import { useAccount } from 'wagmi';
import Link from 'next/link';

const NETWORK_LABEL = ACTIVE_CHAIN_ID === 421614 ? 'Arbitrum Sepolia' : 'Arbitrum One';

// Features for investors
const features = [
  {
    icon: TrendingUp,
    title: 'Rentabilidade Otimizada por IA',
    description: 'Algoritmo de machine learning ajusta automaticamente as faixas de liquidez para maximizar coleta de fees.',
  },
  {
    icon: Shield,
    title: 'Smart Contracts Auditáveis',
    description: 'Padrão ERC-4626 transparente. Seus fundos ficam em contratos verificados na Arbitrum One.',
  },
  {
    icon: Zap,
    title: 'Sem Lock-up',
    description: 'Saque a qualquer momento. Liquidez garantida pela maior DEX do mundo (Uniswap V3).',
  },
  {
    icon: Coins,
    title: 'Dual Vault: USDC + USDT',
    description: 'Diversifique entre as duas stablecoins mais líquidas do mercado.',
  },
];

// Stats
const stats = [
  { label: 'TVL Total', value: '$10,500+', sublabel: 'em gestão' },
  { label: 'Retorno Médio', value: '4%+', sublabel: 'últimos 30 dias' },
  { label: 'Rebalanceios', value: 'Automáticos', sublabel: 'a cada 15 min' },
];

export default function LandingPage() {
  const { isConnected, address } = useAccount();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white">AI Liquidity Manager</h1>
              <p className="text-xs text-slate-400">{NETWORK_LABEL}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block"
            >
              Admin
            </Link>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Network Guard */}
      <NetworkGuard />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            Sistema Online • Arbitrum One
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Gere Renda Passiva com
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"> Stablecoins</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            Vault tokenizado (ERC-4626) que usa IA para gerenciar liquidez na Uniswap V3. 
            Deposite USDC ou USDT e receba rendimentos automaticamente.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            {isConnected ? (
              <Link href="/investor">
                <Button size="lg" className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8">
                  <Wallet className="mr-2 h-5 w-5" />
                  Ver Meus Investimentos
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-slate-400">Conecte sua carteira para começar</p>
                <WalletConnect />
              </div>
            )}
            <Link href="/investor">
              <Button variant="outline" size="lg" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                <BarChart3 className="mr-2 h-5 w-5" />
                Ver Dashboard
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-2xl md:text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
                <p className="text-xs text-emerald-400">{stat.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16 border-t border-slate-800">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
          Por que escolher o AI Liquidity Manager?
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="bg-slate-900/50 border-slate-800 hover:border-emerald-500/50 transition-colors">
                <CardHeader>
                  <div className="p-2 rounded-lg bg-emerald-500/10 w-fit mb-3">
                    <Icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <CardTitle className="text-lg text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-400">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it Works */}
      <section className="max-w-6xl mx-auto px-4 py-16 border-t border-slate-800">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
          Como Funciona
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-emerald-400">1</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Conecte & Deposite</h3>
            <p className="text-slate-400">Conecte sua carteira e deposite USDC ou USDT no vault.</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-cyan-400">2</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">IA Trabalha por Você</h3>
            <p className="text-slate-400">O algoritmo ajusta as posições a cada 15 minutos para maximizar fees.</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-violet-400">3</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Receba & Saque</h3>
            <p className="text-slate-400">Acompanhe seus rendimentos e saque quando quiser, sem lock-up.</p>
          </div>
        </div>
      </section>

      {/* Risk Disclaimer */}
      <section className="max-w-6xl mx-auto px-4 py-16 border-t border-slate-800">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Riscos e Transparência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Não há garantia de retorno.</strong> Investimentos em DeFi carregam risco de perda.</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Perda Impermanente (IL).</strong> Você pode ter menos tokens que HODL.</span>
                </li>
              </ul>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Smart contracts verificados na blockchain.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>10% performance fee apenas sobre lucros.</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA Final */}
      <section className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          Pronto para começar?
        </h2>
        <p className="text-slate-400 mb-8">
          Conecte sua carteira e comece a gerar renda passiva com stablecoins.
        </p>
        {isConnected ? (
          <Link href="/investor">
            <Button size="lg" className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8">
              <BarChart3 className="mr-2 h-5 w-5" />
              Acessar Meus Investimentos
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        ) : (
          <div className="inline-flex flex-col items-center gap-3">
            <p className="text-sm text-slate-400">Clique para conectar sua carteira</p>
            <WalletConnect />
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-slate-500">
          <p className="mb-2">
            Powered by Uniswap V3 • Arbitrum One • AI Liquidity Manager
          </p>
          <p>
            <a 
              href="https://arbiscan.io/address/0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              USDC Vault
            </a>
            {' • '}
            <a 
              href="https://arbiscan.io/address/0x12a20d3569da6DD2d99E7bC95748283B10729c4C" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              USDT Vault
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
