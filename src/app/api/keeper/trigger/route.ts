/**
 * POST /api/keeper/trigger
 * Server-side proxy → AI engine POST /keeper/trigger
 * Allows the dashboard "Rebalance" button to manually fire one keeper cycle.
 */
import { NextResponse } from 'next/server';

const AI_URL = process.env.AI_ENGINE_URL ?? '';

export async function POST() {
  if (!AI_URL) {
    return NextResponse.json({ error: 'AI_ENGINE_URL not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${AI_URL}/keeper/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (err) {
    console.error('[/api/keeper/trigger]', err);
    return NextResponse.json({ error: 'AI engine unreachable' }, { status: 502 });
  }
}
