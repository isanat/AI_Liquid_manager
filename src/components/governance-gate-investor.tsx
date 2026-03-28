"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Shield,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
} from 'lucide-react';
import { useGovernanceGate, getGovernanceMessages, type GovernanceStatus } from '@/hooks/use-governance';

const statusConfig: Record<GovernanceStatus, { color: string; bg: string; border: string; icon: typeof CheckCircle }> = {
  GO: { 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-50 dark:bg-emerald-950/30', 
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle 
  },
  WATCH: { 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-50 dark:bg-amber-950/30', 
    border: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle 
  },
  'NO-GO': { 
    color: 'text-red-600 dark:text-red-400', 
    bg: 'bg-red-50 dark:bg-red-950/30', 
    border: 'border-red-200 dark:border-red-800',
    icon: XCircle 
  },
};

export function GovernanceGateInvestor() {
  const { result, refresh } = useGovernanceGate();

  if (!result) {
    return (
      <Card className="bg-white dark:bg-slate-900 shadow-lg">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Verificando estratégia...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = statusConfig[result.status];
  const Icon = config.icon;
  const messages = getGovernanceMessages(result.status, 'investor');

  return (
    <Card className={`${config.bg} ${config.border}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Validação da Estratégia
          </CardTitle>
          <Badge className={`${config.bg} ${config.color} border-current`}>
            <Icon className="h-3 w-3 mr-1" />
            {result.status}
          </Badge>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Status atual da estratégia para novos aportes
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Message */}
        <div className={`p-4 rounded-lg ${config.bg} border ${config.border}`}>
          <p className={`font-medium ${config.color}`}>
            {messages.main}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {messages.secondary}
          </p>
        </div>

        {/* Simple Status Lines */}
        <div className="space-y-2">
          <StatusLine 
            label="Retorno" 
            status={result.checks.find(c => c.name.includes('Retorno'))?.status || 'GO'} 
            message={messages.lines.retorno}
          />
          <StatusLine 
            label="Risco" 
            status={result.checks.find(c => c.name.includes('Drawdown'))?.status || 'GO'} 
            message={messages.lines.risco}
          />
          <StatusLine 
            label="Operação" 
            status={result.checks.find(c => c.name.includes('Saúde'))?.status || 'GO'} 
            message={messages.lines.operacao}
          />
        </div>

        {/* CTA & Timestamp */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500">
            Atualizado em {result.lastValidated.toLocaleTimeString('pt-BR')}
          </p>
          <Button variant="ghost" size="sm" onClick={refresh} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            Atualizar
          </Button>
        </div>

        {/* Action Recommendation */}
        <div className={`text-center p-3 rounded-lg ${config.bg}`}>
          <p className={`text-sm font-medium ${config.color}`}>
            {messages.cta}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusLine({ label, status, message }: { label: string; status: GovernanceStatus; message: string }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${config.color}`} />
        <span className={config.color}>{message}</span>
      </div>
    </div>
  );
}

export default GovernanceGateInvestor;
