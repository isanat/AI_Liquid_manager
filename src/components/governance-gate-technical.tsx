'use client';

import { useGovernance, getStatusColor, getStatusIcon, type GovernanceDecision } from '@/hooks/use-governance';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/contexts/i18n-context';
import { 
  Shield, TrendingUp, AlertTriangle, DollarSign, Activity,
  CheckCircle, AlertCircle, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GovernanceGateTechnicalProps {
  vaultAssetsUsd?: number;
  userAssetsUsd?: number;
}

export function GovernanceGateTechnical({ vaultAssetsUsd = 0, userAssetsUsd = 0 }: GovernanceGateTechnicalProps) {
  const { t } = useI18n();
  const governance = useGovernance(vaultAssetsUsd, userAssetsUsd);

  const kpis = [
    { ...governance.investedValue, icon: DollarSign },
    { ...governance.accumulatedReturn, icon: TrendingUp },
    { ...governance.risk, icon: AlertTriangle },
    { ...governance.costs, icon: Shield },
    { ...governance.operationalStatus, icon: Activity },
  ];

  const DecisionIcon = governance.overallDecision === 'GO' ? CheckCircle 
    : governance.overallDecision === 'WATCH' ? AlertCircle 
    : XCircle;

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Governance Gate</CardTitle>
              <CardDescription>KPIs + Limites + Critérios GO/NO-GO</CardDescription>
            </div>
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
      </CardHeader>
      
      <CardContent className="space-y-4 p-4 sm:p-6">
        {/* Overall Decision Banner */}
        <div className={cn(
          'rounded-lg p-3 border',
          getStatusColor(governance.overallDecision)
        )}>
          <p className="text-sm font-medium">{governance.decisionReason}</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div 
                key={kpi.label}
                className={cn(
                  'rounded-lg p-3 border',
                  getStatusColor(kpi.status)
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{kpi.label}</span>
                  </div>
                  <span className="text-lg font-bold">
                    {kpi.status === 'GO' ? '✓' : kpi.status === 'WATCH' ? '⚠' : '✕'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-xl font-bold">
                    {kpi.unit === 'USD' ? '$' : ''}{kpi.value.toFixed(kpi.unit === 'USD' ? 0 : 1)}{kpi.unit === '%/yr' ? '%/yr' : kpi.unit === '%' ? '%' : ''}
                  </span>
                </div>
                <p className="text-xs opacity-80 leading-relaxed">{kpi.description}</p>
                
                {/* Progress bar showing position in range */}
                <div className="mt-2">
                  <Progress 
                    value={Math.min(100, (kpi.value / kpi.threshold.go) * 100)} 
                    className="h-1"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Thresholds Reference */}
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-2">Thresholds Reference:</p>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-emerald-400">GO:</span> Value ≥ threshold</div>
            <div><span className="text-rose-400">NO-GO:</span> Value below minimum</div>
          </div>
        </div>

        {/* Last Updated */}
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {governance.lastUpdated.toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  );
}
