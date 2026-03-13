/**
 * Server-side proxy for AI Engine status.
 *
 * Fetches /health and /keeper/status from the AI Engine using the
 * server-side AI_ENGINE_URL env var (linked via Render's fromService).
 * The browser calls /api/system-status — no CORS issues, no hardcoded URL.
 */
import { NextResponse } from 'next/server';

const AI_URL = (process.env.AI_ENGINE_URL ?? '').replace(/\/$/, '');

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!AI_URL) {
    return NextResponse.json(
      { error: 'AI_ENGINE_URL not configured on server' },
      { status: 503 },
    );
  }

  try {
    const [health, keeper] = await Promise.allSettled([
      fetch(`${AI_URL}/health`,         { next: { revalidate: 0 } }).then(r => r.json()),
      fetch(`${AI_URL}/keeper/status`,  { next: { revalidate: 0 } }).then(r => r.json()),
    ]);

    return NextResponse.json({
      ai_url:  AI_URL,
      health:  health.status  === 'fulfilled' ? health.value  : null,
      keeper:  keeper.status  === 'fulfilled' ? keeper.value  : null,
      health_error:  health.status  === 'rejected' ? String(health.reason)  : null,
      keeper_error:  keeper.status  === 'rejected' ? String(keeper.reason)  : null,
    });
  } catch (err) {
    console.error('[/api/system-status]', err);
    return NextResponse.json({ error: 'Failed to reach AI Engine', ai_url: AI_URL }, { status: 502 });
  }
}
