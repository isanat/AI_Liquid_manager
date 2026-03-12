'use client';

import { useState } from 'react';
import {
  DollarSign, ChevronRight, Shield, TrendingUp,
  Calculator, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default function RevenuePage() {
  const [aum,        setAum]        = useState(500_000);   // $500k
  const [mgmtBps,    setMgmtBps]    = useState(200);        // 2%
  const [perfBps,    setPerfBps]    = useState(2_000);      // 20%
  const [apyPct,     setApyPct]     = useState(25);         // 25% APY (LP fees earned)
  const [numClients, setNumClients] = useState(10);
  const [setupFee,   setSetupFee]   = useState(500);        // $500 one-time

  const mgmtAnnual     = (aum * mgmtBps) / 10_000;
  const lpProfit       = (aum * apyPct) / 100;
  const perfAnnual     = (lpProfit * perfBps) / 10_000;
  const setupAnnual    = numClients * setupFee;
  const totalAnnual    = mgmtAnnual + perfAnnual + setupAnnual;
  const totalMonthly   = totalAnnual / 12;

  const clientNet      = lpProfit - perfAnnual - mgmtAnnual;
  const clientNetPct   = (clientNet / aum) * 100;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
          <Shield className="h-3 w-3" />
          <span>Admin</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-300">Calculadora de Receita</span>
        </div>
        <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <Calculator className="h-7 w-7 text-emerald-400" />
          Calculadora de Receita White-Label
        </h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Simule quanto você ganha operando este sistema como gestor de fundo DeFi.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Controls */}
        <div className="space-y-5">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-100">Parâmetros do Fundo</CardTitle>
              <CardDescription className="text-xs">Arraste os sliders para simular diferentes cenários</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* AUM */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">AUM Total (Assets Under Management)</span>
                  <span className="font-mono font-bold text-emerald-400">{fmt(aum)}</span>
                </div>
                <Slider
                  min={10_000} max={10_000_000} step={10_000}
                  value={[aum]} onValueChange={([v]) => setAum(v)}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-zinc-600">
                  <span>$10k</span><span>$10M</span>
                </div>
              </div>

              {/* Num Clients */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Número de Clientes</span>
                  <span className="font-mono font-bold text-cyan-400">{numClients}</span>
                </div>
                <Slider
                  min={1} max={200} step={1}
                  value={[numClients]} onValueChange={([v]) => setNumClients(v)}
                />
                <div className="flex justify-between text-[10px] text-zinc-600">
                  <span>1</span><span>200</span>
                </div>
              </div>

              {/* Management Fee */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Taxa de Gestão Anual</span>
                  <span className="font-mono font-bold text-violet-400">{(mgmtBps / 100).toFixed(1)}%</span>
                </div>
                <Slider
                  min={0} max={500} step={25}
                  value={[mgmtBps]} onValueChange={([v]) => setMgmtBps(v)}
                />
                <div className="flex justify-between text-[10px] text-zinc-600">
                  <span>0%</span><span>5% (máximo)</span>
                </div>
              </div>

              {/* Performance Fee */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Taxa de Performance</span>
                  <span className="font-mono font-bold text-amber-400">{(perfBps / 100).toFixed(0)}% do lucro</span>
                </div>
                <Slider
                  min={0} max={3_000} step={100}
                  value={[perfBps]} onValueChange={([v]) => setPerfBps(v)}
                />
                <div className="flex justify-between text-[10px] text-zinc-600">
                  <span>0%</span><span>30% (máximo)</span>
                </div>
              </div>

              {/* APY */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">APY Estimado do Pool LP</span>
                  <span className="font-mono font-bold text-rose-400">{apyPct}%</span>
                </div>
                <Slider
                  min={5} max={100} step={1}
                  value={[apyPct]} onValueChange={([v]) => setApyPct(v)}
                />
                <div className="flex justify-between text-[10px] text-zinc-600">
                  <span>5%</span><span>100%</span>
                </div>
              </div>

              {/* Setup Fee */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Setup Fee por Cliente (único)</span>
                  <span className="font-mono font-bold text-zinc-300">{fmt(setupFee)}</span>
                </div>
                <Slider
                  min={0} max={5_000} step={100}
                  value={[setupFee]} onValueChange={([v]) => setSetupFee(v)}
                />
                <div className="flex justify-between text-[10px] text-zinc-600">
                  <span>$0</span><span>$5,000</span>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="space-y-4">

          {/* Main Result */}
          <Card className="bg-gradient-to-br from-emerald-500/15 to-zinc-900/50 border-emerald-500/30">
            <CardContent className="pt-6 text-center space-y-1">
              <p className="text-xs text-zinc-400 uppercase tracking-wider">Receita Total Anual Estimada</p>
              <p className="text-5xl font-bold text-emerald-400">{fmt(totalAnnual)}</p>
              <p className="text-sm text-zinc-500">
                {fmt(totalMonthly)} <span className="text-zinc-600">/ mês</span>
              </p>
            </CardContent>
          </Card>

          {/* Breakdown */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-100">Detalhamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: 'Taxa de Gestão',
                  sub: `${(mgmtBps / 100).toFixed(1)}% × ${fmt(aum)} AUM`,
                  value: mgmtAnnual,
                  color: 'text-emerald-400',
                  pct: totalAnnual > 0 ? (mgmtAnnual / totalAnnual) * 100 : 0,
                },
                {
                  label: 'Taxa de Performance',
                  sub: `${(perfBps / 100).toFixed(0)}% × ${fmt(lpProfit)} de lucro LP`,
                  value: perfAnnual,
                  color: 'text-violet-400',
                  pct: totalAnnual > 0 ? (perfAnnual / totalAnnual) * 100 : 0,
                },
                {
                  label: 'Setup Fees',
                  sub: `${numClients} clientes × ${fmt(setupFee)}`,
                  value: setupAnnual,
                  color: 'text-amber-400',
                  pct: totalAnnual > 0 ? (setupAnnual / totalAnnual) * 100 : 0,
                },
              ].map(item => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <div>
                      <span className={`font-semibold ${item.color}`}>{item.label}</span>
                      <span className="text-zinc-600 ml-2">{item.sub}</span>
                    </div>
                    <span className={`font-mono font-bold ${item.color}`}>{fmt(item.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.color === 'text-emerald-400' ? 'bg-emerald-500' :
                        item.color === 'text-violet-400' ? 'bg-violet-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-between border-t border-zinc-700 pt-2 text-sm font-bold">
                <span className="text-zinc-200">Total Anual</span>
                <span className="font-mono text-emerald-400">{fmt(totalAnnual)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Client perspective */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-100 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                O que o Cliente recebe (pós-taxas)
              </CardTitle>
              <CardDescription className="text-xs">Comparação para um cliente com {fmt(aum / numClients)} investido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-center">
                  <p className="text-[10px] text-zinc-500">APY Bruto do Pool</p>
                  <p className="text-xl font-bold text-zinc-300">{apyPct}%</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                  <p className="text-[10px] text-zinc-500">APY Líquido para o Cliente</p>
                  <p className="text-xl font-bold text-emerald-400">{Math.max(0, clientNetPct).toFixed(1)}%</p>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Lucro bruto LP (por cliente)</span>
                  <span className="font-mono">{fmt(lpProfit / numClients)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>- Taxa gestão (sua parte)</span>
                  <span className="font-mono text-rose-400">-{fmt(mgmtAnnual / numClients)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>- Taxa performance (sua parte)</span>
                  <span className="font-mono text-rose-400">-{fmt(perfAnnual / numClients)}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-700 pt-1 font-semibold">
                  <span className="text-zinc-200">Lucro líquido do cliente</span>
                  <span className="font-mono text-emerald-400">{fmt(Math.max(0, clientNet / numClients))}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded bg-zinc-800/50 mt-2">
                <Info className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-500">
                  Manter o APY líquido do cliente atrativo (acima de 10–15%) é essencial para reter investidores.
                  Ajuste as taxas para equilibrar a sua receita com a satisfação dos clientes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Scenarios */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-100">Cenários Rápidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Bootstrap (10 clientes, $50k cada)', aum: 500_000, clients: 10, apy: 20, mgmt: 200, perf: 2000 },
                { label: 'Crescimento (50 clientes, $100k cada)', aum: 5_000_000, clients: 50, apy: 20, mgmt: 200, perf: 2000 },
                { label: 'Escala (200 clientes, $100k cada)', aum: 20_000_000, clients: 200, apy: 18, mgmt: 150, perf: 1500 },
              ].map(s => {
                const m = (s.aum * s.mgmt) / 10_000;
                const p = ((s.aum * s.apy) / 100 * s.perf) / 10_000;
                const total = m + p;
                return (
                  <button
                    key={s.label}
                    onClick={() => { setAum(s.aum); setNumClients(s.clients); setApyPct(s.apy); setMgmtBps(s.mgmt); setPerfBps(s.perf); }}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-violet-500/30 transition-colors text-left"
                  >
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{s.label}</p>
                      <p className="text-[10px] text-zinc-500">AUM: {fmt(s.aum)} · APY: {s.apy}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">{fmt(total)}/ano</p>
                      <p className="text-[10px] text-zinc-600">{fmt(total / 12)}/mês</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

        </div>
      </div>

      <p className="text-[10px] text-zinc-700 text-center">
        * Esta calculadora é apenas para fins ilustrativos. Os valores reais dependem das condições do mercado,
        volume de trading nos pools, custos de gas, e outros factores. Não constitui aconselhamento financeiro.
      </p>
    </div>
  );
}
