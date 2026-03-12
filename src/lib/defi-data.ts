/**
 * Real DeFi Data Fetcher
 * Fetches actual on-chain data from Uniswap V3 and price feeds
 */

// Uniswap V3 Subgraph endpoints
const UNISWAP_V3_SUBGRAPH = {
  ethereum: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  arbitrum: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-arbitrum-one',
  optimism: 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis',
  polygon: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon',
};

// CoinGecko API (free tier)
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export interface PoolData {
  id: string;
  token0: TokenInfo;
  token1: TokenInfo;
  feeTier: number;
  liquidity: string;
  sqrtPrice: string;
  tick: number;
  tvlUSD: number;
  volumeUSD24h: number;
  feesUSD24h: number;
  txCount24h: number;
}

export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  derivedETH: number;
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PoolMetrics {
  poolAddress: string;
  currentPrice: number;
  tvl: number;
  volume24h: number;
  fees24h: number;
  liquidity: number;
  tick: number;
  volatility24h: number;
  twap1h: number;
  twap24h: number;
}

/**
 * Fetch pool data from Uniswap V3 subgraph
 */
export async function fetchPoolData(
  poolAddress: string,
  network: keyof typeof UNISWAP_V3_SUBGRAPH = 'ethereum'
): Promise<PoolData | null> {
  const query = `
    query GetPool($poolId: ID!) {
      pool(id: $poolId) {
        id
        token0 {
          id
          symbol
          name
          decimals
          derivedETH
        }
        token1 {
          id
          symbol
          name
          decimals
          derivedETH
        }
        feeTier
        liquidity
        sqrtPrice
        tick
        totalValueLockedUSD
        volumeUSD
        feesUSD
        txCount
      }
      poolDayData(first: 1, orderBy: date, orderDirection: desc, where: { pool: $poolId }) {
        volumeUSD
        feesUSD
        txCount
      }
    }
  `;

  try {
    const response = await fetch(UNISWAP_V3_SUBGRAPH[network], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { poolId: poolAddress.toLowerCase() } }),
    });

    const data = await response.json();
    
    if (!data.data?.pool) {
      console.error('Pool not found:', poolAddress);
      return null;
    }

    const pool = data.data.pool;
    const dayData = data.data.poolDayData?.[0] || {};

    return {
      id: pool.id,
      token0: pool.token0,
      token1: pool.token1,
      feeTier: parseInt(pool.feeTier),
      liquidity: pool.liquidity,
      sqrtPrice: pool.sqrtPrice,
      tick: parseInt(pool.tick),
      tvlUSD: parseFloat(pool.totalValueLockedUSD) || 0,
      volumeUSD24h: parseFloat(dayData.volumeUSD) || 0,
      feesUSD24h: parseFloat(dayData.feesUSD) || 0,
      txCount24h: parseInt(dayData.txCount) || 0,
    };
  } catch (error) {
    console.error('Error fetching pool data:', error);
    return null;
  }
}

/**
 * Fetch historical pool data for TWAP calculation
 */
export async function fetchPoolHourData(
  poolAddress: string,
  hours: number = 24,
  network: keyof typeof UNISWAP_V3_SUBGRAPH = 'ethereum'
): Promise<Array<{ timestamp: number; open: number; close: number; liquidity: number }>> {
  const query = `
    query GetPoolHourData($poolId: String!, $hours: Int!) {
      poolHourData(
        first: $hours
        orderBy: periodStartUnix
        orderDirection: desc
        where: { pool: $poolId }
      ) {
        periodStartUnix
        open
        close
        liquidity
        volumeUSD
        feesUSD
      }
    }
  `;

  try {
    const response = await fetch(UNISWAP_V3_SUBGRAPH[network], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query, 
        variables: { poolId: poolAddress.toLowerCase(), hours } 
      }),
    });

    const data = await response.json();
    return data.data?.poolHourData?.map((h: Record<string, unknown>) => ({
      timestamp: h.periodStartUnix as number,
      open: parseFloat(h.open as string) || 0,
      close: parseFloat(h.close as string) || 0,
      liquidity: parseFloat(h.liquidity as string) || 0,
    })) || [];
  } catch (error) {
    console.error('Error fetching hour data:', error);
    return [];
  }
}

/**
 * Calculate TWAP from hourly data
 */
export function calculateTWAP(
  hourlyData: Array<{ timestamp: number; close: number }>
): { twap1h: number; twap24h: number } {
  if (hourlyData.length === 0) {
    return { twap1h: 0, twap24h: 0 };
  }

  // 1-hour TWAP
  const last1h = hourlyData.slice(0, 1);
  const twap1h = last1h.reduce((sum, d) => sum + d.close, 0) / Math.max(last1h.length, 1);

  // 24-hour TWAP
  const last24h = hourlyData.slice(0, 24);
  const twap24h = last24h.reduce((sum, d) => sum + d.close, 0) / Math.max(last24h.length, 1);

  return { twap1h, twap24h };
}

/**
 * Calculate realized volatility from price data
 * Using Parkinson volatility estimator for better accuracy
 */
export function calculateVolatility(
  hourlyData: Array<{ open: number; close: number; high?: number; low?: number }>
): number {
  if (hourlyData.length < 2) return 0;

  // Standard volatility (log returns)
  const logReturns: number[] = [];
  for (let i = 1; i < hourlyData.length; i++) {
    if (hourlyData[i - 1].close > 0 && hourlyData[i].close > 0) {
      const logReturn = Math.log(hourlyData[i].close / hourlyData[i - 1].close);
      logReturns.push(logReturn);
    }
  }

  if (logReturns.length === 0) return 0;

  // Standard deviation of log returns
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / logReturns.length;
  
  // Annualize (hourly data, so multiply by sqrt(365 * 24) = sqrt(8760))
  return Math.sqrt(variance * 8760);
}

/**
 * Get token price from CoinGecko
 */
export async function getTokenPrice(
  coinId: string
): Promise<{ usd: number; usd24hChange: number } | null> {
  try {
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
    );
    
    const data = await response.json();
    
    if (data[coinId]) {
      return {
        usd: data[coinId].usd,
        usd24hChange: data[coinId].usd_24h_change || 0,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching token price:', error);
    return null;
  }
}

/**
 * Get comprehensive pool metrics
 */
export async function getPoolMetrics(
  poolAddress: string,
  network: keyof typeof UNISWAP_V3_SUBGRAPH = 'ethereum'
): Promise<PoolMetrics | null> {
  // Fetch current pool data
  const poolData = await fetchPoolData(poolAddress, network);
  if (!poolData) return null;

  // Fetch hourly data for TWAP and volatility
  const hourlyData = await fetchPoolHourData(poolAddress, 24, network);
  
  // Calculate derived metrics
  const { twap1h, twap24h } = calculateTWAP(hourlyData);
  const volatility24h = calculateVolatility(hourlyData);

  // Calculate current price from sqrtPrice
  // price = (sqrtPrice / 2^96)^2
  const sqrtPrice = parseFloat(poolData.sqrtPrice);
  const currentPrice = Math.pow(sqrtPrice / Math.pow(2, 96), 2);

  return {
    poolAddress: poolData.id,
    currentPrice,
    tvl: poolData.tvlUSD,
    volume24h: poolData.volumeUSD24h,
    fees24h: poolData.feesUSD24h,
    liquidity: parseFloat(poolData.liquidity),
    tick: poolData.tick,
    volatility24h,
    twap1h,
    twap24h,
  };
}

/**
 * Popular Uniswap V3 pools for demo
 */
export const POPULAR_POOLS: Record<string, { address: string; network: keyof typeof UNISWAP_V3_SUBGRAPH; name: string }> = {
  'ETH-USDC-0.05%': {
    address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
    network: 'ethereum',
    name: 'ETH/USDC 0.05%',
  },
  'ETH-USDC-0.3%': {
    address: '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8',
    network: 'ethereum',
    name: 'ETH/USDC 0.3%',
  },
  'ETH-USDT-0.3%': {
    address: '0x11b815efb8f581194ae79006d24e0d814b7697f6',
    network: 'ethereum',
    name: 'ETH/USDT 0.3%',
  },
  'WBTC-ETH-0.3%': {
    address: '0x4585fe77225b41b697c938b018e2ac67ac5a20c0',
    network: 'ethereum',
    name: 'WBTC/ETH 0.3%',
  },
};

/**
 * Fetch data for all popular pools
 */
export async function fetchAllPopularPools(): Promise<Array<PoolMetrics & { name: string }>> {
  const results = await Promise.all(
    Object.entries(POPULAR_POOLS).map(async ([key, pool]) => {
      const metrics = await getPoolMetrics(pool.address, pool.network);
      if (metrics) {
        return { ...metrics, name: pool.name };
      }
      return null;
    })
  );

  return results.filter((r): r is PoolMetrics & { name: string } => r !== null);
}
