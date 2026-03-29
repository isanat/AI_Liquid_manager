'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Brain, ChevronRight,
  Droplets, ExternalLink, Home, LineChart, RefreshCw,
  Settings, Shield, Target, TrendingUp, Wallet, Zap, Clock, Coins,
} from 'lucide-react';
import { WalletConnect, ACTIVE_CHAIN_ID } from '@/components/wallet-connect';
import { CardInfo } from '@/components/card-info';
import { LanguageSwitcher } from '@/components/language-switcher';
import { GovernanceGateInvestor } from '@/components/governance-gate-investor';
import { useVaultHistory } from '@/hooks/use-vault-history';
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

const EXPLORER = ACTIVE_CHAIN_ID === 421614
  ? 'https://sepolia.arbiscan.io'
  : 'https://arbiscan.io';
const NETWORK_LABEL = ACTIVE_CHAIN_ID === 421614 ? 'Arb Sepolia' : 'Arbitrum One';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'portfolio' | 'invest' | 'market' | 'system';

// ─── Dual Vault State Hook ────────────────────────────────────────────────────

function useDualVaultData() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  // USDC Vault
  const [usdcVaultState, setUsdcVaultState] = useState<VaultState | null>(null);
  const [usdcUserState, setUsdcUserState] = useState<UserVaultState | null>(null);
  
  // USDT Vault
  const [usdtVaultState, setUsdtVaultState] = useState<VaultState | null>(null);
  const [usdtUserState, setUsdtUserState] = useState<UserVaultState | null>(null);

  const refresh = useCallback(async () => {
    if (!publicClient) return;
    
    // Fetch both vaults in parallel
    const [usdcVs, usdtVs] = await Promise.all([
      readVaultState(publicClient, VAULT_USDC_ADDRESS),
      readVaultState(publicClient, VAULT_USDT_ADDRESS),
    ]);
    setUsdcVaultState(usdcVs);
    setUsdtVaultState(usdtVs);
    
    // Fetch user states for both vaults
    if (address) {
      const [usdcUs, usdtUs] = await Promise.all([
        readUserVaultState(publicClient, address, VAULT_USDC_ADDRESS, USDC_ARBITRUM_ONE),
        readUserVaultState(publicClient, address, VAULT_USDT_ADDRESS, USDT_ARBITRUM_ONE),
      ]);
      setUsdcUserState(usdcUs);
      setUsdtUserState(usdtUs);
    }
  }, [publicClient, address]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30_000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Combined stats
  const totalTVL = (usdcVaultState ? parseFloat(usdcVaultState.totalAssetsUsd) : 0) +
                   (usdtVaultState ? parseFloat(usdtVaultState.totalAssetsUsd) : 0);
  const userTotalPosition = (usdcUserState ? parseFloat(usdcUserState.assetsValueUsd) : 0) +
                            (usdtUserState ? parseFloat(usdtUserState.assetsValueUsd) : 0);

  return {
    // Individual vaults
    usdcVaultState,
    usdtVaultState,
    usdcUserState,
    usdtUserState,
    // Combined
    totalTVL,
    userTotalPosition,
    // Utils
    refresh,
    isConnected,
  };
}

// ─── Vault Selector Component ─────────────────────────────────────────────────

function VaultSelector({ 
  selected, 
  onChange 
}: { 
  selected: AssetType; 
  onChange: (asset: AssetType) => void;
}) {
  return (
    <div className="flex rounded-xl bg-zinc-900 border border-zinc-800 p-1 gap-1">
      <button
        onClick={() => onChange('USDC')}
        className={cn(
          'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
          selected === 'USDC' 
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
            : 'text-zinc-400 hover:text-zinc-200',
        )}
      >
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        USDC
      </button>
      <button
        onClick={() => onChange('USDT')}
        className={cn(
          'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
          selected === 'USDT' 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'text-zinc-400 hover:text-zinc-200',
        )}
      >
        <span className="w-2 h-2 rounded-full bg-green-500" />
        USDT
      </button>
    </div>
  );
}

// ─── Portfolio Tab ─────────────────────────────────────────────────────────────

function PortfolioTab({ onDeposit, onWithdraw, selectedAsset, onAssetChange }: { 
  onDeposit: () => void; 
  onWithdraw: () => void;
  selectedAsset: AssetType;
  onAssetChange: (asset: AssetType) => void;
}) {
  const { 
    usdcVaultState, usdtVaultState, 
    usdcUserState, usdtUserState,
    totalTVL, userTotalPosition, 
    isConnected 
  } = useDualVaultData();
  const { history, loading: histLoading } = useVaultHistory();
  const { marketData, regime } = useLiquidityStore();
  const { t } = useI18n();

  // Current vault based on selection
  const vaultState = selectedAsset === 'USDC' ? usdcVaultState : usdtVaultState;
  const userState = selectedAsset === 'USDC' ? usdcUserState : usdtUserState;
  const vaultAddress = selectedAsset === 'USDC' ? VAULT_USDC_ADDRESS : VAULT_USDT_ADDRESS;

  const userUsd = userState ? parseFloat(userState.assetsValueUsd) : 0;
  const vaultAssets = vaultState ? parseFloat(vaultState.totalAssetsUsd) : 0;
  const sharePrice = vaultState ? parseFloat(vaultState.sharePriceUsd) : 1;
  const isLive = vaultState && !vaultState.paused && vaultAddress;

  const regimeColor = {
    trend: 'text-cyan-400',
    'high-vol': 'text-rose-400',
    'low-vol': 'text-emerald-400',
    range: 'text-amber-400',
  }[regime?.type ?? 'range'] ?? 'text-zinc-400';

  // TVL distribution
  const usdcTVL = usdcVaultState ? parseFloat(usdcVaultState.totalAssetsUsd) : 0;
  const usdtTVL = usdtVaultState ? parseFloat(usdtVaultState.totalAssetsUsd) : 0;
  const usdcShare = totalTVL > 0 ? (usdcTVL / totalTVL * 100) : 50;
  const usdtShare = 100 - usdcShare;

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* ── Onboarding card (only when not connected) ─── */}
      {!isConnected && (
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/50 to-cyan-950/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
              <Droplets className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">Como funciona?</span>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            {[
              { icon: Wallet, color: 'text-emerald-400', text: 'Deposite USDC ou USDT no vault' },
              { icon: Brain,  color: 'text-cyan-400',    text: 'IA rebalanceia a cada 15 min na Uniswap V3' },
              { icon: TrendingUp, color: 'text-violet-400', text: 'Retire com rendimento a qualquer hora' },
            ].map(({ icon: Icon, color, text }) => (
              <div key={text} className="flex items-center gap-2 text-xs text-zinc-300">
                <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
                {text}
              </div>
            ))}
          </div>
          <div className="flex gap-2 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-emerald-400" /> Sem lock-up</span>
            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-400" /> ERC-4626</span>
          </div>
        </div>
      )}

      {/* Combined TVL Card */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border border-emerald-500/20 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Coins className="h-4 w-4 text-emerald-400" />
          <p className="text-sm text-zinc-400">Total Value Locked (Both Vaults)</p>
        </div>
        <p className="text-4xl font-bold tracking-tight">
          ${totalTVL.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
        
        {/* TVL Distribution Bar */}
        <div className="mt-3 space-y-2">
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            <div className="bg-blue-500 transition-all duration-500" style={{ width: `${usdcShare}%` }} />
            <div className="bg-green-500 transition-all duration-500" style={{ width: `${usdtShare}%` }} />
          </div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              USDC: ${usdcTVL.toLocaleString('en-US', { maximumFractionDigits: 0 })} ({usdcShare.toFixed(0)}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              USDT: ${usdtTVL.toLocaleString('en-US', { maximumFractionDigits: 0 })} ({usdtShare.toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* User Total Position */}
        {isConnected && userTotalPosition > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-xs text-zinc-500">Your Total Position</p>
            <p className="text-xl font-bold text-emerald-400">
              ${userTotalPosition.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {/* Vault Selector */}
      <VaultSelector selected={selectedAsset} onChange={onAssetChange} />

      {/* Selected Vault Info */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={cn(
              'w-3 h-3 rounded-full',
              selectedAsset === 'USDC' ? 'bg-blue-500' : 'bg-green-500'
            )} />
            <p className="text-sm font-medium text-zinc-200">{selectedAsset} Vault</p>
          </div>
          <span className={cn(
            'text-xs px-2.5 py-1 rounded-full font-medium border',
            isLive
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
          )}>
            {isLive ? '● Live' : vaultAddress ? '⏸ Paused' : '— Not Deployed'}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-zinc-500">TVL</p>
            <p className="font-bold text-lg">${vaultAssets.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Share Price</p>
            <p className="font-bold text-lg">${sharePrice.toFixed(4)}</p>
          </div>
          {isConnected && (
            <>
              <div>
                <p className="text-xs text-zinc-500">Your Position</p>
                <p className="font-bold text-lg">${userUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">vAI Shares</p>
                <p className="font-bold text-lg">{userState && userState.shares > 0n ? parseFloat(formatUnits(userState.shares, 18)).toFixed(4) : '0.0000'}</p>
              </div>
            </>
          )}
        </div>

        {/* Vault Address Link */}
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <a 
            href={`${EXPLORER}/address/${vaultAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors font-mono"
          >
            {vaultAddress?.slice(0, 6)}…{vaultAddress?.slice(-4)} ↗
          </a>
        </div>
      </div>

      {/* Governance Gate - KPIs + GO/NO-GO */}
      <GovernanceGateInvestor vaultAssetsUsd={vaultAssets} userAssetsUsd={userUsd} />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onDeposit}
          className="flex items-center justify-center gap-2 h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-base transition-colors active:scale-95"
        >
          <ArrowDownLeft className="h-5 w-5" />
          {t('portfolio.deposit')}
        </button>
        <button
          onClick={onWithdraw}
          className="flex items-center justify-center gap-2 h-14 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-base border border-zinc-700 transition-colors active:scale-95"
        >
          <ArrowUpRight className="h-5 w-5" />
          {t('portfolio.withdraw')}
        </button>
      </div>

      {/* Últimas transações */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-zinc-200">{t('portfolio.recentTransactions')}</p>
            <CardInfo tip={t('invest.tip')} />
          </div>
          {histLoading && <RefreshCw className="h-3.5 w-3.5 text-zinc-500 animate-spin" />}
        </div>
        {!isConnected ? (
          <p className="px-4 pb-4 text-xs text-zinc-500">{t('portfolio.connectWallet')}</p>
        ) : history.length === 0 && !histLoading ? (
          <p className="px-4 pb-4 text-xs text-zinc-500">{t('portfolio.noTransactions')}</p>
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
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-zinc-200">{t('portfolio.marketSummary')}</p>
            <CardInfo tip={t('market.tip')} />
          </div>
          <span className={cn('text-xs font-medium', regimeColor)}>
            ● {regime?.type ?? 'range'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="flex items-center gap-1"><p className="text-zinc-500 text-xs">{t('metrics.price.label')}</p><CardInfo tip={t('metrics.price.tip')} /></div>
            <p className="font-semibold">${marketData.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <div className="flex items-center gap-1"><p className="text-zinc-500 text-xs">{t('market.volume24h')}</p><CardInfo tip={t('metrics.volume24h.tip')} /></div>
            <p className="font-semibold">${(marketData.volume24h / 1e6).toFixed(1)}M</p>
          </div>
          <div>
            <div className="flex items-center gap-1"><p className="text-zinc-500 text-xs">{t('market.volatility1d')}</p><CardInfo tip={t('metrics.volatility1d.tip')} /></div>
            <p className="font-semibold">{(marketData.volatility1d * 100).toFixed(2)}%</p>
          </div>
          <div>
            <div className="flex items-center gap-1"><p className="text-zinc-500 text-xs">{t('market.confidence')}</p><CardInfo tip={t('metrics.atr.tip')} /></div>
            <p className="font-semibold">{((regime?.confidence ?? 0) * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invest Tab ────────────────────────────────────────────────────────────────

function InvestTab({ 
  initialMode, 
  selectedAsset, 
  onAssetChange 
}: { 
  initialMode: 'deposit' | 'withdraw';
  selectedAsset: AssetType;
  onAssetChange: (asset: AssetType) => void;
}) {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>(initialMode);
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { usdcVaultState, usdtVaultState, usdcUserState, usdtUserState, refresh } = useDualVaultData();
  const { history } = useVaultHistory();
  const { toast } = useToast();
  const { t } = useI18n();

  // Current vault based on selection
  const vaultState = selectedAsset === 'USDC' ? usdcVaultState : usdtVaultState;
  const userState = selectedAsset === 'USDC' ? usdcUserState : usdtUserState;
  const vaultAddress = selectedAsset === 'USDC' ? VAULT_USDC_ADDRESS : VAULT_USDT_ADDRESS;
  const assetAddress = selectedAsset === 'USDC' ? USDC_ARBITRUM_ONE : USDT_ARBITRUM_ONE;

  const walletBal = userState ? parseFloat(formatUnits(userState.stablecoinBalance, 6)) : 0;
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
      toast({ title: `Passo 1/2 — Aprovar ${selectedAsset}`, description: 'Confirma na carteira…' });
      const approveTx = await approveStablecoin(walletClient, address, depositAmt, assetAddress, vaultAddress);
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      toast({ title: 'Passo 2/2 — Depositar', description: 'Confirma na carteira…' });
      const depTx = await depositToVault(walletClient, address, depositAmt, vaultAddress);
      await publicClient.waitForTransactionReceipt({ hash: depTx });
      setTxHash(depTx); setDepositAmt('');
      await refresh();
      toast({ title: 'Depósito confirmado!', description: `$${amt.toLocaleString()} ${selectedAsset} depositados. Recebeste vAI shares.` });
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
      const tx = await redeemFromVault(walletClient, address, shares, vaultAddress);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setTxHash(tx); setWithdrawAmt('');
      await refresh();
      toast({ title: 'Saque confirmado!', description: `${selectedAsset} devolvido à carteira.` });
    } catch (err) {
      toast({ title: 'Saque falhou', description: (err instanceof Error ? err.message : 'Erro').slice(0, 100), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* Saldos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 mb-1">Carteira {selectedAsset}</p>
          <p className="text-2xl font-bold">${walletBal.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 mb-1">Posição {selectedAsset}</p>
          <p className="text-2xl font-bold">${userUsd.toFixed(2)}</p>
        </div>
      </div>

      {/* Vault Selector */}
      <VaultSelector selected={selectedAsset} onChange={onAssetChange} />

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-zinc-900 border border-zinc-800 p-1 gap-1">
        <button
          onClick={() => setMode('deposit')}
          className={cn(
            'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
            mode === 'deposit' ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {t('invest.depositMode')}
        </button>
        <button
          onClick={() => setMode('withdraw')}
          className={cn(
            'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
            mode === 'withdraw' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {t('invest.withdrawMode')}
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
                onClick={() => setDepositAmt(walletBal.toFixed(6))}
                className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg"
              >
                MAX
              </button>
              <span className="text-sm text-zinc-500">{selectedAsset}</span>
            </div>
          </div>
          <button
            onClick={handleDeposit}
            disabled={busy || vaultState?.paused}
            className="h-14 w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-lg transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            {busy ? <><RefreshCw className="h-5 w-5 animate-spin" /> A processar…</> : <>Depositar {selectedAsset} <ChevronRight className="h-5 w-5" /></>}
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
              Tens <span className="text-zinc-200">{vaiShares.toFixed(4)} vAI</span> shares (≈ ${userUsd.toFixed(2)} {selectedAsset})
            </p>
          )}
          <button
            onClick={handleWithdraw}
            disabled={busy || vaultState?.paused}
            className="h-14 w-full rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-bold text-lg transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            {busy ? <><RefreshCw className="h-5 w-5 animate-spin" /> A processar…</> : <>Sacar {selectedAsset} <ChevronRight className="h-5 w-5" /></>}
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
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <p className="text-sm font-medium text-zinc-200">{t('invest.fullHistory')}</p>
            <CardInfo tip={t('invest.tip')} />
          </div>
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
  const { marketData, aiOutputs, aiInputs, regime, ranges, updateMarketData, dataSource, lastFetchedAt } = useLiquidityStore();
  const { t } = useI18n();
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

  const rangeTypeColor = { core: 'text-emerald-400', defensive: 'text-amber-400', opportunistic: 'text-cyan-400' };

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* ETH Price Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 mb-1">ETH / USD</p>
            <p className="text-4xl font-bold">${marketData.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-zinc-500 mt-1">Pool 0.05% · {NETWORK_LABEL}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
            {/* Data source badge */}
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded-full border font-medium',
              dataSource === 'the-graph'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : dataSource === 'coingecko-price'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : dataSource === 'static-fallback'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
            )}>
              {dataSource === 'the-graph' ? '● The Graph' :
               dataSource === 'coingecko-price' ? '⚠ CoinGecko' :
               dataSource === 'static-fallback' ? '✕ Fallback' :
               '○ Loading…'}
            </span>
            {lastFetchedAt && (
              <span className="text-[10px] text-zinc-600">
                {new Date(lastFetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-3 gap-2 text-xs text-zinc-500">
          <span>
            <span className="flex items-center gap-1">{t('market.twap')}<CardInfo tip={t('metrics.twap.tip')} /></span>
            <span className="block text-zinc-200">${marketData.twap?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '—'}</span>
          </span>
          <span>
            <span className="flex items-center gap-1">{t('market.tick')}<CardInfo tip={t('metrics.tick.tip')} /></span>
            <span className="block text-zinc-200">{marketData.tick?.toLocaleString() ?? '—'}</span>
          </span>
          <span>
            <span className="flex items-center gap-1">{t('market.vol1h')}</span>
            <span className="block text-zinc-200">${(marketData.volume1h / 1e6).toFixed(1)}M</span>
          </span>
        </div>
      </div>

      {/* Métricas 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { labelKey: 'market.volume24h',     tipKey: 'metrics.volume24h.tip',   value: `$${(marketData.volume24h / 1e6).toFixed(1)}M`,     icon: TrendingUp },
          { labelKey: 'market.volatility1d',  tipKey: 'metrics.volatility1d.tip',value: `${(marketData.volatility1d * 100).toFixed(2)}%`,   icon: Activity   },
          { labelKey: 'market.volatility7d',  tipKey: 'metrics.volatility1d.tip',value: `${(marketData.volatility7d * 100).toFixed(2)}%`,   icon: Activity   },
          { labelKey: 'market.atr',           tipKey: 'metrics.atr.tip',         value: `$${marketData.atr?.toFixed(2) ?? '—'}`,            icon: LineChart  },
          { labelKey: 'market.stdDev',        tipKey: 'metrics.stdDev.tip',      value: `$${marketData.stdDeviation?.toFixed(2) ?? '—'}`,   icon: LineChart  },
          { labelKey: 'market.liquidity',     tipKey: 'metrics.liquidity.tip',   value: `$${(marketData.liquidity / 1e6).toFixed(1)}M`,     icon: Droplets   },
        ].map(({ labelKey, tipKey, value, icon: Icon }) => (
          <div key={labelKey} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-3.5 w-3.5 text-zinc-500" />
              <p className="text-xs text-zinc-500">{t(labelKey)}</p>
              <CardInfo tip={t(tipKey)} />
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
            <p className="text-sm font-medium text-zinc-200">{t('market.aiRegime')}</p>
            <CardInfo tip={t('market.tip')} />
          </div>
          <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium capitalize', regimeCls)}>
            {regime?.type ?? 'range'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div><p className="text-xs text-zinc-500">{t('market.confidence')}</p><p className="font-semibold">{((regime?.confidence ?? 0) * 100).toFixed(0)}%</p></div>
          <div><p className="text-xs text-zinc-500">{t('market.rangeWidth')}</p><p className="font-semibold">{aiOutputs.rangeWidth?.toFixed(1) ?? '—'}%</p></div>
          <div><p className="text-xs text-zinc-500">{t('market.rebalanceThreshold')}</p><p className="font-semibold">{((aiOutputs.rebalanceThreshold ?? 0) * 100).toFixed(0)}%</p></div>
          <div><p className="text-xs text-zinc-500">{t('market.trend')}</p><p className={cn('font-semibold capitalize', aiInputs.trendDirection === 'up' ? 'text-emerald-400' : aiInputs.trendDirection === 'down' ? 'text-rose-400' : 'text-zinc-400')}>{aiInputs.trendDirection}</p></div>
        </div>
        {aiOutputs.reasoning && (
          <p className="text-xs text-zinc-500 bg-zinc-800/50 rounded-lg p-2 leading-relaxed">{aiOutputs.reasoning}</p>
        )}
      </div>

      {/* Alocação de Capital */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-amber-400" />
          <p className="text-sm font-medium text-zinc-200">Alocação de Capital</p>
        </div>
        <div className="space-y-2.5">
          {[
            { label: 'Core',         pct: aiOutputs.capitalAllocation?.core ?? 0.7,          color: 'bg-emerald-500' },
            { label: 'Defensivo',    pct: aiOutputs.capitalAllocation?.defensive ?? 0.2,     color: 'bg-amber-500'   },
            { label: 'Oportunista',  pct: aiOutputs.capitalAllocation?.opportunistic ?? 0.1, color: 'bg-cyan-500'    },
          ].map(({ label, pct, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400">{label}</span>
                <span className="text-zinc-200 font-medium">{(pct * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', color)} style={{ width: `${pct * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Range Configs — Core / Defensivo / Oportunista */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
          <Target className="h-4 w-4 text-emerald-400" />
          <p className="text-sm font-medium text-zinc-200">Ranges de Posição</p>
        </div>
        <div className="divide-y divide-zinc-800">
          {ranges.map(range => (
            <div key={range.type} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className={cn('text-xs font-semibold uppercase tracking-wide', rangeTypeColor[range.type])}>{range.type}</span>
                <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">{range.percentage}% capital</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                <span>Mín <span className="text-zinc-200">${range.priceLower.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></span>
                <span>Máx <span className="text-zinc-200">${range.priceUpper.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></span>
                <span>Tick inf. <span className="text-zinc-200">{range.tickLower.toLocaleString()}</span></span>
                <span>Tick sup. <span className="text-zinc-200">{range.tickUpper.toLocaleString()}</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Inputs */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-violet-400" />
          <p className="text-sm font-medium text-zinc-200">Entradas do Modelo IA</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-zinc-500">Vol 1D (input)</p><p className="font-semibold">{(aiInputs.volatility1d * 100).toFixed(2)}%</p></div>
          <div><p className="text-xs text-zinc-500">Vol 7D (input)</p><p className="font-semibold">{(aiInputs.volatility7d * 100).toFixed(2)}%</p></div>
          <div><p className="text-xs text-zinc-500">Price Drift</p><p className={cn('font-semibold', aiInputs.priceDrift > 0 ? 'text-emerald-400' : 'text-rose-400')}>{(aiInputs.priceDrift * 100).toFixed(2)}%</p></div>
          <div><p className="text-xs text-zinc-500">Volume Spike</p><p className={cn('font-semibold', aiInputs.volumeSpike ? 'text-amber-400' : 'text-zinc-400')}>{aiInputs.volumeSpike ? 'Sim' : 'Não'}</p></div>
        </div>
      </div>
    </div>
  );
}

// ─── System Tab ────────────────────────────────────────────────────────────────

function SystemTab() {
  const { usdcVaultState, usdtVaultState, totalTVL } = useDualVaultData();
  const { systemStatus, metrics, riskMetrics, recentExecutions } = useLiquidityStore();
  const { t } = useI18n();
  const [keeper, setKeeper] = useState<{ last_run?: string; status?: string; next_run_in_seconds?: number } | null>(null);

  useEffect(() => {
    const AI_URL = process.env.NEXT_PUBLIC_AI_ENGINE_URL;
    if (!AI_URL) return;
    fetch(`${AI_URL}/keeper/status`).then(r => r.json()).then(setKeeper).catch(() => {});
  }, []);

  const statusDot = (ok: boolean) => (
    <span className={cn('inline-block w-2 h-2 rounded-full', ok ? 'bg-emerald-400' : 'bg-zinc-600')} />
  );

  const execStatusColor: Record<string, string> = {
    completed: 'text-emerald-400',
    failed: 'text-rose-400',
    executing: 'text-amber-400',
    pending: 'text-zinc-400',
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* KPI cards — as quatro métricas principais */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center gap-1 mb-1"><p className="text-xs text-zinc-500">{t('system.tvl')}</p><CardInfo tip="Total Value Locked — total USDC + USDT depositado nos vaults." /></div>
          <p className="text-2xl font-bold">${totalTVL.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center gap-1 mb-1"><p className="text-xs text-zinc-500">{t('system.fees24h')}</p><CardInfo tip={t('metrics.volume24h.tip')} /></div>
          <p className="text-2xl font-bold">${metrics.totalFees24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center gap-1 mb-1"><p className="text-xs text-zinc-500">{t('system.estApy')}</p><CardInfo tip="APY estimado com base nas taxas geradas nas últimas 24h anualizadas." /></div>
          <p className="text-2xl font-bold">{(metrics.avgAPY * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center gap-1 mb-1"><p className="text-xs text-zinc-500">{t('system.health')}</p><CardInfo tip="Score de saúde geral do sistema: considera vaults ativos, serviços online e posições em range." /></div>
          <p className="text-2xl font-bold">{metrics.systemHealth.toFixed(0)}%</p>
          <div className="mt-1.5 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full" style={{ width: `${metrics.systemHealth}%` }} />
          </div>
        </div>
      </div>

      {/* Dual Vault Status */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="h-4 w-4 text-violet-400" />
          <p className="text-sm font-medium text-zinc-200">Vault Status</p>
        </div>
        <div className="space-y-3">
          {/* USDC Vault */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-zinc-400">USDC Vault</span>
            </div>
            <div className="flex items-center gap-1.5">
              {statusDot(!!usdcVaultState && !usdcVaultState.paused)}
              <span className={usdcVaultState && !usdcVaultState.paused ? 'text-emerald-400' : 'text-zinc-500'}>
                {usdcVaultState ? (usdcVaultState.paused ? 'Paused' : 'Live') : 'Offline'}
              </span>
            </div>
          </div>
          {/* USDT Vault */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-zinc-400">USDT Vault</span>
            </div>
            <div className="flex items-center gap-1.5">
              {statusDot(!!usdtVaultState && !usdtVaultState.paused)}
              <span className={usdtVaultState && !usdtVaultState.paused ? 'text-emerald-400' : 'text-zinc-500'}>
                {usdtVaultState ? (usdtVaultState.paused ? 'Paused' : 'Live') : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status dos serviços */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-violet-400" />
          <p className="text-sm font-medium text-zinc-200">{t('system.services')}</p>
          <CardInfo tip={t('system.tip')} />
        </div>
        <div className="space-y-2 text-sm">
          {[
            { label: 'IA Engine',           ok: systemStatus?.aiEngineReady ?? false  },
            { label: 'Strategy Controller', ok: systemStatus?.strategyControllerActive ?? false },
            { label: 'Data Indexer',        ok: systemStatus?.dataIndexerSynced ?? false },
            { label: 'Execution Engine',    ok: systemStatus?.executionEngineReady ?? false },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-zinc-400">{label}</span>
              <div className="flex items-center gap-1.5">
                {statusDot(ok)}
                <span className={ok ? 'text-emerald-400' : 'text-zinc-500'}>{ok ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-rose-400" />
          <p className="text-sm font-medium text-zinc-200">{t('system.riskMetrics')}</p>
          <CardInfo tip="Métricas de risco calculadas com base na volatilidade atual e no histórico de posições do vault." />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-zinc-500">{t('metrics.impermanentLoss.label')}</p><p className="font-semibold">{(riskMetrics.impermanentLoss * 100).toFixed(2)}%</p></div>
          <div><p className="text-xs text-zinc-500">{t('metrics.maxDrawdown.label')}</p><p className="font-semibold">{(riskMetrics.maxDrawdown * 100).toFixed(2)}%</p></div>
          <div><p className="text-xs text-zinc-500">{t('metrics.sharpe.label')}</p><p className="font-semibold">{riskMetrics.sharpeRatio.toFixed(2)}</p></div>
          <div><p className="text-xs text-zinc-500">{t('metrics.sortino.label')}</p><p className="font-semibold">{riskMetrics.sortinoRatio.toFixed(2)}</p></div>
        </div>
      </div>

      {/* Keeper Status */}
      {keeper && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-cyan-400" />
            <p className="text-sm font-medium text-zinc-200">Keeper Scheduler</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-zinc-500">Status</p><p className={cn('font-semibold', keeper.status === 'running' ? 'text-emerald-400' : 'text-zinc-400')}>{keeper.status ?? 'unknown'}</p></div>
            <div><p className="text-xs text-zinc-500">Next Run</p><p className="font-semibold">{keeper.next_run_in_seconds ? `${Math.round(keeper.next_run_in_seconds / 60)}min` : '—'}</p></div>
          </div>
        </div>
      )}

      {/* Recent Executions */}
      {recentExecutions.length > 0 && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-medium text-zinc-200">{t('system.executionHistory')}</p>
          </div>
          <div className="divide-y divide-zinc-800">
            {recentExecutions.slice(0, 5).map((exec, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{exec.action}</p>
                  <p className="text-[10px] text-zinc-500">{new Date(exec.timestamp).toLocaleString()}</p>
                </div>
                <span className={cn('text-xs font-medium', execStatusColor[exec.status] ?? 'text-zinc-400')}>{exec.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bottom Navigation ─────────────────────────────────────────────────────────

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { id: Tab; icon: typeof Home; label: string }[] = [
    { id: 'portfolio', icon: Wallet, label: 'Portfolio' },
    { id: 'invest', icon: ArrowDownLeft, label: 'Investir' },
    { id: 'market', icon: TrendingUp, label: 'Mercado' },
    { id: 'system', icon: Settings, label: 'Sistema' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-sm z-50">
      <div className="max-w-2xl mx-auto flex h-16">
        {items.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
              tab === id ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ─── Root Mobile Dashboard ─────────────────────────────────────────────────────

export function MobileDashboard() {
  const [tab, setTab] = useState<Tab>('portfolio');
  const [selectedAsset, setSelectedAsset] = useState<AssetType>('USDC');

  const goDeposit = () => { setTab('invest'); };
  const goWithdraw = () => { setTab('invest'); };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
              <Droplets className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm">AI Liquid Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Content */}
      {tab === 'portfolio' && (
        <PortfolioTab 
          onDeposit={goDeposit} 
          onWithdraw={goWithdraw} 
          selectedAsset={selectedAsset}
          onAssetChange={setSelectedAsset}
        />
      )}
      {tab === 'invest' && (
        <InvestTab 
          initialMode="deposit" 
          selectedAsset={selectedAsset}
          onAssetChange={setSelectedAsset}
        />
      )}
      {tab === 'market' && <MarketTab />}
      {tab === 'system' && <SystemTab />}

      {/* Bottom Navigation */}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
