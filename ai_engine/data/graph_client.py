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

# Uniswap V3 subgraph on The Graph decentralized network.
# NOTE: this subgraph indexes Ethereum mainnet pools. If DEFAULT_POOL is an
# Arbitrum pool address, queries against this subgraph will return null — you
# will need a separate Arbitrum-specific subgraph ID for Arbitrum data.
SUBGRAPH_ID = "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV"

# Default pool: ETH/USDC 0.05% on Arbitrum One.
# Override via POOL_ADDRESS env var. Note that this address must match the
# chain indexed by SUBGRAPH_ID above.
DEFAULT_POOL = os.getenv("POOL_ADDRESS", "0xC6962004f452bE9203591991D15f6b388e09E8D0")


def _build_gateway_url(api_key: str) -> str:
    return f"https://gateway.thegraph.com/api/{api_key}/subgraphs/id/{SUBGRAPH_ID}"


def _get_subgraph_urls() -> list[str]:
    """
    Returns candidate subgraph URLs in priority order.
    - THE_GRAPH_API_KEY  → primary authenticated endpoint
    - THE_GRAPH_API_KEY2 → optional second key as hot standby
    - Public gateway     → always present as last resort (rate-limited)
    """
    urls = []

    key1 = os.getenv("THE_GRAPH_API_KEY", "").strip()
    if key1:
        urls.append(_build_gateway_url(key1))

    key2 = os.getenv("THE_GRAPH_API_KEY2", "").strip()
    if key2:
        urls.append(_build_gateway_url(key2))

    # Public gateway — always available, no key, rate-limited
    urls.append(
        f"https://gateway-arbitrum.network.thegraph.com/api/public/subgraphs/id/{SUBGRAPH_ID}"
    )
    return urls

# Reference pools for analysis (Ethereum mainnet addresses — use with mainnet subgraph)
KNOWN_POOLS = {
    "eth-usdc-0.3":  "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",   # mainnet
    "eth-usdc-0.05": "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",   # mainnet
    "eth-usdt-0.3":  "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",   # mainnet
    "btc-eth-0.3":   "0xcbcdf9626bc03e24f779434178a73a0b4bad62ed",   # mainnet
    "eth-dai-0.3":   "0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8",   # mainnet
    # Arbitrum One — requires Arbitrum-specific subgraph
    "arb-eth-usdc-0.05": "0xC6962004f452bE9203591991D15f6b388e09E8D0",
}


async def _graph_post(query: str) -> Optional[Dict[str, Any]]:
    """
    POST a GraphQL query trying each URL in _get_subgraph_urls() until one succeeds.
    Returns parsed .data dict or None on total failure.
    """
    last_error: str = ""
    for url in _get_subgraph_urls():
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(url, json={"query": query})
                response.raise_for_status()
                payload = response.json()
                if "errors" in payload:
                    last_error = str(payload["errors"])
                    continue  # try next endpoint
                return payload.get("data")
        except httpx.TimeoutException:
            last_error = "timeout"
        except httpx.HTTPStatusError as e:
            last_error = f"HTTP {e.response.status_code}"
        except Exception as e:
            last_error = str(e)

    logger.warning("All Graph endpoints failed", last_error=last_error)
    return None


async def fetch_pool_hour_data(
    pool_address: str = DEFAULT_POOL,
    hours: int = 168,
) -> List[Dict[str, Any]]:
    """
    Fetch hourly pool snapshots (oldest→newest).
    Tries primary key → secondary key → public gateway automatically.
    """
    query = """{
      poolHourDatas(
        where: { pool: "%s" }
        orderBy: periodStartUnix
        orderDirection: desc
        first: %d
      ) {
        periodStartUnix tvlUSD volumeUSD feesUSD
        token0Price token1Price liquidity
        open high low close
      }
    }""" % (pool_address.lower(), hours)

    data = await _graph_post(query)
    if not data:
        return []
    rows = data.get("poolHourDatas", [])
    rows.reverse()
    return rows


async def fetch_pool_day_data(
    pool_address: str = DEFAULT_POOL,
    days: int = 90,
) -> List[Dict[str, Any]]:
    """
    Fetch daily pool snapshots for backtesting (oldest→newest).
    Tries primary key → secondary key → public gateway automatically.
    """
    query = """{
      poolDayDatas(
        where: { pool: "%s" }
        orderBy: date
        orderDirection: desc
        first: %d
      ) {
        date tvlUSD volumeUSD feesUSD
        token0Price token1Price liquidity
        open high low close txCount
      }
    }""" % (pool_address.lower(), days)

    data = await _graph_post(query)
    if not data:
        return []
    rows = data.get("poolDayDatas", [])
    rows.reverse()
    return rows


async def fetch_pool_state(pool_address: str = DEFAULT_POOL) -> Optional[Dict[str, Any]]:
    """
    Fetch current pool state.
    Tries primary key → secondary key → public gateway automatically.
    """
    query = """{
      pool(id: "%s") {
        sqrtPrice tick liquidity
        token0Price token1Price
        totalValueLockedUSD volumeUSD feesUSD feeTier txCount
        token0 { symbol decimals }
        token1 { symbol decimals }
      }
    }""" % pool_address.lower()

    data = await _graph_post(query)
    return data.get("pool") if data else None


async def fetch_recent_swaps(
    pool_address: str = DEFAULT_POOL,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """
    Fetch recent swap events (oldest→newest).
    Useful for computing realized volatility and volume velocity.
    """
    query = """{
      swaps(
        where: { pool: "%s" }
        orderBy: timestamp
        orderDirection: desc
        first: %d
      ) {
        timestamp amount0 amount1 amountUSD sqrtPriceX96 tick
      }
    }""" % (pool_address.lower(), limit)

    data = await _graph_post(query)
    if not data:
        return []
    swaps = data.get("swaps", [])
    swaps.reverse()
    return swaps
