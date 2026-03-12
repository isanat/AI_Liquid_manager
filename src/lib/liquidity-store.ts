// AI Liquidity Manager - Live Data Store
// Data comes from /api/liquidity (which queries The Graph server-side).
// Math.random() removed — all values are deterministic or real.

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

// ── Static pool info (address is real) ───────────────────────────────────────

const POOL_DATA: PoolData = {
  // ETH/USDC 0.05% pool on Arbitrum One (also correct for Arb Sepolia testnet equivalent)
  address: '0xC6962004f452bE9203591991D15f6b388e09E8D0',
  token0: {
    symbol: 'USDC',
    name: 'USD Coin',
    // Arbitrum One USDC — overridden at runtime by NEXT_PUBLIC_CHAIN_ID
    address: process.env.NEXT_PUBLIC_CHAIN_ID === '421614'
      ? '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'
      : '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    price: 1,
  },
  token1: {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
    decimals: 18,
    price: 2000, // placeholder — replaced by real data from API
  },
  fee: 500, // 0.05% fee tier (matches vault contract fee: 500)
  liquidity: 25_000_000,
  sqrtPriceX96: BigInt('2028240960365167041968'),
  tick: 85176,
  tvl: 450_000_000,
  volume24h: 150_000_000,
  fees24h: 450_000,
};

// ── Deterministic defaults (shown on first render, replaced by real data) ────

const DEFAULT_MARKET: MarketData = {
  timestamp: new Date(),
  price: 1850,
  tick: 85176,
  twap: 1850,
  priceVelocity: 0,
  liquidity: 25_000_000,
  activeLiquidity: 12_000_000,
  depth: 600_000,
  volume1h: 600_000,
  volume24h: 12_000_000,
  volumeSpike: false,
  volatility1d: 0.035,
  volatility7d: 0.04,
  realizedVolatility: 0.035 * Math.sqrt(365),
  atr: 1850 * 0.035,
  stdDeviation: 0.035 * 1850,
};

const DEFAULT_RANGES: RangeConfig[] = [
  { type: 'core',         tickLower: 84576, tickUpper: 85776, priceLower: 1741, priceUpper: 1961, percentage: 70, liquidity: 8_750_000 },
  { type: 'defensive',    tickLower: 83376, tickUpper: 86976, priceLower: 1517, priceUpper: 2257, percentage: 20, liquidity: 2_500_000 },
  { type: 'opportunistic',tickLower: 84976, tickUpper: 85376, priceLower: 1813, priceUpper: 1887, percentage: 10, liquidity: 1_250_000 },
];

// ── API response → store types ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMarketData(d: any): MarketData {
  return {
    timestamp: new Date(d.timestamp),
    price: d.price,
    tick: d.tick,
    twap: d.twap,
    priceVelocity: d.priceVelocity,
    liquidity: d.liquidity,
    activeLiquidity: d.activeLiquidity,
    depth: d.depth,
    volume1h: d.volume1h,
    volume24h: d.volume24h,
    volumeSpike: d.volumeSpike,
    volatility1d: d.volatility1d,
    volatility7d: d.volatility7d,
    realizedVolatility: d.realizedVolatility,
    atr: d.atr,
    stdDeviation: d.stdDeviation,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOutputs(o: any): AIOutputs {
  return {
    rangeWidth: o.rangeWidth,
    rebalanceThreshold: o.rebalanceThreshold,
    capitalAllocation: o.capitalAllocation as CapitalAllocation,
    confidence: o.confidence,
    reasoning: o.reasoning,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRanges(r: any[]): RangeConfig[] {
  return r.map(x => ({
    type: x.type,
    tickLower: x.tickLower,
    tickUpper: x.tickUpper,
    priceLower: x.priceLower,
    priceUpper: x.priceUpper,
    percentage: x.percentage,
    liquidity: x.liquidity,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRegime(r: any): LiquidityRegime {
  return {
    type: r.type,
    confidence: r.confidence,
    detectedAt: new Date(r.detectedAt),
    indicators: r.indicators,
  };
}

// ── Static positions (representative, not random) ─────────────────────────────

const INITIAL_POSITIONS: Position[] = [
  {
    id: 'pos-1',
    pool: 'ETH/USDC',
    tickLower: 84576,
    tickUpper: 85776,
    liquidity: BigInt('1250000000000000000'),
    token0Amount: 45.2,
    token1Amount: 85_300,
    feesEarned0: 0.12,
    feesEarned1: 228,
    inRange: true,
    createdAt: new Date(Date.now() - 86_400_000 * 2),
    lastCollected: new Date(Date.now() - 3_600_000),
  },
  {
    id: 'pos-2',
    pool: 'ETH/USDC',
    tickLower: 83_376,
    tickUpper: 86_976,
    liquidity: BigInt('500000000000000000'),
    token0Amount: 15.8,
    token1Amount: 32_000,
    feesEarned0: 0.03,
    feesEarned1: 62,
    inRange: true,
    createdAt: new Date(Date.now() - 86_400_000 * 5),
    lastCollected: new Date(Date.now() - 7_200_000),
  },
];

// ── Store ─────────────────────────────────────────────────────────────────────

interface LiquidityStore {
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
  isLoading: boolean;
  lastFetchedAt: Date | null;
  dataSource: string;

  updateMarketData: () => void;
  startCycle: () => void;
  executeRebalance: () => void;
  deposit: (amount: number, investor: string) => void;
  withdraw: (shares: number, investor: string) => void;
  collectFees: (positionId: string) => void;
}

export const useLiquidityStore = create<LiquidityStore>((set, get) => ({
  // ── Initial state ───────────────────────────────────────────────────────────
  vault: {
    id: 'vault-001',
    name: 'AI Liquidity Vault',
    totalAssets: 12_500_000,
    totalShares: 11_625_000,
    nav: 1.075,
    strategy: 'adaptive-range',
    lastRebalance: new Date(Date.now() - 3_600_000 * 3),
    investors: 47,
  },

  positions: INITIAL_POSITIONS,
  marketData: DEFAULT_MARKET,
  poolData: POOL_DATA,

  metrics: {
    totalTVL: 12_500_000,
    totalFees24h: 38_500,
    totalVolume24h: 14_200_000,
    activePositions: 2,
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
    confidence: 0.78,
    detectedAt: new Date(Date.now() - 3_600_000 * 12),
    indicators: { trendStrength: 0.25, volatilityLevel: 0.45, volumeProfile: 0.68 },
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
  ranges: DEFAULT_RANGES,

  aiInputs: {
    volatility1d: 0.035,
    volatility7d: 0.04,
    volume: 12_500_000,
    liquidityDepth: 22_000_000,
    priceDrift: 0,
    volumeSpike: false,
    trendDirection: 'neutral',
  },

  aiOutputs: {
    rangeWidth: 7,
    rebalanceThreshold: 0.065,
    capitalAllocation: { core: 70, defensive: 20, opportunistic: 10, cashBuffer: 5 },
    confidence: 0.72,
    reasoning: 'Normal market conditions — standard allocation applied.',
  },

  isLoading: false,
  lastFetchedAt: null,
  dataSource: 'initializing',

  // ── Actions ─────────────────────────────────────────────────────────────────

  updateMarketData: () => {
    // Prevent concurrent fetches
    if (get().isLoading) return;
    set({ isLoading: true });

    fetch('/api/liquidity?action=full')
      .then(r => r.json())
      .then(({ success, data }) => {
        if (!success || !data) return;

        const market = parseMarketData(data.market);
        const outputs = parseOutputs(data.aiOutputs);
        const ranges = data.ranges ? parseRanges(data.ranges) : get().ranges;
        const regime = data.regime ? parseRegime(data.regime) : get().regime;

        const aiInputs: AIInputs = {
          volatility1d: market.volatility1d,
          volatility7d: market.volatility7d,
          volume: market.volume24h,
          liquidityDepth: market.liquidity,
          priceDrift: market.priceVelocity,
          volumeSpike: market.volumeSpike,
          trendDirection:
            market.priceVelocity > 0.002 ? 'up'
            : market.priceVelocity < -0.002 ? 'down'
            : 'neutral',
        };

        set(state => ({
          marketData: market,
          aiInputs,
          aiOutputs: outputs,
          ranges,
          regime,
          isLoading: false,
          lastFetchedAt: new Date(),
          dataSource: (data.market as { dataSource?: string }).dataSource ?? 'api',
          systemStatus: { ...state.systemStatus, lastUpdate: new Date() },
        }));
      })
      .catch(() => {
        // Keep previous data on error, just mark not loading
        set({ isLoading: false });
      });
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

  deposit: (amount: number, _investor: string) => {
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

  withdraw: (shares: number, _investor: string) => {
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
          : p,
      ),
    }));
  },
}));
