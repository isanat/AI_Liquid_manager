// AI Liquidity Manager - Simulation Data Store
import { create } from 'zustand';
import type {
  Vault,
  Position,
  MarketData,
  StrategyCycle,
  Execution,
  PoolData,
  DashboardMetrics,
  SystemStatus,
  LiquidityRegime,
  RiskMetrics,
  RangeConfig,
  CapitalAllocation,
  AIInputs,
  AIOutputs,
} from './liquidity-types';

// Generate realistic mock data
const generateMarketData = (): MarketData => {
  const basePrice = 1850 + Math.random() * 100; // ETH price range
  const volatility1d = 0.02 + Math.random() * 0.06;
  const volatility7d = volatility1d * (0.8 + Math.random() * 0.4);
  
  return {
    timestamp: new Date(),
    price: basePrice,
    tick: Math.floor(Math.log(basePrice) / Math.log(1.0001)),
    twap: basePrice * (0.998 + Math.random() * 0.004),
    priceVelocity: (Math.random() - 0.5) * 0.01,
    liquidity: 15000000 + Math.random() * 10000000,
    activeLiquidity: 8000000 + Math.random() * 5000000,
    depth: 500000 + Math.random() * 300000,
    volume1h: 500000 + Math.random() * 300000,
    volume24h: 12000000 + Math.random() * 8000000,
    volumeSpike: Math.random() > 0.85,
    volatility1d,
    volatility7d,
    realizedVolatility: volatility1d * Math.sqrt(365),
    atr: basePrice * volatility1d,
    stdDeviation: volatility1d * basePrice,
  };
};

const generatePositions = (): Position[] => {
  const basePrice = 1850;
  const tickSpacing = 60;
  
  return [
    {
      id: 'pos-1',
      pool: 'ETH/USDC',
      tickLower: Math.floor(Math.log(basePrice * 0.92) / Math.log(1.0001)),
      tickUpper: Math.floor(Math.log(basePrice * 1.08) / Math.log(1.0001)),
      liquidity: BigInt('1250000000000000000'),
      token0Amount: 45.2,
      token1Amount: 85300,
      feesEarned0: 0.12,
      feesEarned1: 228,
      inRange: true,
      createdAt: new Date(Date.now() - 86400000 * 2),
      lastCollected: new Date(Date.now() - 3600000),
    },
    {
      id: 'pos-2',
      pool: 'ETH/USDC',
      tickLower: Math.floor(Math.log(basePrice * 0.75) / Math.log(1.0001)),
      tickUpper: Math.floor(Math.log(basePrice * 1.25) / Math.log(1.0001)),
      liquidity: BigInt('500000000000000000'),
      token0Amount: 15.8,
      token1Amount: 32000,
      feesEarned0: 0.03,
      feesEarned1: 62,
      inRange: true,
      createdAt: new Date(Date.now() - 86400000 * 5),
      lastCollected: new Date(Date.now() - 7200000),
    },
    {
      id: 'pos-3',
      pool: 'ETH/USDC',
      tickLower: Math.floor(Math.log(basePrice * 0.98) / Math.log(1.0001)),
      tickUpper: Math.floor(Math.log(basePrice * 1.02) / Math.log(1.0001)),
      liquidity: BigInt('800000000000000000'),
      token0Amount: 28.5,
      token1Amount: 54700,
      feesEarned0: 0.45,
      feesEarned1: 855,
      inRange: true,
      createdAt: new Date(Date.now() - 3600000 * 6),
      lastCollected: new Date(Date.now() - 1800000),
    },
  ];
};

const generatePoolData = (): PoolData => ({
  address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
  token0: {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    price: 1850,
  },
  token1: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    price: 1,
  },
  fee: 3000,
  liquidity: 25000000,
  sqrtPriceX96: BigInt('2028240960365167041968'),
  tick: 85000,
  tvl: 450000000,
  volume24h: 150000000,
  fees24h: 450000,
});

const generateRanges = (price: number): RangeConfig[] => {
  const tick = Math.floor(Math.log(price) / Math.log(1.0001));
  
  return [
    {
      type: 'core',
      tickLower: tick - 600,
      tickUpper: tick + 600,
      priceLower: price * 0.94,
      priceUpper: price * 1.06,
      percentage: 70,
      liquidity: 8750000,
    },
    {
      type: 'defensive',
      tickLower: tick - 1800,
      tickUpper: tick + 1800,
      priceLower: price * 0.82,
      priceUpper: price * 1.22,
      percentage: 20,
      liquidity: 2500000,
    },
    {
      type: 'opportunistic',
      tickLower: tick - 200,
      tickUpper: tick + 200,
      priceLower: price * 0.98,
      priceUpper: price * 1.02,
      percentage: 10,
      liquidity: 1250000,
    },
  ];
};

const generateAIOutputs = (inputs: AIInputs): AIOutputs => {
  const rangeWidth = inputs.volatility1d * 2 * 100;
  const baseAllocation: CapitalAllocation = {
    core: 70,
    defensive: 20,
    opportunistic: 10,
    cashBuffer: 5,
  };

  if (inputs.volatility1d > 0.05) {
    baseAllocation.core = 60;
    baseAllocation.defensive = 30;
    baseAllocation.opportunistic = 5;
  } else if (inputs.volatility1d < 0.02) {
    baseAllocation.core = 75;
    baseAllocation.defensive = 15;
    baseAllocation.opportunistic = 10;
  }

  if (inputs.volumeSpike) {
    baseAllocation.opportunistic = Math.min(baseAllocation.opportunistic + 5, 15);
  }

  return {
    rangeWidth,
    rebalanceThreshold: 0.03 + inputs.volatility1d,
    capitalAllocation: baseAllocation,
    confidence: 0.75 + Math.random() * 0.2,
    reasoning: inputs.volatility1d > 0.04
      ? 'High volatility detected. Widening ranges and increasing defensive allocation.'
      : inputs.volumeSpike
      ? 'Volume spike detected. Increasing opportunistic allocation for fee capture.'
      : 'Normal market conditions. Standard allocation strategy applied.',
  };
};

interface LiquidityStore {
  // Data
  vault: Vault;
  positions: Position[];
  marketData: MarketData;
  poolData: PoolData;
  metrics: DashboardMetrics;
  systemStatus: SystemStatus;
  regime: LiquidityRegime;
  riskMetrics: RiskMetrics;
  currentCycle: StrategyCycle | null;
  recentExecutions: Execution[];
  ranges: RangeConfig[];
  aiInputs: AIInputs;
  aiOutputs: AIOutputs;
  
  // Actions
  updateMarketData: () => void;
  startCycle: () => void;
  executeRebalance: () => void;
  deposit: (amount: number, investor: string) => void;
  withdraw: (shares: number, investor: string) => void;
  collectFees: (positionId: string) => void;
}

export const useLiquidityStore = create<LiquidityStore>((set, get) => ({
  // Initial State
  vault: {
    id: 'vault-001',
    name: 'AI Liquidity Vault',
    totalAssets: 12500000,
    totalShares: 11625000,
    nav: 1.075,
    strategy: 'adaptive-range',
    lastRebalance: new Date(Date.now() - 3600000 * 3),
    investors: 47,
  },
  
  positions: generatePositions(),
  marketData: generateMarketData(),
  poolData: generatePoolData(),
  
  metrics: {
    totalTVL: 12500000,
    totalFees24h: 38500,
    totalVolume24h: 14200000,
    activePositions: 3,
    totalInvestors: 47,
    avgAPY: 0.285,
    rebalancesToday: 2,
    systemHealth: 98.5,
  },
  
  systemStatus: {
    vaultConnected: true,
    strategyControllerActive: true,
    aiEngineReady: true,
    dataIndexerSynced: true,
    executionEngineReady: true,
    lastUpdate: new Date(),
  },
  
  regime: {
    type: 'range',
    confidence: 0.82,
    detectedAt: new Date(Date.now() - 3600000 * 12),
    indicators: {
      trendStrength: 0.25,
      volatilityLevel: 0.45,
      volumeProfile: 0.68,
    },
  },
  
  riskMetrics: {
    impermanentLoss: 0.023,
    maxDrawdown: 0.085,
    var95: 0.042,
    sharpeRatio: 2.1,
    sortinoRatio: 2.8,
    calmarRatio: 1.9,
  },
  
  currentCycle: null,
  recentExecutions: [],
  
  ranges: generateRanges(1850),
  
  aiInputs: {
    volatility1d: 0.035,
    volatility7d: 0.042,
    volume: 12500000,
    liquidityDepth: 22000000,
    priceDrift: 0.002,
    volumeSpike: false,
    trendDirection: 'neutral',
  },
  
  aiOutputs: {
    rangeWidth: 7,
    rebalanceThreshold: 0.065,
    capitalAllocation: {
      core: 70,
      defensive: 20,
      opportunistic: 10,
      cashBuffer: 5,
    },
    confidence: 0.85,
    reasoning: 'Normal market conditions. Standard allocation strategy applied.',
  },
  
  // Actions
  updateMarketData: () => {
    const newMarketData = generateMarketData();
    const newAiInputs: AIInputs = {
      volatility1d: newMarketData.volatility1d,
      volatility7d: newMarketData.volatility7d,
      volume: newMarketData.volume24h,
      liquidityDepth: newMarketData.liquidity,
      priceDrift: newMarketData.priceVelocity,
      volumeSpike: newMarketData.volumeSpike,
      trendDirection: newMarketData.priceVelocity > 0.002 ? 'up' 
        : newMarketData.priceVelocity < -0.002 ? 'down' 
        : 'neutral',
    };
    
    set(state => ({
      marketData: newMarketData,
      aiInputs: newAiInputs,
      aiOutputs: generateAIOutputs(newAiInputs),
      ranges: generateRanges(newMarketData.price),
      systemStatus: { ...state.systemStatus, lastUpdate: new Date() },
    }));
  },
  
  startCycle: () => {
    const cycle: StrategyCycle = {
      id: `cycle-${Date.now()}`,
      startedAt: new Date(),
      phase: 'data-collection',
      marketData: get().marketData,
      aiInputs: get().aiInputs,
    };
    set({ currentCycle: cycle });
  },
  
  executeRebalance: () => {
    const execution: Execution = {
      id: `exec-${Date.now()}`,
      type: 'rebalance',
      status: 'pending',
      params: {
        ranges: get().ranges,
        capitalAllocation: get().aiOutputs.capitalAllocation,
      },
      timestamp: new Date(),
    };
    
    set(state => ({
      recentExecutions: [execution, ...state.recentExecutions.slice(0, 9)],
      currentCycle: null,
      vault: { ...state.vault, lastRebalance: new Date() },
    }));
  },
  
  deposit: (amount: number, investor: string) => {
    set(state => {
      const shares = amount / state.vault.nav;
      return {
        vault: {
          ...state.vault,
          totalAssets: state.vault.totalAssets + amount,
          totalShares: state.vault.totalShares + shares,
          investors: state.vault.investors + 1,
        },
        metrics: {
          ...state.metrics,
          totalTVL: state.metrics.totalTVL + amount,
          totalInvestors: state.metrics.totalInvestors + 1,
        },
      };
    });
  },
  
  withdraw: (shares: number, investor: string) => {
    set(state => {
      const amount = shares * state.vault.nav;
      return {
        vault: {
          ...state.vault,
          totalAssets: Math.max(0, state.vault.totalAssets - amount),
          totalShares: Math.max(0, state.vault.totalShares - shares),
        },
        metrics: {
          ...state.metrics,
          totalTVL: Math.max(0, state.metrics.totalTVL - amount),
        },
      };
    });
  },
  
  collectFees: (positionId: string) => {
    set(state => ({
      positions: state.positions.map(p => 
        p.id === positionId 
          ? { ...p, feesEarned0: 0, feesEarned1: 0, lastCollected: new Date() }
          : p
      ),
    }));
  },
}));
