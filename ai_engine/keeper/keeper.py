"""
AI Liquid Vault — Keeper Bot
════════════════════════════
Runs every 15 minutes (APScheduler) and:
  1. Calls FastAPI /predict → get AI strategy params (tick range, allocation %)
  2. Converts the suggested price range → Uniswap V3 ticks
  3. Calls vault.rebalance(tickLower, tickUpper, amount0, amount1) on Arbitrum
  4. Calls vault.collectFees() to harvest LP fees back into the vault

Required environment variables:
  VAULT_ADDRESS        – deployed AILiquidVault address
  KEEPER_PRIVATE_KEY   – hex private key (0x...) of the strategy manager EOA
  RPC_URL_ARBITRUM     – Arbitrum One RPC (e.g. Alchemy)
  AI_ENGINE_URL        – base URL of FastAPI service (default http://localhost:8000)

Optional:
  REBALANCE_INTERVAL   – cron interval in minutes (default 15)
  USDC_DEPLOY_PCT      – % of idle USDC to deploy per cycle (default 80)
"""

from __future__ import annotations

import asyncio
import logging
import math
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from web3 import AsyncWeb3, Web3
from web3.middleware import ExtraDataToPOAMiddleware

logger = logging.getLogger(__name__)

# ─── Contract addresses (Arbitrum One) ───────────────────────────────────────

# Configurable via env — defaults to Arbitrum One; override for testnet
USDC_ADDRESS   = os.getenv("USDC_ADDRESS", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831")

TICK_SPACING   = 10   # 0.05% pool
TICK_LIMIT     = 887272

# ─── Minimal ABIs ─────────────────────────────────────────────────────────────

VAULT_ABI = [
    {
        "name": "rebalance",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "tickLower",      "type": "int24"},
            {"name": "tickUpper",      "type": "int24"},
            {"name": "amount0Desired", "type": "uint256"},
            {"name": "amount1Desired", "type": "uint256"},
        ],
        "outputs": [],
    },
    {
        "name": "collectFees",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs":  [],
        "outputs": [],
    },
    {
        "name": "totalAssets",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "paused",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "strategyManager",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [],
        "outputs": [{"name": "", "type": "address"}],
    },
    {
        "name": "activePositionCount",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

ERC20_ABI = [
    {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

# ─── Keeper state (kept in memory; FastAPI /keeper/status reads this) ─────────

# Keeper interval in seconds (exported for /keeper/status endpoint)
REBALANCE_INTERVAL = int(os.getenv("REBALANCE_INTERVAL", "15")) * 60  # default 15 min

keeper_state: dict = {
    "last_run":              None,   # ISO timestamp
    "last_run_timestamp":    None,   # Unix epoch float (for next_run_in_seconds calc)
    "last_tx_hash":          None,
    "last_error":            None,
    "total_runs":            0,
    "total_rebalances":      0,
    "status":                "idle",
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def price_to_tick(price: float) -> int:
    """Convert a price (USDC per WETH) to a Uniswap V3 tick."""
    # For USDC/WETH pool, token0=USDC (6 dec), token1=WETH (18 dec)
    # Adjusted price = price * 10^(18-6) = price * 1e12
    adjusted = price * 1e12
    tick = math.floor(math.log(adjusted) / math.log(1.0001))
    return tick


def nearest_usable_tick(tick: int, spacing: int = TICK_SPACING) -> int:
    """Round tick to nearest valid tick spacing."""
    return round(tick / spacing) * spacing


def clamp_tick(tick: int) -> int:
    return max(-TICK_LIMIT, min(TICK_LIMIT, tick))


# ─── Core keeper logic ────────────────────────────────────────────────────────

async def run_keeper_cycle(w3: AsyncWeb3, vault, keeper_account: str) -> dict:
    """Execute one full keeper cycle: predict → rebalance → collectFees."""

    ai_url   = os.getenv("AI_ENGINE_URL", "http://localhost:8000")
    usdc_pct = float(os.getenv("USDC_DEPLOY_PCT", "80")) / 100.0

    result = {"success": False, "action": None, "tx_hash": None, "error": None}

    # ── 0. Check vault is not paused ─────────────────────────────────────────
    is_paused = await vault.functions.paused().call()
    if is_paused:
        result["error"] = "Vault is paused"
        logger.warning("Keeper: vault is paused, skipping cycle")
        return result

    # ── 1. Get idle USDC balance in vault ────────────────────────────────────
    usdc_contract = w3.eth.contract(
        address=Web3.to_checksum_address(USDC_ADDRESS),
        abi=ERC20_ABI,
    )
    idle_usdc = await usdc_contract.functions.balanceOf(vault.address).call()
    # USDC has 6 decimals
    idle_usdc_human = idle_usdc / 1e6
    logger.info(f"Keeper: idle USDC in vault = ${idle_usdc_human:,.2f}")

    # ── 2. Call AI /predict endpoint ─────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{ai_url}/predict")
            resp.raise_for_status()
            prediction = resp.json()
    except Exception as e:
        result["error"] = f"AI predict failed: {e}"
        logger.error(f"Keeper: {result['error']}")
        # Still try to collect fees even if predict fails
        await _collect_fees(vault, w3, keeper_account, result)
        return result

    logger.info(f"Keeper: AI prediction = {prediction}")

    # ── 3. Parse strategy params ─────────────────────────────────────────────
    # Expected keys from /predict: current_price, range_width, core_pct, confidence
    # current_price MUST come from the AI — no fallback to avoid deploying at stale price
    if "current_price" not in prediction or not prediction["current_price"]:
        result["error"] = "AI /predict missing current_price — refusing to rebalance"
        logger.error(f"Keeper: {result['error']}")
        await _collect_fees(vault, w3, keeper_account, result)  # still harvest fees
        return result

    current_price = float(prediction["current_price"])
    range_width   = float(prediction.get("range_width", 0.06))   # ±6%
    core_pct      = float(prediction.get("core_pct",    0.7))    # 70% of capital
    confidence    = float(prediction.get("confidence",  0.0))

    lower_price = current_price * (1 - range_width)
    upper_price = current_price * (1 + range_width)

    tick_lower = clamp_tick(nearest_usable_tick(price_to_tick(lower_price)))
    tick_upper = clamp_tick(nearest_usable_tick(price_to_tick(upper_price)))

    if tick_lower >= tick_upper:
        result["error"] = f"Invalid tick range: {tick_lower} >= {tick_upper} (price={current_price}, width={range_width})"
        logger.error(f"Keeper: {result['error']}")
        # Still collect fees even when range is invalid — capital stays idle until next cycle
        await _collect_fees(vault, w3, keeper_account, result)
        return result

    # Amount of USDC to deploy (apply core_pct and usdc_pct safety limit)
    deploy_ratio  = min(core_pct, usdc_pct)
    amount0       = int(idle_usdc * deploy_ratio)  # USDC in wei (6 dec)
    amount1       = 0  # USDC-only strategy — no WETH deployment

    if amount0 == 0:
        logger.info("Keeper: no idle USDC to deploy, collecting fees only")
        await _collect_fees(vault, w3, keeper_account, result)
        return result

    logger.info(
        f"Keeper: rebalancing | range ${lower_price:.0f}–${upper_price:.0f} "
        f"| ticks [{tick_lower}, {tick_upper}] | deploying {amount0/1e6:,.2f} USDC "
        f"| confidence {confidence:.0%}"
    )

    # ── 4. Call vault.rebalance() ─────────────────────────────────────────────
    try:
        nonce    = await w3.eth.get_transaction_count(keeper_account)
        gas_price = await w3.eth.gas_price

        tx = await vault.functions.rebalance(
            tick_lower, tick_upper, amount0, amount1
        ).build_transaction({
            "from":     keeper_account,
            "nonce":    nonce,
            "gasPrice": int(gas_price * 1.1),  # 10% buffer
        })

        # Estimate gas
        try:
            tx["gas"] = await w3.eth.estimate_gas(tx)
        except Exception:
            tx["gas"] = 800_000  # fallback

        # Sign and send
        private_key = os.environ["KEEPER_PRIVATE_KEY"]
        signed      = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash     = await w3.eth.send_raw_transaction(signed.raw_transaction)
        tx_hash_hex = tx_hash.hex()

        logger.info(f"Keeper: rebalance tx sent = {tx_hash_hex}")

        # Wait for confirmation
        receipt = await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt.status != 1:
            raise RuntimeError(f"Rebalance tx reverted: {tx_hash_hex}")

        logger.info(f"Keeper: rebalance confirmed in block {receipt.blockNumber}")
        result["action"]   = "rebalance"
        result["tx_hash"]  = tx_hash_hex
        result["success"]  = True

    except Exception as e:
        result["error"] = f"Rebalance failed: {e}"
        logger.error(f"Keeper: {result['error']}")
        return result

    # ── 5. Collect fees ───────────────────────────────────────────────────────
    await _collect_fees(vault, w3, keeper_account, result)
    return result


async def _collect_fees(vault, w3: AsyncWeb3, keeper_account: str, result: dict) -> None:
    """Collect LP fees from all active positions."""
    try:
        active = await vault.functions.activePositionCount().call()
        if active == 0:
            logger.info("Keeper: no active positions to collect fees from")
            return

        nonce    = await w3.eth.get_transaction_count(keeper_account)
        gas_price = await w3.eth.gas_price

        tx = await vault.functions.collectFees().build_transaction({
            "from":     keeper_account,
            "nonce":    nonce,
            "gasPrice": int(gas_price * 1.1),
        })
        try:
            tx["gas"] = await w3.eth.estimate_gas(tx)
        except Exception:
            tx["gas"] = 300_000

        private_key = os.environ["KEEPER_PRIVATE_KEY"]
        signed      = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash     = await w3.eth.send_raw_transaction(signed.raw_transaction)
        tx_hash_hex = tx_hash.hex()

        receipt = await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        if receipt.status == 1:
            logger.info(f"Keeper: collectFees confirmed = {tx_hash_hex}")
            if not result.get("tx_hash"):
                result["tx_hash"] = tx_hash_hex
        else:
            logger.warning(f"Keeper: collectFees reverted = {tx_hash_hex}")

    except Exception as e:
        logger.warning(f"Keeper: collectFees failed (non-critical): {e}")


# ─── Scheduled job (called by APScheduler) ───────────────────────────────────

async def keeper_job() -> None:
    """Entry point called by the scheduler."""
    global keeper_state

    logger.info("Keeper: starting cycle")
    keeper_state["status"]            = "running"
    keeper_state["last_run"]          = datetime.now(timezone.utc).isoformat()
    keeper_state["last_run_timestamp"] = time.time()
    keeper_state["total_runs"]        += 1

    # Setup web3
    rpc_url = os.getenv("RPC_URL_ARBITRUM")
    if not rpc_url:
        err = "RPC_URL_ARBITRUM not set"
        logger.error(f"Keeper: {err}")
        keeper_state["last_error"] = err
        keeper_state["status"]     = "idle"
        return

    vault_address = os.getenv("VAULT_ADDRESS")
    if not vault_address:
        err = "VAULT_ADDRESS not set"
        logger.error(f"Keeper: {err}")
        keeper_state["last_error"] = err
        keeper_state["status"]     = "idle"
        return

    private_key = os.getenv("KEEPER_PRIVATE_KEY")
    if not private_key:
        err = "KEEPER_PRIVATE_KEY not set"
        logger.error(f"Keeper: {err}")
        keeper_state["last_error"] = err
        keeper_state["status"]     = "idle"
        return

    try:
        w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(rpc_url))
        # For Arbitrum PoA compatibility
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        keeper_account = w3.eth.account.from_key(private_key).address
        logger.info(f"Keeper: account = {keeper_account}")

        vault = w3.eth.contract(
            address=Web3.to_checksum_address(vault_address),
            abi=VAULT_ABI,
        )

        result = await run_keeper_cycle(w3, vault, keeper_account)

        keeper_state["last_error"] = result.get("error")
        keeper_state["last_tx_hash"] = result.get("tx_hash")
        if result.get("action") == "rebalance":
            keeper_state["total_rebalances"] += 1

        logger.info(f"Keeper: cycle complete = {result}")

    except Exception as e:
        logger.exception(f"Keeper: unexpected error: {e}")
        keeper_state["last_error"] = str(e)
    finally:
        keeper_state["status"] = "idle"


# ─── Standalone runner (for manual testing) ───────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [keeper] %(message)s",
    )
    asyncio.run(keeper_job())
