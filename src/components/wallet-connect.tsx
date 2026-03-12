'use client';

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain, useBalance } from 'wagmi';
import { mainnet, arbitrum } from 'wagmi/chains';
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
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ─── Chain badge colour ───────────────────────────────────────────────────────

function chainColor(chainId: number): string {
  const map: Record<number, string> = {
    1:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
    42161: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    8453:  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    10:    'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return map[chainId] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
}

function chainName(chainId: number): string {
  const map: Record<number, string> = {
    1:     'Ethereum',
    42161: 'Arbitrum',
    8453:  'Base',
    10:    'Optimism',
  };
  return map[chainId] ?? `Chain ${chainId}`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Connector picker dialog ──────────────────────────────────────────────────

function ConnectorDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { connect, connectors, isPending } = useConnect();

  const labelFor = (id: string) => {
    if (id.includes('metaMask') || id === 'injected') return 'MetaMask';
    if (id.includes('coinbase'))   return 'Coinbase Wallet';
    if (id.includes('walletConnect')) return 'WalletConnect';
    return id;
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Connect Wallet</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          {connectors.map(connector => (
            <Button
              key={connector.id}
              variant="outline"
              className="justify-start border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800"
              disabled={isPending}
              onClick={() => {
                connect({ connector });
                onClose();
              }}
            >
              <Wallet className="h-4 w-4 mr-2 text-emerald-400" />
              {labelFor(connector.id)}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function WalletConnect() {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: balance } = useBalance({ address, chainId });

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Wallet className="h-4 w-4 mr-2" />
          )}
          {isConnecting ? 'Connecting…' : 'Connect'}
        </Button>
        <ConnectorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
          {shortAddr(address)}
          <ChevronDown className="h-3 w-3 ml-2 text-zinc-400" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 bg-zinc-900 border-zinc-800"
      >
        <DropdownMenuLabel className="text-zinc-400 font-normal text-xs">
          Connected
        </DropdownMenuLabel>

        {/* Address */}
        <div className="px-2 py-1.5">
          <p className="text-sm font-mono text-zinc-100">{shortAddr(address)}</p>
          {balance && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {(Number(balance.value) / 10 ** balance.decimals).toFixed(4)} {balance.symbol}
            </p>
          )}
        </div>

        {/* Chain */}
        <div className="px-2 py-1.5">
          <Badge variant="outline" className={`text-xs ${chainColor(chainId)}`}>
            {chainName(chainId)}
          </Badge>
        </div>

        <DropdownMenuSeparator className="bg-zinc-800" />

        {/* Actions */}
        <DropdownMenuItem
          className="text-zinc-300 hover:text-zinc-100 cursor-pointer"
          onClick={copyAddress}
        >
          <Copy className="h-4 w-4 mr-2" />
          {copied ? 'Copied!' : 'Copy address'}
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-zinc-300 hover:text-zinc-100 cursor-pointer"
          onClick={() =>
            window.open(
              `https://etherscan.io/address/${address}`,
              '_blank',
              'noopener',
            )
          }
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View on Etherscan
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-zinc-800" />

        {/* Switch chains */}
        <DropdownMenuLabel className="text-zinc-500 font-normal text-xs">
          Switch network
        </DropdownMenuLabel>

        {[mainnet, arbitrum].map(chain => (
          <DropdownMenuItem
            key={chain.id}
            className="text-zinc-300 hover:text-zinc-100 cursor-pointer"
            disabled={chainId === chain.id}
            onClick={() => switchChain({ chainId: chain.id })}
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                chainId === chain.id ? 'bg-emerald-500' : 'bg-zinc-600'
              }`}
            />
            {chain.name}
            {chainId === chain.id && (
              <span className="ml-auto text-xs text-emerald-400">active</span>
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="bg-zinc-800" />

        <DropdownMenuItem
          className="text-red-400 hover:text-red-300 cursor-pointer"
          onClick={() => disconnect()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
