import { NextRequest, NextResponse } from 'next/server';

// Use deployed AI Engine on Render by default
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'https://ai-liquid-manager.onrender.com';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'health';

  try {
    switch (action) {
      case 'health': {
        const response = await fetch(`${AI_ENGINE_URL}/health`);
        const data = await response.json();
        return NextResponse.json({ success: true, data });
      }

      case 'importance': {
        const response = await fetch(`${AI_ENGINE_URL}/features/importance`);
        const data = await response.json();
        return NextResponse.json({ success: true, data });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch {
    // Fallback to simulated data if AI engine not available
    if (action === 'health') {
      return NextResponse.json({
        success: true,
        data: {
          status: 'degraded',
          model_loaded: false,
          model_version: 'rule-based',
          uptime_seconds: 0,
          fallback: true,
        }
      });
    }
    return NextResponse.json({ success: false, error: 'AI Engine unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'inference';

  try {
    const body = await request.json();

    switch (action) {
      case 'inference': {
        const response = await fetch(`${AI_ENGINE_URL}/inference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        return NextResponse.json({ success: true, data });
      }

      case 'backtest': {
        const response = await fetch(`${AI_ENGINE_URL}/backtest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        return NextResponse.json({ success: true, data });
      }

      case 'train': {
        const response = await fetch(`${AI_ENGINE_URL}/train`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        return NextResponse.json({ success: true, data });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch {
    // Fallback to simulated inference
    if (action === 'inference') {
      return NextResponse.json({
        success: true,
        data: {
          range_width: 7,
          range_bias: 0,
          core_allocation: 70,
          defensive_allocation: 20,
          opportunistic_allocation: 10,
          cash_buffer: 5,
          rebalance_threshold: 0.065,
          confidence: 0.75,
          detected_regime: 'range',
          regime_confidence: 0.8,
          reasoning: 'Rule-based fallback: Normal market conditions detected.',
          model_version: 'rule-based-fallback',
          fallback: true,
        }
      });
    }
    return NextResponse.json({ success: false, error: 'AI Engine unavailable' }, { status: 503 });
  }
}
