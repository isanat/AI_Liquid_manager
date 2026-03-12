/**
 * Vault API — persists deposit/withdraw operations to SQLite via Prisma.
 * Also exposes vault history for the dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── POST /api/vault — deposit or withdraw ─────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, amount, shares } = body;

    if (action === 'deposit') {
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
      }

      // Upsert default vault in DB (for history tracking)
      const vault = await db.vault.upsert({
        where: { id: 'vault-001' },
        create: {
          id:           'vault-001',
          name:         'AI Liquidity Vault',
          protocol:     'uniswap-v3',
          network:      'ethereum',
          poolAddress:  '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8',
          token0Symbol: 'ETH',
          token1Symbol: 'USDC',
          token0Address:'0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          token1Address:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          feeTier:      3000,
          totalValueLocked: amount,
          availableCapital: amount,
        },
        update: {
          totalValueLocked: { increment: amount },
          availableCapital:  { increment: amount },
        },
      });

      return NextResponse.json({ success: true, vault, action: 'deposit', amount });
    }

    if (action === 'withdraw') {
      const withdrawShares = shares ?? amount; // accept either field
      if (!withdrawShares || typeof withdrawShares !== 'number' || withdrawShares <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid shares' }, { status: 400 });
      }

      // NAV ≈ 1.075 (kept in sync with store default)
      const usdValue = withdrawShares * 1.075;

      const vault = await db.vault.upsert({
        where: { id: 'vault-001' },
        create: {
          id:           'vault-001',
          name:         'AI Liquidity Vault',
          protocol:     'uniswap-v3',
          network:      'ethereum',
          poolAddress:  '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8',
          token0Symbol: 'ETH',
          token1Symbol: 'USDC',
          token0Address:'0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          token1Address:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          feeTier:      3000,
          totalValueLocked: 0,
          availableCapital: 0,
        },
        update: {
          totalValueLocked: { decrement: usdValue },
          availableCapital:  { decrement: usdValue },
        },
      });

      return NextResponse.json({ success: true, vault, action: 'withdraw', shares: withdrawShares, usdValue });
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Use deposit or withdraw.' }, { status: 400 });
  } catch (err) {
    console.error('[/api/vault POST]', err);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }
}

// ── GET /api/vault — vault summary + recent history ──────────────────────────
export async function GET() {
  try {
    const vault = await db.vault.findUnique({
      where: { id: 'vault-001' },
      include: {
        positions: { where: { status: 'active' }, take: 10, orderBy: { openedAt: 'desc' } },
        strategies: { where: { isActive: true }, take: 1 },
      },
    });

    return NextResponse.json({ success: true, vault });
  } catch (err) {
    console.error('[/api/vault GET]', err);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }
}
