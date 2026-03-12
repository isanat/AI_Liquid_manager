'use client';

/**
 * VaultPositions — shows real Uniswap V3 LP positions owned by the AILiquidVault.
 *
 * Reads:
 *  - vault.getActiveTokenIds()  → array of NFT token IDs
 *  - NPM.positions(tokenId)     → tick range, liquidity, uncollected fees
 */

import { useState, useEffect, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, Activity } from 'lucide-react';
import { VAULT_ADDRESS, VAULT_ABI } from '@/lib/vault-contract';
import { NPM_ABI, NONFUNGIBLE_POSITION_MANAGER, tickToPrice } from '@/lib/uniswap-v3';
import type { Address } from 'viem';
import { formatUnits } from 'viem';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VaultPosition {
  tokenId: bigint;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint; // USDC
  tokensOwed1: bigint; // WETH
  priceLower: number;
  priceUpper: number;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function PositionRow({ pos }: { pos: VaultPosition }) {
  const isActive = pos.liquidity > 0n;
  const hasFees  = pos.tokensOwed0 > 0n || pos.tokensOwed1 > 0n;
  const feeLabel = `${pos.fee / 10000}%`;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
          <span className="text-sm font-mono text-zinc-100">#{pos.tokenId.toString()}</span>
          <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
            {feeLabel}
          </Badge>
          <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
            vault
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-zinc-400 hover:text-zinc-300"
          onClick={() =>
            window.open(
              `https://app.uniswap.org/positions/v3/arbitrum/${pos.tokenId}`,
              '_blank',
              'noopener',
            )
          }
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
        <div>
          <span className="text-zinc-500">Range: </span>
          ${pos.priceLower.toFixed(0)} – ${pos.priceUpper.toFixed(0)} USDC/ETH
        </div>
        <div>
          <span className="text-zinc-500">Liquidity: </span>
          {isActive ? pos.liquidity.toString().slice(0, 8) + '…' : 'closed'}
        </div>
        {hasFees && (
          <div className="col-span-2 text-emerald-400/80">
            Uncollected: {formatUnits(pos.tokensOwed0, 6)} USDC · {formatUnits(pos.tokensOwed1, 18).slice(0, 8)} WETH
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VaultPositions() {
  const publicClient = usePublicClient();
  const npm = NONFUNGIBLE_POSITION_MANAGER as Address;

  const [positions, setPositions] = useState<VaultPosition[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    if (!publicClient || !VAULT_ADDRESS) return;
    setLoading(true);
    setError(null);
    try {
      const tokenIds = await publicClient.readContract({
        address:      VAULT_ADDRESS,
        abi:          VAULT_ABI,
        functionName: 'getActiveTokenIds',
      }) as bigint[];

      const loaded: VaultPosition[] = [];
      for (const tokenId of tokenIds) {
        const raw = await publicClient.readContract({
          address:      npm,
          abi:          NPM_ABI,
          functionName: 'positions',
          args:         [tokenId],
        }) as readonly [bigint, string, string, string, number, number, number, bigint, bigint, bigint, bigint, bigint];

        loaded.push({
          tokenId,
          fee:         raw[4],
          tickLower:   raw[5],
          tickUpper:   raw[6],
          liquidity:   raw[7],
          tokensOwed0: raw[10],
          tokensOwed1: raw[11],
          priceLower:  tickToPrice(raw[5]),
          priceUpper:  tickToPrice(raw[6]),
        });
      }
      setPositions(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vault positions');
    } finally {
      setLoading(false);
    }
  }, [publicClient, npm]);

  useEffect(() => {
    loadPositions();
    const iv = setInterval(loadPositions, 30_000);
    return () => clearInterval(iv);
  }, [loadPositions]);

  if (!VAULT_ADDRESS) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-6 text-center text-zinc-500 text-sm">
          Vault not deployed — set NEXT_PUBLIC_VAULT_ADDRESS
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-zinc-200">
              Vault LP Positions
            </CardTitle>
            {positions.length > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                {positions.length}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
            onClick={loadPositions}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-2">
        {error && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-2">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500 py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading vault positions…
          </div>
        ) : positions.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-4">
            No active LP positions — keeper will open one on next rebalance cycle
          </p>
        ) : (
          positions.map(pos => (
            <PositionRow key={pos.tokenId.toString()} pos={pos} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
