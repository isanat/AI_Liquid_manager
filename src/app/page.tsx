'use client';

import { WalletConnect } from '@/components/wallet-connect';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/contexts/i18n-context';
import { ACTIVE_CHAIN_ID } from '@/components/wallet-connect';
import {
  Droplets, Shield, Zap, Brain, TrendingUp, ArrowRight,
  Coins, Activity, Target, Wallet
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const NETWORK_LABEL = ACTIVE_CHAIN_ID === 421614 ? 'Arbitrum Sepolia' : 'Arbitrum One';

export default function HomePage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
              <Droplets className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">AI Liquid Manager</h1>
              <p className="text-xs text-zinc-500">{NETWORK_LABEL}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/30 via-transparent to-cyan-950/30" />
        <div className="max-w-7xl mx-auto px-4 py-16 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live on Arbitrum One
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                AI-Powered Liquidity Management
              </span>
            </h1>
            <p className="text-lg text-zinc-400 mb-8 max-w-2xl mx-auto">
              Vault tokenizado ERC-4626 que usa inteligência artificial para gerenciar liquidez na Uniswap V3, 
              gerando taxas automaticamente com rebalanceamento a cada 15 minutos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/investor"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors"
              >
                <Wallet className="h-5 w-5" />
                Começar a Investir
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold border border-zinc-700 transition-colors"
              >
                <Activity className="h-5 w-5" />
                Dashboard Técnica
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Brain,
              title: 'IA LightGBM',
              desc: 'Modelo de machine learning detecta regime de mercado e otimiza ranges automaticamente.',
              color: 'from-cyan-500/20 to-cyan-500/5 text-cyan-400',
            },
            {
              icon: Shield,
              title: 'ERC-4626 Vault',
              desc: 'Padrão tokenizado para vaults. Seus depósitos viram shares vAI que valorizam com as taxas.',
              color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400',
            },
            {
              icon: Zap,
              title: 'Rebalance 15min',
              desc: 'Keeper bot executa ajustes de posição on-chain automaticamente sem intervenção manual.',
              color: 'from-violet-500/20 to-violet-500/5 text-violet-400',
            },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 hover:border-zinc-700 transition-colors"
              >
                <div className={cn('p-2 rounded-lg bg-gradient-to-br w-fit mb-4', feature.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center mb-8">Como Funciona</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: 1, icon: Wallet, title: 'Deposite USDC/USDT', desc: 'Conecte sua carteira e deposite stablecoins no vault. Você recebe shares vAI proporcionais.' },
            { step: 2, icon: Brain, title: 'IA Gerencia', desc: 'O modelo LightGBM analisa mercado e ajusta posições na Uniswap V3 automaticamente.' },
            { step: 3, icon: TrendingUp, title: 'Receba Retorno', desc: 'Taxas de trading são acumuladas no vault. O preço da share aumenta com o tempo.' },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="relative rounded-2xl bg-zinc-900 border border-zinc-800 p-6">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-black text-sm">
                {step}
              </div>
              <Icon className="h-8 w-8 text-zinc-400 mb-4" />
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Network', value: 'Arbitrum One', icon: Activity },
            { label: 'Pool', value: 'ETH/USDC 0.05%', icon: Target },
            { label: 'Modelo', value: 'LightGBM', icon: Brain },
            { label: 'Padrão', value: 'ERC-4626', icon: Shield },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
              <Icon className="h-5 w-5 text-zinc-500 mx-auto mb-2" />
              <p className="text-xs text-zinc-500 mb-1">{label}</p>
              <p className="font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-zinc-500">
          <p>AI Liquid Manager · Vault tokenizado na Arbitrum One</p>
          <p className="mt-2 text-xs">
            <span className="text-zinc-400">Aviso:</span> Investimentos em DeFi envolvem riscos. Perda impermanente e volatilidade podem afetar seus retornos.
          </p>
        </div>
      </footer>
    </div>
  );
}
