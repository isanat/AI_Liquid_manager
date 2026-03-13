// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AILiquidVault}   from "../src/AILiquidVault.sol";

/**
 * @title Deploy
 * @notice Deploys AILiquidVault to Arbitrum Sepolia or Arbitrum One.
 *
 * Required environment variables:
 *   DEPLOYER_PRIVATE_KEY   – private key of the deploying wallet (needs ETH for gas)
 *   STRATEGY_MANAGER       – keeper EOA address (gets strategy manager role)
 *   FEE_RECIPIENT          – address that receives management + performance fees
 *
 * Auto-detected per chainId (no override needed):
 *   USDC — Circle testnet on Sepolia, native USDC on Arbitrum One
 *   NPM  — Uniswap V3 NonfungiblePositionManager for this network
 *   WETH — Wrapped ETH for this network
 *
 * Usage:
 *   # Arbitrum Sepolia (testnet)
 *   source .env && forge script script/Deploy.s.sol \
 *     --rpc-url $RPC_URL_ARBITRUM_SEPOLIA \
 *     --broadcast -vvvv
 *
 *   # Arbitrum One (production — add --verify flag)
 *   source .env && forge script script/Deploy.s.sol \
 *     --rpc-url $RPC_URL_ARBITRUM \
 *     --broadcast --verify -vvvv
 */
contract Deploy is Script {
    // ── USDC addresses ──────────────────────────────────────────────────────────
    address constant USDC_ARBITRUM_ONE     = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address constant USDC_ARBITRUM_SEPOLIA = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    address constant USDC_ETH_SEPOLIA      = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    // ── Uniswap V3 NonfungiblePositionManager ───────────────────────────────────
    // Arbitrum One:     canonical CREATE2 address
    address constant NPM_ARBITRUM_ONE     = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    // Arbitrum Sepolia: 0x248AB79... is the factory; 0x6b2937... is the NPM
    address constant NPM_ARBITRUM_SEPOLIA = 0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65;

    // ── WETH (same address on Arbitrum One and Arbitrum Sepolia) ────────────────
    address constant WETH_ARBITRUM = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    function run() external {
        address strategyManager = vm.envAddress("STRATEGY_MANAGER");
        address feeRecipient    = vm.envAddress("FEE_RECIPIENT");

        require(strategyManager != address(0), "Deploy: STRATEGY_MANAGER not set");
        require(feeRecipient    != address(0), "Deploy: FEE_RECIPIENT not set");

        // Auto-select addresses by chain
        address usdc;
        address npm;
        address weth;

        if (block.chainid == 42161) {
            usdc = USDC_ARBITRUM_ONE;
            npm  = NPM_ARBITRUM_ONE;
            weth = WETH_ARBITRUM;
        } else if (block.chainid == 421614) {
            usdc = USDC_ARBITRUM_SEPOLIA;
            npm  = NPM_ARBITRUM_SEPOLIA;
            weth = WETH_ARBITRUM;
        } else if (block.chainid == 11155111) {
            usdc = USDC_ETH_SEPOLIA;
            npm  = NPM_ARBITRUM_ONE; // Ethereum Sepolia uses same NPM address
            weth = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14; // WETH on Eth Sepolia
        } else {
            revert("Deploy: unknown chainId");
        }

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console.log("Chain ID:         ", block.chainid);
        console.log("Deployer:         ", deployer);
        console.log("Strategy manager: ", strategyManager);
        console.log("Fee recipient:    ", feeRecipient);
        console.log("USDC:             ", usdc);
        console.log("NPM:              ", npm);
        console.log("WETH:             ", weth);

        vm.startBroadcast(deployerKey);

        AILiquidVault vault = new AILiquidVault(usdc, npm, weth, strategyManager, feeRecipient);

        console.log("AILiquidVault deployed at:", address(vault));
        console.log("Asset (USDC):             ", address(vault.asset()));
        console.log("Share token (vAI):        vAI");
        console.log("NPM:                      ", vault.NPM());
        console.log("WETH:                     ", vault.WETH());
        console.log("Strategy manager:         ", vault.strategyManager());

        vm.stopBroadcast();
    }
}
