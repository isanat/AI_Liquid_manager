"""
AI Liquid Vault V2 — Keeper Bot with Risk Management
═══════════════════════════════════════════════════════
Runs every 15 minutes (APScheduler) and:
  1. Checks risk limits (pilot phase, protection limits, circuit breaker)
  2. Calls FastAPI /predict → get AI strategy params (tick range, allocation %)
  3. Converts the suggested price range → Uniswap V3 ticks
  4. Calls vault.rebalance(tickLower, tickUpper, amountWeth, amountStable) on Arbitrum
  5. Calls vault.collectFees() to harvest LP fees back into the vault
  6. Records rebalance in pilot manager for phase progression

SUPPORTS: Both USDC and USDT vaults

RISK CONTROLS:
  - Pilot Phase: Progressive capital deployment ($100 -> $1K -> $10K -> Production)
  - Protection Limits: Max rebalances/day, volatility pause, exposure limits
  - Circuit Breaker: Auto-pause on repeated failures

Required environment variables:
  VAULT_USDC_ADDRESS    – USDC vault address
  VAULT_USDT_ADDRESS    – USDT vault address (optional)
  KEEPER_PRIVATE_KEY    – hex private key (0x...) of the strategy manager EOA
  RPC_URL_ARBITRUM      – Arbitrum One RPC (e.g. Alchemy)
  AI_ENGINE_URL         – base URL of FastAPI service (default http://localhost:8000)

Optional:
  REBALANCE_INTERVAL    – cron interval in minutes (default 15)
  USDC_DEPLOY_PCT       – % of idle stablecoin to deploy per cycle (default 80)
  RISK_MAX_REBALANCES_PER_DAY  – max rebalances per day (default 3)
  RISK_PAUSE_THRESHOLD_1D      – volatility pause threshold (default 0.15)
"""

from __future__ import annotations

import asyncio
import logging
import math
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple

import httpx
from web3 import AsyncWeb3, Web3
from web3.middleware import ExtraDataToPOAMiddleware

# Add parent path for risk imports
_parent = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _parent not in sys.path:
    sys.path.insert(0, _parent)

# Risk management imports
try:
    from risk.risk_config import get_risk_config, RiskConfig
    from risk.protection_limits import get_protection_limits, get_circuit_breaker, ProtectionLimits, CircuitBreaker
    from risk.pilot_phases import get_pilot_manager, PilotPhaseManager, PilotPhase
    RISK_ENABLED = True
except ImportError as e:
    logging.warning(f"Risk management not available: {e}")
    RISK_ENABLED = False

logger = logging.getLogger(__name__)

# ─── Contract addresses (Arbitrum One) ───────────────────────────────────────

# Token addresses
USDC_ADDRESS = os.getenv("USDC_ADDRESS", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831")
USDT_ADDRESS = os.getenv("USDT_ADDRESS", "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9")
WETH_ADDRESS = os.getenv("WETH_ADDRESS", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1")

# Vault addresses (V2)
VAULT_USDC_ADDRESS = os.getenv("VAULT_USDC_ADDRESS", "0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C")
VAULT_USDT_ADDRESS = os.getenv("VAULT_USDT_ADDRESS", "0x12a20d3569da6DD2d99E7bC95748283B10729c4C")

# Legacy support
VAULT_ADDRESS = os.getenv("VAULT_ADDRESS", VAULT_USDC_ADDRESS)

TICK_SPACING = 10   # 0.05% pool
TICK_LIMIT   = 887272

# ─── Minimal ABIs ─────────────────────────────────────────────────────────────

VAULT_V2_ABI = [
    {
        "name": "rebalance",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "tickLower",    "type": "int24"},
            {"name": "tickUpper",    "type": "int24"},
            {"name": "amountWeth",   "type": "uint256"},   # V2: renamed from amount0Desired
            {"name": "amountStable", "type": "uint256"},   # V2: renamed from amount1Desired
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
        "name": "asset",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [],
        "outputs": [{"name": "", "type": "address"}],
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
    {
        "name": "assetSymbol",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [],
        "outputs": [{"name": "", "type": "string"}],
    },
    {
        "name": "poolFee",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [],
        "outputs": [{"name": "", "type": "uint24"}],
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
    {
        "name": "symbol",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [],
        "outputs": [{"name": "", "type": "string"}],
    },
]

# ─── Keeper state ────────────────────────────────────────────────────────────

REBALANCE_INTERVAL = int(os.getenv("REBALANCE_INTERVAL", "15")) * 60  # default 15 min

keeper_state: dict = {
    "last_run":              None,
    "last_run_timestamp":    None,
    "last_tx_hash":          None,
    "last_error":            None,
    "total_runs":            0,
    "total_rebalances":      0,
    "status":                "idle",
    "vaults_processed":      [],
    # Risk status
    "risk_enabled":          RISK_ENABLED,
    "pilot_phase":           "unknown" if RISK_ENABLED else "disabled",
    "circuit_breaker":       "unknown" if RISK_ENABLED else "disabled",
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def price_to_tick_v2(price: float) -> int:
    """
    Convert a price (stablecoin per WETH) to a Uniswap V3 tick.
    
    For WETH/stablecoin pool:
    - token0 = WETH (18 decimals)
    - token1 = stablecoin (6 decimals)
    - price = stablecoin per WETH (e.g., 2000 USDC per ETH)
    - sqrtPrice = sqrt(price * 1e6 / 1e18) = sqrt(price / 1e12)
    - tick = log1.0001(sqrtPrice^2) = log1.0001(price / 1e12)
    """
    # Adjusted price for token decimals
    # token0 (WETH) has 18 decimals, token1 (stablecoin) has 6 decimals
    # Price ratio adjustment: price * 10^(decimals1 - decimals0) = price * 10^(-12)
    # So: adjusted_price = price / 1e12
    adjusted = price / 1e12
    if adjusted <= 0:
        return -TICK_LIMIT
    tick = math.floor(math.log(adjusted) / math.log(1.0001))
    return tick


def nearest_usable_tick(tick: int, spacing: int = TICK_SPACING) -> int:
    """Round tick to nearest valid tick spacing."""
    return round(tick / spacing) * spacing


def clamp_tick(tick: int) -> int:
    return max(-TICK_LIMIT, min(TICK_LIMIT, tick))


# ─── Risk Management Functions ────────────────────────────────────────────────

def _get_market_volatility(prediction: dict) -> Tuple[float, float]:
    """Extract volatility metrics from AI prediction."""
    vol_1d = float(prediction.get("volatility_1d", 0.05))  # Default 5%
    vol_7d = float(prediction.get("volatility_7d", vol_1d * 1.5))
    return vol_1d, vol_7d


async def _check_risk_limits(
    vault_address: str,
    amount_to_deploy: float,
    idle_amount: float,
    current_tvl: float,
    volatility_1d: float,
    volatility_7d: float,
) -> Tuple[bool, str, dict]:
    """
    Check all risk limits before rebalance.
    
    Returns:
        (allowed: bool, reason: str, details: dict)
    """
    if not RISK_ENABLED:
        return True, "Risk management disabled", {"enabled": False}
    
    details = {"enabled": True, "checks": []}
    
    try:
        # 1. Check pilot phase limits
        pilot = get_pilot_manager()
        can_deploy, pilot_reason = pilot.can_deploy(amount_to_deploy)
        details["pilot_phase"] = pilot.current_phase.value
        details["pilot_max_capital"] = pilot.get_max_allowed_capital()
        
        if not can_deploy:
            return False, f"Pilot limit: {pilot_reason}", details
        
        details["checks"].append({"check": "pilot", "passed": True})
        
        # 2. Check protection limits
        limits = get_protection_limits()
        allowed, breaches = limits.check_limits(
            vault_address=vault_address,
            current_volatility_1d=volatility_1d,
            current_volatility_7d=volatility_7d,
            current_tvl=current_tvl,
            idle_amount=idle_amount,
            proposed_deploy=amount_to_deploy,
        )
        
        details["breaches"] = [
            {"type": b.limit_type.value, "action": b.action_taken.value, "message": b.message}
            for b in breaches
        ]
        
        if not allowed:
            blocked = [b for b in breaches if b.action_taken.value in ("block", "pause")]
            reason = blocked[0].message if blocked else "Protection limit exceeded"
            return False, f"Protection limit: {reason}", details
        
        details["checks"].append({"check": "protection_limits", "passed": True})
        
        # 3. Check circuit breaker
        cb = get_circuit_breaker(vault_address)
        can_execute, cb_reason = cb.can_execute()
        details["circuit_breaker"] = cb.state.value
        
        if not can_execute:
            return False, f"Circuit breaker: {cb_reason}", details
        
        details["checks"].append({"check": "circuit_breaker", "passed": True})
        
        # 4. Check risk config
        config = get_risk_config()
        stats = limits.get_or_create_stats(vault_address)
        last_rebalance_minutes = 9999
        if stats.last_rebalance_time:
            last_rebalance_minutes = (datetime.now(timezone.utc) - stats.last_rebalance_time).total_seconds() / 60
        
        can_rebalance, config_reason = config.can_rebalance(
            today_count=stats.rebalance_count,
            current_volatility_1d=volatility_1d,
            last_rebalance_minutes_ago=int(last_rebalance_minutes),
        )
        
        if not can_rebalance:
            return False, f"Risk config: {config_reason}", details
        
        details["checks"].append({"check": "risk_config", "passed": True})
        details["today_rebalances"] = stats.rebalance_count
        details["max_rebalances"] = config.shared.max_rebalances_per_day
        
        return True, "All risk checks passed", details
        
    except Exception as e:
        logger.error(f"Risk check error: {e}")
        # Fail open - allow operation if risk check fails
        return True, f"Risk check error (allowed): {e}", {"error": str(e)}


def _record_rebalance_result(
    vault_address: str,
    success: bool,
    gas_cost: float,
    amount_deployed: float,
):
    """Record rebalance result for risk tracking."""
    if not RISK_ENABLED:
        return
    
    try:
        # Record in protection limits
        limits = get_protection_limits()
        limits.record_rebalance(vault_address, gas_cost, amount_deployed)
        
        # Record in pilot manager
        pilot = get_pilot_manager()
        pilot.record_rebalance(success=success, gas_cost=gas_cost)
        
        # Update circuit breaker
        cb = get_circuit_breaker(vault_address)
        if success:
            cb.record_success()
        else:
            cb.record_failure("Rebalance failed")
        
        logger.info(f"Recorded rebalance: success={success}, gas=${gas_cost:.2f}")
        
    except Exception as e:
        logger.error(f"Failed to record rebalance: {e}")


# ─── Core keeper logic ────────────────────────────────────────────────────────

async def run_keeper_cycle_for_vault(
    w3: AsyncWeb3, 
    vault, 
    vault_address: str,
    asset_address: str,
    asset_symbol: str,
    keeper_account: str
) -> dict:
    """Execute one keeper cycle for a single vault with risk management.""""

    ai_url = os.getenv("AI_ENGINE_URL", f"http://localhost:{os.getenv('PORT', '8000')}")
    stable_pct = float(os.getenv("STABLE_DEPLOY_PCT", os.getenv("USDC_DEPLOY_PCT", "80"))) / 100.0

    result = {
        "vault": vault_address,
        "asset": asset_symbol,
        "success": False, 
        "action": None, 
        "tx_hash": None, 
        "error": None
    }

    # Check vault is not paused
    is_paused = await vault.functions.paused().call()
    if is_paused:
        result["error"] = f"{asset_symbol} vault is paused"
        logger.warning(f"Keeper: {result['error']}, skipping")
        return result

    # Get idle stablecoin balance in vault
    stable_contract = w3.eth.contract(
        address=Web3.to_checksum_address(asset_address),
        abi=ERC20_ABI,
    )
    idle_stable = await stable_contract.functions.balanceOf(vault_address).call()
    idle_stable_human = idle_stable / 1e6
    logger.info(f"Keeper: idle {asset_symbol} in vault = ${idle_stable_human:,.2f}")

    # Call AI /predict endpoint
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{ai_url}/predict")
            resp.raise_for_status()
            prediction = resp.json()
    except Exception as e:
        result["error"] = f"AI predict failed: {e}"
        logger.error(f"Keeper: {result['error']}")
        await _collect_fees_v2(vault, w3, keeper_account, result)
        return result

    logger.info(f"Keeper: AI prediction = {prediction}")

    # Parse strategy params
    if "current_price" not in prediction or not prediction["current_price"]:
        result["error"] = "AI /predict missing current_price"
        logger.error(f"Keeper: {result['error']}")
        await _collect_fees_v2(vault, w3, keeper_account, result)
        return result

    current_price = float(prediction["current_price"])
    range_width = float(prediction.get("range_width", 0.06))
    core_pct = float(prediction.get("core_pct", 0.7))
    confidence = float(prediction.get("confidence", 0.0))

    lower_price = current_price * (1 - range_width)
    upper_price = current_price * (1 + range_width)

    tick_lower = clamp_tick(nearest_usable_tick(price_to_tick_v2(lower_price)))
    tick_upper = clamp_tick(nearest_usable_tick(price_to_tick_v2(upper_price)))

    if tick_lower >= tick_upper:
        result["error"] = f"Invalid tick range: {tick_lower} >= {tick_upper}"
        logger.error(f"Keeper: {result['error']}")
        await _collect_fees_v2(vault, w3, keeper_account, result)
        return result

    # Get volatility for risk checks
    volatility_1d, volatility_7d = _get_market_volatility(prediction)
    
    # Get current TVL for risk checks
    try:
        total_assets = await vault.functions.totalAssets().call()
        current_tvl = total_assets / 1e6
    except:
        current_tvl = idle_stable_human
    
    # Amount of stablecoin to deploy (V2: amountStable, amountWeth=0)
    deploy_ratio = min(core_pct, stable_pct)
    proposed_amount = idle_stable * deploy_ratio
    
    # ─── RISK CHECKS ──────────────────────────────────────────────────────────
    
    allowed, risk_reason, risk_details = await _check_risk_limits(
        vault_address=vault_address,
        amount_to_deploy=proposed_amount / 1e6,  # USD value
        idle_amount=idle_stable_human,
        current_tvl=current_tvl,
        volatility_1d=volatility_1d,
        volatility_7d=volatility_7d,
    )
    
    result["risk_check"] = risk_details
    
    if not allowed:
        result["error"] = f"Risk blocked: {risk_reason}"
        logger.warning(f"Keeper: {result['error']}")
        await _collect_fees_v2(vault, w3, keeper_account, result)
        return result
    
    # Apply any exposure limits from risk check
    max_exposure_pct = risk_details.get("max_exposure_pct", deploy_ratio)
    if max_exposure_pct < deploy_ratio:
        deploy_ratio = max_exposure_pct
        logger.info(f"Keeper: exposure limited to {deploy_ratio:.1%} by risk config")
    
    amount_stable = int(idle_stable * deploy_ratio)
    amount_weth = 0  # Stablecoin-only strategy — no WETH deployment

    if amount_stable == 0:
        logger.info(f"Keeper: no idle {asset_symbol} to deploy, collecting fees only")
        await _collect_fees_v2(vault, w3, keeper_account, result)
        return result

    logger.info(
        f"Keeper: rebalancing {asset_symbol} | range ${lower_price:.0f}–${upper_price:.0f} "
        f"| ticks [{tick_lower}, {tick_upper}] | deploying {amount_stable/1e6:,.2f} {asset_symbol} "
        f"| confidence {confidence:.0%} | volatility 1d={volatility_1d:.1%}"
    )

    # Call vault.rebalance() - V2 signature
    try:
        nonce = await w3.eth.get_transaction_count(keeper_account)
        gas_price = await w3.eth.gas_price

        tx = await vault.functions.rebalance(
            tick_lower, tick_upper, amount_weth, amount_stable
        ).build_transaction({
            "from": keeper_account,
            "nonce": nonce,
            "gasPrice": int(gas_price * 1.1),
        })

        try:
            tx["gas"] = await w3.eth.estimate_gas(tx)
        except Exception:
            tx["gas"] = 800_000

        private_key = os.environ["KEEPER_PRIVATE_KEY"]
        signed = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
        tx_hash_hex = tx_hash.hex()

        logger.info(f"Keeper: rebalance tx sent = {tx_hash_hex}")

        receipt = await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt.status != 1:
            raise RuntimeError(f"Rebalance tx reverted: {tx_hash_hex}")

        logger.info(f"Keeper: rebalance confirmed in block {receipt.blockNumber}")
        result["action"] = "rebalance"
        result["tx_hash"] = tx_hash_hex
        result["success"] = True
        
        # Estimate gas cost (Arbitrum ~ $0.10-0.20 per rebalance)
        gas_cost = 0.15  # USD estimate
        if RISK_ENABLED:
            try:
                config = get_risk_config()
                gas_cost = config.get_adjusted_gas_cost("rebalance_full")
            except:
                pass
        
        # Record successful rebalance
        _record_rebalance_result(
            vault_address=vault_address,
            success=True,
            gas_cost=gas_cost,
            amount_deployed=amount_stable / 1e6,
        )

    except Exception as e:
        result["error"] = f"Rebalance failed: {e}"
        logger.error(f"Keeper: {result['error']}")
        
        # Record failed rebalance
        _record_rebalance_result(
            vault_address=vault_address,
            success=False,
            gas_cost=0,
            amount_deployed=0,
        )
        
        return result

    # Collect fees
    await _collect_fees_v2(vault, w3, keeper_account, result)
    return result


async def _collect_fees_v2(vault, w3: AsyncWeb3, keeper_account: str, result: dict) -> None:
    """Collect LP fees from all active positions."""
    try:
        active = await vault.functions.activePositionCount().call()
        if active == 0:
            logger.info("Keeper: no active positions to collect fees from")
            return

        nonce = await w3.eth.get_transaction_count(keeper_account)
        gas_price = await w3.eth.gas_price

        tx = await vault.functions.collectFees().build_transaction({
            "from": keeper_account,
            "nonce": nonce,
            "gasPrice": int(gas_price * 1.1),
        })
        try:
            tx["gas"] = await w3.eth.estimate_gas(tx)
        except Exception:
            tx["gas"] = 300_000

        private_key = os.environ["KEEPER_PRIVATE_KEY"]
        signed = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
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


# ─── Vault list management ────────────────────────────────────────────────────

def get_active_vaults() -> List[Dict[str, str]]:
    """Return list of vaults to process."""
    vaults = []
    
    # USDC Vault (always included)
    if VAULT_USDC_ADDRESS:
        vaults.append({
            "address": VAULT_USDC_ADDRESS,
            "asset": USDC_ADDRESS,
            "symbol": "USDC",
        })
    
    # USDT Vault (optional)
    if VAULT_USDT_ADDRESS:
        vaults.append({
            "address": VAULT_USDT_ADDRESS,
            "asset": USDT_ADDRESS,
            "symbol": "USDT",
        })
    
    return vaults


# ─── Scheduled job ────────────────────────────────────────────────────────────

async def keeper_job() -> None:
    """Entry point called by the scheduler. Processes all vaults."""
    global keeper_state

    logger.info("Keeper: starting cycle")
    keeper_state["status"] = "running"
    keeper_state["last_run"] = datetime.now(timezone.utc).isoformat()
    keeper_state["last_run_timestamp"] = time.time()
    keeper_state["total_runs"] += 1
    keeper_state["vaults_processed"] = []
    
    # Initialize pilot manager and update status
    if RISK_ENABLED:
        try:
            pilot = get_pilot_manager()
            limits = get_protection_limits()
            keeper_state["pilot_phase"] = pilot.current_phase.value
            keeper_state["circuit_breaker"] = "checked_per_vault"
            logger.info(f"Risk status: phase={pilot.current_phase.value}, max_capital=${pilot.get_max_allowed_capital():,.0f}")
        except Exception as e:
            logger.warning(f"Could not initialize risk managers: {e}")

    # Setup web3
    rpc_url = os.getenv("RPC_URL_ARBITRUM")
    if not rpc_url:
        err = "RPC_URL_ARBITRUM not set"
        logger.error(f"Keeper: {err}")
        keeper_state["last_error"] = err
        keeper_state["status"] = "idle"
        return

    private_key = os.getenv("KEEPER_PRIVATE_KEY")
    if not private_key:
        err = "KEEPER_PRIVATE_KEY not set"
        logger.error(f"Keeper: {err}")
        keeper_state["last_error"] = err
        keeper_state["status"] = "idle"
        return

    try:
        w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(rpc_url))
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        keeper_account = w3.eth.account.from_key(private_key).address
        logger.info(f"Keeper: account = {keeper_account}")

        # Process each vault
        vaults = get_active_vaults()
        for vault_info in vaults:
            vault_address = vault_info["address"]
            asset_address = vault_info["asset"]
            asset_symbol = vault_info["symbol"]

            logger.info(f"Keeper: processing {asset_symbol} vault = {vault_address}")

            vault = w3.eth.contract(
                address=Web3.to_checksum_address(vault_address),
                abi=VAULT_V2_ABI,
            )

            result = await run_keeper_cycle_for_vault(
                w3, vault, vault_address, asset_address, asset_symbol, keeper_account
            )
            
            keeper_state["vaults_processed"].append(result)
            
            if result.get("action") == "rebalance":
                keeper_state["total_rebalances"] += 1
                keeper_state["last_tx_hash"] = result.get("tx_hash")

        logger.info(f"Keeper: cycle complete")

    except Exception as e:
        logger.exception(f"Keeper: unexpected error: {e}")
        keeper_state["last_error"] = str(e)
    finally:
        keeper_state["status"] = "idle"


# ─── Standalone runner ────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [keeper] %(message)s",
    )
    asyncio.run(keeper_job())
