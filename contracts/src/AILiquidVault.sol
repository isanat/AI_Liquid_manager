// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AILiquidVault
 * @notice ERC-4626 tokenised vault that custodies USDC, issues vAI shares,
 *         and delegates LP strategy to an off-chain AI keeper on Arbitrum One.
 *
 * Roles
 * ─────
 *  owner           – deploys, sets fees, pauses, updates strategyManager
 *  strategyManager – off-chain keeper EOA; calls rebalance() / collectFees()
 *  depositor       – any address; calls deposit() / redeem()
 *
 * Fee model
 * ─────────
 *  Management fee  : 2 % / year (200 bps), accrued on each interaction
 *  Performance fee : 20 % (2000 bps) of net profit above high-water mark
 *
 * totalAssets accounting
 * ──────────────────────
 *  idle USDC in vault  +  deployedCapital (tracked when rebalance is called)
 *  deployedCapital decreases as collectFees() brings USDC back.
 */

import {ERC4626}         from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20}           from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step}    from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable}         from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";

// ─── Minimal Uniswap V3 NPM interface ────────────────────────────────────────

struct MintParams {
    address token0;
    address token1;
    uint24  fee;
    int24   tickLower;
    int24   tickUpper;
    uint256 amount0Desired;
    uint256 amount1Desired;
    uint256 amount0Min;
    uint256 amount1Min;
    address recipient;
    uint256 deadline;
}

struct DecreaseLiquidityParams {
    uint256 tokenId;
    uint128 liquidity;
    uint256 amount0Min;
    uint256 amount1Min;
    uint256 deadline;
}

struct CollectParams {
    uint256 tokenId;
    address recipient;
    uint128 amount0Max;
    uint128 amount1Max;
}

interface INonfungiblePositionManager {
    function mint(MintParams calldata params)
        external payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);

    function positions(uint256 tokenId)
        external view
        returns (
            uint96  nonce,
            address operator,
            address token0,
            address token1,
            uint24  fee,
            int24   tickLower,
            int24   tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external payable
        returns (uint256 amount0, uint256 amount1);

    function collect(CollectParams calldata params)
        external payable
        returns (uint256 amount0, uint256 amount1);
}

// ─── AILiquidVault ────────────────────────────────────────────────────────────

contract AILiquidVault is ERC4626, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ── Constants ──────────────────────────────────────────────────────────────

    /// @dev Uniswap V3 NonfungiblePositionManager — same address on all EVM chains
    address public constant NPM = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;

    /// @dev USDC native on Arbitrum One
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    /// @dev WETH on Arbitrum One
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    uint256 public constant BPS_DENOMINATOR  = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint128 public constant MAX_UINT128      = type(uint128).max;

    // ── State ──────────────────────────────────────────────────────────────────

    address public strategyManager;
    address public feeRecipient;

    uint256 public managementFeeBps  = 200;   // 2 %  / year
    uint256 public performanceFeeBps = 2_000; // 20 % of net profit

    uint256 public highWaterMark;
    uint256 public lastFeeTimestamp;

    /// @dev Tracks USDC currently deployed into LP positions (not idle in vault).
    uint256 public deployedCapital;

    uint256[] public activeTokenIds;

    // ── Events ─────────────────────────────────────────────────────────────────

    event StrategyManagerUpdated(address indexed oldManager, address indexed newManager);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event FeesUpdated(uint256 managementFeeBps, uint256 performanceFeeBps);
    event Rebalanced(int24 tickLower, int24 tickUpper, uint256 tokenId, uint128 liquidity, uint256 usdcDeployed);
    event FeesCollected(uint256 usdcAmount);
    event ManagementFeeCharged(uint256 feeShares);
    event PerformanceFeeCharged(uint256 feeShares);

    // ── Modifiers ──────────────────────────────────────────────────────────────

    modifier onlyStrategyManager() {
        require(msg.sender == strategyManager, "AILiquidVault: not strategy manager");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address _strategyManager, address _feeRecipient)
        ERC4626(IERC20(USDC))
        ERC20("AI Liquid Vault", "vAI")
        Ownable(msg.sender)
    {
        require(_strategyManager != address(0), "AILiquidVault: zero strategy manager");
        require(_feeRecipient    != address(0), "AILiquidVault: zero fee recipient");
        strategyManager  = _strategyManager;
        feeRecipient     = _feeRecipient;
        lastFeeTimestamp = block.timestamp;
    }

    // ── ERC-4626 overrides ─────────────────────────────────────────────────────

    /**
     * @notice Total USDC controlled by the vault.
     *         = idle USDC in this contract + capital deployed to LP positions.
     */
    function totalAssets() public view override returns (uint256) {
        return IERC20(USDC).balanceOf(address(this)) + deployedCapital;
    }

    function deposit(uint256 assets, address receiver)
        public override nonReentrant whenNotPaused returns (uint256 shares)
    {
        _chargeManagementFee();
        shares = super.deposit(assets, receiver);
        if (highWaterMark == 0) highWaterMark = totalAssets();
    }

    function mint(uint256 shares, address receiver)
        public override nonReentrant whenNotPaused returns (uint256 assets)
    {
        _chargeManagementFee();
        assets = super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address _owner)
        public override nonReentrant whenNotPaused returns (uint256 shares)
    {
        _chargeManagementFee();
        shares = super.withdraw(assets, receiver, _owner);
    }

    function redeem(uint256 shares, address receiver, address _owner)
        public override nonReentrant whenNotPaused returns (uint256 assets)
    {
        _chargeManagementFee();
        assets = super.redeem(shares, receiver, _owner);
    }

    // ── Strategy functions (keeper only) ──────────────────────────────────────

    /**
     * @notice Close existing LP positions and open a new one in the AI-computed range.
     * @param tickLower       Lower tick
     * @param tickUpper       Upper tick
     * @param amount0Desired  USDC to deploy (token0). Must be <= idle USDC balance.
     * @param amount1Desired  WETH to deploy (token1). Usually 0 for USDC-only strategy.
     */
    function rebalance(
        int24   tickLower,
        int24   tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external onlyStrategyManager nonReentrant whenNotPaused {
        require(tickLower < tickUpper, "AILiquidVault: invalid tick range");
        require(amount0Desired > 0,   "AILiquidVault: zero amount");
        require(
            amount0Desired <= IERC20(USDC).balanceOf(address(this)),
            "AILiquidVault: insufficient idle USDC"
        );

        // 1. Close all existing positions (returns USDC + WETH to vault)
        _closeAllPositions();

        // 2. Approve and mint new LP position
        IERC20(USDC).forceApprove(NPM, amount0Desired);
        if (amount1Desired > 0) {
            require(
                amount1Desired <= IERC20(WETH).balanceOf(address(this)),
                "AILiquidVault: insufficient WETH"
            );
            IERC20(WETH).forceApprove(NPM, amount1Desired);
        }

        (uint256 tokenId, uint128 liquidity, uint256 used0,) = INonfungiblePositionManager(NPM).mint(
            MintParams({
                token0:         USDC,
                token1:         WETH,
                fee:            500,
                tickLower:      tickLower,
                tickUpper:      tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min:     0,
                amount1Min:     0,
                recipient:      address(this),
                deadline:       block.timestamp + 1200
            })
        );

        // Track deployed capital
        deployedCapital += used0;

        // Reset approvals
        IERC20(USDC).forceApprove(NPM, 0);
        if (amount1Desired > 0) IERC20(WETH).forceApprove(NPM, 0);

        activeTokenIds.push(tokenId);

        emit Rebalanced(tickLower, tickUpper, tokenId, liquidity, used0);
        _chargePerformanceFee();
    }

    /**
     * @notice Collect accrued LP fees from all active positions into the vault.
     */
    function collectFees() external onlyStrategyManager nonReentrant {
        uint256 totalUsdc = 0;
        for (uint256 i = 0; i < activeTokenIds.length; i++) {
            (uint256 a0,) = INonfungiblePositionManager(NPM).collect(
                CollectParams({
                    tokenId:    activeTokenIds[i],
                    recipient:  address(this),
                    amount0Max: MAX_UINT128,
                    amount1Max: MAX_UINT128
                })
            );
            totalUsdc += a0;
        }
        emit FeesCollected(totalUsdc);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    function setStrategyManager(address _manager) external onlyOwner {
        require(_manager != address(0), "AILiquidVault: zero address");
        emit StrategyManagerUpdated(strategyManager, _manager);
        strategyManager = _manager;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "AILiquidVault: zero address");
        emit FeeRecipientUpdated(feeRecipient, _recipient);
        feeRecipient = _recipient;
    }

    function setFees(uint256 _mgmtBps, uint256 _perfBps) external onlyOwner {
        require(_mgmtBps <= 500,   "AILiquidVault: management fee > 5%");
        require(_perfBps <= 3_000, "AILiquidVault: performance fee > 30%");
        managementFeeBps  = _mgmtBps;
        performanceFeeBps = _perfBps;
        emit FeesUpdated(_mgmtBps, _perfBps);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Emergency: close all LP positions, idle USDC stays in vault.
    function emergencyExit() external onlyOwner {
        _closeAllPositions();
    }

    // ── View helpers ───────────────────────────────────────────────────────────

    function getActiveTokenIds() external view returns (uint256[] memory) {
        return activeTokenIds;
    }

    function activePositionCount() external view returns (uint256) {
        return activeTokenIds.length;
    }

    /// @notice Current share price in USDC (6 decimals). Returns 1e6 if no supply yet.
    function sharePrice() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e6;
        // Both totalAssets (USDC, 6 dec) and totalSupply (vAI, 18 dec) must be normalised
        return (totalAssets() * 1e18) / supply;
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _closeAllPositions() internal {
        uint256 len = activeTokenIds.length;
        for (uint256 i = 0; i < len; i++) {
            uint256 tid = activeTokenIds[i];
            (,,,,,,,uint128 liquidity,,,,) = INonfungiblePositionManager(NPM).positions(tid);
            if (liquidity > 0) {
                INonfungiblePositionManager(NPM).decreaseLiquidity(
                    DecreaseLiquidityParams({
                        tokenId:    tid,
                        liquidity:  liquidity,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline:   block.timestamp + 1200
                    })
                );
            }
            INonfungiblePositionManager(NPM).collect(
                CollectParams({
                    tokenId:    tid,
                    recipient:  address(this),
                    amount0Max: MAX_UINT128,
                    amount1Max: MAX_UINT128
                })
            );
        }
        deployedCapital = 0;
        delete activeTokenIds;
    }

    function _chargeManagementFee() internal {
        uint256 elapsed = block.timestamp - lastFeeTimestamp;
        if (elapsed == 0 || totalSupply() == 0) return;
        lastFeeTimestamp = block.timestamp;

        uint256 assets    = totalAssets();
        uint256 feeAssets = (assets * managementFeeBps * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
        if (feeAssets == 0) return;

        uint256 feeShares = convertToShares(feeAssets);
        if (feeShares == 0) return;
        _mint(feeRecipient, feeShares);
        emit ManagementFeeCharged(feeShares);
    }

    function _chargePerformanceFee() internal {
        uint256 assets = totalAssets();
        if (assets <= highWaterMark || totalSupply() == 0) return;

        uint256 profit    = assets - highWaterMark;
        uint256 feeAssets = (profit * performanceFeeBps) / BPS_DENOMINATOR;
        highWaterMark     = assets;

        uint256 feeShares = convertToShares(feeAssets);
        if (feeShares == 0) return;
        _mint(feeRecipient, feeShares);
        emit PerformanceFeeCharged(feeShares);
    }
}
