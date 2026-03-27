/**
 * Liquidity API Route
 *
 * Server-side data layer — queries The Graph (Uniswap V3 subgraph) directly.
 * Falls back to deterministic rule-based values if The Graph is unavailable.
 *
 * Set THE_GRAPH_API_KEY in env for higher rate limits.
 * No API key needed for basic usage (public gateway, rate-limited).
 */
import { NextResponse } from 'next/server';

// ── The Graph config ──────────────────────────────────────────────────────────

const SUBGRAPH_ID = '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
// ETH/USDC 0.05% on Arbitrum One — same pool used by the vault contract
const DEFAULT_POOL = process.env.POOL_ADDRESS ?? '0xC6962004f452bE9203591991D15f6b388e09E8D0';

function getSubgraphUrls(): string[] {
  const urls: string[] = [];
  const key1 = process.env.THE_GRAPH_API_KEY?.trim();
  const key2 = process.env.THE_GRAPH_API_KEY2?.trim();
  if (key1) urls.push(`https://gateway.thegraph.com/api/${key1}/subgraphs/id/${SUBGRAPH_ID}`);
  if (key2) urls.push(`https://gateway.thegraph.com/api/${key2}/subgraphs/id/${SUBGRAPH_ID}`);
  // Public gateway always last
  urls.push(`https://gateway-arbitrum.network.thegraph.com/api/public/subgraphs/id/${SUBGRAPH_ID}`);
  return urls;
}

// ── GraphQL helpers ───────────────────────────────────────────────────────────

interface HourRow {
  periodStartUnix: string;
  tvlUSD: string;
  volumeUSD: string;
  feesUSD: string;
  token0Price: string;
  token1Price: string;
  liquidity: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

interface PoolState {
  sqrtPrice: string;
  tick: string;
  liquidity: string;
  token0Price: string;
  token1Price: string;
  totalValueLockedUSD: string;
  volumeUSD: string;
  feesUSD: string;
  feeTier: string;
  token0: { symbol: string };
  token1: { symbol: string };
}

async function graphQuery<T>(query: string): Promise<T | null> {
  for (const url of getSubgraphUrls()) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        next: { revalidate: 60 },
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.errors) continue; // try next endpoint
      return json.data as T;
    } catch {
      // try next
    }
  }
  return null;
}

async function fetchHourData(pool: string, hours = 48): Promise<HourRow[]> {
  const data = await graphQuery<{ poolHourDatas: HourRow[] }>(`{
    poolHourDatas(
      where: { pool: "${pool.toLowerCase()}" }
      orderBy: periodStartUnix
      orderDirection: desc
      first: ${hours}
    ) {
      periodStartUnix tvlUSD volumeUSD feesUSD
      token0Price token1Price liquidity
      open high low close
    }
  }`);
  const rows = data?.poolHourDatas ?? [];
  return [...rows].reverse(); // oldest first
}

async function fetchPoolState(pool: string): Promise<PoolState | null> {
  const data = await graphQuery<{ pool: PoolState }>(`{
    pool(id: "${pool.toLowerCase()}") {
      sqrtPrice tick liquidity
      token0Price token1Price
      totalValueLockedUSD volumeUSD feesUSD feeTier
      token0 { symbol } token1 { symbol }
    }
  }`);
  return data?.pool ?? null;
}

// ── Market data builder ───────────────────────────────────────────────────────

function buildMarketData(rows: HourRow[], state: PoolState | null) {
  const latest = rows.at(-1);
  const prev24 = rows.at(-25) ?? rows.at(0);

  const price = parseFloat(latest?.token0Price ?? state?.token0Price ?? '1850');
  const price24hAgo = parseFloat(prev24?.token0Price ?? state?.token0Price ?? String(price));
  const twap = rows.slice(-24).reduce((s, r) => s + parseFloat(r.token0Price), 0) / Math.max(rows.slice(-24).length, 1);

  const volume1h = parseFloat(latest?.volumeUSD ?? '0');
  const volume24h = rows.slice(-24).reduce((s, r) => s + parseFloat(r.volumeUSD), 0);
  const volume7dAvg = rows.reduce((s, r) => s + parseFloat(r.volumeUSD), 0) / Math.max(rows.length, 1);
  const volumeSpike = volume7dAvg > 0 && volume1h > volume7dAvg * 2;

  const tvl = parseFloat(latest?.tvlUSD ?? state?.totalValueLockedUSD ?? '25000000');
  const liquidity = parseFloat(latest?.liquidity ?? state?.liquidity ?? '0');

  // Realized 1-day volatility from hourly returns
  const closes = rows.slice(-25).map(r => parseFloat(r.close)).filter(p => p > 0);
  let volatility1d = 0.035;
  if (closes.length >= 2) {
    const returns = closes.slice(1).map((p, i) => Math.log(p / closes[i]));
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    volatility1d = Math.sqrt(variance * 24 * 365); // annualized hourly → daily
  }

  const priceVelocity = price24hAgo > 0 ? (price - price24hAgo) / price24hAgo : 0;
  const tick = state?.tick ? parseInt(state.tick) : Math.floor(Math.log(price) / Math.log(1.0001));

  return {
    timestamp: new Date().toISOString(),
    price,
    tick,
    twap,
    twap1h: twap,
    twap24h: price24hAgo,
    priceVelocity,
    liquidity: tvl,
    activeLiquidity: liquidity,
    depth: volume1h * 0.4,
    volume1h,
    volume24h,
    volumeSpike,
    volatility1d,
    volatility7d: volatility1d * 1.1,
    realizedVolatility: volatility1d * Math.sqrt(365),
    atr: price * volatility1d,
    stdDeviation: volatility1d * price,
    feesUSD24h: rows.slice(-24).reduce((s, r) => s + parseFloat(r.feesUSD), 0),
    // Source metadata
    dataSource: 'the-graph',
    poolAddress: DEFAULT_POOL,
  };
}

// ── AI model (rule-based, deterministic) ─────────────────────────────────────

function runModel(market: ReturnType<typeof buildMarketData>) {
  const { volatility1d, priceVelocity, volume24h, volume1h, volumeSpike } = market;

  const rangeWidth = Math.max(4, Math.min(15, volatility1d * 200));

  let core = 70, defensive = 20, opportunistic = 10;
  if (volatility1d > 0.05)      { core = 60; defensive = 30; opportunistic = 5; }
  else if (volatility1d < 0.02) { core = 75; defensive = 15; opportunistic = 10; }
  if (volumeSpike)              { opportunistic = Math.min(opportunistic + 5, 15); core -= 5; }

  let regime: string;
  if (Math.abs(priceVelocity) > 0.005)  regime = 'trend';
  else if (volatility1d > 0.05)         regime = 'high-vol';
  else if (volatility1d < 0.02)         regime = 'low-vol';
  else                                  regime = 'range';

  const reasons: string[] = [];
  if (volatility1d > 0.05) reasons.push('High volatility — widening ranges');
  if (volumeSpike) reasons.push('Volume spike — boosting opportunistic allocation');
  if (Math.abs(priceVelocity) > 0.01) {
    reasons.push(`Price drift ${priceVelocity > 0 ? 'upward' : 'downward'}`);
  }

  return {
    rangeWidth,
    rebalanceThreshold: 0.05 + volatility1d * 0.5,
    capitalAllocation: { core, defensive, opportunistic, cashBuffer: 5 },
    confidence: 0.72,
    reasoning: reasons.length
      ? reasons.join('. ')
      : 'Normal market conditions — standard allocation applied.',
    detectedRegime: regime,
    regimeConfidence: 0.78,
  };
}

function detectRegime(market: ReturnType<typeof buildMarketData>) {
  const { priceVelocity, volatility1d, volume24h } = market;
  let type = 'range';
  if (Math.abs(priceVelocity) > 0.005) type = 'trend';
  else if (volatility1d > 0.05)        type = 'high-vol';
  else if (volatility1d < 0.02)        type = 'low-vol';

  return {
    type,
    confidence: 0.78,
    detectedAt: new Date().toISOString(),
    indicators: {
      trendStrength: Math.abs(priceVelocity) * 50,
      volatilityLevel: volatility1d * 20,
      volumeProfile: Math.min((volume24h / 20_000_000) * 100, 100),
    },
  };
}

function calculateRanges(price: number, alloc: { core: number; defensive: number; opportunistic: number }) {
  const tick = Math.floor(Math.log(price) / Math.log(1.0001));
  return [
    {
      type: 'core',
      tickLower: tick - 600,  tickUpper: tick + 600,
      priceLower: price * 0.94, priceUpper: price * 1.06,
      percentage: alloc.core,
      liquidity: 8_750_000 * (alloc.core / 70),
    },
    {
      type: 'defensive',
      tickLower: tick - 1800, tickUpper: tick + 1800,
      priceLower: price * 0.82, priceUpper: price * 1.22,
      percentage: alloc.defensive,
      liquidity: 2_500_000 * (alloc.defensive / 20),
    },
    {
      type: 'opportunistic',
      tickLower: tick - 200,  tickUpper: tick + 200,
      priceLower: price * 0.98, priceUpper: price * 1.02,
      percentage: alloc.opportunistic,
      liquidity: 1_250_000 * (alloc.opportunistic / 10),
    },
  ];
}

// ── CoinGecko price fallback (free, no key, 30 req/min) ──────────────────────

async function fetchCoinGeckoPrice(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { next: { revalidate: 120 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.ethereum?.usd ?? null;
  } catch {
    return null;
  }
}

// ── Static fallback (used only when all data sources are unreachable) ─────────

async function buildFallback() {
  // Try CoinGecko for at least a real price
  const cgPrice = await fetchCoinGeckoPrice();
  const price = cgPrice ?? 1850;
  const volatility1d = 0.035;
  return {
    timestamp: new Date().toISOString(),
    price,
    tick: Math.floor(Math.log(price) / Math.log(1.0001)),
    twap: price,
    twap1h: price,
    twap24h: price,
    priceVelocity: 0,
    liquidity: 25_000_000,
    activeLiquidity: 12_000_000,
    depth: 600_000,
    volume1h: 600_000,
    volume24h: 12_000_000,
    volumeSpike: false,
    volatility1d,
    volatility7d: 0.04,
    realizedVolatility: volatility1d * Math.sqrt(365),
    atr: price * volatility1d,
    stdDeviation: volatility1d * price,
    feesUSD24h: 36_000,
    dataSource: cgPrice ? 'coingecko-price' : 'static-fallback',
    poolAddress: DEFAULT_POOL,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') ?? 'market';
  const pool = searchParams.get('pool') ?? DEFAULT_POOL;

  // Fetch real data (shared for all actions)
  const [rows, state] = await Promise.all([
    fetchHourData(pool, 48),
    fetchPoolState(pool),
  ]);

  const market = rows.length > 0
    ? buildMarketData(rows, state)
    : await buildFallback();

  switch (action) {
    case 'market':
      return NextResponse.json({ success: true, data: market });

    case 'ai-inference': {
      const outputs = runModel(market);
      return NextResponse.json({ success: true, inputs: market, outputs });
    }

    case 'regime': {
      const regime = detectRegime(market);
      return NextResponse.json({ success: true, regime });
    }

    case 'ranges': {
      const outputs = runModel(market);
      const ranges = calculateRanges(market.price, outputs.capitalAllocation);
      return NextResponse.json({ success: true, ranges, price: market.price });
    }

    case 'rebalance-score': {
      const outputs = runModel(market);
      const posCenter = market.price * (1 + market.priceVelocity * 0.5);
      const priceDistance = Math.abs(market.price - posCenter) / posCenter;
      const score = {
        priceDistance: priceDistance * 100,
        volatilityChange: market.volatility1d * 100,
        liquidityShift: 0,
        timeDecay: 5,
        total: priceDistance * 100 + market.volatility1d * 100 + 5,
        shouldRebalance: priceDistance > 0.05 || market.volatility1d > 0.06,
      };
      return NextResponse.json({ success: true, score });
    }

    case 'full': {
      const outputs = runModel(market);
      const regime = detectRegime(market);
      const ranges = calculateRanges(market.price, outputs.capitalAllocation);
      const posCenter = market.price;
      const priceDistance = 0;
      const rebalanceScore = {
        priceDistance,
        volatilityChange: market.volatility1d * 100,
        liquidityShift: 0,
        timeDecay: 5,
        total: market.volatility1d * 100 + 5,
        shouldRebalance: market.volatility1d > 0.06,
      };
      return NextResponse.json({
        success: true,
        data: { market, aiInputs: market, aiOutputs: outputs, regime, ranges, rebalanceScore },
      });
    }

    default:
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  }
  } catch (err) {
    console.error('[/api/liquidity]', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
