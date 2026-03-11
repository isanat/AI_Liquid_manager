import { NextResponse } from 'next/server';

// Simulated market data generator
function generateMarketData() {
  const basePrice = 1850 + Math.random() * 100;
  const volatility1d = 0.02 + Math.random() * 0.06;
  const volatility7d = volatility1d * (0.8 + Math.random() * 0.4);
  
  return {
    timestamp: new Date().toISOString(),
    price: basePrice,
    tick: Math.floor(Math.log(basePrice) / Math.log(1.0001)),
    twap: basePrice * (0.998 + Math.random() * 0.004),
    priceVelocity: (Math.random() - 0.5) * 0.01,
    liquidity: 15000000 + Math.random() * 10000000,
    activeLiquidity: 8000000 + Math.random() * 5000000,
    depth: 500000 + Math.random() * 300000,
    volume1h: 500000 + Math.random() * 300000,
    volume24h: 12000000 + Math.random() * 8000000,
    volumeSpike: Math.random() > 0.85,
    volatility1d,
    volatility7d,
    realizedVolatility: volatility1d * Math.sqrt(365),
    atr: basePrice * volatility1d,
    stdDeviation: volatility1d * basePrice,
  };
}

// AI model simulation
function runAIModel(inputs: {
  volatility1d: number;
  volatility7d: number;
  volume: number;
  liquidityDepth: number;
  priceDrift: number;
  volumeSpike: boolean;
}) {
  const rangeWidth = inputs.volatility1d * 2 * 100;
  
  let core = 70;
  let defensive = 20;
  let opportunistic = 10;
  
  if (inputs.volatility1d > 0.05) {
    core = 60;
    defensive = 30;
    opportunistic = 5;
  } else if (inputs.volatility1d < 0.02) {
    core = 75;
    defensive = 15;
    opportunistic = 10;
  }
  
  if (inputs.volumeSpike) {
    opportunistic = Math.min(opportunistic + 5, 15);
    core -= 5;
  }
  
  const confidence = 0.75 + Math.random() * 0.2;
  
  let reasoning = 'Normal market conditions. Standard allocation strategy applied.';
  if (inputs.volatility1d > 0.04) {
    reasoning = 'High volatility detected. Widening ranges and increasing defensive allocation.';
  } else if (inputs.volumeSpike) {
    reasoning = 'Volume spike detected. Increasing opportunistic allocation for fee capture.';
  } else if (inputs.priceDrift > 0.005) {
    reasoning = 'Upward price drift detected. Biasing range slightly upward.';
  } else if (inputs.priceDrift < -0.005) {
    reasoning = 'Downward price drift detected. Biasing range slightly downward.';
  }
  
  return {
    rangeWidth,
    rebalanceThreshold: 0.03 + inputs.volatility1d,
    capitalAllocation: {
      core,
      defensive,
      opportunistic,
      cashBuffer: 5,
    },
    confidence,
    reasoning,
  };
}

// Regime detection simulation
function detectRegime(marketData: ReturnType<typeof generateMarketData>) {
  const { priceVelocity, volatility1d, volume24h } = marketData;
  
  let type: 'trend' | 'range' | 'high-vol' | 'low-vol' = 'range';
  let confidence = 0.5 + Math.random() * 0.4;
  
  if (Math.abs(priceVelocity) > 0.005) {
    type = 'trend';
    confidence = 0.6 + Math.random() * 0.3;
  } else if (volatility1d > 0.05) {
    type = 'high-vol';
    confidence = 0.7 + Math.random() * 0.2;
  } else if (volatility1d < 0.02) {
    type = 'low-vol';
    confidence = 0.65 + Math.random() * 0.25;
  }
  
  return {
    type,
    confidence,
    detectedAt: new Date().toISOString(),
    indicators: {
      trendStrength: Math.abs(priceVelocity) * 50,
      volatilityLevel: volatility1d * 20,
      volumeProfile: (volume24h / 20000000) * 100,
    },
  };
}

// Calculate range configuration
function calculateRanges(price: number, allocation: { core: number; defensive: number; opportunistic: number }) {
  const tick = Math.floor(Math.log(price) / Math.log(1.0001));
  
  return [
    {
      type: 'core',
      tickLower: tick - 600,
      tickUpper: tick + 600,
      priceLower: price * 0.94,
      priceUpper: price * 1.06,
      percentage: allocation.core,
      liquidity: 8750000 * (allocation.core / 70),
    },
    {
      type: 'defensive',
      tickLower: tick - 1800,
      tickUpper: tick + 1800,
      priceLower: price * 0.82,
      priceUpper: price * 1.22,
      percentage: allocation.defensive,
      liquidity: 2500000 * (allocation.defensive / 20),
    },
    {
      type: 'opportunistic',
      tickLower: tick - 200,
      tickUpper: tick + 200,
      priceLower: price * 0.98,
      priceUpper: price * 1.02,
      percentage: allocation.opportunistic,
      liquidity: 1250000 * (allocation.opportunistic / 10),
    },
  ];
}

// Calculate rebalance score
function calculateRebalanceScore(
  currentPrice: number,
  positionCenter: number,
  volatilityChange: number,
  liquidityShift: number,
  timeSinceLastRebalance: number
) {
  const priceDistance = Math.abs(currentPrice - positionCenter) / positionCenter;
  const timeDecay = Math.min(timeSinceLastRebalance / 1440, 1);
  
  const score = {
    priceDistance: priceDistance * 100,
    volatilityChange: volatilityChange * 100,
    liquidityShift: liquidityShift * 100,
    timeDecay: timeDecay * 10,
    total: 0,
    shouldRebalance: false,
  };
  
  score.total = score.priceDistance + score.volatilityChange + score.liquidityShift + score.timeDecay;
  score.shouldRebalance = score.total > 0.65;
  
  return score;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'market';
  
  switch (action) {
    case 'market': {
      const data = generateMarketData();
      return NextResponse.json({ success: true, data });
    }
    
    case 'ai-inference': {
      const marketData = generateMarketData();
      const inputs = {
        volatility1d: marketData.volatility1d,
        volatility7d: marketData.volatility7d,
        volume: marketData.volume24h,
        liquidityDepth: marketData.liquidity,
        priceDrift: marketData.priceVelocity,
        volumeSpike: marketData.volumeSpike,
      };
      const outputs = runAIModel(inputs);
      return NextResponse.json({ success: true, inputs, outputs });
    }
    
    case 'regime': {
      const marketData = generateMarketData();
      const regime = detectRegime(marketData);
      return NextResponse.json({ success: true, regime });
    }
    
    case 'ranges': {
      const marketData = generateMarketData();
      const inputs = {
        volatility1d: marketData.volatility1d,
        volatility7d: marketData.volatility7d,
        volume: marketData.volume24h,
        liquidityDepth: marketData.liquidity,
        priceDrift: marketData.priceVelocity,
        volumeSpike: marketData.volumeSpike,
      };
      const outputs = runAIModel(inputs);
      const ranges = calculateRanges(marketData.price, outputs.capitalAllocation);
      return NextResponse.json({ success: true, ranges, price: marketData.price });
    }
    
    case 'rebalance-score': {
      const marketData = generateMarketData();
      const score = calculateRebalanceScore(
        marketData.price,
        marketData.price * (0.99 + Math.random() * 0.02),
        Math.random() * 0.1,
        Math.random() * 0.15,
        Math.random() * 720
      );
      return NextResponse.json({ success: true, score });
    }
    
    case 'full': {
      const marketData = generateMarketData();
      const inputs = {
        volatility1d: marketData.volatility1d,
        volatility7d: marketData.volatility7d,
        volume: marketData.volume24h,
        liquidityDepth: marketData.liquidity,
        priceDrift: marketData.priceVelocity,
        volumeSpike: marketData.volumeSpike,
      };
      const outputs = runAIModel(inputs);
      const regime = detectRegime(marketData);
      const ranges = calculateRanges(marketData.price, outputs.capitalAllocation);
      const rebalanceScore = calculateRebalanceScore(
        marketData.price,
        marketData.price * (0.99 + Math.random() * 0.02),
        Math.random() * 0.1,
        Math.random() * 0.15,
        Math.random() * 720
      );
      
      return NextResponse.json({
        success: true,
        data: {
          market: marketData,
          aiInputs: inputs,
          aiOutputs: outputs,
          regime,
          ranges,
          rebalanceScore,
        },
      });
    }
    
    default:
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  }
}
