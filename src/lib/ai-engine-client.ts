/**
 * AI Engine Client
 * Connects Next.js frontend to Python AI backend
 */

// Use deployed AI Engine on Render by default, fallback to localhost for development
const AI_ENGINE_URL = process.env.NEXT_PUBLIC_AI_ENGINE_URL || 'https://ai-liquid-manager.onrender.com';

export interface MarketDataInput {
  price: number;
  twap_1h?: number;
  twap_24h?: number;
  volume_1h: number;
  volume_24h: number;
  total_liquidity: number;
  active_liquidity: number;
  tick?: number;
}

export interface StrategyOutput {
  range_width: number;
  range_bias: number;
  core_allocation: number;
  defensive_allocation: number;
  opportunistic_allocation: number;
  cash_buffer: number;
  rebalance_threshold: number;
  confidence: number;
  detected_regime: string;
  regime_confidence: number;
  reasoning: string;
  model_version: string;
}

export interface BacktestResult {
  total_return: number;
  apr: number;
  sharpe_ratio: number;
  max_drawdown: number;
  fees_collected: number;
  impermanent_loss: number;
  rebalance_count: number;
  total_gas_cost: number;
  vs_hodl: number;
}

/**
 * Run AI inference on market data
 */
export async function runInference(data: MarketDataInput): Promise<StrategyOutput> {
  const response = await fetch(`${AI_ENGINE_URL}/inference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Inference failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Run inference for a specific pool
 */
export async function runInferenceForPool(poolAddress: string): Promise<StrategyOutput> {
  const response = await fetch(`${AI_ENGINE_URL}/inference/pool/${poolAddress}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Pool inference failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Run backtest
 */
export async function runBacktest(config: {
  days?: number;
  initial_capital?: number;
  volatility?: number;
  trend?: number;
}): Promise<BacktestResult> {
  const response = await fetch(`${AI_ENGINE_URL}/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Backtest failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Train model
 */
export async function trainModel(config?: {
  use_synthetic?: boolean;
  epochs?: number;
}): Promise<{ success: boolean; message: string; metrics: Record<string, number> }> {
  const response = await fetch(`${AI_ENGINE_URL}/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config || { use_synthetic: true }),
  });

  if (!response.ok) {
    throw new Error(`Training failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get feature importance
 */
export async function getFeatureImportance(): Promise<{
  feature_importance: Record<string, number>;
  model_version: string;
}> {
  const response = await fetch(`${AI_ENGINE_URL}/features/importance`);

  if (!response.ok) {
    throw new Error(`Failed to get feature importance: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{
  status: string;
  model_loaded: boolean;
  model_version?: string;
  uptime_seconds: number;
}> {
  const response = await fetch(`${AI_ENGINE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return response.json();
}
