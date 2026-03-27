/**
 * Deploy AILiquidVault to Arbitrum One Mainnet (CORRECTED)
 * This script extracts the creation code and appends correct mainnet constructor args
 */

import { ethers, Wallet, Contract, providers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Load full bytecode (creation code + constructor args) from Sepolia deployment
const FULL_BYTECODE = fs.readFileSync(path.join(__dirname, 'bytecode.txt'), 'utf-8').trim();

// Extract creation code (remove last 320 hex chars which are constructor args)
const CREATION_CODE = FULL_BYTECODE.slice(0, -320);

// Mainnet addresses
const MAINNET = {
  chainId: 42161,
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',   // Native USDC on Arbitrum One
  npm: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',    // Uniswap V3 NPM
  weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',   // WETH (same on both)
  owner: '0xBa71d72CE72eD071b38260498E0Bf18Bf76d16e7',   // Your wallet
};

// ABI for constructor
const ABI = [
  'constructor(address _usdc, address _npm, address _weth, address _strategyManager, address _feeRecipient)',
  'function owner() view returns (address)',
  'function strategyManager() view returns (address)',
  'function feeRecipient() view returns (address)',
  'function asset() view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];

// Encode constructor arguments
function encodeConstructorArgs(
  usdc: string, 
  npm: string, 
  weth: string, 
  strategyManager: string, 
  feeRecipient: string
): string {
  const abiCoder = ethers.utils.defaultAbiCoder;
  return abiCoder.encode(
    ['address', 'address', 'address', 'address', 'address'],
    [usdc, npm, weth, strategyManager, feeRecipient]
  ).slice(2); // Remove 0x prefix
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🚀 AILiquidVault Deployment - Arbitrum One Mainnet');
  console.log('   (CORRECTED VERSION)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const privateKey = process.env.KEEPER_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ ERROR: KEEPER_PRIVATE_KEY not set');
    process.exit(1);
  }
  
  const provider = new providers.JsonRpcProvider(MAINNET.rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  
  console.log('📋 Configuration:');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`   Network:        Arbitrum One (${MAINNET.chainId})`);
  console.log(`   Deployer:       ${wallet.address}`);
  console.log(`   USDC (Mainnet): ${MAINNET.usdc}`);
  console.log(`   NPM (Mainnet):  ${MAINNET.npm}`);
  console.log(`   WETH:           ${MAINNET.weth}`);
  console.log(`   Strategy Mgr:   ${MAINNET.owner}`);
  console.log(`   Fee Recipient:  ${MAINNET.owner}`);
  console.log('───────────────────────────────────────────────────────────');
  
  // Check balance
  const balance = await wallet.getBalance();
  const balanceEth = parseFloat(ethers.utils.formatEther(balance));
  console.log(`\n💰 Balance: ${balanceEth.toFixed(6)} ETH`);
  
  if (balanceEth < 0.001) {
    console.error('❌ Insufficient ETH!');
    process.exit(1);
  }
  
  // Encode constructor args for mainnet
  const constructorArgs = encodeConstructorArgs(
    MAINNET.usdc,
    MAINNET.npm,
    MAINNET.weth,
    MAINNET.owner,
    MAINNET.owner
  );
  
  // Combine creation code with mainnet constructor args
  const deployData = CREATION_CODE + constructorArgs;
  
  console.log('\n📦 Bytecode Info:');
  console.log(`   Creation code: ${CREATION_CODE.length} chars`);
  console.log(`   Constructor args: ${constructorArgs.length} chars`);
  console.log(`   Total deploy data: ${deployData.length} chars`);
  
  // Deploy
  console.log('\n📤 Deploying...');
  console.log('───────────────────────────────────────────────────────────');
  
  const tx = await wallet.sendTransaction({ data: deployData });
  console.log(`⏳ Transaction: ${tx.hash}`);
  console.log(`   View: https://arbiscan.io/tx/${tx.hash}`);
  
  console.log('\n⏳ Waiting for confirmation...');
  const receipt = await tx.wait();
  
  if (receipt.status === 0) {
    console.error('❌ Transaction failed!');
    process.exit(1);
  }
  
  const contractAddress = receipt.contractAddress;
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ DEPLOYMENT SUCCESSFUL!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📜 Contract: ${contractAddress}`);
  console.log(`🔗 Arbiscan: https://arbiscan.io/address/${contractAddress}`);
  console.log(`📝 TX: ${tx.hash}`);
  
  // Verify
  console.log('\n🔍 Verifying...');
  
  const contract = new Contract(contractAddress, ABI, provider);
  
  try {
    const [owner, strategyManager, feeRecipient, asset, name, symbol] = await Promise.all([
      contract.owner(),
      contract.strategyManager(),
      contract.feeRecipient(),
      contract.asset(),
      contract.name(),
      contract.symbol(),
    ]);
    
    console.log('───────────────────────────────────────────────────────────');
    console.log(`   Name:          ${name}`);
    console.log(`   Symbol:        ${symbol}`);
    console.log(`   Owner:         ${owner}`);
    console.log(`   Strategy Mgr:  ${strategyManager}`);
    console.log(`   Fee Recipient: ${feeRecipient}`);
    console.log(`   Asset (USDC):  ${asset}`);
    
    const usdcCorrect = asset.toLowerCase() === MAINNET.usdc.toLowerCase();
    const ownerCorrect = owner.toLowerCase() === MAINNET.owner.toLowerCase();
    
    console.log('\n✅ Verification:');
    console.log(`   USDC Address:  ${usdcCorrect ? '✅ CORRECT' : '❌ WRONG'}`);
    console.log(`   Owner:         ${ownerCorrect ? '✅ CORRECT' : '❌ WRONG'}`);
    
    if (usdcCorrect && ownerCorrect) {
      console.log('\n🎉 ALL VERIFICATIONS PASSED!');
    }
  } catch (error) {
    console.error('Verification error:', error);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📝 ENVIRONMENT VARIABLES:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n   NEXT_PUBLIC_VAULT_ADDRESS=${contractAddress}`);
  console.log(`   VAULT_ADDRESS=${contractAddress}`);
  console.log(`   NEXT_PUBLIC_CHAIN_ID=42161`);
  console.log('\n═══════════════════════════════════════════════════════════');
  
  return contractAddress;
}

main()
  .then((addr) => { console.log(`\n🎉 Done! ${addr}\n`); process.exit(0); })
  .catch((e) => { console.error('\n❌ Failed:', e); process.exit(1); });
