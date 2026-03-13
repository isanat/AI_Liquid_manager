// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

interface IUniswapV3Factory {
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IUniswapV3Pool {
    function initialize(uint160 sqrtPriceX96) external;
    function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool);
}

/**
 * Create and initialize the USDC/WETH 0.05% pool on Arbitrum Sepolia.
 * Only needed once — idempotent (skips if pool already exists).
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... forge script script/CreatePool.s.sol \
 *     --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast -vv
 */
contract CreatePool is Script {
    // Arbitrum Sepolia
    address constant FACTORY = 0x248AB79Bbb9bC29bB72f7Cd42F17e054Fc40188e;
    address constant USDC    = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    address constant WETH    = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    uint24  constant FEE     = 500; // 0.05%

    // sqrtPriceX96 for 1 ETH = 1850 USDC
    // raw_price = 1e18 / (1850 * 1e6) = 5.405e8
    // sqrtPriceX96 = sqrt(5.405e8) * 2^96
    uint160 constant SQRT_PRICE_X96 = 1842017362858961064056288662519808;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        IUniswapV3Factory factory = IUniswapV3Factory(FACTORY);

        // Check if pool already exists
        address existing = factory.getPool(USDC, WETH, FEE);
        if (existing != address(0)) {
            console.log("Pool already exists:", existing);
            IUniswapV3Pool pool = IUniswapV3Pool(existing);
            (uint160 sqrtPrice,,,,,,) = pool.slot0();
            if (sqrtPrice == 0) {
                console.log("Pool not initialized - initializing...");
                vm.startBroadcast(deployerKey);
                pool.initialize(SQRT_PRICE_X96);
                vm.stopBroadcast();
                console.log("Pool initialized at sqrtPriceX96:", SQRT_PRICE_X96);
            } else {
                console.log("Pool already initialized. sqrtPrice:", sqrtPrice);
            }
            return;
        }

        vm.startBroadcast(deployerKey);

        address poolAddr = factory.createPool(USDC, WETH, FEE);
        console.log("Pool created at:", poolAddr);

        IUniswapV3Pool(poolAddr).initialize(SQRT_PRICE_X96);
        console.log("Pool initialized. sqrtPriceX96:", SQRT_PRICE_X96);

        vm.stopBroadcast();
    }
}
