// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @dev Fork test — run against Arbitrum One fork:
 *      forge test --fork-url $RPC_URL_ARBITRUM -vvv
 *
 * Tests:
 *  - deposit / redeem round-trip
 *  - share price calculation
 *  - only strategyManager can call rebalance
 *  - pause / unpause
 *  - fee parameter guards
 */

import {Test, console}  from "forge-std/Test.sol";
import {AILiquidVault}  from "../src/AILiquidVault.sol";
import {IERC20}         from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AILiquidVaultTest is Test {
    // Arbitrum One addresses
    address constant USDC    = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    AILiquidVault vault;

    address owner    = makeAddr("owner");
    address keeper   = makeAddr("keeper");
    address feeDest  = makeAddr("fees");
    address alice    = makeAddr("alice");
    address bob      = makeAddr("bob");

    uint256 constant ONE_USDC   = 1e6;
    uint256 constant DEPOSIT_1K = 1_000 * ONE_USDC;

    function setUp() public {
        vm.startPrank(owner);
        // NPM and WETH = Arbitrum One addresses (fork test runs against Arb One)
        vault = new AILiquidVault(
            USDC,
            0xC36442b4a4522E871399CD717aBDD847Ab11FE88, // NPM Arbitrum One
            0x82aF49447D8a07e3bd95BD0d56f35241523fBab1, // WETH Arbitrum One
            keeper,
            feeDest
        );
        vm.stopPrank();

        // Give alice and bob USDC by impersonating a known whale
        address whale = 0x489ee077994B6658eAfA855C308275EAd8097C4A; // Arbitrum USDC holder
        vm.startPrank(whale);
        IERC20(USDC).transfer(alice, DEPOSIT_1K * 2);
        IERC20(USDC).transfer(bob,   DEPOSIT_1K);
        vm.stopPrank();
    }

    // ── Deposit / Redeem ───────────────────────────────────────────────────────

    function test_DepositMintShares() public {
        vm.startPrank(alice);
        IERC20(USDC).approve(address(vault), DEPOSIT_1K);
        uint256 shares = vault.deposit(DEPOSIT_1K, alice);
        vm.stopPrank();

        assertGt(shares, 0,           "shares must be > 0");
        assertEq(vault.balanceOf(alice), shares, "alice share balance mismatch");
        assertEq(vault.totalAssets(),  DEPOSIT_1K, "totalAssets must equal deposit");
    }

    function test_RedeemReturnsUsdc() public {
        // Alice deposits
        vm.startPrank(alice);
        IERC20(USDC).approve(address(vault), DEPOSIT_1K);
        uint256 shares = vault.deposit(DEPOSIT_1K, alice);

        // Alice redeems all shares
        uint256 before = IERC20(USDC).balanceOf(alice);
        vault.redeem(shares, alice, alice);
        uint256 returned = IERC20(USDC).balanceOf(alice) - before;
        vm.stopPrank();

        // Should get back ~1000 USDC (minus any rounding)
        assertApproxEqAbs(returned, DEPOSIT_1K, 1, "redeem amount mismatch");
    }

    function test_MultipleDepositors() public {
        vm.startPrank(alice);
        IERC20(USDC).approve(address(vault), DEPOSIT_1K);
        uint256 aliceShares = vault.deposit(DEPOSIT_1K, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        IERC20(USDC).approve(address(vault), DEPOSIT_1K);
        uint256 bobShares = vault.deposit(DEPOSIT_1K, bob);
        vm.stopPrank();

        assertApproxEqAbs(aliceShares, bobShares, 1, "shares should be equal for equal deposit");
        assertApproxEqAbs(vault.totalAssets(), 2 * DEPOSIT_1K, 1, "total assets mismatch");
    }

    // ── Access control ─────────────────────────────────────────────────────────

    function test_RebalanceOnlyKeeper() public {
        vm.expectRevert("AILiquidVault: not strategy manager");
        vm.prank(alice);
        vault.rebalance(int24(-887272), int24(887272), DEPOSIT_1K, 0);
    }

    function test_PauseOnlyOwner() public {
        vm.expectRevert();
        vm.prank(alice);
        vault.pause();

        vm.prank(owner);
        vault.pause();
        assertTrue(vault.paused());
    }

    function test_DepositRevertsWhenPaused() public {
        vm.prank(owner);
        vault.pause();

        vm.startPrank(alice);
        IERC20(USDC).approve(address(vault), DEPOSIT_1K);
        vm.expectRevert();
        vault.deposit(DEPOSIT_1K, alice);
        vm.stopPrank();
    }

    // ── Fee guards ─────────────────────────────────────────────────────────────

    function test_SetFeesGuard() public {
        vm.startPrank(owner);

        // Should pass (5 % mgmt, 30 % perf)
        vault.setFees(500, 3_000);

        // Should revert (> 5 %)
        vm.expectRevert("AILiquidVault: management fee > 5%");
        vault.setFees(501, 2_000);

        // Should revert (> 30 %)
        vm.expectRevert("AILiquidVault: performance fee > 30%");
        vault.setFees(200, 3_001);

        vm.stopPrank();
    }

    // ── Share price ─────────────────────────────────────────────────────────────

    function test_SharePriceInitial() public view {
        // No deposits yet → 1e6
        assertEq(vault.sharePrice(), 1e6);
    }

    function test_SharePriceAfterDeposit() public {
        vm.startPrank(alice);
        IERC20(USDC).approve(address(vault), DEPOSIT_1K);
        vault.deposit(DEPOSIT_1K, alice);
        vm.stopPrank();

        // Share price should be 1e6 per share initially (no profit)
        assertGt(vault.sharePrice(), 0);
    }

    // ── Strategy manager update ────────────────────────────────────────────────

    function test_UpdateStrategyManager() public {
        address newKeeper = makeAddr("newKeeper");
        vm.prank(owner);
        vault.setStrategyManager(newKeeper);
        assertEq(vault.strategyManager(), newKeeper);
    }
}
