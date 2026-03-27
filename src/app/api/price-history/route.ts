/**
 * Server-side proxy for CoinGecko price history.
 * Avoids browser 401/CORS issues with the free CoinGecko API.
 */
import { NextResponse } from 'next/server';

const COINGECKO_KEY = process.env.COINGECKO_API_KEY ?? process.env.NEXT_PUBLIC_COINGECKO_API_KEY ?? '';

export async function GET() {
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=1&interval=hourly';
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (COINGECKO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_KEY;

    const res = await fetch(url, { headers, next: { revalidate: 300 } });
    if (!res.ok) {
      // Return empty dataset so the chart renders gracefully instead of crashing
      console.warn('[/api/price-history] upstream error', res.status);
      return NextResponse.json({ prices: [], error: 'upstream error', status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[/api/price-history]', err);
    return NextResponse.json({ prices: [], error: 'fetch failed' });
  }
}
