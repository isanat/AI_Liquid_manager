'use client';

/**
 * UniswapPositions — shows real on-chain Uniswap V3 positions for the
 * connected wallet. Uses wagmi hooks + viem reads.
 *
 * Actions available:
 *  - Collect fees
 *  - Remove liquidity (decrease 100%)
 */
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, RefreshCw, Coins, Minus, ExternalLink, AlertTriangle } from 'lucide-react';
import {
  NPM_ABI,
  POOL_ABI,
  collectFees,
  readPositions,
  tickToPrice,
  MAX_UINT128,
  NONFUNGIBLE_POSITION_MANAGER,
} from '@/lib/uniswap-v3';
import type { Address } from 'viem';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnChainPosition {
  tokenId: bigint;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  priceLower: number;
  priceUpper: number;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function PositionRow({
  pos,
  onCollect,
  onRemove,
  collecting,
  removing,
  chainId,
}: {
  pos: OnChainPosition;
  onCollect: (tokenId: bigint) => void;
  onRemove: (tokenId: bigint, liquidity: bigint) => void;
  collecting: boolean;
  removing: boolean;
  chainId: number | undefined;
}) {
  const feeLabel = `${pos.fee / 10000}%`;
  const hasFees = pos.tokensOwed0 > 0n || pos.tokensOwed1 > 0n;
  const isActive = pos.liquidity > 0n;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
          <span className="text-sm font-mono text-zinc-100">#{pos.tokenId.toString()}</span>
          <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
            {feeLabel}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            disabled={!hasFees || collecting}
            onClick={() => onCollect(pos.tokenId)}
          >
            {collecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Coins className="h-3 w-3 mr-1" />}
            Collect fees
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
            disabled={!isActive || removing}
            onClick={() => onRemove(pos.tokenId, pos.liquidity)}
          >
            {removing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Minus className="h-3 w-3 mr-1" />}
            Remove
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-zinc-400 hover:text-zinc-300"
            onClick={() =>
              window.open(
                `https://app.uniswap.org/positions/v3/${
                  chainId === 42161  ? 'arbitrum'  :
                  chainId === 421614 ? 'arbitrum'  :
                  chainId === 1      ? 'ethereum'  : 'arbitrum'
                }/${pos.tokenId}`,
                '_blank',
                'noopener',
              )
            }
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
        <div>
          <span className="text-zinc-500">Range: </span>
          ${pos.priceLower.toFixed(0)} – ${pos.priceUpper.toFixed(0)}
        </div>
        <div>
          <span className="text-zinc-500">Liquidity: </span>
          {isActive ? pos.liquidity.toString().slice(0, 8) + '…' : 'closed'}
        </div>
        {hasFees && (
          <div className="col-span-2 text-emerald-400/80">
            Uncollected fees: T0={pos.tokensOwed0.toString().slice(0, 6)} T1={pos.tokensOwed1.toString().slice(0, 6)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UniswapPositions() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [positions, setPositions] = useState<OnChainPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<{ id: bigint; type: 'collect' | 'remove' } | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const npm = NONFUNGIBLE_POSITION_MANAGER as Address;

  const loadPositions = useCallback(async () => {
    if (!address || !publicClient) return;
    setLoading(true);
    setError(null);
    try {
      const tokenIds = await readPositions(publicClient, npm, address);
      const loaded: OnChainPosition[] = [];

      for (const tokenId of tokenIds) {
        const raw = await publicClient.readContract({
          address: npm,
          abi: NPM_ABI,
          functionName: 'positions',
          args: [tokenId],
        });
        loaded.push({
          tokenId,
          token0:      raw[2],
          token1:      raw[3],
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
      const msg = e instanceof Error ? e.message : String(e);
      // "returned no data (0x)" means contract not deployed on this network (e.g. Arbitrum Sepolia)
      setError(
        msg.includes('returned no data') || msg.includes('"0x"')
          ? 'Uniswap V3 not available on this network'
          : 'Failed to load positions'
      );
    } finally {
      setLoading(false);
    }
  }, [address, publicClient, npm]);

  useEffect(() => {
    if (isConnected && address) loadPositions();
  }, [isConnected, address, loadPositions]);

  const handleCollect = async (tokenId: bigint) => {
    if (!walletClient || !address) return;
    setActionPending({ id: tokenId, type: 'collect' });
    setTxHash(null);
    try {
      const hash = await collectFees(walletClient, npm, tokenId, address as Address);
      setTxHash(hash);
      await loadPositions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Collect failed');
    } finally {
      setActionPending(null);
    }
  };

  const handleRemove = async (tokenId: bigint, liquidity: bigint) => {
    if (!walletClient || !address || !publicClient) return;
    setActionPending({ id: tokenId, type: 'remove' });
    setTxHash(null);
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      const SLIPPAGE_BPS = 50n; // 0.5% slippage tolerance

      // 1a. Simulate to get expected token amounts (no state change)
      const { result } = await publicClient.simulateContract({
        address: npm,
        abi: NPM_ABI,
        functionName: 'decreaseLiquidity',
        args: [{ tokenId, liquidity, amount0Min: 0n, amount1Min: 0n, deadline }],
        account: address as Address,
      });
      const [amount0Expected, amount1Expected] = result as [bigint, bigint];

      // 1b. Apply 0.5% slippage to computed minimums
      const amount0Min = amount0Expected * (10000n - SLIPPAGE_BPS) / 10000n;
      const amount1Min = amount1Expected * (10000n - SLIPPAGE_BPS) / 10000n;

      // 1c. Decrease all liquidity with slippage protection
      const hash1 = await walletClient.writeContract({
        address: npm,
        abi: NPM_ABI,
        functionName: 'decreaseLiquidity',
        args: [{ tokenId, liquidity, amount0Min, amount1Min, deadline }],
        account: address as Address,
        chain: walletClient.chain ?? null,
      });
      await publicClient!.waitForTransactionReceipt({ hash: hash1 });

      // 2. collect all tokens
      const hash2 = await collectFees(walletClient, npm, tokenId, address as Address);
      setTxHash(hash2);
      await loadPositions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setActionPending(null);
    }
  };

  if (!isConnected) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-6 text-center text-zinc-500 text-sm">
          Connect wallet to view on-chain positions
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-zinc-200">
            On-Chain Positions
          </CardTitle>
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

        {txHash && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
            <span>Tx sent:</span>
            <a
              href={`https://etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono underline"
            >
              {txHash.slice(0, 10)}…
            </a>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500 py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading positions…
          </div>
        ) : positions.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-4">
            No Uniswap V3 positions found
          </p>
        ) : (
          positions.map(pos => (
            <PositionRow
              key={pos.tokenId.toString()}
              pos={pos}
              collecting={actionPending?.id === pos.tokenId && actionPending.type === 'collect'}
              removing={actionPending?.id === pos.tokenId && actionPending.type === 'remove'}
              onCollect={handleCollect}
              onRemove={handleRemove}
              chainId={chainId}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
