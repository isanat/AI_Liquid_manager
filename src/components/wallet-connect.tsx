'use client';

import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
  useBalance,
  useReadContract,
} from 'wagmi';
import { arbitrum, arbitrumSepolia } from 'wagmi/chains';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  ChevronDown,
  LogOut,
  Copy,
  ExternalLink,
  RefreshCw,
  FlaskConical,
  Globe,
} from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { USDC_ARBITRUM } from '@/lib/vault-contract';

// ─── Network config ───────────────────────────────────────────────────────────

/** Active network driven by NEXT_PUBLIC_CHAIN_ID env var */
export const ACTIVE_CHAIN_ID: number =
  Number(process.env.NEXT_PUBLIC_CHAIN_ID) === 421614 ? 421614 : 42161;

const CHAIN_META: Record<number, { name: string; label: string; color: string; explorer: string; testnet: boolean }> = {
  42161: {
    name:     'Arbitrum One',
    label:    'Arbitrum',
    color:    'bg-sky-500/10 text-sky-400 border-sky-500/20',
    explorer: 'https://arbiscan.io',
    testnet:  false,
  },
  421614: {
    name:    'Arbitrum Sepolia',
    label:   'Arb Sepolia',
    color:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    explorer:'https://sepolia.arbiscan.io',
    testnet: true,
  },
  1: {
    name:    'Ethereum',
    label:   'Ethereum',
    color:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    explorer:'https://etherscan.io',
    testnet: false,
  },
};

function chainMeta(id: number) {
  return CHAIN_META[id] ?? {
    name:    `Chain ${id}`,
    label:   `Chain ${id}`,
    color:   'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    explorer:'https://etherscan.io',
    testnet: false,
  };
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// ─── Connector picker dialog ──────────────────────────────────────────────────

/** True when running in a mobile browser (not SSR) */
function isMobileBrowser() {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

/** True when MetaMask (or any injected provider) is available */
function isMetaMaskInjected() {
  if (typeof window === 'undefined') return false;
  return !!(window as { ethereum?: unknown }).ethereum;
}

function ConnectorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { connect, connectors, isPending } = useConnect();
  const mobile = isMobileBrowser();
  const metamaskInjected = isMetaMaskInjected();

  const labelFor = (id: string) => {
    if (id.includes('metaMask') || id === 'injected') return 'MetaMask';
    if (id.includes('coinbase'))      return 'Coinbase Wallet';
    if (id.includes('walletConnect')) return 'WalletConnect';
    return id;
  };

  /** On mobile, open the MetaMask deep link so it redirects back to the dapp */
  const openMetaMaskDeepLink = () => {
    const dappUrl = window.location.href.replace(/^https?:\/\//, '');
    window.location.href = `https://metamask.app.link/dapp/${dappUrl}`;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Connect Wallet</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          {connectors.map(connector => {
            const isMetaMaskConnector =
              connector.id.includes('metaMask') || connector.id === 'injected';

            // On mobile without injected provider → deep link instead of wagmi connect
            if (isMetaMaskConnector && mobile && !metamaskInjected) {
              return (
                <Button
                  key={connector.id}
                  variant="outline"
                  className="justify-start border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800"
                  onClick={openMetaMaskDeepLink}
                >
                  <Wallet className="h-4 w-4 mr-2 text-emerald-400" />
                  MetaMask
                  <span className="ml-auto text-[10px] text-zinc-500">app</span>
                </Button>
              );
            }

            return (
              <Button
                key={connector.id}
                variant="outline"
                className="justify-start border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800"
                disabled={isPending}
                onClick={() => { connect({ connector }); onClose(); }}
              >
                <Wallet className="h-4 w-4 mr-2 text-emerald-400" />
                {labelFor(connector.id)}
              </Button>
            );
          })}
        </div>
        {mobile && !metamaskInjected && (
          <p className="text-xs text-amber-400/80 mt-1 text-center">
            No se detectó MetaMask. Usa WalletConnect o abre desde la app MetaMask.
          </p>
        )}
        <p className="text-xs text-zinc-500 mt-1 text-center">
          Make sure your wallet is on{' '}
          <span className="text-amber-400 font-medium">
            {chainMeta(ACTIVE_CHAIN_ID).name}
          </span>
        </p>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function WalletConnect() {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // ETH balance (gas)
  const { data: ethBalance } = useBalance({ address });

  // USDC balance
  const { data: usdcRaw } = useReadContract({
    address:      USDC_ARBITRUM,
    abi:          ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args:         address ? [address] : undefined,
    query:        { enabled: !!address },
  });
  const usdcBalance = usdcRaw ? parseFloat(formatUnits(usdcRaw as bigint, 6)) : 0;

  const isCorrectChain = chainId === ACTIVE_CHAIN_ID;
  const meta = chainMeta(chainId);
  const activeMeta = chainMeta(ACTIVE_CHAIN_ID);
  const explorerBase = chainMeta(chainId).explorer;

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const switchToActive = () => switchChain({ chainId: ACTIVE_CHAIN_ID });

  // ── Not connected ─────────────────────────────────────────────────────────

  if (!isConnected || !address) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={isConnecting}
          className="border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-500/5"
        >
          {isConnecting ? (
            <RefreshCw className="h-4 w-4 sm:mr-2 animate-spin" />
          ) : (
            <Wallet className="h-4 w-4 sm:mr-2" />
          )}
          <span className="hidden sm:inline">
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </span>
        </Button>
        <ConnectorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </>
    );
  }

  // ── Connected: wrong network quick-switch button ──────────────────────────

  if (!isCorrectChain) {
    return (
      <Button
        size="sm"
        onClick={switchToActive}
        disabled={isSwitching}
        className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
      >
        {isSwitching ? (
          <RefreshCw className="h-4 w-4 sm:mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 sm:mr-2" />
        )}
        <span className="hidden sm:inline">Switch to {activeMeta.label}</span>
      </Button>
    );
  }

  // ── Connected: correct network ────────────────────────────────────────────

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 sm:mr-2" />
          <span className="hidden sm:inline">{shortAddr(address)}</span>
          <ChevronDown className="hidden sm:block h-3 w-3 ml-1 text-zinc-400" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[calc(100vw-32px)] sm:w-72 bg-zinc-900 border-zinc-800">

        {/* Address + balances */}
        <div className="px-3 py-2 space-y-1.5">
          <p className="text-sm font-mono text-zinc-100">{shortAddr(address)}</p>

          {/* ETH (gas) */}
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">ETH (gas)</span>
            <span className={`font-medium ${ethBalance && Number(ethBalance.value) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {ethBalance
                ? `${(Number(ethBalance.value) / 1e18).toFixed(4)} ETH`
                : '—'}
            </span>
          </div>

          {/* USDC */}
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">USDC (deposit)</span>
            <span className={`font-medium ${usdcBalance > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {usdcBalance.toFixed(2)} USDC
            </span>
          </div>

          {/* Network badge */}
          <div className="flex items-center gap-2 pt-0.5">
            <Badge variant="outline" className={`text-xs ${meta.color}`}>
              {meta.testnet && <FlaskConical className="h-3 w-3 mr-1" />}
              {meta.name}
            </Badge>
            <span className="text-[10px] text-emerald-400">● correct network</span>
          </div>
        </div>

        <DropdownMenuSeparator className="bg-zinc-800" />

        {/* Switch network */}
        <DropdownMenuLabel className="text-zinc-500 font-normal text-xs px-3">
          Switch network
        </DropdownMenuLabel>

        {[arbitrumSepolia, arbitrum].map(chain => {
          const cm = chainMeta(chain.id);
          const isActive = chainId === chain.id;
          const isTarget = ACTIVE_CHAIN_ID === chain.id;
          return (
            <DropdownMenuItem
              key={chain.id}
              className="cursor-pointer text-zinc-300 hover:text-zinc-100 mx-1 rounded"
              disabled={isActive}
              onClick={() => switchChain({ chainId: chain.id })}
            >
              {cm.testnet
                ? <FlaskConical className="h-4 w-4 mr-2 text-amber-400" />
                : <Globe       className="h-4 w-4 mr-2 text-sky-400" />}
              <span className="flex-1">{cm.name}</span>
              {isActive  && <span className="text-xs text-emerald-400">active</span>}
              {isTarget && !isActive && <span className="text-xs text-zinc-500">app default</span>}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator className="bg-zinc-800" />

        <DropdownMenuItem
          className="text-zinc-300 hover:text-zinc-100 cursor-pointer mx-1 rounded"
          onClick={copyAddress}
        >
          <Copy className="h-4 w-4 mr-2" />
          {copied ? 'Copied!' : 'Copy address'}
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-zinc-300 hover:text-zinc-100 cursor-pointer mx-1 rounded"
          onClick={() => window.open(`${explorerBase}/address/${address}`, '_blank', 'noopener')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View on Explorer
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-zinc-800" />

        <DropdownMenuItem
          className="text-red-400 hover:text-red-300 cursor-pointer mx-1 rounded mb-1"
          onClick={() => disconnect()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
