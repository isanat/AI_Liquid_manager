'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Brain, ChevronRight,
  Droplets, ExternalLink, Shield, Target, TrendingUp, Wallet, Zap, Coins,
  RefreshCw, Info
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
      setUsdtUserState(usdtUs);
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

// ─── Vault Selector ────────────────────────────────────────────────────────────

function VaultSelector({ selected, onChange }: { selected: AssetType; onChange: (asset: AssetType) => void }) {
  return (
    <div className="flex rounded-xl bg-zinc-900 border border-zinc-800 p-1 gap-1">
      <button
        onClick={() => onChange('USDC')}
        className={cn(
          'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
          selected === 'USDC' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-zinc-400 hover:text-zinc-200',
        )}
      >
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        USDC
      </button>
      <button
        onClick={() => onChange('USDT')}
        className={cn(
          'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
          selected === 'USDT' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-zinc-400 hover:text-zinc-200',
        )}
      >
        <span className="w-2 h-2 rounded-full bg-green-500" />
        USDT
      </button>
    </div>
  );
}

// ─── Investor Dashboard ────────────────────────────────────────────────────────

export default function InvestorPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { history } = useVaultHistory();
  const { marketData, regime } = useLiquidityStore();
  const { t } = useI18n();
  const { toast } = useToast();

  const [selectedAsset, setSelectedAsset] = useState<AssetType>('USDC');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

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

  // TVL distribution
  const usdcTVL = usdcVaultState ? parseFloat(usdcVaultState.totalAssetsUsd) : 0;
  const usdtTVL = usdtVaultState ? parseFloat(usdtVaultState.totalAssetsUsd) : 0;
  const usdcShare = totalTVL > 0 ? (usdcTVL / totalTVL * 100) : 50;
  const usdtShare = 100 - usdcShare;

  const handleDeposit = async () => {
    if (!walletClient || !address || !publicClient) {
      toast({ title: 'Conecta a carteira primeiro', variant: 'destructive' });
      return;
    }
    const amt = parseFloat(depositAmt);
    if (!depositAmt || isNaN(amt) || amt <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    setBusy(true);
    setTxHash(null);
    try {
      toast({ title: `Passo 1/2 — Aprovar ${selectedAsset}`, description: 'Confirma na carteira…' });
      const approveTx = await approveStablecoin(walletClient, address, depositAmt, assetAddress, vaultAddress);
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      toast({ title: 'Passo 2/2 — Depositar', description: 'Confirma na carteira…' });
      const depTx = await depositToVault(walletClient, address, depositAmt, vaultAddress);
      await publicClient.waitForTransactionReceipt({ hash: depTx });
      setTxHash(depTx);
      setDepositAmt('');
      await refresh();
      toast({ title: 'Depósito confirmado!', description: `$${amt.toLocaleString()} ${selectedAsset} depositados.` });
    } catch (err) {
      toast({ title: 'Depósito falhou', description: (err instanceof Error ? err.message : 'Erro').slice(0, 100), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!walletClient || !address || !publicClient) {
      toast({ title: 'Conecta a carteira primeiro', variant: 'destructive' });
      return;
    }
    const amt = parseFloat(withdrawAmt);
    if (!withdrawAmt || isNaN(amt) || amt <= 0) {
      toast({ title: 'Shares inválidas', variant: 'destructive' });
      return;
    }
    const shares = parseUnits(withdrawAmt, 18);
    if (userState && shares > userState.shares) {
      toast({ title: 'Shares insuficientes', description: `Tens ${vaiShares.toFixed(4)} vAI`, variant: 'destructive' });
      return;
    }
    setBusy(true);
    setTxHash(null);
    try {
      toast({ title: 'A resgatar vAI shares…', description: 'Confirma na carteira…' });
      const tx = await redeemFromVault(walletClient, address, shares, vaultAddress);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setTxHash(tx);
      setWithdrawAmt('');
      await refresh();
      toast({ title: 'Saque confirmado!', description: `${selectedAsset} devolvido à carteira.` });
    } catch (err) {
      toast({ title: 'Saque falhou', description: (err instanceof Error ? err.message : 'Erro').slice(0, 100), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const regimeColor = {
    trend: 'text-cyan-400',
    'high-vol': 'text-rose-400',
    'low-vol': 'text-emerald-400',
    range: 'text-amber-400',
  }[regime?.type ?? 'range'] ?? 'text-zinc-400';

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

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Como funciona - Onboarding */}
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
                { icon: Brain, color: 'text-cyan-400', text: 'IA rebalanceia a cada 15 min na Uniswap V3' },
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

        {/* Governance Gate */}
        <GovernanceGateInvestor vaultAssetsUsd={vaultAssets} userAssetsUsd={userUsd} />

        {/* Vault Selector */}
        <VaultSelector selected={selectedAsset} onChange={setSelectedAsset} />

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
              vaultState && !vaultState.paused && vaultAddress
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
            )}>
              {vaultState && !vaultState.paused && vaultAddress ? '● Live' : vaultAddress ? '⏸ Paused' : '— Not Deployed'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-zinc-500">TVL {selectedAsset}</p>
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
                  <p className="font-bold text-lg">{vaiShares.toFixed(4)}</p>
                </div>
              </>
            )}
          </div>
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

        {/* Deposit/Withdraw */}
        {isConnected ? (
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-4">
            {/* Mode toggle */}
            <div className="flex rounded-xl bg-zinc-800 p-1 gap-1">
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

            {/* Wallet Balance */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-zinc-800/50 p-3">
                <p className="text-xs text-zinc-500">Carteira {selectedAsset}</p>
                <p className="font-bold">${walletBal.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-zinc-800/50 p-3">
                <p className="text-xs text-zinc-500">Posição {selectedAsset}</p>
                <p className="font-bold">${userUsd.toFixed(2)}</p>
              </div>
            </div>

            {mode === 'deposit' ? (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={depositAmt}
                    onChange={(e) => setDepositAmt(e.target.value)}
                    className="w-full h-14 px-4 pr-20 text-xl font-bold bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-emerald-500/50"
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
                  className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold transition-colors flex items-center justify-center gap-2"
                >
                  {busy ? <><RefreshCw className="h-4 w-4 animate-spin" /> Processando…</> : `Depositar ${selectedAsset}`}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.0000"
                    value={withdrawAmt}
                    onChange={(e) => setWithdrawAmt(e.target.value)}
                    className="w-full h-14 px-4 pr-20 text-xl font-bold bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-rose-500/50"
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
                    Tens <span className="text-zinc-200">{vaiShares.toFixed(4)} vAI</span> (≈ ${userUsd.toFixed(2)})
                  </p>
                )}
                <button
                  onClick={handleWithdraw}
                  disabled={busy || vaultState?.paused}
                  className="w-full h-12 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-bold transition-colors flex items-center justify-center gap-2"
                >
                  {busy ? <><RefreshCw className="h-4 w-4 animate-spin" /> Processando…</> : `Sacar ${selectedAsset}`}
                </button>
              </div>
            )}

            {txHash && (
              <a
                href={`${EXPLORER}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Tx confirmada — ver no explorer
              </a>
            )}

            {vaultState && (
              <p className="text-center text-xs text-zinc-600">
                Taxa gestão {Number(vaultState.managementFeeBps) / 100}% · Performance {Number(vaultState.performanceFeeBps) / 100}%
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 text-center">
            <Wallet className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">Conecte sua carteira para depositar ou sacar</p>
          </div>
        )}

        {/* Market Summary */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-zinc-200">Resumo do Mercado</p>
            <span className={cn('text-xs font-medium', regimeColor)}>● {regime?.type ?? 'range'}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-zinc-500">ETH Price</p>
              <p className="font-semibold">${marketData.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Volume 24h</p>
              <p className="font-semibold">${(marketData.volume24h / 1e6).toFixed(1)}M</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Volatilidade 1D</p>
              <p className="font-semibold">{(marketData.volatility1d * 100).toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Confiança IA</p>
              <p className="font-semibold">{((regime?.confidence ?? 0) * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        {history.length > 0 && (
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-sm font-medium text-zinc-200">Transações Recentes</p>
            </div>
            <div className="divide-y divide-zinc-800">
              {history.slice(0, 5).map((tx, i) => (
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
          </div>
        )}
      </main>
    </div>
  );
}
