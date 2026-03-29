'use client';

import { useGovernance, getStatusColor, getStatusIcon } from '@/hooks/use-governance';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/contexts/i18n-context';
import { 
  Shield, TrendingUp, AlertTriangle, DollarSign, Activity,
  CheckCircle, AlertCircle, XCircle, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GovernanceGateInvestorProps {
  vaultAssetsUsd?: number;
  userAssetsUsd?: number;
}

export function GovernanceGateInvestor({ vaultAssetsUsd = 0, userAssetsUsd = 0 }: GovernanceGateInvestorProps) {
  const { t } = useI18n();
  const governance = useGovernance(vaultAssetsUsd, userAssetsUsd);

  const kpis = [
    { ...governance.investedValue, icon: DollarSign, label: 'Invested Value' },
    { ...governance.accumulatedReturn, icon: TrendingUp, label: 'Accumulated Return' },
    { ...governance.risk, icon: AlertTriangle, label: 'Risk' },
    { ...governance.costs, icon: Shield, label: 'Costs' },
    { ...governance.operationalStatus, icon: Activity, label: 'Operational Status' },
  ];

  const DecisionIcon = governance.overallDecision === 'GO' ? CheckCircle 
    : governance.overallDecision === 'WATCH' ? AlertCircle 
    : XCircle;

  return (
    <Card className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      {/* Header with Decision */}
      <div className={cn(
        'px-4 py-3 border-b',
        governance.overallDecision === 'GO' ? 'bg-emerald-500/10 border-emerald-500/20' :
        governance.overallDecision === 'WATCH' ? 'bg-amber-500/10 border-amber-500/20' :
        'bg-rose-500/10 border-rose-500/20'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-200">Validação de Lucratividade</span>
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              'text-xs font-semibold px-3 py-1 border',
              getStatusColor(governance.overallDecision)
            )}
          >
            <DecisionIcon className="h-3 w-3 mr-1" />
            {governance.overallDecision}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* 5 Simple Blocks */}
        <div className="grid grid-cols-5 gap-2">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            const statusColor = kpi.status === 'GO' ? 'text-emerald-400' 
              : kpi.status === 'WATCH' ? 'text-amber-400' 
              : 'text-rose-400';
            
            return (
              <div 
                key={kpi.label}
                className="flex flex-col items-center text-center p-2 rounded-lg bg-zinc-800/50"
              >
                <Icon className={cn('h-4 w-4 mb-1', statusColor)} />
                <span className={cn('text-lg font-bold', statusColor)}>
                  {kpi.status === 'GO' ? '✓' : kpi.status === 'WATCH' ? '⚠' : '✕'}
                </span>
                <span className="text-[10px] text-zinc-500 mt-1">{kpi.label}</span>
              </div>
            );
          })}
        </div>

        {/* Decision Reason */}
        <p className="text-xs text-zinc-400 text-center leading-relaxed">
          {governance.decisionReason}
        </p>

        {/* Risk Transparency */}
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3 mt-2">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-cyan-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              <span className="text-zinc-200 font-medium">Transparência de Risco:</span>{' '}
              Este vault utiliza estratégias de liquidez na Uniswap V3. Retornos passados não garantem resultados futuros. 
              Perda impermanente e volatilidade podem afetar a rentabilidade. APY estimado é baseado em dados históricos.
            </p>
          </div>
        </div>

        {/* Last Updated */}
        <p className="text-[10px] text-zinc-600 text-right">
          Atualizado: {governance.lastUpdated.toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  );
}
