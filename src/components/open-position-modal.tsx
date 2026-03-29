'use client';

/**
 * OpenPositionModal — form to mint a new Uniswap V3 position
 * pre-filled with range/allocation from the AI Engine output.
 */
import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import {
  mintPosition,
  approveToken,
  nearestUsableTick,
  priceToTick,
  TICK_SPACING,
  NONFUNGIBLE_POSITION_MANAGER,
  WETH,
  USDC,
  ERC20_ABI,
} from '@/lib/uniswap-v3';
import type { Address } from 'viem';
import { parseUnits } from 'viem';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Current price from AI Engine / The Graph */
  currentPrice: number;
  /** Range width % suggested by AI Engine (e.g. 7 = ±7%) */
  aiRangeWidth: number;
  /** Confidence 0-1 */
  aiConfidence: number;
}

export function OpenPositionModal({ open, onClose, currentPrice, aiRangeWidth, aiConfidence }: Props) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const feeTier = 500; // ETH/USDC 0.05% pool on Arbitrum (matches vault contract)
  const spacing = TICK_SPACING[feeTier];

  // Prefill from AI suggestion
  const defaultLower = (currentPrice * (1 - aiRangeWidth / 100)).toFixed(2);
  const defaultUpper = (currentPrice * (1 + aiRangeWidth / 100)).toFixed(2);

  const [priceLower, setPriceLower] = useState(defaultLower);
  const [priceUpper, setPriceUpper] = useState(defaultUpper);
  const [ethAmount, setEthAmount] = useState('');
  const [usdcAmount, setUsdcAmount] = useState('');

  const [step, setStep] = useState<'idle' | 'approving0' | 'approving1' | 'minting' | 'done'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const npm = NONFUNGIBLE_POSITION_MANAGER as Address;

  const handleOpen = async () => {
    if (!walletClient || !address || !publicClient) return;
    setError(null);
    setTxHash(null);

    try {
      const tickLower = nearestUsableTick(priceToTick(parseFloat(priceLower)), spacing);
      const tickUpper = nearestUsableTick(priceToTick(parseFloat(priceUpper)), spacing);

      if (tickLower >= tickUpper) {
        setError('Price lower must be < price upper');
        return;
      }

      const amount0 = parseUnits(ethAmount,  18); // WETH
      const amount1 = parseUnits(usdcAmount,  6); // USDC

      // 1. Approve WETH
      setStep('approving0');
      const allowance0 = await publicClient.readContract({
        address: WETH as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as Address, npm],
      });
      if (allowance0 < amount0) {
        const h = await approveToken(walletClient, WETH as Address, npm, amount0);
        await publicClient.waitForTransactionReceipt({ hash: h });
      }

      // 2. Approve USDC
      setStep('approving1');
      const allowance1 = await publicClient.readContract({
        address: USDC as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as Address, npm],
      });
      if (allowance1 < amount1) {
        const h = await approveToken(walletClient, USDC as Address, npm, amount1);
        await publicClient.waitForTransactionReceipt({ hash: h });
      }

      // 3. Mint
      setStep('minting');
      const { hash } = await mintPosition(walletClient, publicClient, {
        npmAddress: npm,
        token0: WETH as Address,
        token1: USDC as Address,
        fee: feeTier,
        tickLower,
        tickUpper,
        amount0Desired: amount0,
        amount1Desired: amount1,
        recipient: address as Address,
      });

      setTxHash(hash);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed');
      setStep('idle');
    }
  };

  const stepLabel: Record<typeof step, string> = {
    idle:       'Open Position',
    approving0: 'Approving WETH…',
    approving1: 'Approving USDC…',
    minting:    'Minting position…',
    done:       'Done!',
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Open Uniswap V3 Position</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* AI suggestion banner */}
          <div className="flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded p-2 text-emerald-400">
            <span className="font-semibold">AI suggests:</span>
            ±{aiRangeWidth}% range &bull; confidence {(aiConfidence * 100).toFixed(0)}%
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Price lower (USDC)</Label>
              <Input
                className="bg-zinc-800 border-zinc-700 text-zinc-100 text-sm"
                value={priceLower}
                onChange={e => setPriceLower(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Price upper (USDC)</Label>
              <Input
                className="bg-zinc-800 border-zinc-700 text-zinc-100 text-sm"
                value={priceUpper}
                onChange={e => setPriceUpper(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">WETH amount</Label>
              <Input
                className="bg-zinc-800 border-zinc-700 text-zinc-100 text-sm"
                value={ethAmount}
                onChange={e => setEthAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">USDC amount</Label>
              <Input
                className="bg-zinc-800 border-zinc-700 text-zinc-100 text-sm"
                value={usdcAmount}
                onChange={e => setUsdcAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Pool: ETH/USDC 0.3% &bull; Current price: ${currentPrice.toLocaleString()}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-2">
              <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {txHash && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
              <span>Tx confirmed:</span>
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono underline flex items-center gap-1"
              >
                {txHash.slice(0, 10)}… <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleOpen}
            disabled={!isConnected || step !== 'idle'}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {(step !== 'idle' && step !== 'done') && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {stepLabel[step]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
