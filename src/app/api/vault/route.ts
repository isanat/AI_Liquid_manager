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
          network:      'arbitrum',
          poolAddress:  '0xC6962004f452bE9203591991D15f6b388e09E8D0', // ETH/USDC 0.05% Arbitrum One
          token0Symbol: 'USDC',
          token1Symbol: 'WETH',
          token0Address:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC native Arbitrum
          token1Address:'0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH Arbitrum
          feeTier:      500,
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

      // Derive NAV from DB record (totalValueLocked / totalShares) or use 1:1 as fallback.
      // The authoritative NAV for on-chain withdrawals comes from the ERC-4626 vault directly;
      // this record is only for local history tracking.
      const existing = await db.vault.findUnique({ where: { id: 'vault-001' } });
      const nav = existing && existing.totalValueLocked > 0
        ? existing.totalValueLocked / Math.max(existing.totalValueLocked, 1)
        : 1.0;
      const usdValue = withdrawShares * nav;

      const vault = await db.vault.upsert({
        where: { id: 'vault-001' },
        create: {
          id:           'vault-001',
          name:         'AI Liquidity Vault',
          protocol:     'uniswap-v3',
          network:      'arbitrum',
          poolAddress:  '0xC6962004f452bE9203591991D15f6b388e09E8D0', // ETH/USDC 0.05% Arbitrum One
          token0Symbol: 'USDC',
          token1Symbol: 'WETH',
          token0Address:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC native Arbitrum
          token1Address:'0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH Arbitrum
          feeTier:      500,
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
