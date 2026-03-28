"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Shield,
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { useGovernanceGate, getGovernanceMessages, type GovernanceStatus, type GovernanceCheck } from '@/hooks/use-governance';

const statusConfig: Record<GovernanceStatus, { color: string; bg: string; border: string; icon: typeof CheckCircle }> = {
  GO: { 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/30',
    icon: CheckCircle 
  },
  WATCH: { 
    color: 'text-amber-500', 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/30',
    icon: AlertTriangle 
  },
  'NO-GO': { 
    color: 'text-red-500', 
    bg: 'bg-red-500/10', 
    border: 'border-red-500/30',
    icon: XCircle 
  },
};

interface GovernanceGateTechnicalProps {
  onExecute?: () => void;
  isLoading?: boolean;
}

export function GovernanceGateTechnical({ onExecute, isLoading }: GovernanceGateTechnicalProps) {
  const { result, refresh } = useGovernanceGate();

  if (!result) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Avaliando governança...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = statusConfig[result.status];
  const Icon = config.icon;
  const messages = getGovernanceMessages(result.status, 'technical');

  return (
    <Card className={`bg-gradient-to-br from-card to-card/50 ${config.border}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Shield className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-lg">Governance Gate</CardTitle>
              <CardDescription>Validação operacional e financeira</CardDescription>
            </div>
          </div>
          <Badge className={`${config.bg} ${config.color} border-current`}>
            <Icon className="h-3 w-3 mr-1" />
            {result.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Alert */}
        <Alert className={`${config.bg} ${config.border}`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
          <AlertTitle className={config.color}>
            {result.status === 'GO' && 'Aprovado'}
            {result.status === 'WATCH' && 'Em Observação'}
            {result.status === 'NO-GO' && 'Bloqueado'}
          </AlertTitle>
          <AlertDescription className="text-sm">
            {messages.main}
          </AlertDescription>
        </Alert>

        {/* Metrics Grid */}
        <div className="space-y-3">
          {result.checks.map((check) => (
            <MetricRow key={check.name} check={check} />
          ))}
        </div>

        {/* Secondary Message */}
        <p className="text-xs text-muted-foreground border-t pt-3">
          {messages.secondary}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Última validação: {result.lastValidated.toLocaleTimeString('pt-BR')}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCw className="h-3 w-3" />
            </Button>
            {onExecute && (
              <Button 
                size="sm" 
                onClick={onExecute}
                disabled={isLoading || result.status === 'NO-GO'}
                className={result.status === 'GO' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                {isLoading ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Activity className="h-3 w-3 mr-1" />
                )}
                {messages.cta}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricRow({ check }: { check: GovernanceCheck }) {
  const config = statusConfig[check.status];
  const Icon = config.icon;
  const isPercent = check.unit === '%';
  
  // Calculate progress bar value
  const range = check.limit.watch - check.limit.go;
  const progress = isPercent 
    ? Math.min(100, (check.value / check.limit.critical) * 100)
    : Math.min(100, (check.value / check.limit.critical) * 100);

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${config.color}`} />
        <span className="text-muted-foreground">{check.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-medium ${config.color}`}>
          {check.value.toFixed(2)}{check.unit}
        </span>
        <div className="w-16">
          <Progress 
            value={progress} 
            className={`h-1.5 ${check.status === 'NO-GO' ? 'bg-red-100 dark:bg-red-950' : ''}`}
          />
        </div>
      </div>
    </div>
  );
}

export default GovernanceGateTechnical;
