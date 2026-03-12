"""
AI Liquidity Manager - Standalone FastAPI Service
"""
import os
from datetime import datetime
from typing import Optional, Dict, Any
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="AI Liquidity Manager",
    description="ML-powered liquidity management for Uniswap V3 / Orca",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Models ===

class MarketDataInput(BaseModel):
    price: float
    twap_1h: Optional[float] = None
    twap_24h: Optional[float] = None
    volume_1h: float
    volume_24h: float
    total_liquidity: float
    active_liquidity: float
    tick: Optional[int] = None


class StrategyOutput(BaseModel):
    range_width: float
    range_bias: float
    core_allocation: float
    defensive_allocation: float
    opportunistic_allocation: float
    cash_buffer: float
    rebalance_threshold: float
    confidence: float
    detected_regime: str
    regime_confidence: float
    reasoning: str
    model_version: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: Optional[str]
    uptime_seconds: float


# === Global State ===

start_time = datetime.utcnow()
MODEL_VERSION = "rule-based-v1"


def rule_based_inference(data: MarketDataInput) -> StrategyOutput:
    """Rule-based inference"""
    
    if data.twap_24h and data.twap_24h > 0:
        price_drift = (data.price - data.twap_24h) / data.twap_24h
    else:
        price_drift = 0.0
    
    volatility = 0.035
    range_width = volatility * 200
    range_width = max(4.0, min(15.0, range_width))
    
    if volatility > 0.05:
        core, defensive, opportunistic = 60.0, 30.0, 5.0
        regime = "high-vol"
    elif volatility < 0.02:
        core, defensive, opportunistic = 75.0, 15.0, 10.0
        regime = "low-vol"
    else:
        core, defensive, opportunistic = 70.0, 20.0, 10.0
        regime = "range"
    
    return StrategyOutput(
        range_width=range_width,
        range_bias=price_drift * 10,
        core_allocation=core,
        defensive_allocation=defensive,
        opportunistic_allocation=opportunistic,
        cash_buffer=5.0,
        rebalance_threshold=0.05 + volatility * 0.5,
        confidence=0.75,
        detected_regime=regime,
        regime_confidence=0.8,
        reasoning="Normal market conditions. Standard allocation strategy applied.",
        model_version=MODEL_VERSION,
    )


# === Endpoints ===

@app.get("/")
async def root():
    return {
        "service": "AI Liquidity Manager",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="healthy",
        model_loaded=False,
        model_version=MODEL_VERSION,
        uptime_seconds=(datetime.utcnow() - start_time).total_seconds(),
    )


@app.post("/inference", response_model=StrategyOutput)
async def inference(data: MarketDataInput):
    try:
        logger.info(f"Running inference - price: {data.price}")
        return rule_based_inference(data)
    except Exception as e:
        logger.error(f"Inference failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    logger.info(f"Starting AI Liquidity Manager on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
