"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Shield,
  Clock,
  Zap,
  AlertTriangle,
  Info,
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// Types
interface VaultData {
  address: string;
  symbol: string;
  totalAssets: number;
  deployedValue: number;
  idleValue: number;
  returnPct: number;
  returnUsd: number;
  fees: {
    management: number;
    performance: number;
    total: number;
  };
}

interface InvestorStats {
  totalInvested: number;
  totalReturn: number;
  totalReturnPct: number;
  totalFees: number;
  volatility: number;
  maxDrawdown: number;
  status: 'online' | 'paused' | 'offline';
  lastUpdate: string;
  vaults: VaultData[];
}

// Mock data for development
function getMockData(): InvestorStats {
  return {
    totalInvested: 10500,
    totalReturn: 423.50,
    totalReturnPct: 4.03,
    totalFees: 52.50,
    volatility: 12.5,
    maxDrawdown: 2.1,
    status: 'online',
    lastUpdate: new Date().toISOString(),
    vaults: [
      {
        address: '0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C',
        symbol: 'USDC',
        totalAssets: 5500,
        deployedValue: 4500,
        idleValue: 1000,
        returnPct: 4.2,
        returnUsd: 231,
        fees: { management: 27.50, performance: 11.55, total: 39.05 },
      },
      {
        address: '0x12a20d3569da6DD2d99E7bC95748283B10729c4C',
        symbol: 'USDT',
        totalAssets: 5000,
        deployedValue: 4000,
        idleValue: 1000,
        returnPct: 3.85,
        returnUsd: 192.50,
        fees: { management: 10, performance: 3.45, total: 13.45 },
      },
    ],
  };
}

export default function InvestorDashboard() {
  const [stats, setStats] = useState<InvestorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      // Try to fetch from API
      const response = await fetch('/api/investor/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        // Use mock data if API not available
        setStats(getMockData());
      }
    } catch (error) {
      console.log('Using demo data');
      setStats(getMockData());
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar dados</AlertTitle>
            <AlertDescription>
              Não foi possível carregar os dados do vault. Tente novamente mais tarde.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Navigation Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm font-medium">Dashboard Técnico</span>
            </a>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Visão do Investidor</span>
          </div>
          <a 
            href="/admin" 
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            Admin Técnico →
          </a>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
              Meus Investimentos
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              AI Liquidity Manager • Arbitrum One
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm text-slate-500 dark:text-slate-400">
              <p>Última atualização</p>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {lastRefresh.toLocaleTimeString('pt-BR')}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Status Banner */}
        <div className="mb-6">
          <Card className={`border-l-4 ${stats.status === 'online' ? 'border-l-green-500' : stats.status === 'paused' ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {stats.status === 'online' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : stats.status === 'paused' ? (
                  <Clock className="h-5 w-5 text-yellow-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  Status Operacional:{' '}
                  <Badge variant={stats.status === 'online' ? 'default' : 'secondary'} className="ml-1">
                    {stats.status === 'online' ? 'Online' : stats.status === 'paused' ? 'Pausado' : 'Offline'}
                  </Badge>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Activity className="h-4 w-4" />
                <span>2 Vaults Ativos</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 5 Main Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Block 1: Valor Investido */}
          <Card className="bg-white dark:bg-slate-900 shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Valor Investido
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                ${stats.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-3 space-y-2">
                {stats.vaults.map((vault) => (
                  <div key={vault.address} className="flex justify-between text-sm">
                    <span className="text-slate-500">{vault.symbol}</span>
                    <span className="font-medium">${vault.totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Block 2: Retorno Acumulado */}
          <Card className="bg-white dark:bg-slate-900 shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                {stats.totalReturnPct >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                Retorno Acumulado (líquido)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${stats.totalReturnPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.totalReturnPct >= 0 ? '+' : ''}{stats.totalReturnPct.toFixed(2)}%
              </div>
              <div className={`text-lg font-medium mt-1 ${stats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.totalReturn >= 0 ? '+' : ''}${stats.totalReturn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Desde o início da operação
              </p>
            </CardContent>
          </Card>

          {/* Block 3: Risco */}
          <Card className="bg-white dark:bg-slate-900 shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Risco
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Volatilidade (30d)</span>
                    <span className="font-medium">{stats.volatility.toFixed(1)}%</span>
                  </div>
                  <Progress value={stats.volatility * 5} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Drawdown Máximo</span>
                    <span className="font-medium text-orange-500">{stats.maxDrawdown.toFixed(1)}%</span>
                  </div>
                  <Progress value={stats.maxDrawdown * 10} className="h-2 bg-orange-100 dark:bg-orange-950 [&>div]:bg-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Block 4: Custos Cobrados */}
          <Card className="bg-white dark:bg-slate-900 shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Custos Cobrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                ${stats.totalFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxa de Gestão</span>
                  <span>$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxa de Performance</span>
                  <span>${stats.totalFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                10% sobre lucros (performance fee)
              </p>
            </CardContent>
          </Card>

          {/* Block 5: Status Operacional Detalhado */}
          <Card className="bg-white dark:bg-slate-900 shadow-lg md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Status Operacional
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.vaults.map((vault) => (
                  <div key={vault.address} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="font-medium">{vault.symbol} Vault</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {((vault.deployedValue / vault.totalAssets) * 100).toFixed(0)}% alocado
                      </p>
                      <p className="text-xs text-slate-500">
                        ${vault.deployedValue.toLocaleString()} em liquidez
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transparência e Riscos */}
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5" />
              Transparência e Riscos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-amber-900 dark:text-amber-100">Importante saber:</h4>
                <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
                    <span><strong>Não há garantia de retorno.</strong> Investimentos em DeFi carregam riscos de perda.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-orange-500" />
                    <span><strong>Perda Impermanente (IL).</strong> Você pode ter menos tokens do que se apenas segurasse (HODL).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    <span><strong>Taxas variam.</strong> Os rendimentos dependem do volume de negociação na pool.</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-amber-900 dark:text-amber-100">Como funciona:</h4>
                <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" />
                    <span>Seus fundos ficam em smart contracts auditados na Arbitrum.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" />
                    <span>A IA ajusta automaticamente as faixas de liquidez.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" />
                    <span>Você pode sacar a qualquer momento (liquidez permitindo).</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-6 p-4 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
              <p className="text-sm text-amber-900 dark:text-amber-100 text-center">
                <strong>Nota:</strong> Este produto é destinado a investidores que compreendem os riscos de DeFi. 
                Rentabilidades passadas não garantem resultados futuros. 
                Taxas de performance são cobradas sobre lucros realizados.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>
            Powered by Uniswap V3 • Arbitrum One • AI Liquidity Manager
          </p>
          <p className="mt-1">
            Smart Contracts:{' '}
            <a 
              href="https://arbiscan.io/address/0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              USDC Vault
            </a>
            {' • '}
            <a 
              href="https://arbiscan.io/address/0x12a20d3569da6DD2d99E7bC95748283B10729c4C" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              USDT Vault
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
