"""
DeFiLlama API Client

Fetches historical APY, IL, and TVL data.
No API key required — completely free.
"""
from typing import List, Dict, Any, Optional
import httpx
import structlog

logger = structlog.get_logger()

YIELDS_BASE = "https://yields.llama.fi"

# Pre-mapped DeFiLlama pool IDs for Uniswap V3 mainnet pools
# (avoids slow /pools scan on every call)
POOL_ID_MAP = {
    # ETH/USDC 0.3%
    "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8": "747c1d2a-c668-4682-b9f9-296708a3dd90",
    # ETH/USDC 0.05%
    "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640": "b4c82598-07da-4d8a-abc6-f4d37e6f6b16",
    # ETH/USDT 0.3%
    "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36": "4b9b0c97-0e41-48bd-87ba-4c9f4a226c8e",
    # WBTC/ETH 0.3%
    "0xcbcdf9626bc03e24f779434178a73a0b4bad62ed": "6e24b43c-5b6c-4eca-bdfa-05a0c4e9d5c1",
}


async def get_pool_apy_history(pool_address: str) -> List[Dict[str, Any]]:
    """
    Fetch daily APY + TVL + IL history for a Uniswap V3 pool.

    Returns list of dicts with keys:
        timestamp (ISO string), tvlUsd, apy, apyBase, apyReward, il7d, apyBase7d

    Falls back gracefully if pool not in DeFiLlama index.
    """
    pool_id = POOL_ID_MAP.get(pool_address.lower())

    if not pool_id:
        pool_id = await _find_pool_id(pool_address)

    if not pool_id:
        logger.warning("Pool not found in DeFiLlama", pool_address=pool_address)
        return []

    return await _fetch_history(pool_id)


async def _fetch_history(pool_id: str) -> List[Dict[str, Any]]:
    """Fetch APY history for a known DeFiLlama pool ID."""
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.get(f"{YIELDS_BASE}/chart/{pool_id}")
            response.raise_for_status()
            return response.json().get("data", [])
    except httpx.TimeoutException:
        logger.warning("DeFiLlama request timed out", pool_id=pool_id)
        return []
    except Exception as e:
        logger.error("Failed to fetch DeFiLlama history", pool_id=pool_id, error=str(e))
        return []


async def _find_pool_id(pool_address: str) -> Optional[str]:
    """
    Search DeFiLlama /pools for a Uniswap V3 pool by contract address.
    Only used as fallback when address not in POOL_ID_MAP.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{YIELDS_BASE}/pools")
            response.raise_for_status()
            pools = response.json().get("data", [])

        addr_lower = pool_address.lower()
        for pool in pools:
            if (
                pool.get("project") == "uniswap-v3"
                and pool.get("chain") == "Ethereum"
                and pool.get("pool", "").lower() == addr_lower
            ):
                return pool.get("pool")

        return None

    except Exception as e:
        logger.error("Failed to search DeFiLlama pools", error=str(e))
        return None


async def get_latest_apy(pool_address: str) -> Optional[Dict[str, Any]]:
    """
    Return only the most recent APY snapshot for a pool.
    Returns None if data unavailable.
    """
    history = await get_pool_apy_history(pool_address)
    if not history:
        return None
    return history[-1]
