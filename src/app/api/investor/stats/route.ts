import { NextResponse } from 'next/server';

const AI_ENGINE_URL = (process.env.AI_ENGINE_URL ?? '').replace(/\/$/, '');

// Vault addresses
const VAULTS = [
  { address: '0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C', symbol: 'USDC' },
  { address: '0x12a20d3569da6DD2d99E7bC95748283B10729c4C', symbol: 'USDT' },
];

interface VaultStats {
  address: string;
  symbol: string;
  totalAssets: number;
  deployedValue: number;
  idleValue: number;
  returnPct: number;
  returnUsd: number;
  fees: {
    management: number;
    performance: number;
    total: number;
  };
}

async function fetchVaultData(vaultAddress: string, symbol: string): Promise<VaultStats> {
  try {
    // Try to fetch from vault API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/vault?vault=${vaultAddress}`);
    
    if (response.ok) {
      const data = await response.json();
      
      const totalAssets = data.totalAssets || 0;
      const deployedValue = data.deployedValue || data.activeLiquidity || totalAssets * 0.8;
      const idleValue = totalAssets - deployedValue;
      
      // Calculate returns from API data or use defaults
      const returnPct = data.returnPct || data.apy30d || 0;
      const returnUsd = data.returnUsd || (totalAssets * returnPct / 100);
      
      // Fee calculation (10% performance fee on profits)
      const performanceFee = returnUsd > 0 ? returnUsd * 0.1 : 0;
      
      return {
        address: vaultAddress,
        symbol,
        totalAssets,
        deployedValue,
        idleValue,
        returnPct,
        returnUsd,
        fees: {
          management: 0, // No management fee
          performance: performanceFee,
          total: performanceFee,
        },
      };
    }
  } catch (error) {
    console.log(`Using demo data for ${symbol} vault`);
  }
  
  // Demo data fallback
  const demoAssets = symbol === 'USDC' ? 5500 : 5000;
  const returnPct = symbol === 'USDC' ? 4.2 : 3.85;
  const returnUsd = demoAssets * returnPct / 100;
  
  return {
    address: vaultAddress,
    symbol,
    totalAssets: demoAssets,
    deployedValue: demoAssets * 0.8,
    idleValue: demoAssets * 0.2,
    returnPct,
    returnUsd,
    fees: {
      management: 0,
      performance: returnUsd * 0.1,
      total: returnUsd * 0.1,
    },
  };
}

export async function GET() {
  try {
    // Fetch data for all vaults
    const vaultPromises = VAULTS.map(v => fetchVaultData(v.address, v.symbol));
    const vaults = await Promise.all(vaultPromises);
    
    // Calculate totals
    const totalInvested = vaults.reduce((sum, v) => sum + v.totalAssets, 0);
    const totalReturn = vaults.reduce((sum, v) => sum + v.returnUsd, 0);
    const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
    const totalFees = vaults.reduce((sum, v) => sum + v.fees.total, 0);
    
    // Fetch risk/operational status from AI engine
    let status: 'online' | 'paused' | 'offline' = 'online';
    let volatility = 12.5;
    let maxDrawdown = 2.1;
    
    if (AI_ENGINE_URL) {
      try {
        const riskResponse = await fetch(`${AI_ENGINE_URL}/risk/status`, {
          signal: AbortSignal.timeout(5000),
        });
        
        if (riskResponse.ok) {
          const riskData = await riskResponse.json();
          
          // Map risk status
          if (riskData.pilot?.current_phase === 'paused') {
            status = 'paused';
          } else if (riskData.status === 'disabled') {
            status = 'offline';
          }
          
          // Get risk metrics
          volatility = riskData.pilot?.metrics?.volatility_30d || volatility;
          maxDrawdown = riskData.pilot?.metrics?.max_drawdown || maxDrawdown;
        }
      } catch {
        console.log('Could not fetch risk status, using defaults');
      }
    }
    
    return NextResponse.json({
      totalInvested,
      totalReturn,
      totalReturnPct,
      totalFees,
      volatility,
      maxDrawdown,
      status,
      lastUpdate: new Date().toISOString(),
      vaults,
    });
    
  } catch (error) {
    console.error('Error fetching investor stats:', error);
    
    // Return demo data on error
    return NextResponse.json({
      totalInvested: 10500,
      totalReturn: 423.50,
      totalReturnPct: 4.03,
      totalFees: 52.50,
      volatility: 12.5,
      maxDrawdown: 2.1,
      status: 'online',
      lastUpdate: new Date().toISOString(),
      vaults: [
        {
          address: '0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C',
          symbol: 'USDC',
          totalAssets: 5500,
          deployedValue: 4500,
          idleValue: 1000,
          returnPct: 4.2,
          returnUsd: 231,
          fees: { management: 0, performance: 23.10, total: 23.10 },
        },
        {
          address: '0x12a20d3569da6DD2d99E7bC95748283B10729c4C',
          symbol: 'USDT',
          totalAssets: 5000,
          deployedValue: 4000,
          idleValue: 1000,
          returnPct: 3.85,
          returnUsd: 192.50,
          fees: { management: 0, performance: 19.25, total: 19.25 },
        },
      ],
      demo: true,
    });
  }
}
