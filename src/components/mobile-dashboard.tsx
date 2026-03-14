'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Brain, ChevronRight,
  Droplets, ExternalLink, Home, LineChart, RefreshCw,
  Settings, Shield, TrendingUp, Wallet, Zap,
} from 'lucide-react';
import { WalletConnect, ACTIVE_CHAIN_ID } from '@/components/wallet-connect';
import { useVaultHistory } from '@/hooks/use-vault-history';
import { useLiquidityStore } from '@/lib/liquidity-store';
import {
  VAULT_ADDRESS, USDC_ARBITRUM,
  readVaultState, readUserVaultState,
  approveUsdc, depositToVault, redeemFromVault,
  type VaultState, type UserVaultState,
} from '@/lib/vault-contract';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const EXPLORER = ACTIVE_CHAIN_ID === 421614
  ? 'https://sepolia.arbiscan.io'
  : 'https://arbiscan.io';
const NETWORK_LABEL = ACTIVE_CHAIN_ID === 421614 ? 'Arb Sepolia' : 'Arbitrum One';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'portfolio' | 'invest' | 'market' | 'system';

// ─── Shared vault state hook ───────────────────────────────────────────────────

function useVaultData() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [vaultState, setVaultState] = useState<VaultState | null>(null);
  const [userState, setUserState] = useState<UserVaultState | null>(null);

  const refresh = useCallback(async () => {
    if (!publicClient) return;
    const vs = await readVaultState(publicClient);
    setVaultState(vs);
    if (address) {
      const us = await readUserVaultState(publicClient, address);
      setUserState(us);
    }
  }, [publicClient, address]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30_000);
    return () => clearInterval(iv);
  }, [refresh]);

  return { vaultState, userState, refresh, isConnected };
}

// ─── Portfolio Tab ─────────────────────────────────────────────────────────────

function PortfolioTab({ onDeposit, onWithdraw }: { onDeposit: () => void; onWithdraw: () => void }) {
  const { vaultState, userState, isConnected } = useVaultData();
  const { history, loading: histLoading } = useVaultHistory();
  const { marketData, regime } = useLiquidityStore();

  const userUsd = userState ? parseFloat(userState.assetsValueUsd) : 0;
  const totalAssets = vaultState ? parseFloat(vaultState.totalAssetsUsd) : 0;
  const sharePrice = vaultState ? parseFloat(vaultState.sharePriceUsd) : 1;
  const isLive = vaultState && !vaultState.paused && VAULT_ADDRESS;

  const regimeColor = {
    trend: 'text-cyan-400',
    'high-vol': 'text-rose-400',
    'low-vol': 'text-emerald-400',
    range: 'text-amber-400',
  }[regime?.type ?? 'range'] ?? 'text-zinc-400';

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* Hero — My Position */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border border-emerald-500/20 p-5">
        <p className="text-sm text-zinc-400 mb-1">Minha Posição</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-bold tracking-tight">
              ${userUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {userState && userState.shares > 0n
                ? `${parseFloat(formatUnits(userState.shares, 18)).toFixed(4)} vAI shares`
                : isConnected ? 'Sem posição activa' : 'Conecta a carteira'}
            </p>
          </div>
          <span className={cn(
            'text-xs px-2.5 py-1 rounded-full font-medium border',
            isLive
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
          )}>
            {isLive ? '● Live' : VAULT_ADDRESS ? '⏸ Paused' : '— Not Deployed'}
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-white/5 flex gap-4 text-xs text-zinc-500">
          <span>TVL <span className="text-zinc-200">${totalAssets.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></span>
          <span>Share <span className="text-zinc-200">${sharePrice.toFixed(4)}</span></span>
          <span>Rede <span className="text-amber-400">{NETWORK_LABEL}</span></span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onDeposit}
          className="flex items-center justify-center gap-2 h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-base transition-colors active:scale-95"
        >
          <ArrowDownLeft className="h-5 w-5" />
          Depositar
        </button>
        <button
          onClick={onWithdraw}
          className="flex items-center justify-center gap-2 h-14 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-base border border-zinc-700 transition-colors active:scale-95"
        >
          <ArrowUpRight className="h-5 w-5" />
          Sacar
        </button>
      </div>

      {/* Últimas transações */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-200">Últimas Transações</p>
          {histLoading && <RefreshCw className="h-3.5 w-3.5 text-zinc-500 animate-spin" />}
        </div>
        {!isConnected ? (
          <p className="px-4 pb-4 text-xs text-zinc-500">Conecta a carteira para ver o histórico</p>
        ) : history.length === 0 && !histLoading ? (
          <p className="px-4 pb-4 text-xs text-zinc-500">Nenhuma transação encontrada</p>
        ) : (
          <div className="divide-y divide-zinc-800">
            {history.slice(0, 3).map((tx, i) => (
              <div key={`${tx.txHash}-${i}`} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('p-1.5 rounded-lg', tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}>
                    {tx.type === 'deposit' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {tx.type === 'deposit' ? '+' : '-'}${parseFloat(tx.assetsFormatted).toFixed(2)} USDC
                    </p>
                    <p className="text-[10px] text-zinc-500">Bloco {tx.blockNumber.toString()}</p>
                  </div>
                </div>
                <a href={`${EXPLORER}/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-zinc-300">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resumo de mercado */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-zinc-200">Mercado ETH/USDC</p>
          <span className={cn('text-xs font-medium', regimeColor)}>
            ● {regime?.type ?? 'range'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-zinc-500 text-xs">Preço ETH</p>
            <p className="font-semibold">${marketData.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs">Volume 24h</p>
            <p className="font-semibold">${(marketData.volume24h / 1e6).toFixed(1)}M</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs">Volatilidade 1D</p>
            <p className="font-semibold">{(marketData.volatility1d * 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs">Confiança IA</p>
            <p className="font-semibold">{((regime?.confidence ?? 0) * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invest Tab ────────────────────────────────────────────────────────────────

function InvestTab({ initialMode }: { initialMode: 'deposit' | 'withdraw' }) {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>(initialMode);
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { vaultState, userState, refresh } = useVaultData();
  const { history } = useVaultHistory();
  const { toast } = useToast();

  const usdcBal = userState ? parseFloat(formatUnits(userState.usdcBalance, 6)) : 0;
  const userUsd = userState ? parseFloat(userState.assetsValueUsd) : 0;
  const vaiShares = userState ? parseFloat(formatUnits(userState.shares, 18)) : 0;

  const handleDeposit = async () => {
    if (!walletClient || !address || !publicClient) {
      toast({ title: 'Conecta a carteira primeiro', variant: 'destructive' }); return;
    }
    const amt = parseFloat(depositAmt);
    if (!depositAmt || isNaN(amt) || amt <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' }); return;
    }
    setBusy(true); setTxHash(null);
    try {
      toast({ title: 'Passo 1/2 — Aprovar USDC', description: 'Confirma na carteira…' });
      const approveTx = await approveUsdc(walletClient, address, depositAmt);
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      toast({ title: 'Passo 2/2 — Depositar', description: 'Confirma na carteira…' });
      const depTx = await depositToVault(walletClient, address, depositAmt);
      await publicClient.waitForTransactionReceipt({ hash: depTx });
      setTxHash(depTx); setDepositAmt('');
      await refresh();
      toast({ title: 'Depósito confirmado!', description: `$${amt.toLocaleString()} depositados. Recebeste vAI shares.` });
    } catch (err) {
      toast({ title: 'Depósito falhou', description: (err instanceof Error ? err.message : 'Erro').slice(0, 100), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const handleWithdraw = async () => {
    if (!walletClient || !address || !publicClient) {
      toast({ title: 'Conecta a carteira primeiro', variant: 'destructive' }); return;
    }
    const amt = parseFloat(withdrawAmt);
    if (!withdrawAmt || isNaN(amt) || amt <= 0) {
      toast({ title: 'Shares inválidas', variant: 'destructive' }); return;
    }
    const shares = parseUnits(withdrawAmt, 18);
    if (userState && shares > userState.shares) {
      toast({ title: 'Shares insuficientes', description: `Tens ${vaiShares.toFixed(4)} vAI`, variant: 'destructive' }); return;
    }
    setBusy(true); setTxHash(null);
    try {
      toast({ title: 'A resgatar vAI shares…', description: 'Confirma na carteira…' });
      const tx = await redeemFromVault(walletClient, address, shares);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setTxHash(tx); setWithdrawAmt('');
      await refresh();
      toast({ title: 'Saque confirmado!', description: 'USDC devolvido à carteira.' });
    } catch (err) {
      toast({ title: 'Saque falhou', description: (err instanceof Error ? err.message : 'Erro').slice(0, 100), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* Saldos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 mb-1">Carteira USDC</p>
          <p className="text-2xl font-bold">${usdcBal.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 mb-1">Posição</p>
          <p className="text-2xl font-bold">${userUsd.toFixed(2)}</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-zinc-900 border border-zinc-800 p-1 gap-1">
        <button
          onClick={() => setMode('deposit')}
          className={cn(
            'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
            mode === 'deposit' ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          Depositar
        </button>
        <button
          onClick={() => setMode('withdraw')}
          className={cn(
            'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
            mode === 'withdraw' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          Sacar
        </button>
      </div>

      {/* Form */}
      {!isConnected ? (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 text-center">
          <Wallet className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">Conecta a carteira para depositar ou sacar</p>
        </div>
      ) : mode === 'deposit' ? (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={depositAmt}
              onChange={e => setDepositAmt(e.target.value)}
              className="w-full h-16 px-4 pr-20 text-2xl font-bold bg-zinc-900 border border-zinc-700 rounded-xl focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                onClick={() => setDepositAmt(usdcBal.toFixed(6))}
                className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg"
              >
                MAX
              </button>
              <span className="text-sm text-zinc-500">USDC</span>
            </div>
          </div>
          <button
            onClick={handleDeposit}
            disabled={busy || vaultState?.paused}
            className="h-14 w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-lg transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            {busy ? <><RefreshCw className="h-5 w-5 animate-spin" /> A processar…</> : <>Depositar USDC <ChevronRight className="h-5 w-5" /></>}
          </button>
          {txHash && (
            <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <ExternalLink className="h-3.5 w-3.5" />
              Tx confirmada — ver no explorer
            </a>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.0000"
              value={withdrawAmt}
              onChange={e => setWithdrawAmt(e.target.value)}
              className="w-full h-16 px-4 pr-20 text-2xl font-bold bg-zinc-900 border border-zinc-700 rounded-xl focus:outline-none focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                onClick={() => setWithdrawAmt(vaiShares.toFixed(6))}
                className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg"
              >
                MAX
              </button>
              <span className="text-sm text-zinc-500">vAI</span>
            </div>
          </div>
          {vaiShares > 0 && (
            <p className="text-xs text-zinc-500 text-center">
              Tens <span className="text-zinc-200">{vaiShares.toFixed(4)} vAI</span> shares (≈ ${userUsd.toFixed(2)} USDC)
            </p>
          )}
          <button
            onClick={handleWithdraw}
            disabled={busy || vaultState?.paused}
            className="h-14 w-full rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-bold text-lg transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            {busy ? <><RefreshCw className="h-5 w-5 animate-spin" /> A processar…</> : <>Sacar USDC <ChevronRight className="h-5 w-5" /></>}
          </button>
          {txHash && (
            <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <ExternalLink className="h-3.5 w-3.5" />
              Tx confirmada — ver no explorer
            </a>
          )}
        </div>
      )}

      {/* Fees */}
      {vaultState && (
        <p className="text-center text-xs text-zinc-600">
          Taxa gestão {Number(vaultState.managementFeeBps) / 100}% · Performance {Number(vaultState.performanceFeeBps) / 100}%
        </p>
      )}

      {/* Histórico completo */}
      {history.length > 0 && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          <p className="px-4 pt-4 pb-2 text-sm font-medium text-zinc-200">Histórico Completo</p>
          <div className="divide-y divide-zinc-800">
            {history.map((tx, i) => (
              <div key={`${tx.txHash}-${i}`} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('p-1.5 rounded-lg', tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}>
                    {tx.type === 'deposit' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {tx.type === 'deposit' ? '+' : '-'}${parseFloat(tx.assetsFormatted).toFixed(2)} USDC
                    </p>
                    <p className="text-[10px] text-zinc-500">{parseFloat(tx.sharesFormatted).toFixed(4)} vAI · bloco {tx.blockNumber.toString()}</p>
                  </div>
                </div>
                <a href={`${EXPLORER}/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-zinc-300">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Market Tab ────────────────────────────────────────────────────────────────

function MarketTab() {
  const { marketData, aiOutputs, regime, updateMarketData } = useLiquidityStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await updateMarketData();
    setRefreshing(false);
  };

  const regimeColors: Record<string, string> = {
    trend: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'high-vol': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    'low-vol': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    range: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  const regimeCls = regimeColors[regime?.type ?? 'range'] ?? regimeColors['range'];

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* ETH Price Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 mb-1">ETH / USDC</p>
            <p className="text-4xl font-bold">${marketData.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-zinc-500 mt-1">Pool 0.05% · {NETWORK_LABEL}</p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>
        <div className="mt-3 pt-3 border-t border-white/5 flex gap-4 text-xs text-zinc-500">
          <span>TWAP <span className="text-zinc-200">${marketData.twap?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '—'}</span></span>
          <span>Tick <span className="text-zinc-200">{marketData.tick?.toLocaleString() ?? '—'}</span></span>
        </div>
      </div>

      {/* Métricas 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Volume 24h', value: `$${(marketData.volume24h / 1e6).toFixed(1)}M`, icon: TrendingUp },
          { label: 'Volatilidade 1D', value: `${(marketData.volatility1d * 100).toFixed(2)}%`, icon: Activity },
          { label: 'Liquidez Pool', value: `$${(marketData.liquidity / 1e6).toFixed(1)}M`, icon: Droplets },
          { label: 'ATR', value: `$${marketData.atr?.toFixed(2) ?? '—'}`, icon: LineChart },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-3.5 w-3.5 text-zinc-500" />
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* IA Regime */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-400" />
            <p className="text-sm font-medium text-zinc-200">Regime IA</p>
          </div>
          <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium capitalize', regimeCls)}>
            {regime?.type ?? 'range'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-zinc-500">Confiança</p>
            <p className="font-semibold">{((regime?.confidence ?? 0) * 100).toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Largura Range</p>
            <p className="font-semibold">{aiOutputs.rangeWidth?.toFixed(1) ?? '—'}%</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Capital Core</p>
            <p className="font-semibold">{((aiOutputs.capitalAllocation?.core ?? 0.7) * 100).toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Rebalance Score</p>
            <p className="font-semibold">{((aiOutputs.rebalanceThreshold ?? 0) * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── System Tab ────────────────────────────────────────────────────────────────

function SystemTab() {
  const { vaultState } = useVaultData();
  const { systemStatus, metrics } = useLiquidityStore();
  const [keeper, setKeeper] = useState<{ last_run?: string; status?: string } | null>(null);

  useEffect(() => {
    const AI_URL = process.env.NEXT_PUBLIC_AI_ENGINE_URL;
    if (!AI_URL) return;
    fetch(`${AI_URL}/keeper/status`).then(r => r.json()).then(setKeeper).catch(() => {});
  }, []);

  const isLive = vaultState && !vaultState.paused && VAULT_ADDRESS;

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* Saúde */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-400" />
            <p className="text-sm font-medium text-zinc-200">Saúde do Sistema</p>
          </div>
          <span className="text-xs text-zinc-500">estimado</span>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full" style={{ width: `${metrics.systemHealth}%` }} />
          </div>
          <span className="text-lg font-bold">{metrics.systemHealth.toFixed(0)}%</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg', isLive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500')}>
            <Shield className="h-3.5 w-3.5" /> Vault {isLive ? 'Live' : 'Offline'}
          </div>
          <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg', systemStatus?.aiEngineReady ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500')}>
            <Brain className="h-3.5 w-3.5" /> IA {systemStatus?.aiEngineReady ? 'Activa' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Vault info */}
      {vaultState && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-medium text-zinc-200">Vault ERC-4626</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Total Assets</span>
              <span>${parseFloat(vaultState.totalAssetsUsd).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Posições LP Activas</span>
              <span>{vaultState.activePositions.toString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Taxa Gestão</span>
              <span>{Number(vaultState.managementFeeBps) / 100}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Taxa Performance</span>
              <span>{Number(vaultState.performanceFeeBps) / 100}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Keeper */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-cyan-400" />
          <p className="text-sm font-medium text-zinc-200">Keeper Bot</p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Estado</span>
            <span className={keeper?.status === 'idle' ? 'text-zinc-400' : 'text-emerald-400'}>{keeper?.status ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Última execução</span>
            <span className="text-zinc-400 text-xs">{keeper?.last_run ? new Date(keeper.last_run).toLocaleTimeString() : '—'}</span>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        {VAULT_ADDRESS && (
          <a href={`${EXPLORER}/address/${VAULT_ADDRESS}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800 hover:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-amber-400" />
              <span className="text-sm">Ver Vault no Explorer</span>
            </div>
            <ExternalLink className="h-4 w-4 text-zinc-500" />
          </a>
        )}
        <a href="/admin" className="flex items-center justify-between px-4 py-3.5 hover:bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <Settings className="h-4 w-4 text-zinc-400" />
            <span className="text-sm">Painel de Admin</span>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        </a>
      </div>

      <p className="text-center text-[10px] text-zinc-600">
        {NETWORK_LABEL} · Vault {VAULT_ADDRESS ? `${VAULT_ADDRESS.slice(0, 6)}…${VAULT_ADDRESS.slice(-4)}` : 'não configurado'}
      </p>
    </div>
  );
}

// ─── Bottom Navigation ─────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'portfolio', label: 'Portfolio', icon: Home       },
  { id: 'invest',    label: 'Investir',  icon: Wallet     },
  { id: 'market',    label: 'Mercado',   icon: LineChart  },
  { id: 'system',    label: 'Sistema',   icon: Settings   },
];

// ─── Root Mobile Dashboard ─────────────────────────────────────────────────────

export function MobileDashboard() {
  const [tab, setTab] = useState<Tab>('portfolio');
  const [investMode, setInvestMode] = useState<'deposit' | 'withdraw'>('deposit');

  const goDeposit = () => { setInvestMode('deposit'); setTab('invest'); };
  const goWithdraw = () => { setInvestMode('withdraw'); setTab('invest'); };

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md shrink-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500">
            <Droplets className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm">AI Liquidity</span>
        </div>
        <WalletConnect />
      </header>

      {/* Tab content — scrollable */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'portfolio' && <PortfolioTab onDeposit={goDeposit} onWithdraw={goWithdraw} />}
        {tab === 'invest'    && <InvestTab initialMode={investMode} key={investMode} />}
        {tab === 'market'    && <MarketTab />}
        {tab === 'system'    && <SystemTab />}
      </main>

      {/* Bottom Nav */}
      <nav className="shrink-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md safe-area-pb z-40">
        <div className="flex items-stretch">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] transition-colors',
                tab === id ? 'text-emerald-400' : 'text-zinc-500 active:text-zinc-300',
              )}
            >
              <Icon className={cn('h-5 w-5', tab === id && 'drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]')} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
