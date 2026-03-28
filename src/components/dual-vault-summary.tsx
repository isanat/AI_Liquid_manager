'use client';

import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import {
  VAULT_USDC_ADDRESS,
  VAULT_USDT_ADDRESS,
  USDC_ARBITRUM_ONE,
  USDT_ARBITRUM_ONE,
  readVaultState,
  type VaultState,
} from '@/lib/vault-contract';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Coins, TrendingUp, Shield, Activity, Wallet, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const EXPLORER_BASE = 'https://arbiscan.io';

interface VaultCardProps {
  vaultState: VaultState | null;
  assetType: 'USDC' | 'USDT';
  loading: boolean;
}

function VaultCard({ vaultState, assetType, loading }: VaultCardProps) {
  const color = assetType === 'USDC' ? 'blue' : 'green';
  const vaultAddress = assetType === 'USDC' ? VAULT_USDC_ADDRESS : VAULT_USDT_ADDRESS;
  
  const totalAssets = vaultState ? parseFloat(vaultState.totalAssetsUsd) : 0;
  const sharePrice = vaultState ? parseFloat(vaultState.sharePriceUsd) : 1.0;
  const deployedCapital = vaultState ? Number(formatUnits(vaultState.deployedCapital, 6)) : 0;
  const utilization = totalAssets > 0 ? (deployedCapital / totalAssets) * 100 : 0;
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rounded-full",
              assetType === 'USDC' ? "bg-blue-500" : "bg-green-500"
            )} />
            <CardTitle className="text-sm">{assetType} Vault</CardTitle>
          </div>
          <Badge variant="outline" className={cn(
            "text-xs",
            vaultState?.paused 
              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          )}>
            {vaultState?.paused ? 'Paused' : 'Live'}
          </Badge>
        </div>
        <CardDescription className="text-xs font-mono">
          <a 
            href={`${EXPLORER_BASE}/address/${vaultAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-emerald-400 transition-colors"
          >
            {vaultAddress?.slice(0, 6)}…{vaultAddress?.slice(-4)}
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Total Assets
                </p>
                <p className="text-lg font-bold">
                  ${totalAssets.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Share Price
                </p>
                <p className="text-lg font-bold">
                  ${sharePrice.toFixed(4)}
                </p>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Deployed in LP
                </span>
                <span>${deployedCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              </div>
              <Progress value={utilization} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-1">{utilization.toFixed(1)}% utilized</p>
            </div>
            
            <Separator className="bg-border/50" />
            
            <div className="flex justify-between text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span>Mgmt: {vaultState ? Number(vaultState.managementFeeBps) / 100 : 2}%</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <BarChart3 className="h-3 w-3" />
                <span>Perf: {vaultState ? Number(vaultState.performanceFeeBps) / 100 : 20}%</span>
              </div>
            </div>
            
            {vaultState && vaultState.activePositions > 0n && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
                <Activity className="h-3 w-3" />
                {vaultState.activePositions.toString()} active LP position{vaultState.activePositions > 1n ? 's' : ''}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DualVaultSummary() {
  const publicClient = usePublicClient();
  const [usdcVault, setUsdcVault] = useState<VaultState | null>(null);
  const [usdtVault, setUsdtVault] = useState<VaultState | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshVaults = async () => {
    if (!publicClient) return;
    setLoading(true);
    try {
      const [usdc, usdt] = await Promise.all([
        readVaultState(publicClient, VAULT_USDC_ADDRESS),
        readVaultState(publicClient, VAULT_USDT_ADDRESS),
      ]);
      setUsdcVault(usdc);
      setUsdtVault(usdt);
    } catch (e) {
      console.error('Failed to read vault states:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshVaults();
    const iv = setInterval(refreshVaults, 30_000);
    return () => clearInterval(iv);
  }, [publicClient]);

  const totalTVL = (usdcVault ? parseFloat(usdcVault.totalAssetsUsd) : 0) + 
                   (usdtVault ? parseFloat(usdtVault.totalAssetsUsd) : 0);
  
  const usdcShare = totalTVL > 0 
    ? (usdcVault ? parseFloat(usdcVault.totalAssetsUsd) : 0) / totalTVL * 100 
    : 50;
  const usdtShare = 100 - usdcShare;

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/5">
              <Coins className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Vault Overview</CardTitle>
              <CardDescription>USDC & USDT Vaults on Arbitrum One</CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Combined TVL</p>
            <p className="text-xl font-bold">
              ${totalTVL.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* TVL Distribution Bar */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">TVL Distribution</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            <div 
              className="bg-blue-500 transition-all duration-500"
              style={{ width: `${usdcShare}%` }}
            />
            <div 
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${usdtShare}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              USDC: {usdcShare.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              USDT: {usdtShare.toFixed(1)}%
            </span>
          </div>
        </div>
        
        <Separator className="bg-border/50" />
        
        {/* Individual Vault Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VaultCard 
            vaultState={usdcVault} 
            assetType="USDC" 
            loading={loading && !usdcVault}
          />
          <VaultCard 
            vaultState={usdtVault} 
            assetType="USDT" 
            loading={loading && !usdtVault}
          />
        </div>
      </CardContent>
    </Card>
  );
}
