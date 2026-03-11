'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  Clock,
  Coins,
  Droplets,
  Gauge,
  Layers,
  LineChart,
  Minus,
  Play,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useLiquidityStore } from '@/lib/liquidity-store';
import { cn } from '@/lib/utils';

// Animated number component
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 2 }: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  
  useEffect(() => {
    const start = displayValue;
    const end = value;
    const duration = 500;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value]);
  
  return (
    <span>
      {prefix}{displayValue.toLocaleString('en-US', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
      })}{suffix}
    </span>
  );
}

// Status indicator with pulse animation
function StatusIndicator({ status, label }: { status: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "w-2 h-2 rounded-full",
        status ? "bg-emerald-500" : "bg-red-500"
      )}>
        {status && (
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute" />
        )}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// Main metric card
function MetricCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  prefix = '', 
  suffix = '',
  color = 'emerald',
}: { 
  title: string;
  value: number;
  change?: number;
  icon: React.ElementType;
  prefix?: string;
  suffix?: string;
  color?: 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan';
}) {
  const colorClasses = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-400',
    violet: 'from-violet-500/20 to-violet-500/5 text-violet-400',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-400',
    cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-400',
  };
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="text-2xl font-bold tracking-tight">
              <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
            </div>
            {change !== undefined && (
              <div className={cn(
                "flex items-center gap-1 text-sm",
                change >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {change >= 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                <span>{Math.abs(change).toFixed(2)}%</span>
              </div>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl bg-gradient-to-br",
            colorClasses[color]
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Vault Manager Component
function VaultManager() {
  const { vault, deposit, withdraw } = useLiquidityStore();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5">
              <Shield className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Vault Manager</CardTitle>
              <CardDescription>Capital custody & accounting</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Assets</p>
            <p className="text-xl font-bold">
              <AnimatedNumber value={vault.totalAssets} prefix="$" decimals={0} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">NAV per Share</p>
            <p className="text-xl font-bold">
              <AnimatedNumber value={vault.nav} prefix="$" />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Shares</p>
            <p className="text-xl font-bold">
              <AnimatedNumber value={vault.totalShares} decimals={0} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Investors</p>
            <p className="text-xl font-bold">{vault.investors}</p>
          </div>
        </div>
        
        <Separator className="bg-border/50" />
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <input
              type="number"
              placeholder="Amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background/50 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <Button 
              size="sm" 
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                if (depositAmount) {
                  deposit(parseFloat(depositAmount), 'investor');
                  setDepositAmount('');
                }
              }}
            >
              Deposit
            </Button>
          </div>
          <div className="space-y-2">
            <input
              type="number"
              placeholder="Shares"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background/50 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
            <Button 
              size="sm" 
              variant="destructive"
              className="w-full"
              onClick={() => {
                if (withdrawAmount) {
                  withdraw(parseFloat(withdrawAmount), 'investor');
                  setWithdrawAmount('');
                }
              }}
            >
              Withdraw
            </Button>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Last Rebalance: {vault.lastRebalance.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}

// Strategy Controller Component
function StrategyController() {
  const { currentCycle, startCycle, executeRebalance, systemStatus } = useLiquidityStore();
  const [cyclePhase, setCyclePhase] = useState(0);
  
  const phases = [
    { name: 'Data Collection', icon: Activity, key: 'data-collection' },
    { name: 'AI Inference', icon: Brain, key: 'ai-inference' },
    { name: 'Range Optimization', icon: Target, key: 'range-optimization' },
    { name: 'Execution', icon: Zap, key: 'execution' },
  ];
  
  useEffect(() => {
    if (currentCycle) {
      const interval = setInterval(() => {
        setCyclePhase(prev => {
          if (prev < phases.length - 1) return prev + 1;
          return 0;
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentCycle]);
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5">
              <Layers className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Strategy Controller</CardTitle>
              <CardDescription>Orchestration engine</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20">
            {currentCycle ? 'Running' : 'Idle'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          {phases.map((phase, i) => {
            const isActive = currentCycle && i === cyclePhase;
            const isComplete = currentCycle && i < cyclePhase;
            return (
              <div key={phase.key} className="flex-1">
                <motion.div
                  className={cn(
                    "h-2 rounded-full",
                    isActive ? "bg-violet-500" : isComplete ? "bg-emerald-500" : "bg-muted"
                  )}
                  animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1 }}
                />
              </div>
            );
          })}
        </div>
        
        <div className="space-y-2">
          {phases.map((phase, i) => {
            const isActive = currentCycle && i === cyclePhase;
            const Icon = phase.icon;
            return (
              <div
                key={phase.key}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg transition-colors",
                  isActive ? "bg-violet-500/10" : "bg-transparent"
                )}
              >
                <Icon className={cn(
                  "h-4 w-4",
                  isActive ? "text-violet-400" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {phase.name}
                </span>
                {isActive && (
                  <motion.div
                    className="ml-auto"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <Clock className="h-4 w-4 text-violet-400" />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
        
        <Separator className="bg-border/50" />
        
        <div className="grid grid-cols-2 gap-2">
          <div className="text-xs">
            <p className="text-muted-foreground">Cycle Interval</p>
            <p className="font-medium">15 minutes</p>
          </div>
          <div className="text-xs">
            <p className="text-muted-foreground">Next Run</p>
            <p className="font-medium">In 8 min</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-violet-600 hover:bg-violet-700"
            onClick={startCycle}
            disabled={!!currentCycle}
          >
            <Play className="h-4 w-4 mr-1" />
            Run Cycle
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={executeRebalance}
          >
            Rebalance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// AI Strategy Engine Component
function AIStrategyEngine() {
  const { aiInputs, aiOutputs, marketData } = useLiquidityStore();
  
  const inputBars = [
    { label: 'Volatility 1D', value: aiInputs.volatility1d * 100, max: 10 },
    { label: 'Volatility 7D', value: aiInputs.volatility7d * 100, max: 15 },
    { label: 'Volume Score', value: (aiInputs.volume / 20000000) * 100, max: 100 },
    { label: 'Liquidity Depth', value: (aiInputs.liquidityDepth / 30000000) * 100, max: 100 },
  ];
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/5">
              <Brain className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Strategy Engine</CardTitle>
              <CardDescription>Parameter generation</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
            LightGBM
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-3">Model Inputs</p>
          <div className="space-y-3">
            {inputBars.map((bar) => (
              <div key={bar.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{bar.label}</span>
                  <span>{bar.value.toFixed(1)}%</span>
                </div>
                <Progress value={bar.value} className="h-1.5" />
              </div>
            ))}
          </div>
        </div>
        
        <Separator className="bg-border/50" />
        
        <div>
          <p className="text-xs text-muted-foreground mb-3">Model Outputs</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-background/50 border border-border/50">
              <p className="text-xs text-muted-foreground">Range Width</p>
              <p className="text-lg font-bold text-cyan-400">±{aiOutputs.rangeWidth.toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/50">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-lg font-bold text-emerald-400">
                {(aiOutputs.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 text-cyan-400 mt-0.5" />
            <p className="text-xs text-cyan-300">{aiOutputs.reasoning}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-2 py-1 rounded text-xs",
            aiInputs.volumeSpike ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"
          )}>
            {aiInputs.volumeSpike ? 'Volume Spike Detected' : 'Normal Volume'}
          </div>
          <div className={cn(
            "px-2 py-1 rounded text-xs",
            aiInputs.trendDirection === 'up' ? "bg-emerald-500/20 text-emerald-400" :
            aiInputs.trendDirection === 'down' ? "bg-rose-500/20 text-rose-400" :
            "bg-muted text-muted-foreground"
          )}>
            Trend: {aiInputs.trendDirection.toUpperCase()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Range Optimizer Component
function RangeOptimizer() {
  const { ranges, marketData, aiOutputs } = useLiquidityStore();
  const price = marketData.price;
  
  const rangeColors = {
    core: '#10b981',
    defensive: '#f59e0b',
    opportunistic: '#8b5cf6',
  };
  
  const pieData = ranges.map(r => ({
    name: r.type.charAt(0).toUpperCase() + r.type.slice(1),
    value: r.percentage,
    fill: rangeColors[r.type],
  }));
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
              <Target className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Range Optimizer</CardTitle>
              <CardDescription>Tick calculation & allocation</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <PieChart width={160} height={160}>
            <Pie
              data={pieData}
              cx={80}
              cy={80}
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => [`${value}%`, 'Allocation']}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            />
          </PieChart>
          <div className="space-y-2 ml-4">
            {ranges.map((range) => (
              <div key={range.type} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: rangeColors[range.type] }}
                />
                <span className="text-xs capitalize">{range.type}</span>
                <span className="text-xs text-muted-foreground">{range.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
        
        <Separator className="bg-border/50" />
        
        <div className="space-y-3">
          {ranges.map((range) => (
            <div 
              key={range.type}
              className="p-3 rounded-lg bg-background/50 border border-border/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium capitalize">{range.type} Range</span>
                <Badge 
                  variant="outline" 
                  style={{ 
                    borderColor: rangeColors[range.type] + '40',
                    color: rangeColors[range.type]
                  }}
                >
                  {range.type === 'core' ? '±6%' : range.type === 'defensive' ? '±20%' : '±2%'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>${range.priceLower.toFixed(2)}</span>
                <span className="text-foreground font-medium">${price.toFixed(2)}</span>
                <span>${range.priceUpper.toFixed(2)}</span>
              </div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: rangeColors[range.type] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${range.percentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Execution Engine Component
function ExecutionEngine() {
  const { positions, recentExecutions, collectFees } = useLiquidityStore();
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-500/5">
              <Zap className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Execution Engine</CardTitle>
              <CardDescription>Position management & transactions</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Active Positions</p>
          <ScrollArea className="h-40">
            {positions.map((pos) => (
              <div
                key={pos.id}
                className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50 mb-2"
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    pos.inRange ? "bg-emerald-500" : "bg-rose-500"
                  )} />
                  <div>
                    <p className="text-sm font-medium">{pos.pool}</p>
                    <p className="text-xs text-muted-foreground">
                      {pos.token0Amount.toFixed(2)} ETH + {pos.token1Amount.toFixed(0)} USDC
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-emerald-400">
                    +{pos.feesEarned0.toFixed(4)} ETH
                  </p>
                  <p className="text-xs text-emerald-400">
                    +{pos.feesEarned1.toFixed(2)} USDC
                  </p>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
        
        <Separator className="bg-border/50" />
        
        <div>
          <p className="text-xs text-muted-foreground mb-2">Recent Executions</p>
          <div className="space-y-1">
            {recentExecutions.length > 0 ? (
              recentExecutions.slice(0, 3).map((exec) => (
                <div key={exec.id} className="flex items-center justify-between text-xs">
                  <span className="capitalize">{exec.type}</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      exec.status === 'completed' ? "border-emerald-500/50 text-emerald-400" :
                      exec.status === 'pending' ? "border-amber-500/50 text-amber-400" :
                      "border-rose-500/50 text-rose-400"
                    )}
                  >
                    {exec.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No recent executions</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Risk Dashboard Component
function RiskDashboard() {
  const { riskMetrics, regime } = useLiquidityStore();
  
  const regimeColors = {
    'trend': 'text-emerald-400',
    'range': 'text-amber-400',
    'high-vol': 'text-rose-400',
    'low-vol': 'text-cyan-400',
  };
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-500/5">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Risk Dashboard</CardTitle>
              <CardDescription>IL, metrics & regime detection</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Market Regime</span>
            <Badge 
              variant="outline"
              className={cn("capitalize", regimeColors[regime.type])}
            >
              {regime.type.replace('-', ' ')}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Trend</p>
              <p className="font-medium">{(regime.indicators.trendStrength * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vol</p>
              <p className="font-medium">{(regime.indicators.volatilityLevel * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Volume</p>
              <p className="font-medium">{(regime.indicators.volumeProfile * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-background/50 border border-border/50">
            <p className="text-xs text-muted-foreground">Impermanent Loss</p>
            <p className="text-lg font-bold text-rose-400">
              {(riskMetrics.impermanentLoss * 100).toFixed(2)}%
            </p>
          </div>
          <div className="p-3 rounded-lg bg-background/50 border border-border/50">
            <p className="text-xs text-muted-foreground">Max Drawdown</p>
            <p className="text-lg font-bold text-amber-400">
              {(riskMetrics.maxDrawdown * 100).toFixed(1)}%
            </p>
          </div>
          <div className="p-3 rounded-lg bg-background/50 border border-border/50">
            <p className="text-xs text-muted-foreground">Sharpe Ratio</p>
            <p className="text-lg font-bold text-emerald-400">
              {riskMetrics.sharpeRatio.toFixed(2)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-background/50 border border-border/50">
            <p className="text-xs text-muted-foreground">VaR 95%</p>
            <p className="text-lg font-bold text-cyan-400">
              {(riskMetrics.var95 * 100).toFixed(1)}%
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Rebalance Score</span>
            <span>0.42 / 0.65 threshold</span>
          </div>
          <Progress value={65} className="h-2" />
          <p className="text-xs text-muted-foreground">
            No rebalance needed until score exceeds threshold
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Price Chart Component
function PriceChart() {
  const { marketData } = useLiquidityStore();
  
  // Generate mock price history
  const priceHistory = Array.from({ length: 48 }, (_, i) => ({
    time: new Date(Date.now() - (47 - i) * 3600000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    price: marketData.price * (0.98 + Math.random() * 0.04),
    volume: 500000 + Math.random() * 500000,
  }));
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm col-span-full lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
              <LineChart className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg">ETH/USDC Price</CardTitle>
              <CardDescription>24h price action with volume</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold">${marketData.price.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Current Price</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={priceHistory}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="time" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={10}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={10}
              tickLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#priceGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Data Layer Component
function DataLayer() {
  const { marketData, poolData, updateMarketData } = useLiquidityStore();
  
  useEffect(() => {
    const interval = setInterval(updateMarketData, 5000);
    return () => clearInterval(interval);
  }, [updateMarketData]);
  
  const dataPoints = [
    { label: 'Price', value: `$${marketData.price.toFixed(2)}`, icon: Coins },
    { label: 'Tick', value: marketData.tick.toLocaleString(), icon: Target },
    { label: 'TWAP', value: `$${marketData.twap.toFixed(2)}`, icon: TrendingUp },
    { label: 'Liquidity', value: `$${(marketData.liquidity / 1e6).toFixed(1)}M`, icon: Droplets },
    { label: 'Volume 24h', value: `$${(marketData.volume24h / 1e6).toFixed(1)}M`, icon: BarChart3 },
    { label: 'Volatility 1D', value: `${(marketData.volatility1d * 100).toFixed(2)}%`, icon: Gauge },
    { label: 'ATR', value: `$${marketData.atr.toFixed(2)}`, icon: Activity },
    { label: 'Std Dev', value: `$${marketData.stdDeviation.toFixed(2)}`, icon: LineChart },
  ];
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5">
              <Activity className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Data Layer</CardTitle>
              <CardDescription>Real-time market metrics collection</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
              Live
            </Badge>
            <Button size="sm" variant="outline" onClick={updateMarketData}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {dataPoints.map((point) => {
            const Icon = point.icon;
            return (
              <motion.div
                key={point.label}
                className="p-3 rounded-lg bg-background/50 border border-border/50 text-center"
                whileHover={{ scale: 1.02 }}
              >
                <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{point.label}</p>
                <p className="text-sm font-bold">{point.value}</p>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// System Status Footer
function SystemStatusFooter() {
  const { systemStatus } = useLiquidityStore();
  
  const components = [
    { name: 'Vault', status: systemStatus.vaultConnected },
    { name: 'Strategy Controller', status: systemStatus.strategyControllerActive },
    { name: 'AI Engine', status: systemStatus.aiEngineReady },
    { name: 'Data Indexer', status: systemStatus.dataIndexerSynced },
    { name: 'Execution Engine', status: systemStatus.executionEngineReady },
  ];
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-md border-t border-border/50 px-6 py-3 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          {components.map((comp) => (
            <StatusIndicator key={comp.name} status={comp.status} label={comp.name} />
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          Last Update: {systemStatus.lastUpdate.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

// Architecture Diagram
function ArchitectureDiagram() {
  const layers = [
    { name: 'Investors', icon: Wallet, color: 'from-amber-500/20' },
    { name: 'Vault Contract', icon: Shield, color: 'from-amber-500/20' },
    { name: 'Strategy Controller', icon: Layers, color: 'from-violet-500/20' },
    { name: 'AI Strategy Engine', icon: Brain, color: 'from-cyan-500/20' },
    { name: 'Range Optimizer', icon: Target, color: 'from-emerald-500/20' },
    { name: 'Execution Engine', icon: Zap, color: 'from-rose-500/20' },
    { name: 'DEX Pools', icon: Droplets, color: 'from-blue-500/20' },
  ];
  
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5">
            <Layers className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-lg">System Architecture</CardTitle>
            <CardDescription>Component flow & data pipeline</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-1">
          {layers.map((layer, i) => {
            const Icon = layer.icon;
            return (
              <div key={layer.name} className="w-full flex items-center justify-center">
                <motion.div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r to-transparent w-full max-w-xs justify-center",
                    layer.color
                  )}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{layer.name}</span>
                </motion.div>
                {i < layers.length - 1 && (
                  <div className="w-0.5 h-3 bg-border/50 absolute mt-10" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Dashboard Component
export default function LiquidityManagerDashboard() {
  const { metrics, updateMarketData } = useLiquidityStore();
  
  useEffect(() => {
    updateMarketData();
  }, [updateMarketData]);
  
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500">
                <Droplets className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AI Liquidity Manager</h1>
                <p className="text-sm text-muted-foreground">Adaptive Range Strategy Engine</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                System Online
              </Badge>
              <Button variant="outline" size="sm">
                <Wallet className="h-4 w-4 mr-2" />
                Connect
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Total TVL"
            value={metrics.totalTVL}
            prefix="$"
            change={2.4}
            icon={Wallet}
            color="emerald"
          />
          <MetricCard
            title="Fees 24h"
            value={metrics.totalFees24h}
            prefix="$"
            change={12.8}
            icon={Coins}
            color="amber"
          />
          <MetricCard
            title="Avg APY"
            value={metrics.avgAPY * 100}
            suffix="%"
            icon={TrendingUp}
            color="cyan"
          />
          <MetricCard
            title="System Health"
            value={metrics.systemHealth}
            suffix="%"
            icon={Activity}
            color="violet"
          />
        </div>
        
        {/* Data Layer */}
        <div className="mb-6">
          <DataLayer />
        </div>
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <VaultManager />
            <StrategyController />
          </div>
          
          {/* Center Column */}
          <div className="space-y-6">
            <AIStrategyEngine />
            <RangeOptimizer />
          </div>
          
          {/* Right Column */}
          <div className="space-y-6">
            <ExecutionEngine />
            <RiskDashboard />
            <ArchitectureDiagram />
          </div>
        </div>
        
        {/* Price Chart */}
        <div className="mt-6">
          <PriceChart />
        </div>
      </main>
      
      {/* System Status Footer */}
      <SystemStatusFooter />
    </div>
  );
}
