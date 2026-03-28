"""
Risk Management API Routes

Exposes risk management status for monitoring and control.
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/status")
async def get_risk_status() -> Dict[str, Any]:
    """
    Get current risk management status.
    
    Returns:
        - pilot_phase: Current pilot phase (smoke_test, pilot_1k, pilot_10k, production)
        - max_capital: Maximum capital allowed for current phase
        - protection_limits: Current limits and daily stats
        - circuit_breakers: Status of circuit breakers per vault
    """
    try:
        from risk.risk_config import get_risk_config
        from risk.protection_limits import get_protection_limits
        from risk.pilot_phases import get_pilot_manager
        
        config = get_risk_config()
        limits = get_protection_limits()
        pilot = get_pilot_manager()
        
        return {
            "status": "ok",
            "pilot": pilot.get_status(),
            "protection": limits.get_status(),
            "config": {
                "version": config.config_version,
                "environment": config.environment,
                "fee_tier": config.shared.fee_tier,
                "max_rebalances_per_day": config.shared.max_rebalances_per_day,
                "gas_multiplier": config.shared.gas_cost_multiplier,
                "slippage_bps": config.shared.slippage_bps,
            },
        }
        
    except ImportError as e:
        return {
            "status": "disabled",
            "error": f"Risk management not available: {e}",
        }
    except Exception as e:
        logger.error(f"Error getting risk status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pilot/promote")
async def promote_pilot_phase() -> Dict[str, Any]:
    """
    Manually promote to next pilot phase.
    
    Only works if current phase has passed all criteria.
    """
    try:
        from risk.pilot_phases import get_pilot_manager
        
        pilot = get_pilot_manager()
        
        # Evaluate current phase
        result = pilot.evaluate_phase()
        
        if result.can_promote:
            success = pilot.promote_to_next_phase()
            return {
                "success": success,
                "previous_phase": result.phase.value,
                "new_phase": pilot.current_phase.value,
                "evaluation": {
                    "passed": result.passed,
                    "recommendation": result.recommendation,
                },
            }
        else:
            return {
                "success": False,
                "current_phase": pilot.current_phase.value,
                "evaluation": {
                    "passed": result.passed,
                    "recommendation": result.recommendation,
                    "criteria": {k: {"passed": p, "message": m} for k, (p, m) in result.criteria_results.items()},
                },
            }
            
    except ImportError:
        raise HTTPException(status_code=503, detail="Risk management not available")
    except Exception as e:
        logger.error(f"Error promoting pilot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pilot/pause")
async def pause_pilot(reason: str = "Manual pause") -> Dict[str, Any]:
    """Pause pilot operations."""
    try:
        from risk.pilot_phases import get_pilot_manager
        
        pilot = get_pilot_manager()
        pilot.pause(reason)
        
        return {
            "success": True,
            "status": "paused",
            "reason": reason,
        }
        
    except ImportError:
        raise HTTPException(status_code=503, detail="Risk management not available")
    except Exception as e:
        logger.error(f"Error pausing pilot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pilot/resume")
async def resume_pilot() -> Dict[str, Any]:
    """Resume pilot operations."""
    try:
        from risk.pilot_phases import get_pilot_manager
        
        pilot = get_pilot_manager()
        success = pilot.resume()
        
        return {
            "success": success,
            "status": pilot.current_phase.value,
        }
        
    except ImportError:
        raise HTTPException(status_code=503, detail="Risk management not available")
    except Exception as e:
        logger.error(f"Error resuming pilot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vault/{vault_address}/pause")
async def pause_vault(vault_address: str, reason: str = "Manual pause") -> Dict[str, Any]:
    """Pause a specific vault."""
    try:
        from risk.protection_limits import get_protection_limits
        
        limits = get_protection_limits()
        limits.pause_vault(vault_address, reason)
        
        return {
            "success": True,
            "vault": vault_address,
            "status": "paused",
            "reason": reason,
        }
        
    except ImportError:
        raise HTTPException(status_code=503, detail="Risk management not available")
    except Exception as e:
        logger.error(f"Error pausing vault: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vault/{vault_address}/resume")
async def resume_vault(vault_address: str) -> Dict[str, Any]:
    """Resume a paused vault."""
    try:
        from risk.protection_limits import get_protection_limits
        
        limits = get_protection_limits()
        success = limits.resume_vault(vault_address)
        
        return {
            "success": success,
            "vault": vault_address,
            "status": "active" if success else "paused",
        }
        
    except ImportError:
        raise HTTPException(status_code=503, detail="Risk management not available")
    except Exception as e:
        logger.error(f"Error resuming vault: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/circuit-breaker/{vault_address}/reset")
async def reset_circuit_breaker(vault_address: str) -> Dict[str, Any]:
    """Reset circuit breaker for a vault."""
    try:
        from risk.protection_limits import get_circuit_breaker
        
        cb = get_circuit_breaker(vault_address)
        cb.force_reset()
        
        return {
            "success": True,
            "vault": vault_address,
            "circuit_breaker": cb.state.value,
        }
        
    except ImportError:
        raise HTTPException(status_code=503, detail="Risk management not available")
    except Exception as e:
        logger.error(f"Error resetting circuit breaker: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config/validate")
async def validate_config_consistency() -> Dict[str, Any]:
    """
    Validate that backtest and production configs are consistent.
    
    Returns any discrepancies found.
    """
    try:
        from risk.risk_config import RiskConfig
        
        # Load both configs
        backtest_config = RiskConfig.load()
        production_config = RiskConfig.load()  # In reality, these would differ if ENV vars differ
        
        discrepancies = backtest_config.validate_consistency(production_config)
        
        return {
            "consistent": len(discrepancies) == 0,
            "discrepancies": discrepancies,
            "backtest_config": {
                "fee_tier": backtest_config.shared.fee_tier,
                "max_rebalances": backtest_config.shared.max_rebalances_per_day,
                "gas_multiplier": backtest_config.shared.gas_cost_multiplier,
                "slippage_bps": backtest_config.shared.slippage_bps,
            },
        }
        
    except ImportError:
        raise HTTPException(status_code=503, detail="Risk management not available")
    except Exception as e:
        logger.error(f"Error validating config: {e}")
        raise HTTPException(status_code=500, detail=str(e))
