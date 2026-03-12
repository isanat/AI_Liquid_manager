'use client';

/**
 * NetworkGuard
 * ─────────────
 * Shows a prominent banner when the connected wallet is on the wrong network,
 * and explains what the user needs (ETH for gas + USDC for deposits).
 *
 * Renders nothing when:
 *   • wallet not connected
 *   • already on the correct network
 */

import { useAccount, useChainId, useSwitchChain, useBalance, useReadContract } from 'wagmi';
import { AlertTriangle, FlaskConical, Globe, Zap, Coins, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACTIVE_CHAIN_ID } from '@/components/wallet-connect';
import { USDC_ARBITRUM } from '@/lib/vault-contract';

const CHAIN_INFO: Record<number, {
  name: string;
  nativeCurrency: string;
  faucetEth: string | null;
  faucetUsdc: string;
  testnet: boolean;
}> = {
  42161: {
    name:           'Arbitrum One',
    nativeCurrency: 'ETH',
    faucetEth:      null,
    faucetUsdc:     'https://app.uniswap.org',
    testnet:        false,
  },
  421614: {
    name:           'Arbitrum Sepolia',
    nativeCurrency: 'ETH',
    faucetEth:      'https://www.alchemy.com/faucets/arbitrum-sepolia',
    faucetUsdc:     'https://faucet.circle.com',
    testnet:        true,
  },
};

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export function NetworkGuard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  const { data: ethBalance } = useBalance({ address, query: { enabled: !!address } });
  const { data: usdcRaw }    = useReadContract({
    address:      USDC_ARBITRUM,
    abi:          ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args:         address ? [address] : undefined,
    query:        { enabled: !!address && chainId === ACTIVE_CHAIN_ID },
  });

  if (!isConnected || !address) return null;

  const targetInfo = CHAIN_INFO[ACTIVE_CHAIN_ID];
  const ethOk   = ethBalance  && Number(ethBalance.value) > 0;
  const usdcBal = usdcRaw     ? Number(usdcRaw) / 1e6 : 0;
  const usdcOk  = usdcBal > 0;

  // ── Wrong network → show switch banner ──────────────────────────────────
  if (chainId !== ACTIVE_CHAIN_ID) {
    const targetName = targetInfo?.name ?? `Chain ${ACTIVE_CHAIN_ID}`;
    const isTestnet  = targetInfo?.testnet ?? false;

    return (
      <div className="border-b border-amber-500/30 bg-amber-500/5 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                Wrong network detected
              </p>
              <p className="text-xs text-zinc-400">
                This app runs on{' '}
                <span className="font-semibold text-amber-400">{targetName}</span>.
                Switch your wallet to continue.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isTestnet && (
              <span className="flex items-center gap-1 text-xs text-amber-400 border border-amber-500/30 rounded px-2 py-0.5">
                <FlaskConical className="h-3 w-3" /> Testnet
              </span>
            )}
            <Button
              size="sm"
              onClick={() => switchChain({ chainId: ACTIVE_CHAIN_ID })}
              disabled={isPending}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              {isTestnet
                ? <FlaskConical className="h-4 w-4 mr-1.5" />
                : <Globe       className="h-4 w-4 mr-1.5" />}
              Switch to {targetName}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Correct network → show balance checklist if something is missing ────
  if (ethOk && usdcOk) return null;

  return (
    <div className="border-b border-blue-500/20 bg-blue-500/5 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-6 flex-wrap">
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">
          What you need on {targetInfo?.name}:
        </p>

        {/* ETH for gas */}
        <div className={`flex items-center gap-2 text-sm ${ethOk ? 'text-emerald-400' : 'text-zinc-300'}`}>
          <Zap className={`h-4 w-4 ${ethOk ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>ETH for gas</span>
          {ethOk ? (
            <span className="text-xs text-emerald-500">
              ✓ {(Number(ethBalance!.value) / 1e18).toFixed(4)} ETH
            </span>
          ) : (
            targetInfo?.faucetEth && (
              <a
                href={targetInfo.faucetEth}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
              >
                Get free ETH <ExternalLink className="h-3 w-3" />
              </a>
            )
          )}
        </div>

        {/* USDC to invest */}
        <div className={`flex items-center gap-2 text-sm ${usdcOk ? 'text-emerald-400' : 'text-zinc-300'}`}>
          <Coins className={`h-4 w-4 ${usdcOk ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>USDC to invest</span>
          {usdcOk ? (
            <span className="text-xs text-emerald-500">✓ {usdcBal.toFixed(2)} USDC</span>
          ) : (
            <a
              href={targetInfo?.faucetUsdc ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
            >
              {targetInfo?.testnet ? 'Get testnet USDC' : 'Buy USDC'}{' '}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
