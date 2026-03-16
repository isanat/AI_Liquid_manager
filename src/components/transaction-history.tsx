'use client';

import { useVaultHistory } from '@/hooks/use-vault-history';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowDownLeft, ArrowUpRight, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { ACTIVE_CHAIN_ID } from '@/components/wallet-connect';
import { CardInfo } from '@/components/card-info';
import { useI18n } from '@/contexts/i18n-context';

const EXPLORER = ACTIVE_CHAIN_ID === 421614
  ? 'https://sepolia.arbiscan.io'
  : 'https://arbiscan.io';

export function TransactionHistory() {
  const { isConnected } = useAccount();
  const { history, loading, error, refresh } = useVaultHistory();
  const { t } = useI18n();

  if (!isConnected) return null;

  return (
    <Card id="history" className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/5">
              <Clock className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">My Vault History</CardTitle>
              <CardInfo tip={t('vaultHistory.card')} />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-zinc-400 hover:text-zinc-100"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2">
        {loading && (
          <div className="flex items-center justify-center py-6 text-xs text-zinc-500">
            <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
            Loading on-chain history…
          </div>
        )}

        {error && !loading && (
          <p className="text-xs text-rose-400 text-center py-4">{error}</p>
        )}

        {!loading && !error && history.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-6">
            No deposits or withdrawals found for this wallet.
          </p>
        )}

        {!loading && history.length > 0 && (
          <div className="space-y-2">
            {history.map((tx, i) => (
              <div
                key={`${tx.txHash}-${i}`}
                className="flex items-center justify-between p-2.5 rounded-lg bg-background/40 border border-border/40"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${
                    tx.type === 'deposit'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {tx.type === 'deposit'
                      ? <ArrowDownLeft className="h-3.5 w-3.5" />
                      : <ArrowUpRight   className="h-3.5 w-3.5" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-none">
                      {tx.type === 'deposit' ? '+' : '-'}
                      {parseFloat(tx.assetsFormatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                    </p>
                    <p className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5">
                      <span className="flex items-center gap-0.5">
                        {parseFloat(tx.sharesFormatted).toFixed(4)} vAI shares
                        <CardInfo tip={t('vaultHistory.vaiShares')} />
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        block {tx.blockNumber.toString()}
                        <CardInfo tip={t('vaultHistory.blockNumber')} />
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      tx.type === 'deposit'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {tx.type}
                  </Badge>
                  <a
                    href={`${EXPLORER}/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-zinc-300"
                    title="View on explorer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
