'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { VAULT_ADDRESS } from '@/lib/vault-contract';

export interface VaultTx {
  type: 'deposit' | 'withdraw';
  assets: bigint;
  shares: bigint;
  assetsFormatted: string;
  sharesFormatted: string;
  txHash: `0x${string}`;
  blockNumber: bigint;
}

const DEPOSIT_EVENT = {
  type: 'event' as const,
  name: 'Deposit',
  inputs: [
    { name: 'sender',   type: 'address' as const, indexed: true  },
    { name: 'owner',    type: 'address' as const, indexed: true  },
    { name: 'assets',   type: 'uint256' as const, indexed: false },
    { name: 'shares',   type: 'uint256' as const, indexed: false },
  ],
};

const WITHDRAW_EVENT = {
  type: 'event' as const,
  name: 'Withdraw',
  inputs: [
    { name: 'sender',   type: 'address' as const, indexed: true  },
    { name: 'receiver', type: 'address' as const, indexed: true  },
    { name: 'owner',    type: 'address' as const, indexed: true  },
    { name: 'assets',   type: 'uint256' as const, indexed: false },
    { name: 'shares',   type: 'uint256' as const, indexed: false },
  ],
};

export function useVaultHistory() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [history, setHistory] = useState<VaultTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!address || !publicClient || !VAULT_ADDRESS) return;
    setLoading(true);
    setError(null);
    try {
      const [deposits, withdrawals] = await Promise.all([
        publicClient.getLogs({
          address: VAULT_ADDRESS,
          event: DEPOSIT_EVENT,
          args: { owner: address },
          fromBlock: 'earliest',
        }),
        publicClient.getLogs({
          address: VAULT_ADDRESS,
          event: WITHDRAW_EVENT,
          args: { owner: address },
          fromBlock: 'earliest',
        }),
      ]);

      const txs: VaultTx[] = [
        ...deposits.map(log => ({
          type: 'deposit' as const,
          assets: (log.args as { assets: bigint }).assets,
          shares: (log.args as { shares: bigint }).shares,
          assetsFormatted: formatUnits((log.args as { assets: bigint }).assets, 6),
          sharesFormatted: formatUnits((log.args as { shares: bigint }).shares, 18),
          txHash: log.transactionHash as `0x${string}`,
          blockNumber: log.blockNumber as bigint,
        })),
        ...withdrawals.map(log => ({
          type: 'withdraw' as const,
          assets: (log.args as { assets: bigint }).assets,
          shares: (log.args as { shares: bigint }).shares,
          assetsFormatted: formatUnits((log.args as { assets: bigint }).assets, 6),
          sharesFormatted: formatUnits((log.args as { shares: bigint }).shares, 18),
          txHash: log.transactionHash as `0x${string}`,
          blockNumber: log.blockNumber as bigint,
        })),
      ].sort((a, b) => Number(b.blockNumber - a.blockNumber));

      setHistory(txs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { history, loading, error, refresh: fetch };
}
