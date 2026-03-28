import { NextRequest, NextResponse } from 'next/server';

const AI_ENGINE_URL = (process.env.AI_ENGINE_URL ?? '').replace(/\/$/, '');

// Fallback risk status when Python API is unavailable
function getFallbackRiskStatus() {
  return {
    status: 'disabled',
    error: 'AI Engine not connected. Configure AI_ENGINE_URL environment variable.',
    pilot: {
      current_phase: 'smoke_test',
      max_capital: 100,
      duration_days: 14,
      vault_address: null,
      metrics: {
        start_time: new Date().toISOString(),
        start_capital: 100,
        end_capital: 100,
        return_pct: 0,
        max_drawdown: 0,
        rebalances: 0,
        gas_cost: 0,
      },
      phase_history: [],
      pass_criteria: {
        min_return_pct: 0.5,
        max_drawdown_pct: 5,
        min_rebalances: 3,
      },
    },
    protection: {
      paused_vaults: {},
      daily_stats: {},
      recent_breaches: [],
      limits: {
        max_rebalances_per_day: 3,
        min_minutes_between: 60,
        volatility_pause: 0.15,
        max_exposure_per_cycle: 50,
      },
    },
    config: {
      version: '1.0.0-fallback',
      environment: 'development',
      fee_tier: 500,
      max_rebalances_per_day: 3,
      gas_multiplier: 1.5,
      slippage_bps: 10,
    },
  };
}

// Fallback pilot phase promotion response
function getFallbackPromotionResult() {
  return {
    success: false,
    error: 'AI Engine not connected. Configure AI_ENGINE_URL environment variable.',
    message: 'Cannot promote phase - AI Engine unavailable',
    current_phase: 'smoke_test',
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'health';
  const endpoint = searchParams.get('endpoint'); // For proxying to Python API
  const poolAddress = searchParams.get('pool');

  // Handle endpoint parameter for proxying to Python API
  if (endpoint) {
    if (!AI_ENGINE_URL) {
      // Return fallback for risk endpoints
      if (endpoint === '/risk/status') {
        return NextResponse.json(getFallbackRiskStatus());
      }
      return NextResponse.json({ 
        success: false, 
        error: 'AI_ENGINE_URL not configured. Set the environment variable to connect to the Python AI service.',
        endpoint,
      }, { status: 503 });
    }

    try {
      const response = await fetch(`${AI_ENGINE_URL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`AI Engine returned ${response.status}`);
      }
      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error('AI Engine proxy error:', error);
      
      // Return fallback for risk endpoints
      if (endpoint === '/risk/status') {
        return NextResponse.json(getFallbackRiskStatus());
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'AI Engine unavailable',
        endpoint,
      }, { status: 503 });
    }
  }

  // Legacy action-based routing
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
        // Use correct Python API endpoint: /inference/pool/{address}
        const response = await fetch(`${AI_ENGINE_URL}/inference/pool/${poolAddress}`, { method: 'POST' });
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Pool inference error:', errorText);
          throw new Error(`AI Engine returned ${response.status}`);
        }
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
    
    // Fallback for pool inference
    if (action === 'pool' && poolAddress) {
      return NextResponse.json({
        success: true,
        data: {
          range_width: 8.0,
          range_bias: 0.0,
          core_allocation: 70.0,
          defensive_allocation: 20.0,
          opportunistic_allocation: 10.0,
          cash_buffer: 5.0,
          rebalance_threshold: 0.05,
          confidence: 0.72,
          detected_regime: 'range',
          regime_confidence: 0.78,
          reasoning: 'Fallback response - AI Engine unavailable',
          model_version: 'fallback',
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
  const endpoint = searchParams.get('endpoint'); // For proxying to Python API

  // Handle endpoint parameter for proxying to Python API
  if (endpoint) {
    if (!AI_ENGINE_URL) {
      // Return fallback for risk endpoints
      if (endpoint.startsWith('/risk/pilot/promote')) {
        return NextResponse.json(getFallbackPromotionResult());
      }
      if (endpoint.startsWith('/risk/')) {
        return NextResponse.json({ 
          success: false, 
          error: 'AI Engine not connected',
          message: 'Risk management actions require the AI Engine to be running.',
        }, { status: 503 });
      }
      return NextResponse.json({ 
        success: false, 
        error: 'AI_ENGINE_URL not configured',
        endpoint,
      }, { status: 503 });
    }

    try {
      // Get query params from endpoint
      const [path, queryString] = endpoint.split('?');
      const queryParams = queryString ? `?${queryString}` : '';
      
      // Get request body if any
      let body = null;
      try {
        body = await request.json();
      } catch {
        // No body
      }

      const response = await fetch(`${AI_ENGINE_URL}${path}${queryParams}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI Engine returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error('AI Engine proxy error:', error);
      
      // Return fallback for risk endpoints
      if (endpoint.startsWith('/risk/pilot/promote')) {
        return NextResponse.json(getFallbackPromotionResult());
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'AI Engine unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
        endpoint,
      }, { status: 503 });
    }
  }

  // Legacy action-based routing
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
