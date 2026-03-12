"""
The Graph - Uniswap V3 Subgraph Client

Fetches real pool data: price, volume, fees, TVL, ticks.
API key optional — uses public rate-limited gateway if absent.
Set THE_GRAPH_API_KEY env var to remove rate limits.
"""
import os
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import httpx
import structlog

logger = structlog.get_logger()

# Uniswap V3 mainnet subgraph on The Graph decentralized network
SUBGRAPH_ID = "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV"

# Default pool: ETH/USDC 0.3% on Ethereum mainnet
DEFAULT_POOL = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"

# Popular pools available for analysis
KNOWN_POOLS = {
    "eth-usdc-0.3": "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
    "eth-usdc-0.05": "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
    "eth-usdt-0.3": "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",
    "btc-eth-0.3": "0xcbcdf9626bc03e24f779434178a73a0b4bad62ed",
    "eth-dai-0.3": "0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8",
}


def _get_subgraph_url() -> str:
    api_key = os.getenv("THE_GRAPH_API_KEY", "").strip()
    if api_key:
        return f"https://gateway.thegraph.com/api/{api_key}/subgraphs/id/{SUBGRAPH_ID}"
    # Public endpoint — rate limited but functional for development
    return f"https://gateway-arbitrum.network.thegraph.com/api/public/subgraphs/id/{SUBGRAPH_ID}"


async def fetch_pool_hour_data(
    pool_address: str = DEFAULT_POOL,
    hours: int = 168,
) -> List[Dict[str, Any]]:
    """
    Fetch hourly pool snapshots from The Graph.

    Returns list sorted oldest→newest with keys:
        periodStartUnix, tvlUSD, volumeUSD, feesUSD,
        token0Price, token1Price, liquidity, open, high, low, close
    """
    url = _get_subgraph_url()
    query = """{
      poolHourDatas(
        where: { pool: "%s" }
        orderBy: periodStartUnix
        orderDirection: desc
        first: %d
      ) {
        periodStartUnix
        tvlUSD
        volumeUSD
        feesUSD
        token0Price
        token1Price
        liquidity
        open
        high
        low
        close
      }
    }""" % (pool_address.lower(), hours)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, json={"query": query})
            response.raise_for_status()
            data = response.json()

        if "errors" in data:
            logger.warning("GraphQL errors in poolHourDatas", errors=data["errors"])
            return []

        rows = data.get("data", {}).get("poolHourDatas", [])
        rows.reverse()  # oldest first
        return rows

    except httpx.TimeoutException:
        logger.warning("The Graph request timed out", pool=pool_address)
        return []
    except Exception as e:
        logger.error("Failed to fetch pool hour data", pool=pool_address, error=str(e))
        return []


async def fetch_pool_day_data(
    pool_address: str = DEFAULT_POOL,
    days: int = 90,
) -> List[Dict[str, Any]]:
    """
    Fetch daily pool snapshots for backtesting.

    Returns list sorted oldest→newest with keys:
        date (unix timestamp), tvlUSD, volumeUSD, feesUSD,
        token0Price, token1Price, liquidity, open, high, low, close, txCount
    """
    url = _get_subgraph_url()
    query = """{
      poolDayDatas(
        where: { pool: "%s" }
        orderBy: date
        orderDirection: desc
        first: %d
      ) {
        date
        tvlUSD
        volumeUSD
        feesUSD
        token0Price
        token1Price
        liquidity
        open
        high
        low
        close
        txCount
      }
    }""" % (pool_address.lower(), days)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, json={"query": query})
            response.raise_for_status()
            data = response.json()

        if "errors" in data:
            logger.warning("GraphQL errors in poolDayDatas", errors=data["errors"])
            return []

        rows = data.get("data", {}).get("poolDayDatas", [])
        rows.reverse()  # oldest first
        return rows

    except httpx.TimeoutException:
        logger.warning("The Graph day data request timed out", pool=pool_address)
        return []
    except Exception as e:
        logger.error("Failed to fetch pool day data", pool=pool_address, error=str(e))
        return []


async def fetch_pool_state(pool_address: str = DEFAULT_POOL) -> Optional[Dict[str, Any]]:
    """
    Fetch current pool state (latest snapshot) from The Graph.

    Returns dict with: sqrtPrice, tick, liquidity, token0Price, token1Price,
        volumeUSD, feesUSD, txCount, totalValueLockedUSD, feeTier,
        token0 {symbol, decimals}, token1 {symbol, decimals}
    """
    url = _get_subgraph_url()
    query = """{
      pool(id: "%s") {
        sqrtPrice
        tick
        liquidity
        token0Price
        token1Price
        volumeUSD
        feesUSD
        txCount
        totalValueLockedUSD
        feeTier
        token0 { symbol decimals }
        token1 { symbol decimals }
      }
    }""" % pool_address.lower()

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json={"query": query})
            response.raise_for_status()
            data = response.json()

        if "errors" in data:
            logger.warning("GraphQL errors in pool query", errors=data["errors"])
            return None

        return data.get("data", {}).get("pool")

    except httpx.TimeoutException:
        logger.warning("The Graph pool state request timed out", pool=pool_address)
        return None
    except Exception as e:
        logger.error("Failed to fetch pool state", pool=pool_address, error=str(e))
        return None


async def fetch_recent_swaps(
    pool_address: str = DEFAULT_POOL,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """
    Fetch recent swap events for a pool.
    Useful for computing realized volatility and volume velocity.
    """
    url = _get_subgraph_url()
    query = """{
      swaps(
        where: { pool: "%s" }
        orderBy: timestamp
        orderDirection: desc
        first: %d
      ) {
        timestamp
        amount0
        amount1
        amountUSD
        sqrtPriceX96
        tick
      }
    }""" % (pool_address.lower(), limit)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json={"query": query})
            response.raise_for_status()
            data = response.json()

        if "errors" in data:
            return []

        swaps = data.get("data", {}).get("swaps", [])
        swaps.reverse()
        return swaps

    except Exception as e:
        logger.error("Failed to fetch swaps", pool=pool_address, error=str(e))
        return []
