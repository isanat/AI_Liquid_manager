'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Brain, ChevronDown, ChevronUp,
  Droplets, ExternalLink, Shield, Target, TrendingUp, Wallet, Zap, Coins,
  RefreshCw, Activity, Gauge, BarChart3, Info, Check, X, AlertCircle,
  TrendingDown, Minus, Circle, Sparkles
} from 'lucide-react';
import { WalletConnect, ACTIVE_CHAIN_ID } from '@/components/wallet-connect';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useLiquidityStore } from '@/lib/liquidity-store';
import { useI18n } from '@/contexts/i18n-context';
import {
  VAULT_USDC_ADDRESS,
  VAULT_USDT_ADDRESS,
  USDC_ARBITRUM_ONE,
  USDT_ARBITRUM_ONE,
  readVaultState,
  readUserVaultState,
  approveStablecoin,
  depositToVault,
  redeemFromVault,
  type VaultState,
  type UserVaultState,
  type AssetType,
} from '@/lib/vault-contract';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

const EXPLORER = ACTIVE_CHAIN_ID === 421614
  ? 'https://sepolia.arbiscan.io'
  : 'https://arbiscan.io';
const NETWORK_LABEL = ACTIVE_CHAIN_ID === 421614 ? 'Arb Sepolia' : 'Arbitrum One';

// ─── Types ────────────────────────────────────────────────────────────────────

type SystemStatus = 'OPPORTUNITY' | 'SAFE' | 'RISK' | 'NEUTRAL';
type StrategyMode = 'AGGRESSIVE' | 'BALANCED' | 'CONSERVATIVE';

// ─── Dual Vault State Hook ────────────────────────────────────────────────────

function useDualVaultData() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  const [usdcVaultState, setUsdcVaultState] = useState<VaultState | null>(null);
  const [usdtVaultState, setUsdtVaultState] = useState<VaultState | null>(null);
  const [usdcUserState, setUsdcUserState] = useState<UserVaultState | null>(null);
  const [usdtUserState, setUsdtUserState] = useState<UserVaultState | null>(null);

  const refresh = useCallback(async () => {
    if (!publicClient) return;
    
    const [usdcVs, usdtVs] = await Promise.all([
      readVaultState(publicClient, VAULT_USDC_ADDRESS),
      readVaultState(publicClient, VAULT_USDT_ADDRESS),
    ]);
    setUsdcVaultState(usdcVs);
    setUsdtVaultState(usdtVs);
    
    if (address) {
      const [usdcUs, usdtUs] = await Promise.all([
        readUserVaultState(publicClient, address, VAULT_USDC_ADDRESS, USDC_ARBITRUM_ONE),
        readUserVaultState(publicClient, address, VAULT_USDT_ADDRESS, USDT_ARBITRUM_ONE),
      ]);
      setUsdcUserState(usdcUs);
      setUsdtUserState(usdtUserState);
    }
  }, [publicClient, address]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30_000);
    return () => clearInterval(iv);
  }, [refresh]);

  const totalTVL = (usdcVaultState ? parseFloat(usdcVaultState.totalAssetsUsd) : 0) +
                   (usdtVaultState ? parseFloat(usdtVaultState.totalAssetsUsd) : 0);
  const userTotalPosition = (usdcUserState ? parseFloat(usdcUserState.assetsValueUsd) : 0) +
                            (usdtUserState ? parseFloat(usdtUserState.assetsValueUsd) : 0);

  return {
    usdcVaultState, usdtVaultState, usdcUserState, usdtUserState,
    totalTVL, userTotalPosition, refresh, isConnected,
  };
}

// ─── Helper Components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SystemStatus }) {
  const config = {
    OPPORTUNITY: { icon: Sparkles, color: 'bg-emerald-500', text: 'text-emerald-400', label: 'OPPORTUNITY', pulse: true },
    SAFE: { icon: Shield, color: 'bg-cyan-500', text: 'text-cyan-400', label: 'SAFE', pulse: false },
    RISK: { icon: AlertTriangle, color: 'bg-rose-500', text: 'text-rose-400', label: 'RISK', pulse: true },
    NEUTRAL: { icon: Minus, color: 'bg-zinc-500', text: 'text-zinc-400', label: 'NEUTRAL', pulse: false },
  };
  const c = config[status];
  const Icon = c.icon;
  
  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-sm', 
      status === 'OPPORTUNITY' && 'bg-emerald-500/20 border border-emerald-500/30',
      status === 'SAFE' && 'bg-cyan-500/20 border border-cyan-500/30',
      status === 'RISK' && 'bg-rose-500/20 border border-rose-500/30',
      status === 'NEUTRAL' && 'bg-zinc-500/20 border border-zinc-500/30',
    )}>
      <span className={cn('relative flex h-2 w-2')}>
        {c.pulse && <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', c.color)} />}
        <span className={cn('relative inline-flex rounded-full h-2 w-2', c.color)} />
      </span>
      <span className={c.text}>{c.label}</span>
    </div>
  );
}

function MetricCard({ label, value, change, icon: Icon, color = 'emerald' }: {
  label: string;
  value: string;
  change?: { value: number; label: string };
  icon: typeof Wallet;
  color?: 'emerald' | 'rose' | 'cyan' | 'amber';
}) {
  const colorClasses = {
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
  };
  
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', colorClasses[color])} />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {change && (
        <p className={cn('text-xs mt-1', change.value >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
          {change.value >= 0 ? '+' : ''}{change.value.toFixed(2)}% {change.label}
        </p>
      )}
    </div>
  );
}

// ─── Main Investor Dashboard ──────────────────────────────────────────────────

export default function InvestorPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { marketData, regime, aiOutputs, aiInputs, ranges, metrics } = useLiquidityStore();
  const { t } = useI18n();
  const { toast } = useToast();

  const [selectedAsset, setSelectedAsset] = useState<AssetType>('USDC');
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { 
    usdcVaultState, usdtVaultState, usdcUserState, usdtUserState,
    totalTVL, userTotalPosition, refresh 
  } = useDualVaultData();

  const vaultState = selectedAsset === 'USDC' ? usdcVaultState : usdtVaultState;
  const userState = selectedAsset === 'USDC' ? usdcUserState : usdtUserState;
  const vaultAddress = selectedAsset === 'USDC' ? VAULT_USDC_ADDRESS : VAULT_USDT_ADDRESS;
  const assetAddress = selectedAsset === 'USDC' ? USDC_ARBITRUM_ONE : USDT_ARBITRUM_ONE;

  const walletBal = userState ? parseFloat(formatUnits(userState.stablecoinBalance, 6)) : 0;
  const userUsd = userState ? parseFloat(userState.assetsValueUsd) : 0;
  const vaiShares = userState ? parseFloat(formatUnits(userState.shares, 18)) : 0;
  const vaultAssets = vaultState ? parseFloat(vaultState.totalAssetsUsd) : 0;
  const sharePrice = vaultState ? parseFloat(vaultState.sharePriceUsd) : 1;

  // Calculate system status
  const systemStatus: SystemStatus = (() => {
    const confidence = aiOutputs.confidence ?? 0;
    const volatility = aiInputs.volatility1d ?? 0;
    const rebalanceScore = aiOutputs.rebalanceThreshold ?? 0;
    
    if (confidence > 0.7 && volatility < 0.03 && rebalanceScore > 0.6) return 'OPPORTUNITY';
    if (volatility > 0.08 || rebalanceScore > 0.8) return 'RISK';
    if (confidence > 0.5 && volatility < 0.05) return 'SAFE';
    return 'NEUTRAL';
  })();

  // Strategy mode based on AI outputs
  const strategyMode: StrategyMode = (() => {
    const core = aiOutputs.capitalAllocation?.core ?? 70;
    if (core >= 75) return 'AGGRESSIVE';
    if (core >= 55) return 'BALANCED';
    return 'CONSERVATIVE';
  })();

  // Estimated APR
  const estimatedAPR = metrics.avgAPY > 0 ? metrics.avgAPY * 100 : 68;

  // Alerts
  const alerts = [
    marketData.price > 0 && aiInputs.volatility1d > 0.05 && {
      type: 'warning',
      text: 'Volatility increased - wider ranges recommended',
    },
    aiOutputs.confidence > 0.7 && {
      type: 'success',
      text: 'High confidence signal detected',
    },
    (aiOutputs.rebalanceThreshold ?? 0) > 0.6 && {
      type: 'warning',
      text: `Rebalance recommended (score: ${Math.round((aiOutputs.rebalanceThreshold ?? 0) * 100)}%)`,
    },
    userTotalPosition > 0 && vaultState && parseFloat(vaultState.totalAssetsUsd) > 0 && {
      type: 'info',
      text: `Your position: $${userTotalPosition.toFixed(2)} (${((userTotalPosition / parseFloat(vaultState.totalAssetsUsd)) * 100).toFixed(1)}% of vault)`,
    },
  ].filter(Boolean) as { type: string; text: string }[];

  // AI Explanation
  const aiExplanation = (() => {
    const parts = [];
    if (aiInputs.volatility1d > 0.03) {
      parts.push(`Volatility at ${(aiInputs.volatility1d * 100).toFixed(1)}% (elevated).`);
    }
    if (aiInputs.volumeSpike) {
      parts.push('Volume spike detected.');
    }
    if (regime?.type) {
      parts.push(`Market regime: ${regime.type}.`);
    }
    if (aiOutputs.rangeWidth) {
      parts.push(`Recommended range width: ±${aiOutputs.rangeWidth.toFixed(1)}%.`);
    }
    return parts.join(' ') || 'Analyzing market conditions...';
  })();

  const handleDeposit = async () => {
    if (!walletClient || !address || !publicClient) {
      toast({ title: 'Connect wallet first', variant: 'destructive' });
      return;
    }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    setBusy(true);
    setTxHash(null);
    try {
      toast({ title: `Step 1/2 — Approve ${selectedAsset}` });
      const approveTx = await approveStablecoin(walletClient, address, amount, assetAddress, vaultAddress);
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      toast({ title: 'Step 2/2 — Deposit' });
      const depTx = await depositToVault(walletClient, address, amount, vaultAddress);
      await publicClient.waitForTransactionReceipt({ hash: depTx });
      setTxHash(depTx);
      setAmount('');
      await refresh();
      toast({ title: 'Deposit confirmed!', description: `$${amt.toLocaleString()} ${selectedAsset} deposited.` });
      setShowDeposit(false);
    } catch (err) {
      toast({ title: 'Deposit failed', description: (err instanceof Error ? err.message : 'Error').slice(0, 100), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!walletClient || !address || !publicClient) {
      toast({ title: 'Connect wallet first', variant: 'destructive' });
      return;
    }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      toast({ title: 'Invalid shares amount', variant: 'destructive' });
      return;
    }
    const shares = parseUnits(amount, 18);
    if (userState && shares > userState.shares) {
      toast({ title: 'Insufficient shares', variant: 'destructive' });
      return;
    }
    setBusy(true);
    setTxHash(null);
    try {
      toast({ title: 'Redeeming shares...' });
      const tx = await redeemFromVault(walletClient, address, shares, vaultAddress);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setTxHash(tx);
      setAmount('');
      await refresh();
      toast({ title: 'Withdrawal confirmed!' });
      setShowWithdraw(false);
    } catch (err) {
      toast({ title: 'Withdrawal failed', description: (err instanceof Error ? err.message : 'Error').slice(0, 100), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // Estimated PnL (simulated based on share price)
  const pnl7d = userTotalPosition > 0 ? (aiOutputs.confidence * 10 - 3) : 0;
  const fees24h = userTotalPosition > 0 ? (userTotalPosition * 0.001) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
              <Droplets className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold">AI Liquid Manager</h1>
              <p className="text-xs text-zinc-500">{NETWORK_LABEL}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* ═══════════════════════════════════════════════════════════════════════
            1. HEADER - DECISÃO IMEDIATA
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className={cn(
          'rounded-2xl p-5 border',
          systemStatus === 'OPPORTUNITY' && 'bg-gradient-to-br from-emerald-950/50 to-emerald-900/20 border-emerald-500/30',
          systemStatus === 'SAFE' && 'bg-gradient-to-br from-cyan-950/50 to-cyan-900/20 border-cyan-500/30',
          systemStatus === 'RISK' && 'bg-gradient-to-br from-rose-950/50 to-rose-900/20 border-rose-500/30',
          systemStatus === 'NEUTRAL' && 'bg-gradient-to-br from-zinc-900 to-zinc-800/50 border-zinc-700',
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={systemStatus} />
                <span className="text-xs text-zinc-500">AI Status</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
                <span>Market: <span className="text-zinc-200 font-medium capitalize">{regime?.type ?? 'range'}</span></span>
                <span>Strategy: <span className={cn(
                  'font-medium',
                  strategyMode === 'AGGRESSIVE' && 'text-emerald-400',
                  strategyMode === 'BALANCED' && 'text-amber-400',
                  strategyMode === 'CONSERVATIVE' && 'text-cyan-400',
                )}>{strategyMode}</span></span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-zinc-500">Confidence</p>
                <p className="text-2xl font-bold">{Math.round((aiOutputs.confidence ?? 0.5) * 100)}%</p>
              </div>
              <div className="w-16 h-16 relative">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#27272a" strokeWidth="4" />
                  <circle 
                    cx="32" cy="32" r="28" 
                    fill="none" 
                    stroke={systemStatus === 'OPPORTUNITY' ? '#10b981' : systemStatus === 'SAFE' ? '#06b6d4' : systemStatus === 'RISK' ? '#f43f5e' : '#71717a'}
                    strokeWidth="4" 
                    strokeDasharray={`${(aiOutputs.confidence ?? 0.5) * 176} 176`}
                    strokeLinecap="round"
                  />
                </svg>
                <Brain className="absolute inset-0 m-auto h-6 w-6 text-zinc-400" />
              </div>
            </div>
          </div>
          
          {/* Recommended Action */}
          <div className="mt-4 p-3 rounded-xl bg-black/30 border border-white/5">
            <p className="text-xs text-zinc-500 mb-1">Recommended Action</p>
            <p className="font-medium text-zinc-200">
              {systemStatus === 'OPPORTUNITY' && '→ Tighten range + increase capital in core position'}
              {systemStatus === 'SAFE' && '→ Maintain current positions, collect fees'}
              {systemStatus === 'RISK' && '→ Widen ranges, reduce exposure, monitor closely'}
              {systemStatus === 'NEUTRAL' && '→ No immediate action required'}
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            2. PERFORMANCE - PROVA DE VALOR
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Portfolio Value"
            value={`$${userTotalPosition.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={Wallet}
            color="cyan"
          />
          <MetricCard
            label="PnL (7d)"
            value={pnl7d >= 0 ? `+$${(userTotalPosition * pnl7d / 100).toFixed(0)}` : `-$${(userTotalPosition * Math.abs(pnl7d) / 100).toFixed(0)}`}
            change={userTotalPosition > 0 ? { value: pnl7d, label: 'vs last week' } : undefined}
            icon={pnl7d >= 0 ? TrendingUp : TrendingDown}
            color={pnl7d >= 0 ? 'emerald' : 'rose'}
          />
          <MetricCard
            label="Fees (24h)"
            value={`$${fees24h.toFixed(0)}`}
            icon={Coins}
            color="amber"
          />
          <MetricCard
            label="APR (est.)"
            value={`${estimatedAPR.toFixed(0)}%`}
            icon={BarChart3}
            color="emerald"
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            3. POSITIONS OVERVIEW
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-400" />
            Position Ranges
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ranges.map((range) => {
              const isActive = marketData.price >= range.priceLower && marketData.price <= range.priceUpper;
              const statusColor = isActive ? 'emerald' : range.type === 'defensive' ? 'amber' : 'cyan';
              
              return (
                <div key={range.type} className={cn(
                  'rounded-xl p-4 border',
                  range.type === 'core' && 'bg-emerald-500/5 border-emerald-500/20',
                  range.type === 'defensive' && 'bg-amber-500/5 border-amber-500/20',
                  range.type === 'opportunistic' && 'bg-cyan-500/5 border-cyan-500/20',
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      'text-xs font-semibold uppercase tracking-wide',
                      range.type === 'core' && 'text-emerald-400',
                      range.type === 'defensive' && 'text-amber-400',
                      range.type === 'opportunistic' && 'text-cyan-400',
                    )}>{range.type}</span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400',
                    )}>
                      {isActive ? '● Active' : '○ Standby'}
                    </span>
                  </div>
                  <p className="text-lg font-bold mb-1">
                    ${range.priceLower.toLocaleString()} — ${range.priceUpper.toLocaleString()}
                  </p>
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Capital: {range.percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            4. PRICE VISUAL
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              ETH Price & Ranges
            </h2>
            <span className="text-2xl font-bold">${marketData.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
          
          {/* Visual Range Chart */}
          <div className="relative h-24 mb-4">
            {/* Price line */}
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-zinc-700" />
            
            {/* Ranges */}
            {ranges.map((range) => {
              const minPrice = ranges.reduce((min, r) => Math.min(min, r.priceLower), Infinity);
              const maxPrice = ranges.reduce((max, r) => Math.max(max, r.priceUpper), 0);
              const left = ((range.priceLower - minPrice) / (maxPrice - minPrice)) * 100;
              const width = ((range.priceUpper - range.priceLower) / (maxPrice - minPrice)) * 100;
              const pricePos = ((marketData.price - minPrice) / (maxPrice - minPrice)) * 100;
              
              return (
                <div
                  key={range.type}
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 h-8 rounded-lg opacity-40',
                    range.type === 'core' && 'bg-emerald-500',
                    range.type === 'defensive' && 'bg-amber-500',
                    range.type === 'opportunistic' && 'bg-cyan-500',
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            })}
            
            {/* Current price marker */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-1 h-16 bg-white rounded-full shadow-lg shadow-white/50"
              style={{ left: `${Math.min(Math.max(((marketData.price - 1800) / (2200 - 1800)) * 100, 5), 95)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-zinc-500">
            <span>$1,800</span>
            <span className="text-zinc-400">Current: ${marketData.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            <span>$2,200</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            5. ALERTAS
        ═══════════════════════════════════════════════════════════════════════ */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div 
                key={i}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl text-sm',
                  alert.type === 'warning' && 'bg-amber-500/10 border border-amber-500/20 text-amber-300',
                  alert.type === 'success' && 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300',
                  alert.type === 'info' && 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300',
                )}
              >
                {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 shrink-0" />}
                {alert.type === 'success' && <Check className="h-4 w-4 shrink-0" />}
                {alert.type === 'info' && <Info className="h-4 w-4 shrink-0" />}
                <span>{alert.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            6. ACTION PANEL
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800/50 border border-zinc-700 p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Actions
          </h2>
          
          {/* Vault Selector */}
          <div className="flex rounded-xl bg-zinc-950 border border-zinc-700 p-1 mb-4">
            <button
              onClick={() => setSelectedAsset('USDC')}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                selectedAsset === 'USDC' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              USDC Vault
            </button>
            <button
              onClick={() => setSelectedAsset('USDT')}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                selectedAsset === 'USDT' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              <span className="w-2 h-2 rounded-full bg-green-500" />
              USDT Vault
            </button>
          </div>

          {!isConnected ? (
            <div className="text-center py-6">
              <Wallet className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 mb-4">Connect wallet to deposit or withdraw</p>
              <WalletConnect />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => { setShowDeposit(true); setShowWithdraw(false); setAmount(''); }}
                  className={cn(
                    'h-14 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2',
                    showDeposit 
                      ? 'bg-emerald-500 text-black' 
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700',
                  )}
                >
                  <ArrowDownLeft className="h-5 w-5" />
                  Deposit
                </button>
                <button
                  onClick={() => { setShowWithdraw(true); setShowDeposit(false); setAmount(''); }}
                  className={cn(
                    'h-14 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2',
                    showWithdraw 
                      ? 'bg-rose-500 text-white' 
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700',
                  )}
                >
                  <ArrowUpRight className="h-5 w-5" />
                  Withdraw
                </button>
              </div>

              <AnimatePresence>
                {(showDeposit || showWithdraw) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-700 mb-4">
                      <div className="flex justify-between text-sm mb-3">
                        <span className="text-zinc-500">Your {selectedAsset} Balance</span>
                        <span className="font-medium">${walletBal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-4">
                        <span className="text-zinc-500">Your Position</span>
                        <span className="font-medium">${userUsd.toFixed(2)}</span>
                      </div>
                      
                      <div className="relative mb-3">
                        <input
                          type="number"
                          placeholder={showDeposit ? "0.00" : "0.0000"}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full h-14 px-4 pr-24 text-xl font-bold bg-zinc-900 border border-zinc-700 rounded-xl focus:outline-none focus:border-zinc-500"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          <button
                            onClick={() => setAmount(showDeposit ? walletBal.toFixed(6) : vaiShares.toFixed(6))}
                            className="text-xs px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-600"
                          >
                            MAX
                          </button>
                          <span className="text-sm text-zinc-500">{showDeposit ? selectedAsset : 'vAI'}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={showDeposit ? handleDeposit : handleWithdraw}
                        disabled={busy || vaultState?.paused}
                        className={cn(
                          'w-full h-12 rounded-xl font-bold transition-colors flex items-center justify-center gap-2',
                          showDeposit ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'bg-rose-500 hover:bg-rose-400 text-white',
                          'disabled:opacity-50',
                        )}
                      >
                        {busy ? (
                          <><RefreshCw className="h-4 w-4 animate-spin" /> Processing...</>
                        ) : (
                          <>{showDeposit ? `Deposit ${selectedAsset}` : `Withdraw ${selectedAsset}`}</>
                        )}
                      </button>
                      
                      {txHash && (
                        <a
                          href={`${EXPLORER}/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 text-xs text-emerald-400 mt-3"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View transaction
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between text-xs text-zinc-500">
                <span>Vault TVL: ${vaultAssets.toLocaleString()}</span>
                <span>Share Price: ${sharePrice.toFixed(4)}</span>
              </div>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            7. AI EXPLANATION
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl bg-gradient-to-br from-violet-950/30 to-zinc-900 border border-violet-500/20 p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-400" />
            AI Insight
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed mb-4">{aiExplanation}</p>
          
          {aiOutputs.reasoning && (
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <p className="text-xs text-zinc-400">{aiOutputs.reasoning}</p>
            </div>
          )}
          
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-xs text-zinc-500">Range Width</p>
              <p className="font-bold text-violet-400">±{(aiOutputs.rangeWidth ?? 8).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Volatility</p>
              <p className="font-bold">{(aiInputs.volatility1d * 100).toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Trend</p>
              <p className={cn(
                'font-bold capitalize',
                aiInputs.trendDirection === 'up' && 'text-emerald-400',
                aiInputs.trendDirection === 'down' && 'text-rose-400',
              )}>{aiInputs.trendDirection}</p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            8. ADVANCED (COLLAPSIBLE)
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
          >
            <span className="font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-zinc-500" />
              Advanced Data
            </span>
            {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          <AnimatePresence>
            {advancedOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 pt-2 border-t border-zinc-800">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-zinc-500">Tick</p>
                      <p className="font-medium">{marketData.tick?.toLocaleString() ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">TWAP</p>
                      <p className="font-medium">${marketData.twap?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Liquidity</p>
                      <p className="font-medium">${(marketData.liquidity / 1e6).toFixed(1)}M</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Volume 24h</p>
                      <p className="font-medium">${(marketData.volume24h / 1e6).toFixed(1)}M</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">ATR</p>
                      <p className="font-medium">${marketData.atr?.toFixed(2) ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Std Dev</p>
                      <p className="font-medium">${marketData.stdDeviation?.toFixed(2) ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Vol 7D</p>
                      <p className="font-medium">{(marketData.volatility7d * 100).toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Rebal. Threshold</p>
                      <p className="font-medium">{((aiOutputs.rebalanceThreshold ?? 0) * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  
                  {/* Vault Links */}
                  <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap gap-4 text-xs">
                    <a href={`${EXPLORER}/address/${VAULT_USDC_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-blue-400 transition-colors">
                      USDC Vault ↗
                    </a>
                    <a href={`${EXPLORER}/address/${VAULT_USDT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-green-400 transition-colors">
                      USDT Vault ↗
                    </a>
                    <a href={`${EXPLORER}/address/0xC6962004f452bE9203591991D15f6b388e09E8D0`} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-emerald-400 transition-colors">
                      Pool ETH/USDC ↗
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-600 py-4">
          <p>AI Liquid Manager · ERC-4626 Vault on Arbitrum One</p>
          <p className="mt-1">Past performance does not guarantee future returns. IL and volatility may affect your position.</p>
        </div>
      </main>
    </div>
  );
}
