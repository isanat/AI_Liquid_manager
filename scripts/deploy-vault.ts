/**
 * Deploy AILiquidVault to Arbitrum One Mainnet
 * 
 * Prerequisites:
 * - At least 0.005 ETH on Arbitrum One for gas
 * - KEEPER_PRIVATE_KEY environment variable
 */

import { ethers, Wallet, ContractFactory, providers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Load bytecode from file
const BYTECODE = fs.readFileSync(path.join(__dirname, 'bytecode.txt'), 'utf-8').trim();

// Configuration for Arbitrum One Mainnet
const CONFIG = {
  chainId: 42161,
  rpcUrl: process.env.RPC_URL_ARBITRUM || 'https://arb1.arbitrum.io/rpc',
  
  // Token addresses on Arbitrum One
  usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Native USDC
  npm: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',   // Uniswap V3 NPM
  weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
  
  // Your wallet (will be owner, strategyManager, and feeRecipient)
  deployerAddress: '0xBa71d72CE72eD071b38260498E0Bf18Bf76d16e7',
};

// Minimal ABI for deployment and verification
const ABI = [
  'constructor(address _usdc, address _npm, address _weth, address _strategyManager, address _feeRecipient)',
  'function owner() view returns (address)',
  'function strategyManager() view returns (address)',
  'function feeRecipient() view returns (address)',
  'function asset() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🚀 AILiquidVault Deployment - Arbitrum One Mainnet');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Check for private key
  const privateKey = process.env.KEEPER_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ ERROR: KEEPER_PRIVATE_KEY not set');
    console.error('   Run: export KEEPER_PRIVATE_KEY=0x...');
    process.exit(1);
  }
  
  // Connect to network
  const provider = new providers.JsonRpcProvider(CONFIG.rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  
  // Verify wallet matches expected address
  if (wallet.address.toLowerCase() !== CONFIG.deployerAddress.toLowerCase()) {
    console.error(`❌ ERROR: Wallet address mismatch!`);
    console.error(`   Expected: ${CONFIG.deployerAddress}`);
    console.error(`   Got: ${wallet.address}`);
    process.exit(1);
  }
  
  console.log('📋 Deployment Configuration:');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`   Network:        Arbitrum One (Chain ID: ${CONFIG.chainId})`);
  console.log(`   RPC URL:        ${CONFIG.rpcUrl}`);
  console.log(`   Deployer:       ${wallet.address}`);
  console.log(`   USDC:           ${CONFIG.usdc}`);
  console.log(`   NPM:            ${CONFIG.npm}`);
  console.log(`   WETH:           ${CONFIG.weth}`);
  console.log(`   Strategy Mgr:   ${CONFIG.deployerAddress}`);
  console.log(`   Fee Recipient:  ${CONFIG.deployerAddress}`);
  console.log('───────────────────────────────────────────────────────────');
  
  // Check balance
  const balance = await wallet.getBalance();
  const balanceEth = parseFloat(ethers.utils.formatEther(balance));
  console.log(`\n💰 Wallet Balance: ${balanceEth.toFixed(6)} ETH`);
  
  if (balanceEth < 0.001) {
    console.error('\n❌ ERROR: Insufficient ETH for deployment!');
    console.error('   Need at least 0.001 ETH on Arbitrum One for gas.');
    console.error('   Get ETH from: https://app.uniswap.org/swap');
    console.error('   Or bridge from Ethereum: https://bridge.arbitrum.io/');
    process.exit(1);
  }
  
  if (balanceEth < 0.005) {
    console.warn('⚠️  Warning: Low balance. Consider adding more ETH for safety.');
  }
  
  // Estimate gas
  console.log('\n📊 Estimating gas...');
  const factory = new ContractFactory(ABI, BYTECODE, wallet);
  
  // Deploy
  console.log('\n📤 Deploying AILiquidVault...');
  console.log('───────────────────────────────────────────────────────────');
  
  const contract = await factory.deploy(
    CONFIG.usdc,
    CONFIG.npm,
    CONFIG.weth,
    CONFIG.deployerAddress,  // strategyManager
    CONFIG.deployerAddress   // feeRecipient
  );
  
  console.log(`⏳ Transaction sent!`);
  console.log(`   Hash: ${contract.deployTransaction.hash}`);
  console.log(`   View: https://arbiscan.io/tx/${contract.deployTransaction.hash}`);
  console.log('\n⏳ Waiting for confirmation (this may take 30-60 seconds)...');
  
  await contract.deployed();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ DEPLOYMENT SUCCESSFUL!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📜 Contract Address: ${contract.address}`);
  console.log(`🔗 Arbiscan: https://arbiscan.io/address/${contract.address}`);
  console.log(`📝 Transaction: ${contract.deployTransaction.hash}`);
  
  // Verify deployment
  console.log('\n🔍 Verifying contract...');
  console.log('───────────────────────────────────────────────────────────');
  
  try {
    const [owner, strategyManager, feeRecipient, asset, name, symbol] = await Promise.all([
      contract.owner(),
      contract.strategyManager(),
      contract.feeRecipient(),
      contract.asset(),
      contract.name(),
      contract.symbol(),
    ]);
    
    console.log(`   Name:            ${name}`);
    console.log(`   Symbol:          ${symbol}`);
    console.log(`   Owner:           ${owner}`);
    console.log(`   Strategy Mgr:    ${strategyManager}`);
    console.log(`   Fee Recipient:   ${feeRecipient}`);
    console.log(`   Asset (USDC):    ${asset}`);
    
    // Verify all addresses match
    const allCorrect = 
      owner.toLowerCase() === CONFIG.deployerAddress.toLowerCase() &&
      strategyManager.toLowerCase() === CONFIG.deployerAddress.toLowerCase() &&
      feeRecipient.toLowerCase() === CONFIG.deployerAddress.toLowerCase() &&
      asset.toLowerCase() === CONFIG.usdc.toLowerCase();
    
    if (allCorrect) {
      console.log('\n✅ All addresses verified correctly!');
    } else {
      console.warn('\n⚠️  Warning: Some addresses do not match expected values!');
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📝 UPDATE YOUR ENVIRONMENT VARIABLES:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n   NEXT_PUBLIC_VAULT_ADDRESS=${contract.address}`);
  console.log(`   VAULT_ADDRESS=${contract.address}`);
  console.log(`   NEXT_PUBLIC_CHAIN_ID=42161`);
  console.log(`   RPC_URL_ARBITRUM=https://arb1.arbitrum.io/rpc`);
  console.log('\n═══════════════════════════════════════════════════════════');
  
  return contract.address;
}

main()
  .then((address) => {
    console.log(`\n🎉 Deployment complete! Vault: ${address}\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed!');
    console.error('───────────────────────────────────────────────────────────');
    console.error(error);
    process.exit(1);
  });
