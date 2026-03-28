"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  History,
  BarChart3,
} from 'lucide-react';
import { WalletConnect, ACTIVE_CHAIN_ID } from '@/components/wallet-connect';
import { NetworkGuard } from '@/components/network-guard';
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
} from '@/lib/vault-contract';
import Link from 'next/link';

const NETWORK_LABEL = ACTIVE_CHAIN_ID === 421614 ? 'Arbitrum Sepolia' : 'Arbitrum One';
const EXPLORER_BASE = ACTIVE_CHAIN_ID === 421614 ? 'https://sepolia.arbiscan.io' : 'https://arbiscan.io';

// Vault configuration
const VAULTS = [
  { address: VAULT_USDC_ADDRESS, symbol: 'USDC', asset: USDC_ARBITRUM_ONE, decimals: 6 },
  { address: VAULT_USDT_ADDRESS, symbol: 'USDT', asset: USDT_ARBITRUM_ONE, decimals: 6 },
];

interface VaultInfo {
  address: string;
  symbol: string;
  decimals: number;
  vaultState: VaultState | null;
  userState: UserVaultState | null;
  userBalance: bigint;
  userAllowance: bigint;
}

// Transaction history type
interface Transaction {
  type: 'deposit' | 'withdraw';
  vault: string;
  amount: string;
  timestamp: Date;
  txHash: string;
}

export default function InvestorDashboard() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeVault, setActiveVault] = useState<string>('USDC');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Load vault data
  const loadVaultData = useCallback(async () => {
    if (!publicClient || !address) return;

    setRefreshing(true);
    try {
      const vaultData = await Promise.all(
        VAULTS.map(async (vault) => {
          const [vaultState, userState] = await Promise.all([
            readVaultState(vault.address, publicClient),
            readUserVaultState(vault.address, address, publicClient, vault.decimals),
          ]);

          return {
            address: vault.address,
            symbol: vault.symbol,
            decimals: vault.decimals,
            vaultState,
            userState,
            userBalance: userState?.balance || BigInt(0),
            userAllowance: userState?.allowance || BigInt(0),
          };
        })
      );

      setVaults(vaultData);
    } catch (err) {
      console.error('Error loading vault data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [publicClient, address]);

  useEffect(() => {
    if (isConnected && address) {
      loadVaultData();
    } else {
      setLoading(false);
    }
  }, [isConnected, address, loadVaultData]);

  // Get current vault
  const currentVault = vaults.find((v) => v.symbol === activeVault);

  // Calculate totals
  const totalInvested = vaults.reduce((sum, v) => {
    if (!v.vaultState || !v.userState) return sum;
    const pricePerShare = Number(v.vaultState.pricePerShare) / Math.pow(10, v.decimals);
    return sum + v.userState.balance * pricePerShare;
  }, 0);

  const totalShares = vaults.reduce((sum, v) => sum + Number(v.userState?.shares || 0), 0);

  // Handle deposit
  const handleDeposit = async () => {
    if (!walletClient || !address || !currentVault || !depositAmount) return;

    setIsProcessing(true);
    setError(null);
    setTxHash(null);

    try {
      const amount = parseUnits(depositAmount, currentVault.decimals);

      // Check allowance
      if (currentVault.userAllowance < amount) {
        const approveTx = await approveStablecoin(
          currentVault.address,
          currentVault.asset,
          amount,
          walletClient,
          address
        );
        await publicClient?.waitForTransactionReceipt({ hash: approveTx });
      }

      // Deposit
      const tx = await depositToVault(
        currentVault.address,
        amount,
        walletClient,
        address
      );

      setTxHash(tx);
      await publicClient?.waitForTransactionReceipt({ hash: tx });

      // Add to transaction history
      const newTx: Transaction = {
        type: 'deposit',
        vault: currentVault.symbol,
        amount: depositAmount,
        timestamp: new Date(),
        txHash: tx,
      };
      setTransactions((prev) => [newTx, ...prev].slice(0, 10));

      // Refresh data
      await loadVaultData();
      setDepositAmount('');

    } catch (err: unknown) {
      console.error('Deposit error:', err);
      setError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!walletClient || !address || !currentVault || !withdrawAmount) return;

    setIsProcessing(true);
    setError(null);
    setTxHash(null);

    try {
      const amount = parseUnits(withdrawAmount, currentVault.decimals);

      // Withdraw (redeem)
      const tx = await redeemFromVault(
        currentVault.address,
        amount,
        walletClient,
        address
      );

      setTxHash(tx);
      await publicClient?.waitForTransactionReceipt({ hash: tx });

      // Add to transaction history
      const newTx: Transaction = {
        type: 'withdraw',
        vault: currentVault.symbol,
        amount: withdrawAmount,
        timestamp: new Date(),
        txHash: tx,
      };
      setTransactions((prev) => [newTx, ...prev].slice(0, 10));

      // Refresh data
      await loadVaultData();
      setWithdrawAmount('');

    } catch (err: unknown) {
      console.error('Withdraw error:', err);
      setError(err instanceof Error ? err.message : 'Withdraw failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate return (mock for now - would need historical data)
  const returnPct = 4.03; // Demo
  const returnUsd = totalInvested * returnPct / 100;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        {/* Header */}
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm font-medium">← Voltar</span>
            </Link>
            <WalletConnect />
          </div>
        </header>

        <div className="container mx-auto px-4 py-16 text-center">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Conecte sua Carteira
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Conecte sua carteira para ver seus investimentos e operar os vaults.
          </p>
          <WalletConnect />
        </div>
      </div>
    );
  }

  if (loading) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm font-medium">Landing</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Meus Investimentos</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            >
              Admin →
            </Link>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Network Guard */}
      <NetworkGuard />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Status & Refresh */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="font-medium">Status: Online</span>
            <Badge variant="secondary" className="ml-2">{NETWORK_LABEL}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={loadVaultData} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Investido */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Investido
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="mt-2 space-y-1">
                {vaults.map((v) => (
                  <div key={v.address} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{v.symbol}</span>
                    <span className="font-medium">
                      {v.userState ? Number(v.userState.balance).toFixed(2) : '0.00'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Retorno */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                {returnPct >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                Retorno Acumulado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
              </div>
              <div className={`text-lg font-medium mt-1 ${returnUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {returnUsd >= 0 ? '+' : ''}${returnUsd.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          {/* Risco */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Risco
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Volatilidade</span>
                    <span className="font-medium">12.5%</span>
                  </div>
                  <Progress value={12.5 * 5} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Drawdown</span>
                    <span className="font-medium text-orange-500">2.1%</span>
                  </div>
                  <Progress value={2.1 * 10} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Taxas */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Taxas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gestão</span>
                  <span>0%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Performance</span>
                  <span>10%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  10% sobre lucros realizados
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Deposit/Withdraw + History */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Deposit/Withdraw */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Operações</CardTitle>
                <CardDescription>Deposite ou saque do vault</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeVault} onValueChange={setActiveVault}>
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="USDC">USDC Vault</TabsTrigger>
                    <TabsTrigger value="USDT">USDT Vault</TabsTrigger>
                  </TabsList>

                  {['USDC', 'USDT'].map((symbol) => {
                    const vault = vaults.find((v) => v.symbol === symbol);
                    return (
                      <TabsContent key={symbol} value={symbol} className="space-y-4">
                        {vault?.vaultState && (
                          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <div>
                              <p className="text-xs text-muted-foreground">TVL do Vault</p>
                              <p className="text-lg font-bold">
                                ${Number(vault.vaultState.totalAssets).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Seu Saldo</p>
                              <p className="text-lg font-bold">
                                ${vault.userState ? Number(vault.userState.balance).toFixed(2) : '0.00'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Seus Shares</p>
                              <p className="text-lg font-bold">
                                {vault.userState ? Number(vault.userState.shares).toFixed(4) : '0'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Preço/Share</p>
                              <p className="text-lg font-bold">
                                ${vault.vaultState ? Number(vault.vaultState.pricePerShare).toFixed(4) : '1.00'}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Deposit */}
                          <div className="space-y-3">
                            <Label>Depositar {symbol}</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(e.target.value)}
                            />
                            <Button
                              className="w-full"
                              onClick={handleDeposit}
                              disabled={isProcessing || !depositAmount}
                            >
                              {isProcessing ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Processando...
                                </>
                              ) : (
                                <>
                                  <ArrowDownRight className="h-4 w-4 mr-2" />
                                  Depositar
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Withdraw */}
                          <div className="space-y-3">
                            <Label>Sacar {symbol}</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                            />
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={handleWithdraw}
                              disabled={isProcessing || !withdrawAmount}
                            >
                              {isProcessing ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Processando...
                                </>
                              ) : (
                                <>
                                  <ArrowUpRight className="h-4 w-4 mr-2" />
                                  Sacar
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Tx Hash */}
                        {txHash && (
                          <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <AlertTitle>Transação Confirmada</AlertTitle>
                            <AlertDescription>
                              <a
                                href={`${EXPLORER_BASE}/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:underline font-mono text-xs"
                              >
                                {txHash.slice(0, 10)}...{txHash.slice(-8)} →
                              </a>
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Error */}
                        {error && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Erro</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* History */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico Recente
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma transação recente
                  </p>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          {tx.type === 'deposit' ? (
                            <ArrowDownRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-orange-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium capitalize">{tx.type}</p>
                            <p className="text-xs text-muted-foreground">{tx.vault}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">${tx.amount}</p>
                          <a
                            href={`${EXPLORER_BASE}/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            Ver tx
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Risk Disclaimer */}
        <Card className="mt-8 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-lg">
              <AlertTriangle className="h-5 w-5" />
              Transparência e Riscos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-amber-800 dark:text-amber-200">
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
                  <span><strong>Não há garantia de retorno.</strong> Investimentos em DeFi carregam riscos de perda.</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-orange-500" />
                  <span><strong>Perda Impermanente (IL).</strong> Você pode ter menos tokens do que HODL.</span>
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" />
                  <span>Smart contracts auditáveis na blockchain.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" />
                  <span>Saque a qualquer momento (sem lock-up).</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
