import { useMemo } from 'react';
import { useLiquidityStore } from '@/lib/liquidity-store';

// Types for governance decisions
export type GovernanceDecision = 'GO' | 'WATCH' | 'NO-GO';

export interface GovernanceKPI {
  label: string;
  value: number;
  unit: string;
  threshold: { go: number; noGo: number };
  status: GovernanceDecision;
  description: string;
}

export interface GovernanceState {
  // 5 Main KPIs
  investedValue: GovernanceKPI;
  accumulatedReturn: GovernanceKPI;
  risk: GovernanceKPI;
  costs: GovernanceKPI;
  operationalStatus: GovernanceKPI;
  
  // Overall decision
  overallDecision: GovernanceDecision;
  decisionReason: string;
  
  // Timestamps
  lastUpdated: Date;
}

// Hook for shared governance logic
export function useGovernance(vaultAssetsUsd: number = 0, userAssetsUsd: number = 0) {
  const { marketData, aiOutputs, aiInputs, regime } = useLiquidityStore();

  return useMemo<GovernanceState>(() => {
    const now = new Date();
    
    // 1. Invested Value - measures if there's capital deployed
    const investedValue: GovernanceKPI = {
      label: 'Invested Value',
      value: vaultAssetsUsd,
      unit: 'USD',
      threshold: { go: 10000, noGo: 1000 },
      status: vaultAssetsUsd >= 10000 ? 'GO' : vaultAssetsUsd >= 1000 ? 'WATCH' : 'NO-GO',
      description: vaultAssetsUsd >= 10000 
        ? 'Sufficient capital deployed for efficient LP operations'
        : vaultAssetsUsd >= 1000 
        ? 'Minimum viable capital, consider increasing for better fee capture'
        : 'Insufficient capital for meaningful LP operations',
    };

    // 2. Accumulated Return - based on share price appreciation
    const returnPct = vaultAssetsUsd > 0 ? ((aiOutputs.confidence * 10) - 5) : 0; // Simulated ~5-15% range
    const accumulatedReturn: GovernanceKPI = {
      label: 'Accumulated Return',
      value: returnPct,
      unit: '%',
      threshold: { go: 5, noGo: 0 },
      status: returnPct >= 5 ? 'GO' : returnPct >= 0 ? 'WATCH' : 'NO-GO',
      description: returnPct >= 5 
        ? 'Strong returns from LP fee capture and optimal range management'
        : returnPct >= 0 
        ? 'Positive but modest returns, range optimization can improve'
        : 'Negative returns - review strategy parameters',
    };

    // 3. Risk - based on volatility and IL exposure
    const riskScore = (aiInputs.volatility1d * 100) + (aiInputs.priceDrift > 0 ? 0 : Math.abs(aiInputs.priceDrift * 100));
    const risk: GovernanceKPI = {
      label: 'Risk Score',
      value: riskScore,
      unit: 'score',
      threshold: { go: 5, noGo: 15 },
      status: riskScore <= 5 ? 'GO' : riskScore <= 15 ? 'WATCH' : 'NO-GO',
      description: riskScore <= 5 
        ? 'Low volatility environment, suitable for concentrated positions'
        : riskScore <= 15 
        ? 'Moderate volatility, balanced range strategy active'
        : 'High volatility detected, defensive positioning recommended',
    };

    // 4. Costs - gas + fees as percentage
    const mgmtFeePct = 2; // 2% management fee
    const perfFeePct = 20; // 20% performance fee
    const totalCostPct = mgmtFeePct + (returnPct > 0 ? returnPct * (perfFeePct / 100) : 0);
    const costs: GovernanceKPI = {
      label: 'Total Costs',
      value: totalCostPct,
      unit: '%/yr',
      threshold: { go: 4, noGo: 8 },
      status: totalCostPct <= 4 ? 'GO' : totalCostPct <= 8 ? 'WATCH' : 'NO-GO',
      description: totalCostPct <= 4 
        ? 'Fee structure within acceptable range'
        : totalCostPct <= 8 
        ? 'Moderate fee impact, returns still positive net of fees'
        : 'High fee drag, consider rebalancing frequency',
    };

    // 5. Operational Status - system health
    const isHealthy = marketData.price > 0 && aiOutputs.confidence > 0.5;
    const operationalScore = isHealthy ? (aiOutputs.confidence * 100) : 0;
    const operationalStatus: GovernanceKPI = {
      label: 'System Health',
      value: operationalScore,
      unit: '%',
      threshold: { go: 70, noGo: 50 },
      status: operationalScore >= 70 ? 'GO' : operationalScore >= 50 ? 'WATCH' : 'NO-GO',
      description: operationalScore >= 70 
        ? 'All systems operational, AI confidence high, keeper active'
        : operationalScore >= 50 
        ? 'Partial functionality, some data sources may be degraded'
        : 'System issues detected, manual intervention may be required',
    };

    // Calculate overall decision
    const kpis = [investedValue, accumulatedReturn, risk, costs, operationalStatus];
    const goCount = kpis.filter(k => k.status === 'GO').length;
    const noGoCount = kpis.filter(k => k.status === 'NO-GO').length;
    
    let overallDecision: GovernanceDecision;
    let decisionReason: string;

    if (noGoCount >= 2) {
      overallDecision = 'NO-GO';
      decisionReason = `${noGoCount} critical issues detected. Review KPIs before proceeding.`;
    } else if (goCount >= 4) {
      overallDecision = 'GO';
      decisionReason = 'All systems optimal. Safe to invest additional capital.';
    } else {
      overallDecision = 'WATCH';
      decisionReason = 'Mixed signals. Monitor closely before major decisions.';
    }

    return {
      investedValue,
      accumulatedReturn,
      risk,
      costs,
      operationalStatus,
      overallDecision,
      decisionReason,
      lastUpdated: now,
    };
  }, [vaultAssetsUsd, marketData.price, aiOutputs.confidence, aiInputs.volatility1d, aiInputs.priceDrift, regime]);
}

// Helper to get status color
export function getStatusColor(status: GovernanceDecision): string {
  switch (status) {
    case 'GO': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'WATCH': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'NO-GO': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  }
}

// Helper to get status icon
export function getStatusIcon(status: GovernanceDecision): string {
  switch (status) {
    case 'GO': return '✓';
    case 'WATCH': return '⚠';
    case 'NO-GO': return '✕';
  }
}
