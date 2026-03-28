'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import {
  VAULT_ADDRESS,
  USDC_ARBITRUM_ONE,
  readVaultState,
  readUserVaultState,
  approveStablecoin,
  depositToVault,
  redeemFromVault,
  type VaultState,
  type UserVaultState,
} from '@/lib/vault-contract';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  Clock,
  Coins,
  Droplets,
  Gauge,
  Layers,
  LineChart,
  Minus,
  Play,
  RefreshCw,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useLiquidityStore } from '@/lib/liquidity-store';
import { cn } from '@/lib/utils';
import { WalletConnect, ACTIVE_CHAIN_ID } from '@/components/wallet-connect';
import { NetworkGuard } from '@/components/network-guard';
import { TransactionHistory } from '@/components/transaction-history';
import { MobileNav } from '@/components/mobile-nav';
import { LanguageSwitcher } from '@/components/language-switcher';
import { CardInfo } from '@/components/card-info';
import { useI18n } from '@/contexts/i18n-context';

// Derive network label and explorer from ACTIVE_CHAIN_ID (set via NEXT_PUBLIC_CHAIN_ID)
const NETWORK_LABEL   = ACTIVE_CHAIN_ID === 421614 ? 'Arbitrum Sepolia' : 'Arbitrum One';
const EXPLORER_BASE   = ACTIVE_CHAIN_ID === 421614 ? 'https://sepolia.arbiscan.io' : 'https://arbiscan.io';
import { UniswapPositions } from '@/components/uniswap-positions';
import { OpenPositionModal } from '@/components/open-position-modal';
import { useToast } from '@/hooks/use-toast';

// ── Investor Onboarding Banner ────────────────────────────────────────────────
function OnboardingBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('onboarding_dismissed');
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem('onboarding_dismissed', '1');
    setVisible(false);
  };

  if (!visible) return null;

  const steps = [
    {
      icon: Wallet,
      color: 'from-emerald-500/20 border-emerald-500/30',
      iconColor: 'text-emerald-400',
      title: '1. Deposite USDC',
      desc: 'Conecte sua carteira e deposite USDC. Você recebe shares (vAI) proporcionais ao valor depositado.',
    },
    {
      icon: Brain,
      color: 'from-cyan-500/20 border-cyan-500/30',
      iconColor: 'text-cyan-400',
      title: '2. IA Gerencia',
      desc: 'O modelo LightGBM detecta o regime de mercado e rebalanceia posições na Uniswap V3 a cada 15 min.',
    },
    {
      icon: TrendingUp,
      color: 'from-violet-500/20 border-violet-500/30',
      iconColor: 'text-violet-400',
      title: '3. Retire com Rendimento',
      desc: 'Saque a qualquer momento. Seus shares valem mais à medida que as taxas de LP são acumuladas.',
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        className="mb-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-card to-cyan-950/30 p-5 sm:p-6 relative"
      >
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
            <Droplets className="h-4 w-4 text-white" />
          </div>
          <h2 className="font-bold text-base sm:text-lg">Bem-vindo ao AI Liquidity Manager</h2>
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-xs hidden sm:inline-flex">Ao vivo na Arbitrum</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
          Vault tokenizado (ERC-4626) que usa inteligência artificial para gerenciar liquidez na Uniswap V3 e gerar taxas automaticamente para você.
        </p>

        {/* 3 Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className={cn(
                  'rounded-xl border bg-gradient-to-br to-transparent p-4',
                  s.color
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn('h-4 w-4', s.iconColor)} />
                  <span className="font-semibold text-sm">{s.title}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Key facts */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-emerald-400" /> ERC-4626 auditável</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-cyan-400" /> Rebalanceio a cada 15 min</span>
            <span className="flex items-center gap-1"><Coins className="h-3 w-3 text-amber-400" /> 2% gestão + 20% performance</span>
            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-violet-400" /> Sem lock-up</span>
          </div>
          <button
            onClick={() => { dismiss(); document.getElementById('vault')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="ml-auto shrink-0 px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Depositar USDC →
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Animated number component
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 2 }: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  
  useEffect(() => {
    const start = displayValue;
    const end = value;
    const duration = 500;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value]);
  
  return (
    <span>
      {prefix}{displayValue.toLocaleString('en-US', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
      })}{suffix}
    </span>
  );
}

// Status indicator with pulse animation
function StatusIndicator({ status, label }: { status: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "w-2 h-2 rounded-full",
        status ? "bg-emerald-500" : "bg-red-500"
      )}>
        {status && (
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute" />
        )}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// Main metric card
function MetricCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  prefix = '', 
  suffix = '',
  color = 'emerald',
}: { 
  title: string;
  value: number;
  change?: number;
  icon: React.ElementType;
  prefix?: string;
  suffix?: string;
  color?: 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan';
}) {
  const colorClasses = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-400',
    violet: 'from-violet-500/20 to-violet-500/5 text-violet-400',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-400',
    cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-400',
  };
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="text-2xl font-bold tracking-tight">
              <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
            </div>
            {change !== undefined && (
              <div className={cn(
                "flex items-center gap-1 text-sm",
                change >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {change >= 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                <span>{Math.abs(change).toFixed(2)}%</span>
              </div>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl bg-gradient-to-br",
            colorClasses[color]
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Vault Manager Component — real ERC-4626 on-chain interactions
function VaultManager() {
  const { toast } = useToast();
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { t } = useI18n();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawShares, setWithdrawShares] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [vaultState, setVaultState] = useState<VaultState | null>(null);
  const [userState, setUserState] = useState<UserVaultState | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const vaultDeployed = Boolean(VAULT_ADDRESS);

  const refreshState = useCallback(async () => {
    if (!publicClient) return;
    const vs = await readVaultState(publicClient);
    setVaultState(vs);
    if (address) {
      const us = await readUserVaultState(publicClient, address);
      setUserState(us);
    }
  }, [publicClient, address]);

  useEffect(() => {
    refreshState();
    const iv = setInterval(refreshState, 30_000);
    return () => clearInterval(iv);
  }, [refreshState]);

  const handleDeposit = async () => {
    if (!walletClient || !address || !publicClient) {
      toast({ title: 'Connect wallet first', variant: 'destructive' });
      return;
    }
    const amount = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amount) || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter a positive USDC amount.', variant: 'destructive' });
      return;
    }
    if (!vaultDeployed) {
      toast({ title: 'Vault not deployed', description: 'Set NEXT_PUBLIC_VAULT_ADDRESS in env vars.', variant: 'destructive' });
      return;
    }
    setIsDepositing(true);
    setTxHash(null);
    try {
      // Step 1: Approve USDC
      toast({ title: 'Step 1/2 — Approve USDC', description: 'Confirm approval in your wallet…' });
      const approveTx = await approveStablecoin(walletClient, address, depositAmount, USDC_ARBITRUM_ONE);
      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      // Step 2: Deposit
      toast({ title: 'Step 2/2 — Deposit', description: 'Confirm deposit in your wallet…' });
      const depositTx = await depositToVault(walletClient, address, depositAmount);
      await publicClient.waitForTransactionReceipt({ hash: depositTx });

      setTxHash(depositTx);
      setDepositAmount('');
      await refreshState();
      toast({
        title: 'Deposit successful',
        description: `$${amount.toLocaleString()} deposited into vault. vAI shares received.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      toast({ title: 'Deposit failed', description: msg.slice(0, 100), variant: 'destructive' });
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!walletClient || !address || !publicClient) {
      toast({ title: 'Connect wallet first', variant: 'destructive' });
      return;
    }
    const sharesNum = parseFloat(withdrawShares);
    if (!withdrawShares || isNaN(sharesNum) || sharesNum <= 0) {
      toast({ title: 'Invalid shares', description: 'Enter a positive number of vAI shares.', variant: 'destructive' });
      return;
    }
    if (!vaultDeployed) {
      toast({ title: 'Vault not deployed', variant: 'destructive' });
      return;
    }
    const sharesToRedeem = parseUnits(withdrawShares, 18);
    if (userState && sharesToRedeem > userState.shares) {
      toast({
        title: 'Insufficient shares',
        description: `You hold ${formatUnits(userState.shares, 18)} vAI shares.`,
        variant: 'destructive',
      });
      return;
    }
    setIsWithdrawing(true);
    setTxHash(null);
    try {
      toast({ title: 'Redeeming vAI shares', description: 'Confirm transaction in your wallet…' });
      const redeemTx = await redeemFromVault(walletClient, address, sharesToRedeem);
      await publicClient.waitForTransactionReceipt({ hash: redeemTx });

      setTxHash(redeemTx);
      setWithdrawShares('');
      await refreshState();
      toast({
        title: 'Withdrawal successful',
        description: `Shares redeemed — USDC returned to your wallet.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      toast({ title: 'Withdrawal failed', description: msg.slice(0, 100), variant: 'destructive' });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const totalAssetsUsd = vaultState ? parseFloat(vaultState.totalAssetsUsd) : 0;
  const sharePriceUsd  = vaultState ? parseFloat(vaultState.sharePriceUsd) : 1.0;
  const userAssetsUsd  = userState ? parseFloat(userState.assetsValueUsd) : 0;
  const userUsdcBal    = userState ? parseFloat(formatUnits(userState.stablecoinBalance, 6)) : 0;

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5">
              <Shield className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-lg">Vault Manager</CardTitle>
                <CardInfo tip={t('vaultManager.card')} />
              </div>
              <CardDescription>
                ERC-4626 · {NETWORK_LABEL}
                {VAULT_ADDRESS && (
                  <a
                    href={`${EXPLORER_BASE}/address/${VAULT_ADDRESS}`}
                    target="_blank" rel="noopener noreferrer"
                    className="ml-2 font-mono text-xs text-emerald-400 hover:underline"
                  >
                    {VAULT_ADDRESS.slice(0, 6)}…{VAULT_ADDRESS.slice(-4)}
                  </a>
                )}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className={vaultState?.paused ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}>
            {vaultState?.paused ? 'Paused' : vaultDeployed ? 'Live' : 'Not Deployed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* On-chain stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Total Assets (on-chain)
              <CardInfo tip={t('vaultManager.totalAssets')} />
            </p>
            <p className="text-xl font-bold">
              <AnimatedNumber value={totalAssetsUsd} prefix="$" decimals={0} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              vAI Share Price
              <CardInfo tip={t('vaultManager.sharePrice')} />
            </p>
            <p className="text-xl font-bold">
              <AnimatedNumber value={sharePriceUsd} prefix="$" decimals={4} />
            </p>
          </div>
          {isConnected && (
            <>
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  Your Position
                  <CardInfo tip={t('vaultManager.yourPosition')} />
                </p>
                <p className="text-xl font-bold">
                  <AnimatedNumber value={userAssetsUsd} prefix="$" decimals={2} />
                </p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  Wallet USDC
                  <CardInfo tip={t('vaultManager.walletUsdc')} />
                </p>
                <p className="text-xl font-bold">
                  <AnimatedNumber value={userUsdcBal} prefix="$" decimals={2} />
                </p>
              </div>
            </>
          )}
        </div>

        {/* Active LP positions count */}
        {vaultState && vaultState.activePositions > 0n && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
            <Activity className="h-3 w-3 flex-shrink-0" />
            {vaultState.activePositions.toString()} active LP position{vaultState.activePositions > 1n ? 's' : ''} on Uniswap V3
          </div>
        )}

        <Separator className="bg-border/50" />

        {!isConnected ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Connect wallet ({NETWORK_LABEL}) to deposit or withdraw
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  Deposit USDC
                  <CardInfo tip={t('vaultManager.deposit')} />
                </p>
                <input
                  type="number"
                  placeholder="Amount (USDC)"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDeposit()}
                  className="w-full px-3 py-2 text-sm bg-background/50 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <Button
                  size="sm"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleDeposit}
                  disabled={isDepositing || vaultState?.paused}
                >
                  {isDepositing ? <><Minus className="h-3 w-3 mr-1 animate-spin" />Processing…</> : 'Deposit'}
                </Button>
              </div>
              <div className="space-y-2">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  Redeem vAI Shares
                  <CardInfo tip={t('vaultManager.withdraw')} />
                </p>
                <input
                  type="number"
                  placeholder="vAI shares"
                  value={withdrawShares}
                  onChange={(e) => setWithdrawShares(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleWithdraw()}
                  className="w-full px-3 py-2 text-sm bg-background/50 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full"
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || vaultState?.paused}
                >
                  {isWithdrawing ? <><Minus className="h-3 w-3 mr-1 animate-spin" />Processing…</> : 'Withdraw'}
                </Button>
              </div>
            </div>

            {txHash && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
                <span>Tx confirmed:</span>
                <a
                  href={`${EXPLORER_BASE}/tx/${txHash}`}
                  target="_blank" rel="noopener noreferrer"
                  className="font-mono underline"
                >
                  {txHash.slice(0, 10)}…
                </a>
              </div>
            )}
          </>
        )}

        {vaultState && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Mgmt fee: {Number(vaultState.managementFeeBps) / 100}% · Perf fee: {Number(vaultState.performanceFeeBps) / 100}%
            <CardInfo tip={t('vaultManager.fees')} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Strategy Controller Component
function StrategyController() {
  const { currentCycle, startCycle, executeRebalance, updateMarketData, setAiOutputs, systemStatus } = useLiquidityStore();
  const { toast } = useToast();
  const { t } = useI18n();
  const [cyclePhase, setCyclePhase] = useState(0);
  const [keeperStatus, setKeeperStatus] = useState<{ last_run?: string; next_run_in_seconds?: number; status?: string } | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  // Fetch real keeper status via server-side proxy (avoids CORS)
  useEffect(() => {
    const fetch_ = () =>
      fetch('/api/system-status', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => d?.keeper && setKeeperStatus(d.keeper))
        .catch(() => null);
    fetch_();
    const iv = setInterval(fetch_, 30_000);
    return () => clearInterval(iv);
  }, []);

  const nextRunLabel = keeperStatus?.next_run_in_seconds != null
    ? keeperStatus.next_run_in_seconds < 60
      ? `In ${keeperStatus.next_run_in_seconds}s`
      : `In ${Math.round(keeperStatus.next_run_in_seconds / 60)}min`
    : '—';

  const phases = [
    { name: 'Data Collection', icon: Activity, key: 'data-collection' },
    { name: 'AI Inference', icon: Brain, key: 'ai-inference' },
    { name: 'Range Optimization', icon: Target, key: 'range-optimization' },
    { name: 'Execution', icon: Zap, key: 'execution' },
  ];

  const handleRunCycle = async () => {
    startCycle();
    updateMarketData(); // fetch market data from The Graph
    toast({ title: 'Strategy cycle started', description: 'Fetching live market data and running AI inference…' });

    // Call Python AI engine via proxy for live inference on the ETH/USDC pool
    const POOL = process.env.NEXT_PUBLIC_CHAIN_ID === '421614'
      ? '0x77F8dA77c8fb5ADAf3088937B934beC2B0ff97bF'  // Arbitrum Sepolia
      : '0xC6962004f452bE9203591991D15f6b388e09E8D0'; // Arbitrum One
    try {
      const res = await fetch(`/api/ai?action=pool&pool=${POOL}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setAiOutputs({
            rangeWidth:  d.range_width ?? d.rangeWidth,
            confidence:  d.confidence,
            capitalAllocation: {
              core:          d.core_allocation          ?? d.capitalAllocation?.core          ?? 70,
              defensive:     d.defensive_allocation     ?? d.capitalAllocation?.defensive     ?? 20,
              opportunistic: d.opportunistic_allocation ?? d.capitalAllocation?.opportunistic ?? 10,
              cashBuffer:    d.cash_buffer              ?? d.capitalAllocation?.cashBuffer    ?? 0,
            },
          });
          toast({ title: 'AI inference complete', description: `Regime: ${d.detected_regime ?? 'range'} | Confidence: ${Math.round((d.confidence ?? 0.7) * 100)}%` });
        }
      }
    } catch {
      // Non-fatal: store already has last known AI outputs
    }
  };

  const handleRebalance = async () => {
    if (isTriggering) return;
    setIsTriggering(true);
    toast({ title: 'Rebalance queued', description: 'Sending keeper trigger to execute on-chain rebalance…' });
    try {
      const res = await fetch('/api/keeper/trigger', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.queued) {
        executeRebalance();
        toast({ title: 'Keeper triggered', description: 'On-chain rebalance cycle started. Check Keeper status for progress.' });
      } else {
        toast({
          title: res.ok ? 'Keeper busy' : 'Trigger failed',
          description: data.message ?? data.error ?? data.detail ?? 'Check Render env vars: VAULT_ADDRESS, KEEPER_PRIVATE_KEY, RPC_URL_ARBITRUM',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach keeper API.', variant: 'destructive' });
    } finally {
      setIsTriggering(false);
    }
  };

  useEffect(() => {
    if (currentCycle) {
      const interval = setInterval(() => {
        setCyclePhase(prev => {
          if (prev < phases.length - 1) return prev + 1;
          return 0;
        });
      }, 2000);
      return () => clearInterval(interval);
    } else {
      setCyclePhase(0);
    }
  }, [currentCycle]);
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5">
              <Layers className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-lg">Strategy Controller</CardTitle>
                <CardInfo tip={t('strategyController.card')} />
              </div>
              <CardDescription>Orchestration engine</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20">
            {currentCycle ? 'Running' : 'Idle'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          {phases.map((phase, i) => {
            const isActive = currentCycle && i === cyclePhase;
            const isComplete = currentCycle && i < cyclePhase;
            return (
              <div key={phase.key} className="flex-1">
                <motion.div
                  className={cn(
                    "h-2 rounded-full",
                    isActive ? "bg-violet-500" : isComplete ? "bg-emerald-500" : "bg-muted"
                  )}
                  animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1 }}
                />
              </div>
            );
          })}
        </div>
        
        <div className="space-y-2">
          {phases.map((phase, i) => {
            const isActive = currentCycle && i === cyclePhase;
            const Icon = phase.icon;
            return (
              <div
                key={phase.key}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg transition-colors",
                  isActive ? "bg-violet-500/10" : "bg-transparent"
                )}
              >
                <Icon className={cn(
                  "h-4 w-4",
                  isActive ? "text-violet-400" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {phase.name}
                </span>
                {isActive && (
                  <motion.div
                    className="ml-auto"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <Clock className="h-4 w-4 text-violet-400" />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
        
        <Separator className="bg-border/50" />
        
        <div className="grid grid-cols-2 gap-2">
          <div className="text-xs">
            <p className="flex items-center gap-1 text-muted-foreground">
              Cycle Interval
              <CardInfo tip={t('strategyController.cycleInterval')} />
            </p>
            <p className="font-medium">
              {keeperStatus ? `${Math.round(((keeperStatus as { interval_seconds?: number }).interval_seconds ?? 900) / 60)} min` : '15 min'}
            </p>
          </div>
          <div className="text-xs">
            <p className="flex items-center gap-1 text-muted-foreground">
              Next Run
              <CardInfo tip={t('strategyController.nextRun')} />
            </p>
            <p className="font-medium">{nextRunLabel}</p>
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            className="flex-1 bg-violet-600 hover:bg-violet-700"
            onClick={handleRunCycle}
            disabled={!!currentCycle}
          >
            <Play className="h-4 w-4 mr-1" />
            {currentCycle ? 'Running…' : 'Run Cycle'}
          </Button>
          <CardInfo tip={t('strategyController.runCycle')} />
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={handleRebalance}
            disabled={isTriggering}
          >
            {isTriggering ? 'Triggering…' : 'Rebalance'}
          </Button>
          <CardInfo tip={t('strategyController.rebalance')} />
        </div>
      </CardContent>
    </Card>
  );
}

// AI Strategy Engine Component
function AIStrategyEngine() {
  const { aiInputs, aiOutputs, marketData } = useLiquidityStore();
  const { t } = useI18n();

  const inputBars = [
    { label: 'Volatility 1D', tip: t('aiStrategy.volatility1d'), value: aiInputs.volatility1d * 100, max: 10 },
    { label: 'Volatility 7D', tip: t('aiStrategy.volatility7d'), value: aiInputs.volatility7d * 100, max: 15 },
    { label: 'Volume Score', tip: t('aiStrategy.volumeScore'), value: (aiInputs.volume / 20000000) * 100, max: 100 },
    { label: 'Liquidity Depth', tip: t('aiStrategy.liquidityDepth'), value: (aiInputs.liquidityDepth / 30000000) * 100, max: 100 },
  ];

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/5">
              <Brain className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-lg">AI Strategy Engine</CardTitle>
                <CardInfo tip={t('aiStrategy.card')} />
              </div>
              <CardDescription>Parameter generation</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
            LightGBM
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
        <div>
          <p className="text-xs text-muted-foreground mb-3">Model Inputs</p>
          <div className="space-y-3">
            {inputBars.map((bar) => (
              <div key={bar.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {bar.label}
                    <CardInfo tip={bar.tip} />
                  </span>
                  <span>{bar.value.toFixed(1)}%</span>
                </div>
                <Progress value={bar.value} className="h-1.5" />
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-border/50" />

        <div>
          <p className="text-xs text-muted-foreground mb-3">Model Outputs</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-1 mb-0.5">
                <p className="text-xs text-muted-foreground">Range Width</p>
                <CardInfo tip={t('aiStrategy.rangeWidth')} />
              </div>
              <p className="text-lg font-bold text-cyan-400">±{aiOutputs.rangeWidth.toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-1 mb-0.5">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <CardInfo tip={t('aiStrategy.confidence')} />
              </div>
              <p className="text-lg font-bold text-emerald-400">
                {(aiOutputs.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 text-cyan-400 mt-0.5" />
            <p className="text-xs text-cyan-300">{aiOutputs.reasoning}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-2 py-1 rounded text-xs",
            aiInputs.volumeSpike ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"
          )}>
            {aiInputs.volumeSpike ? 'Volume Spike Detected' : 'Normal Volume'}
          </div>
          <div className={cn(
            "px-2 py-1 rounded text-xs",
            aiInputs.trendDirection === 'up' ? "bg-emerald-500/20 text-emerald-400" :
            aiInputs.trendDirection === 'down' ? "bg-rose-500/20 text-rose-400" :
            "bg-muted text-muted-foreground"
          )}>
            Trend: {aiInputs.trendDirection.toUpperCase()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Range Optimizer Component
function RangeOptimizer() {
  const { ranges, marketData, aiOutputs } = useLiquidityStore();
  const { t } = useI18n();
  const price = marketData.price;

  const rangeColors = {
    core: '#10b981',
    defensive: '#f59e0b',
    opportunistic: '#8b5cf6',
  };

  const rangeTips: Record<string, string> = {
    core: t('rangeOptimizer.core'),
    defensive: t('rangeOptimizer.defensive'),
    opportunistic: t('rangeOptimizer.opportunistic'),
  };

  const pieData = ranges.map(r => ({
    name: r.type.charAt(0).toUpperCase() + r.type.slice(1),
    value: r.percentage,
    fill: rangeColors[r.type],
  }));

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
              <Target className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-lg">Range Optimizer</CardTitle>
                <CardInfo tip={t('rangeOptimizer.card')} />
              </div>
              <CardDescription>Tick calculation & allocation</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-center">
          <PieChart width={160} height={160}>
            <Pie
              data={pieData}
              cx={80}
              cy={80}
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => [`${value}%`, 'Allocation']}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            />
          </PieChart>
          <div className="space-y-2 ml-4">
            {ranges.map((range) => (
              <div key={range.type} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: rangeColors[range.type] }}
                />
                <span className="text-xs capitalize">{range.type}</span>
                <span className="text-xs text-muted-foreground">{range.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
        
        <Separator className="bg-border/50" />
        
        <div className="space-y-3">
          {ranges.map((range) => (
            <div
              key={range.type}
              className="p-3 rounded-lg bg-background/50 border border-border/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1 text-sm font-medium capitalize">
                  {range.type} Range
                  <CardInfo tip={rangeTips[range.type]} />
                </span>
                <Badge
                  variant="outline"
                  style={{
                    borderColor: rangeColors[range.type] + '40',
                    color: rangeColors[range.type]
                  }}
                >
                  {range.type === 'core' ? '±6%' : range.type === 'defensive' ? '±20%' : '±2%'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>${range.priceLower.toFixed(2)}</span>
                <span className="text-foreground font-medium">${price.toFixed(2)}</span>
                <span>${range.priceUpper.toFixed(2)}</span>
              </div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: rangeColors[range.type] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${range.percentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Execution Engine Component
function ExecutionEngine() {
  const { positions, recentExecutions, collectFees, marketData, aiOutputs } = useLiquidityStore();
  const { toast } = useToast();
  const { t } = useI18n();
  const [openPositionModal, setOpenPositionModal] = useState(false);
  const [collectingId, setCollectingId] = useState<string | null>(null);

  const handleCollectFees = async (posId: string, fees0: number, fees1: number) => {
    if (fees0 === 0 && fees1 === 0) {
      toast({ title: 'No fees to collect', description: 'This position has no uncollected fees.' });
      return;
    }
    setCollectingId(posId);
    try {
      collectFees(posId);
      toast({
        title: 'Fees collected',
        description: `+${fees0.toFixed(4)} ETH  +${fees1.toFixed(2)} USDC`,
      });
    } finally {
      setCollectingId(null);
    }
  };
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-500/5">
              <Zap className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-lg">Execution Engine</CardTitle>
                <CardInfo tip={t('executionEngine.card')} />
              </div>
              <CardDescription>Position management & transactions</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
        <div className="space-y-2">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            Active Positions
            <CardInfo tip={t('executionEngine.activePositions')} />
          </p>
          <ScrollArea className="h-44">
            {positions.map((pos) => (
              <div
                key={pos.id}
                className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50 mb-2"
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    pos.inRange ? "bg-emerald-500" : "bg-rose-500"
                  )} />
                  <div>
                    <p className="text-sm font-medium">{pos.pool}</p>
                    <p className="text-xs text-muted-foreground">
                      {pos.token0Amount.toFixed(2)} ETH + {pos.token1Amount.toFixed(0)} USDC
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xs text-emerald-400">+{pos.feesEarned0.toFixed(4)} ETH</p>
                    <p className="text-xs text-emerald-400">+{pos.feesEarned1.toFixed(2)} USDC</p>
                  </div>
                  <CardInfo tip={t('executionEngine.collectFees')} />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    disabled={collectingId === pos.id}
                    onClick={() => handleCollectFees(pos.id, pos.feesEarned0, pos.feesEarned1)}
                  >
                    <Coins className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
        
        <Separator className="bg-border/50" />
        
        <div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            Recent Executions
            <CardInfo tip={t('executionEngine.recentExecutions')} />
          </p>
          <div className="space-y-1">
            {recentExecutions.length > 0 ? (
              recentExecutions.slice(0, 3).map((exec) => (
                <div key={exec.id} className="flex items-center justify-between text-xs">
                  <span className="capitalize">{exec.type}</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      exec.status === 'completed' ? "border-emerald-500/50 text-emerald-400" :
                      exec.status === 'pending' ? "border-amber-500/50 text-amber-400" :
                      "border-rose-500/50 text-rose-400"
                    )}
                  >
                    {exec.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No recent executions</p>
            )}
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* On-chain positions via wallet */}
        <UniswapPositions />

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            onClick={() => setOpenPositionModal(true)}
          >
            <Zap className="h-3 w-3 mr-1" />
            Open New Position (AI Range)
          </Button>
          <CardInfo tip={t('executionEngine.openPosition')} />
        </div>

        <OpenPositionModal
          open={openPositionModal}
          onClose={() => setOpenPositionModal(false)}
          currentPrice={marketData?.price ?? 0}
          aiRangeWidth={aiOutputs?.rangeWidth ?? 0}
          aiConfidence={aiOutputs?.confidence ?? 0}
        />
      </CardContent>
    </Card>
  );
}

// Risk Dashboard Component
function RiskDashboard() {
  const { riskMetrics, regime } = useLiquidityStore();
  const { t } = useI18n();

  const regimeColors = {
    'trend': 'text-emerald-400',
    'range': 'text-amber-400',
    'high-vol': 'text-rose-400',
    'low-vol': 'text-cyan-400',
  };
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-500/5">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-lg">Risk Dashboard</CardTitle>
                <CardInfo tip={t('riskDashboard.card')} />
              </div>
              <CardDescription>IL, metrics & regime detection</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
        <div className="p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Market Regime
              <CardInfo tip={t('riskDashboard.marketRegime')} />
            </span>
            <Badge
              variant="outline"
              className={cn("capitalize", regimeColors[regime.type])}
            >
              {regime.type.replace('-', ' ')}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="flex items-center gap-0.5 text-muted-foreground">
                Trend <CardInfo tip={t('riskDashboard.trend')} />
              </p>
              <p className="font-medium">{(regime.indicators.trendStrength * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="flex items-center gap-0.5 text-muted-foreground">
                Vol <CardInfo tip={t('riskDashboard.vol')} />
              </p>
              <p className="font-medium">{(regime.indicators.volatilityLevel * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="flex items-center gap-0.5 text-muted-foreground">
                Volume <CardInfo tip={t('riskDashboard.volume')} />
              </p>
              <p className="font-medium">{(regime.indicators.volumeProfile * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-background/50 border border-border/50">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Impermanent Loss <CardInfo tip={t('metrics.impermanentLoss.tip')} />
            </p>
            <p className="text-lg font-bold text-rose-400">
              {(riskMetrics.impermanentLoss * 100).toFixed(2)}%
            </p>
          </div>
          <div className="p-3 rounded-lg bg-background/50 border border-border/50">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Max Drawdown <CardInfo tip={t('metrics.maxDrawdown.tip')} />
            </p>
            <p className="text-lg font-bold text-amber-400">
              {(riskMetrics.maxDrawdown * 100).toFixed(1)}%
            </p>
          </div>
          <div className="p-3 rounded-lg bg-background/50 border border-border/50">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Sharpe Ratio <CardInfo tip={t('metrics.sharpe.tip')} />
            </p>
            <p className="text-lg font-bold text-emerald-400">
              {riskMetrics.sharpeRatio.toFixed(2)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-background/50 border border-border/50">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              VaR 95% <CardInfo tip={t('metrics.var95.tip')} />
            </p>
            <p className="text-lg font-bold text-cyan-400">
              {(riskMetrics.var95 * 100).toFixed(1)}%
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              Rebalance Score
              <CardInfo tip={t('riskDashboard.rebalanceScore')} />
            </span>
            <span>0.42 / 0.65 threshold</span>
          </div>
          <Progress value={65} className="h-2" />
          <p className="text-xs text-muted-foreground">
            No rebalance needed until score exceeds threshold
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Price Chart Component — fetches real 24h price history from CoinGecko
function PriceChart() {
  const { marketData } = useLiquidityStore();
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number; volume: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchHistory() {
      try {
        // Proxied via /api/price-history to avoid browser 401/CORS on CoinGecko
        const res = await fetch('/api/price-history', { cache: 'no-store' });
        if (!res.ok) throw new Error('CoinGecko error');
        const json = await res.json();
        if (cancelled) return;
        const prices:  [number, number][] = json.prices  ?? [];
        const volumes: [number, number][] = json.total_volumes ?? [];
        const history = prices.map(([ts, price], i) => ({
          time:   new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          price,
          volume: volumes[i]?.[1] ?? 0,
        }));
        setPriceHistory(history);
      } catch {
        // Fallback: use current price to build a flat line (no random noise)
        if (cancelled) return;
        const p = marketData.price || 2000;
        setPriceHistory(
          Array.from({ length: 24 }, (_, i) => ({
            time:   new Date(Date.now() - (23 - i) * 3600000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            price:  p,
            volume: 0,
          }))
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchHistory();
    // Refresh every 5 minutes
    const iv = setInterval(fetchHistory, 300_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [marketData.price]);
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm col-span-full lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
              <LineChart className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg">ETH/USDC Price</CardTitle>
              <CardDescription>24h price action with volume</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold">${marketData.price.toFixed(2)}</p>
              <p className="text-xs text-zinc-500">CoinGecko live</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[200px] text-zinc-500 text-sm gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading price history…
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={priceHistory}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="time" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={10}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={10}
              tickLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#priceGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// Data Layer Component
function DataLayer() {
  const { marketData, poolData, updateMarketData, isLoading, dataSource } = useLiquidityStore();
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    const interval = setInterval(updateMarketData, 30000); // 30s — don't hammer The Graph
    return () => clearInterval(interval);
  }, [updateMarketData]);

  const handleRefresh = () => {
    updateMarketData();
    toast({ title: 'Refreshing market data…', description: `Source: ${dataSource}` });
  };
  
  const dataPoints = [
    { label: t('metrics.price.label'),      tip: t('metrics.price.tip'),       value: `$${marketData.price.toFixed(2)}`,                     icon: Coins     },
    { label: t('metrics.tick.label'),       tip: t('metrics.tick.tip'),        value: marketData.tick.toLocaleString(),                       icon: Target    },
    { label: t('metrics.twap.label'),       tip: t('metrics.twap.tip'),        value: `$${marketData.twap.toFixed(2)}`,                       icon: TrendingUp},
    { label: t('metrics.liquidity.label'),  tip: t('metrics.liquidity.tip'),   value: `$${(marketData.liquidity / 1e6).toFixed(1)}M`,          icon: Droplets  },
    { label: t('metrics.volume24h.label'),  tip: t('metrics.volume24h.tip'),   value: `$${(marketData.volume24h / 1e6).toFixed(1)}M`,          icon: BarChart3 },
    { label: t('metrics.volatility1d.label'),tip: t('metrics.volatility1d.tip'),value: `${(marketData.volatility1d * 100).toFixed(2)}%`,      icon: Gauge     },
    { label: t('metrics.atr.label'),        tip: t('metrics.atr.tip'),         value: `$${marketData.atr.toFixed(2)}`,                        icon: Activity  },
    { label: t('metrics.stdDev.label'),     tip: t('metrics.stdDev.tip'),      value: `$${marketData.stdDeviation.toFixed(2)}`,               icon: LineChart },
  ];
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5">
              <Activity className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Data Layer</CardTitle>
              <CardDescription className="hidden sm:block">Real-time market metrics collection</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`hidden sm:flex ${
              dataSource === 'the-graph'        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              dataSource === 'coingecko-price'  ? 'bg-amber-500/10  text-amber-400  border-amber-500/20'  :
              dataSource === 'static-fallback'  ? 'bg-rose-500/10   text-rose-400   border-rose-500/20'   :
                                                  'bg-zinc-500/10   text-zinc-400   border-zinc-500/20'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                dataSource === 'the-graph' ? 'bg-emerald-500 animate-pulse' :
                dataSource === 'coingecko-price' ? 'bg-amber-500' :
                dataSource === 'static-fallback' ? 'bg-rose-500' : 'bg-zinc-500'
              }`} />
              {dataSource === 'the-graph' ? 'Live · The Graph' :
               dataSource === 'coingecko-price' ? 'Partial · CoinGecko' :
               dataSource === 'static-fallback' ? 'Fallback · Offline' :
               'Loading…'}
            </Badge>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isLoading} className="shrink-0">
              {isLoading
                ? <><RefreshCw className="h-3 w-3 sm:mr-1 animate-spin" /><span className="hidden sm:inline">Loading…</span></>
                : <><RefreshCw className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Refresh</span></>
              }
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {dataPoints.map((point) => {
            const Icon = point.icon;
            return (
              <motion.div
                key={point.label}
                className="p-3 rounded-lg bg-background/50 border border-border/50 text-center relative"
                whileHover={{ scale: 1.02 }}
              >
                <div className="absolute top-2 right-2">
                  <CardInfo tip={point.tip} />
                </div>
                <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{point.label}</p>
                <p className="text-sm font-bold">{point.value}</p>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// System Status Footer
function SystemStatusFooter() {
  const { systemStatus } = useLiquidityStore();
  
  const components = [
    { name: 'Vault', status: systemStatus.vaultConnected },
    { name: 'Strategy Controller', status: systemStatus.strategyControllerActive },
    { name: 'AI Engine', status: systemStatus.aiEngineReady },
    { name: 'Data Indexer', status: systemStatus.dataIndexerSynced },
    { name: 'Execution Engine', status: systemStatus.executionEngineReady },
  ];
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-md border-t border-border/50 px-4 sm:px-6 py-2 sm:py-3 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Mobile: colored dots only. Desktop: dots + labels */}
        <div className="flex items-center gap-3 sm:gap-5 overflow-x-auto">
          {components.map((comp) => (
            <div key={comp.name} className="flex items-center gap-1.5 shrink-0">
              <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                comp.status ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              )} />
              <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">{comp.name}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          <span className="hidden sm:inline">Last Update: </span>
          {systemStatus.lastUpdate.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}


// Main Dashboard Component
export default function LiquidityManagerDashboard() {
  const { metrics, updateMarketData } = useLiquidityStore();
  
  useEffect(() => {
    updateMarketData();
  }, [updateMarketData]);
  
  return (
    <div className="min-h-screen bg-background pb-14 sm:pb-20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shrink-0">
                <Droplets className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold leading-none">
                  {/* Mobile: short title */}
                  <span className="text-sm sm:hidden">AI Liquidity</span>
                  {/* Desktop: full title */}
                  <span className="hidden sm:inline text-xl">AI Liquidity Manager</span>
                </h1>
                <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">Adaptive Range Strategy Engine</p>
              </div>
            </div>
            {/* Right actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Badge — desktop only */}
              <Badge variant="outline" className="hidden sm:flex bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                System Online
              </Badge>
              {/* Admin — icon + text on desktop, icon-only on mobile */}
              <a
                href="/admin"
                className="flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-all"
                title="Admin"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline text-xs">Admin</span>
              </a>
              <LanguageSwitcher />
              {/* Wallet — icon-only on mobile (text hidden internally in WalletConnect) */}
              <WalletConnect />
            </div>
          </div>
        </div>
      </header>

      {/* Network guard — wrong network banner + balance checklist */}
      <NetworkGuard />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-20 sm:pb-6">

        {/* ── Onboarding banner (dismissible) ────────────────────────────────── */}
        <OnboardingBanner />

        {/* ── Overview section ───────────────────────────────────────────────── */}
        <section id="overview">
          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Total TVL"
              value={metrics.totalTVL}
              prefix="$"
              icon={Wallet}
              color="emerald"
            />
            <MetricCard
              title="Fees 24h"
              value={metrics.totalFees24h}
              prefix="$"
              icon={Coins}
              color="amber"
            />
            <MetricCard
              title="Est. APY"
              value={metrics.avgAPY * 100}
              suffix="%"
              icon={TrendingUp}
              color="cyan"
            />
            <MetricCard
              title="System Health"
              value={metrics.systemHealth}
              suffix="%"
              icon={Activity}
              color="violet"
            />
          </div>

          {/* Data Layer */}
          <div className="mb-6">
            <DataLayer />
          </div>
        </section>

        {/* ── Vault + History section ────────────────────────────────────────── */}
        <section id="vault" className="scroll-mt-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <VaultManager />
              <div id="history" className="scroll-mt-20">
                <TransactionHistory />
              </div>
              <div id="strategy" className="scroll-mt-20">
                <StrategyController />
              </div>
            </div>

            {/* Center Column */}
            <div className="space-y-6">
              <AIStrategyEngine />
              <RangeOptimizer />
            </div>

            {/* Right Column */}
            <div id="system" className="space-y-6 scroll-mt-20">
              <ExecutionEngine />
              <RiskDashboard />
            </div>
          </div>
        </section>

        {/* Price Chart */}
        <div className="mt-6">
          <PriceChart />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <MobileNav />
      
      {/* System Status Footer */}
      <SystemStatusFooter />
    </div>
  );
}
