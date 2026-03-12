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
 * Optional:
 *   USDC_ADDRESS           – override USDC token address (detected automatically by chainId)
 *
 * USDC addresses (auto-detected):
 *   Arbitrum One   (42161)  → 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
 *   Arbitrum Sepolia(421614) → 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d (Circle testnet)
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
    // USDC native on Arbitrum One
    address constant USDC_ARBITRUM_ONE     = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    // Circle's testnet USDC on Arbitrum Sepolia
    address constant USDC_ARBITRUM_SEPOLIA = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    function run() external {
        address strategyManager = vm.envAddress("STRATEGY_MANAGER");
        address feeRecipient    = vm.envAddress("FEE_RECIPIENT");

        require(strategyManager != address(0), "Deploy: STRATEGY_MANAGER not set");
        require(feeRecipient    != address(0), "Deploy: FEE_RECIPIENT not set");

        // Auto-select USDC by chain; allow override via env var
        address usdc;
        try vm.envAddress("USDC_ADDRESS") returns (address overrideUsdc) {
            usdc = overrideUsdc;
            console.log("USDC override:    ", usdc);
        } catch {
            if (block.chainid == 42161) {
                usdc = USDC_ARBITRUM_ONE;
            } else if (block.chainid == 421614) {
                usdc = USDC_ARBITRUM_SEPOLIA;
            } else {
                revert("Deploy: unknown chainId - set USDC_ADDRESS manually");
            }
        }

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console.log("Chain ID:         ", block.chainid);
        console.log("Deployer:         ", deployer);
        console.log("Strategy manager: ", strategyManager);
        console.log("Fee recipient:    ", feeRecipient);
        console.log("USDC:             ", usdc);

        vm.startBroadcast(deployerKey);

        AILiquidVault vault = new AILiquidVault(usdc, strategyManager, feeRecipient);

        console.log("AILiquidVault deployed at:", address(vault));
        console.log("Asset (USDC):             ", address(vault.asset()));
        console.log("Share token (vAI):        vAI");
        console.log("Strategy manager:         ", vault.strategyManager());

        vm.stopBroadcast();
    }
}
