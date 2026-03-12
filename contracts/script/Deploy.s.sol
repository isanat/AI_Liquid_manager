// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AILiquidVault}   from "../src/AILiquidVault.sol";

/**
 * @title Deploy
 * @notice Deploys AILiquidVault to Arbitrum Sepolia or Arbitrum One.
 *
 * Required environment variables:
 *   DEPLOYER_PRIVATE_KEY   – private key of the deploying wallet
 *   STRATEGY_MANAGER       – address of the keeper EOA (strategy manager role)
 *   FEE_RECIPIENT          – address that receives management + performance fees
 *
 * Usage:
 *   # Arbitrum Sepolia (testnet)
 *   forge script script/Deploy.s.sol \
 *     --rpc-url arbitrum_sepolia \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 *   # Arbitrum One (production)
 *   forge script script/Deploy.s.sol \
 *     --rpc-url arbitrum_one \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract Deploy is Script {
    function run() external {
        address strategyManager = vm.envAddress("STRATEGY_MANAGER");
        address feeRecipient    = vm.envAddress("FEE_RECIPIENT");

        require(strategyManager != address(0), "Deploy: STRATEGY_MANAGER not set");
        require(feeRecipient    != address(0), "Deploy: FEE_RECIPIENT not set");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console.log("Deployer:         ", deployer);
        console.log("Strategy manager: ", strategyManager);
        console.log("Fee recipient:    ", feeRecipient);
        console.log("Chain ID:         ", block.chainid);

        vm.startBroadcast(deployerKey);

        AILiquidVault vault = new AILiquidVault(strategyManager, feeRecipient);

        console.log("AILiquidVault deployed at:", address(vault));
        console.log("USDC (asset):             ", address(vault.asset()));
        console.log("Share token (vAI):        ", address(vault));

        vm.stopBroadcast();
    }
}
