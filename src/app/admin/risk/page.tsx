"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  ChevronUp,
  RefreshCw,
  Clock,
  DollarSign,
  TrendingUp,
  Activity,
  Zap,
  Settings,
  AlertCircle,
} from 'lucide-react';

// Types
interface PilotStatus {
  current_phase: string;
  max_capital: number;
  duration_days: number;
  vault_address: string | null;
  metrics: {
    start_time: string | null;
    start_capital: number;
    end_capital: number;
    return_pct: number;
    max_drawdown: number;
    rebalances: number;
    gas_cost: number;
  };
  phase_history: Array<{
    phase: string;
    passed: boolean;
    recommendation: string;
  }>;
  pass_criteria: Record<string, number>;
}

interface ProtectionStatus {
  paused_vaults: Record<string, string>;
  daily_stats: Record<string, {
    rebalances: number;
    gas_spent: number;
    deployed: number;
  }>;
  recent_breaches: Array<{
    type: string;
    action: string;
    message: string;
    time: string;
  }>;
  limits: {
    max_rebalances_per_day: number;
    min_minutes_between: number;
    volatility_pause: number;
    max_exposure_per_cycle: number;
  };
}

interface RiskConfig {
  version: string;
  environment: string;
  fee_tier: number;
  max_rebalances_per_day: number;
  gas_multiplier: number;
  slippage_bps: number;
}

interface RiskStatus {
  status: string;
  pilot: PilotStatus;
  protection: ProtectionStatus;
  config: RiskConfig;
}

const PHASE_LABELS: Record<string, { label: string; color: string; capital: string }> = {
  smoke_test: { label: 'Smoke Test', color: 'bg-yellow-500', capital: '$100' },
  pilot_1k: { label: 'Pilot $1K', color: 'bg-blue-500', capital: '$1,000' },
  pilot_10k: { label: 'Pilot $10K', color: 'bg-purple-500', capital: '$10,000' },
  production: { label: 'Production', color: 'bg-green-500', capital: '$50K+' },
  paused: { label: 'Paused', color: 'bg-red-500', capital: '-' },
};

const VAULTS = [
  { address: '0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C', symbol: 'USDC' },
  { address: '0x12a20d3569da6DD2d99E7bC95748283B10729c4C', symbol: 'USDT' },
];

export default function RiskManagementPage() {
  const [riskStatus, setRiskStatus] = useState<RiskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch risk status
  const fetchRiskStatus = async () => {
    try {
      const response = await fetch('/api/ai?endpoint=/risk/status');
      if (!response.ok) throw new Error('Failed to fetch risk status');
      const data = await response.json();
      setRiskStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchRiskStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // API actions
  const performAction = async (action: string, params?: Record<string, string>) => {
    setActionLoading(action);
    try {
      let url = `/api/ai?endpoint=${action}`;
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url += `&${key}=${value}`;
        });
      }
      
      const response = await fetch(url, { method: 'POST' });
      if (!response.ok) throw new Error(`Action failed: ${action}`);
      
      // Refresh status after action
      await fetchRiskStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!riskStatus) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Risk Management Unavailable</AlertTitle>
        <AlertDescription>
          {error || 'Could not load risk status. The AI engine may not be running.'}
        </AlertDescription>
      </Alert>
    );
  }

  const { pilot, protection, config } = riskStatus;
  const phaseInfo = PHASE_LABELS[pilot.current_phase] || { label: pilot.current_phase, color: 'bg-gray-500', capital: '?' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Risk Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Control and monitor system-wide risk parameters
          </p>
        </div>
        <Button variant="outline" onClick={fetchRiskStatus} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Banner */}
      {riskStatus.status !== 'ok' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Risk Management Disabled</AlertTitle>
          <AlertDescription>
            Risk management is not available. Operations will proceed without limits.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pilot" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pilot">
            <TrendingUp className="h-4 w-4 mr-2" />
            Pilot Phase
          </TabsTrigger>
          <TabsTrigger value="limits">
            <Shield className="h-4 w-4 mr-2" />
            Protection Limits
          </TabsTrigger>
          <TabsTrigger value="vaults">
            <Activity className="h-4 w-4 mr-2" />
            Vault Control
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Config
          </TabsTrigger>
        </TabsList>

        {/* PILOT PHASE TAB */}
        <TabsContent value="pilot" className="space-y-4">
          {/* Current Phase Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Current Phase</CardTitle>
                  <CardDescription>Progressive capital deployment program</CardDescription>
                </div>
                <Badge className={`${phaseInfo.color} text-white text-lg px-4 py-2`}>
                  {phaseInfo.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Phase Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Phase Progress</span>
                  <span>Max Capital: {phaseInfo.capital}</span>
                </div>
                <div className="flex gap-2">
                  {['smoke_test', 'pilot_1k', 'pilot_10k', 'production'].map((phase, i) => {
                    const info = PHASE_LABELS[phase];
                    const isActive = pilot.current_phase === phase;
                    const isPast = pilot.phase_history.some(h => h.phase === phase);
                    return (
                      <div 
                        key={phase}
                        className={`flex-1 h-3 rounded-full ${isActive ? info.color : isPast ? 'bg-green-600' : 'bg-gray-200'}`}
                        title={info.label}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Current Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Return</p>
                  <p className={`text-2xl font-bold ${pilot.metrics.return_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pilot.metrics.return_pct >= 0 ? '+' : ''}{pilot.metrics.return_pct.toFixed(2)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Max Drawdown</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {pilot.metrics.max_drawdown.toFixed(2)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Rebalances</p>
                  <p className="text-2xl font-bold">{pilot.metrics.rebalances}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Gas Cost</p>
                  <p className="text-2xl font-bold">${pilot.metrics.gas_cost.toFixed(2)}</p>
                </div>
              </div>

              {/* Pass Criteria */}
              <div>
                <h4 className="font-semibold mb-3">Pass Criteria for Next Phase</h4>
                <div className="space-y-2">
                  {Object.entries(pilot.pass_criteria).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="default" className="flex items-center gap-2">
                      <ChevronUp className="h-4 w-4" />
                      Promote to Next Phase
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Promote Pilot Phase?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will increase the maximum allowed capital. Make sure current phase has met all criteria.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => performAction('/risk/pilot/promote')}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === '/risk/pilot/promote' ? 'Promoting...' : 'Promote'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {pilot.current_phase !== 'paused' ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex items-center gap-2">
                        <Pause className="h-4 w-4" />
                        Pause Pilot
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Pause Pilot Operations?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will stop all rebalance operations until manually resumed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => performAction('/risk/pilot/pause?reason=Manual%20pause%20from%20admin')}
                          className="bg-destructive text-destructive-foreground"
                          disabled={actionLoading !== null}
                        >
                          {actionLoading === '/risk/pilot/pause' ? 'Pausing...' : 'Pause'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={() => performAction('/risk/pilot/resume')}
                    disabled={actionLoading !== null}
                  >
                    <Play className="h-4 w-4" />
                    {actionLoading === '/risk/pilot/resume' ? 'Resuming...' : 'Resume Pilot'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Phase History */}
          <Card>
            <CardHeader>
              <CardTitle>Phase History</CardTitle>
            </CardHeader>
            <CardContent>
              {pilot.phase_history.length === 0 ? (
                <p className="text-muted-foreground">No phase transitions yet.</p>
              ) : (
                <div className="space-y-2">
                  {pilot.phase_history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b">
                      <div className="flex items-center gap-2">
                        {h.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <Badge variant="outline">{PHASE_LABELS[h.phase]?.label || h.phase}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{h.recommendation}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROTECTION LIMITS TAB */}
        <TabsContent value="limits" className="space-y-4">
          {/* Active Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Active Protection Limits</CardTitle>
              <CardDescription>Hard limits that cannot be bypassed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Max Rebalances per Day</p>
                      <p className="text-sm text-muted-foreground">Prevents excessive gas costs</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{protection.limits.max_rebalances_per_day}</p>
                    <Badge variant="destructive">BLOCK</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-medium">Min Time Between Rebalances</p>
                      <p className="text-sm text-muted-foreground">Cooldown period</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{protection.limits.min_minutes_between} min</p>
                    <Badge variant="destructive">BLOCK</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="font-medium">Volatility Pause Threshold</p>
                      <p className="text-sm text-muted-foreground">Stops operations in extreme markets</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{(protection.limits.volatility_pause * 100).toFixed(0)}%</p>
                    <Badge variant="destructive">PAUSE</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Max Exposure per Cycle</p>
                      <p className="text-sm text-muted-foreground">Limits capital at risk</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{protection.limits.max_exposure_per_cycle}%</p>
                    <Badge variant="secondary">WARN</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Breaches */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Limit Breaches</CardTitle>
            </CardHeader>
            <CardContent>
              {protection.recent_breaches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                  <p>No recent limit breaches</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {protection.recent_breaches.map((breach, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`h-4 w-4 ${breach.action === 'block' || breach.action === 'pause' ? 'text-red-600' : 'text-yellow-600'}`} />
                        <span className="text-sm">{breach.message}</span>
                      </div>
                      <Badge variant={breach.action === 'block' ? 'destructive' : 'secondary'}>
                        {breach.action.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VAULT CONTROL TAB */}
        <TabsContent value="vaults" className="space-y-4">
          {VAULTS.map((vault) => {
            const isPaused = protection.paused_vaults[vault.address];
            const today = new Date().toISOString().split('T')[0];
            const statsKey = `${vault.address}:${today}`;
            const stats = protection.daily_stats[statsKey];

            return (
              <Card key={vault.address}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {vault.symbol} Vault
                        {isPaused && <Badge variant="destructive">PAUSED</Badge>}
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {vault.address}
                      </CardDescription>
                    </div>
                    {isPaused ? (
                      <Button 
                        variant="outline"
                        onClick={() => performAction(`/risk/vault/${vault.address}/resume`)}
                        disabled={actionLoading !== null}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Pause {vault.symbol} Vault?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will stop all rebalance operations for this vault.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => performAction(`/risk/vault/${vault.address}/pause?reason=Manual%20pause`)}
                              className="bg-destructive text-destructive-foreground"
                              disabled={actionLoading !== null}
                            >
                              Pause
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isPaused && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Vault Paused</AlertTitle>
                      <AlertDescription>Reason: {isPaused}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Today's Rebalances</p>
                      <p className="text-2xl font-bold">{stats?.rebalances || 0}</p>
                      <p className="text-xs text-muted-foreground">/ {protection.limits.max_rebalances_per_day} max</p>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Gas Spent</p>
                      <p className="text-2xl font-bold">${stats?.gas_spent.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Deployed</p>
                      <p className="text-2xl font-bold">${stats?.deployed.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>

                  {/* Circuit Breaker Reset */}
                  <div className="mt-4 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => performAction(`/risk/circuit-breaker/${vault.address}/reset`)}
                      disabled={actionLoading !== null}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset Circuit Breaker
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* CONFIG TAB */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shared Configuration</CardTitle>
              <CardDescription>
                These parameters are shared between backtest and production to ensure consistent results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Config Version</p>
                    <p className="text-xl font-bold">{config.version}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Environment</p>
                    <p className="text-xl font-bold capitalize">{config.environment}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>Fee Tier</span>
                    <Badge variant="outline">{config.fee_tier} ({(config.fee_tier / 10000).toFixed(2)}%)</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>Max Rebalances per Day</span>
                    <Badge variant="outline">{config.max_rebalances_per_day}</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>Gas Cost Multiplier</span>
                    <Badge variant="outline">{config.gas_multiplier}x</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>Slippage</span>
                    <Badge variant="outline">{config.slippage_bps} bps</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Settings className="h-4 w-4" />
            <AlertTitle>Configuration Changes</AlertTitle>
            <AlertDescription>
              To modify these values, update the environment variables in Coolify with the <code className="bg-muted px-1 rounded">RISK_</code> prefix.
              Example: <code className="bg-muted px-1 rounded">RISK_MAX_REBALANCES_PER_DAY=5</code>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
