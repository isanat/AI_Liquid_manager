import { NextRequest, NextResponse } from 'next/server';

const AI_ENGINE_URL = (process.env.AI_ENGINE_URL ?? '').replace(/\/$/, '');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'health';
  const poolAddress = searchParams.get('pool');

  if (!AI_ENGINE_URL) {
    return NextResponse.json({ success: false, error: 'AI_ENGINE_URL not configured' }, { status: 503 });
  }

  try {
    switch (action) {
      case 'health': {
        const response = await fetch(`${AI_ENGINE_URL}/health`);
        if (!response.ok) throw new Error(`AI Engine returned ${response.status}`);
        const data = await response.json();
        return NextResponse.json({ success: true, data });
      }

      case 'importance': {
        const response = await fetch(`${AI_ENGINE_URL}/features/importance`);
        if (!response.ok) throw new Error(`AI Engine returned ${response.status}`);
        const data = await response.json();
        return NextResponse.json({ success: true, data });
      }

      case 'pool': {
        if (!poolAddress) {
          return NextResponse.json({ success: false, error: 'Pool address required' }, { status: 400 });
        }
        const network = searchParams.get('network') || 'arbitrum';
        const response = await fetch(`${AI_ENGINE_URL}/pool/${poolAddress}?network=${network}`);
        if (!response.ok) throw new Error(`AI Engine returned ${response.status}`);
        const data = await response.json();
        return NextResponse.json({ success: true, data });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('AI Engine error:', error);
    
    // Fallback to simulated data if AI engine not available
    if (action === 'health') {
      return NextResponse.json({
        success: true,
        data: {
          status: 'degraded',
          model_loaded: false,
          model_version: 'fallback',
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

  if (!AI_ENGINE_URL) {
    return NextResponse.json({ success: false, error: 'AI_ENGINE_URL not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();

    switch (action) {
      case 'inference': {
        const response = await fetch(`${AI_ENGINE_URL}/inference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`AI Engine returned ${response.status}`);
        const data = await response.json();
        return NextResponse.json({ success: true, data });
      }

      case 'backtest': {
        const response = await fetch(`${AI_ENGINE_URL}/backtest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`AI Engine returned ${response.status}`);
        const data = await response.json();
        return NextResponse.json({ success: true, data });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('AI Engine error:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: 'AI Engine unavailable. Check if the service is running.' 
    }, { status: 503 });
  }
}
