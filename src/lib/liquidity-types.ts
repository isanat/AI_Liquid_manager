// AI Liquidity Manager - Type Definitions

export interface Vault {
  id: string;
  name: string;
  totalAssets: number;
  totalShares: number;
  nav: number;
  strategy: string;
  lastRebalance: Date;
  investors: number;
}

export interface Deposit {
  id: string;
  investor: string;
  amount: number;
  shares: number;
  timestamp: Date;
  txHash: string;
}

export interface Withdrawal {
  id: string;
  investor: string;
  shares: number;
  amount: number;
  timestamp: Date;
  txHash: string;
}

export interface PoolData {
  address: string;
  token0: Token;
  token1: Token;
  fee: number;
  liquidity: number;
  sqrtPriceX96: bigint;
  tick: number;
  tvl: number;
  volume24h: number;
  fees24h: number;
}

export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  price: number;
}

export interface MarketData {
  timestamp: Date;
  price: number;
  tick: number;
  twap: number;
  priceVelocity: number;
  liquidity: number;
  activeLiquidity: number;
  depth: number;
  volume1h: number;
  volume24h: number;
  volumeSpike: boolean;
  volatility1d: number;
  volatility7d: number;
  realizedVolatility: number;
  atr: number;
  stdDeviation: number;
}

export interface LiquidityDistribution {
  tickLower: number;
  tickUpper: number;
  liquidity: number;
  percentage: number;
}

export interface Position {
  id: string;
  pool: string;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  token0Amount: number;
  token1Amount: number;
  feesEarned0: number;
  feesEarned1: number;
  inRange: boolean;
  createdAt: Date;
  lastCollected: Date;
}

export interface StrategyParams {
  rangeWidth: number;
  rebalanceThreshold: number;
  capitalAllocation: CapitalAllocation;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
}

export interface CapitalAllocation {
  core: number;        // 60-80%
  defensive: number;   // 10-30%
  opportunistic: number; // 2-10%
  cashBuffer: number;  // ~5%
}

export interface AIInputs {
  volatility1d: number;
  volatility7d: number;
  volume: number;
  liquidityDepth: number;
  priceDrift: number;
  volumeSpike: boolean;
  trendDirection: 'up' | 'down' | 'neutral';
}

export interface AIOutputs {
  rangeWidth: number;
  rebalanceThreshold: number;
  capitalAllocation: CapitalAllocation;
  confidence: number;
  reasoning: string;
}

export interface RangeConfig {
  type: 'core' | 'defensive' | 'opportunistic';
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  percentage: number;
  liquidity: number;
}

export interface RebalanceScore {
  priceDistance: number;
  volatilityChange: number;
  liquidityShift: number;
  timeDecay: number;
  total: number;
  shouldRebalance: boolean;
}

export interface Execution {
  id: string;
  type: 'mint' | 'burn' | 'collect' | 'swap' | 'rebalance';
  status: 'pending' | 'executing' | 'completed' | 'failed';
  positionId?: string;
  params: Record<string, unknown>;
  gasUsed?: number;
  gasPrice?: number;
  txHash?: string;
  timestamp: Date;
  error?: string;
}

export interface RiskMetrics {
  impermanentLoss: number;
  maxDrawdown: number;
  var95: number; // Value at Risk 95%
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
}

export interface LiquidityRegime {
  type: 'trend' | 'range' | 'high-vol' | 'low-vol';
  confidence: number;
  detectedAt: Date;
  indicators: {
    trendStrength: number;
    volatilityLevel: number;
    volumeProfile: number;
  };
}

export interface StrategyCycle {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  phase: 'data-collection' | 'ai-inference' | 'range-optimization' | 'execution' | 'completed' | 'failed';
  marketData?: MarketData;
  aiInputs?: AIInputs;
  aiOutputs?: AIOutputs;
  ranges?: RangeConfig[];
  executions?: Execution[];
  error?: string;
}

export interface SystemStatus {
  vaultConnected: boolean;
  strategyControllerActive: boolean;
  aiEngineReady: boolean;
  dataIndexerSynced: boolean;
  executionEngineReady: boolean;
  lastUpdate: Date;
}

export interface DashboardMetrics {
  totalTVL: number;
  totalFees24h: number;
  totalVolume24h: number;
  activePositions: number;
  totalInvestors: number;
  avgAPY: number;
  rebalancesToday: number;
  systemHealth: number;
}
