/**
 * Deploy AILiquidVaultV2 to Arbitrum One Mainnet
 * 
 * Deploys TWO vaults:
 * 1. USDC Vault - for USDC deposits
 * 2. USDT Vault - for USDT deposits
 * 
 * Both vaults use WETH/stablecoin pools where WETH is token0
 */

import { ethers, Wallet, Contract, providers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Load V2 bytecode
const BYTECODE_V2 = fs.readFileSync(path.join(__dirname, 'bytecode-v2.txt'), 'utf-8').trim();

// Arbitrum One Mainnet Configuration
const MAINNET = {
  chainId: 42161,
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  
  // Token addresses
  usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',   // Native USDC
  usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',   // USDT
  npm:  '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',    // Uniswap V3 NPM
  weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',   // WETH
  
  // Pool fee tiers
  poolFeeLow: 500,    // 0.05% - for stable pairs
  
  // Owner address
  owner: '0xBa71d72CE72eD071b38260498E0Bf18Bf76d16e7',
};

// ABI for constructor and verification
const ABI = [
  'constructor(address _stablecoin, address _npm, address _weth, uint24 _poolFee, address _strategyManager, address _feeRecipient)',
  'function owner() view returns (address)',
  'function strategyManager() view returns (address)',
  'function feeRecipient() view returns (address)',
  'function asset() view returns (address)',
  'function poolFee() view returns (uint24)',
  'function WETH() view returns (address)',
  'function NPM() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function assetSymbol() view returns (string)',
];

// Encode constructor arguments
function encodeConstructorArgs(
  stablecoin: string,
  npm: string,
  weth: string,
  poolFee: number,
  strategyManager: string,
  feeRecipient: string
): string {
  const abiCoder = ethers.utils.defaultAbiCoder;
  return abiCoder.encode(
    ['address', 'address', 'address', 'uint24', 'address', 'address'],
    [stablecoin, npm, weth, poolFee, strategyManager, feeRecipient]
  ).slice(2); // Remove 0x prefix
}

async function deployVault(
  wallet: Wallet,
  provider: providers.JsonRpcProvider,
  name: string,
  stablecoin: string,
  poolFee: number
): Promise<string> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🚀 Deploying ${name} Vault`);
  console.log('═'.repeat(60));
  
  // Encode constructor args
  const constructorArgs = encodeConstructorArgs(
    stablecoin,
    MAINNET.npm,
    MAINNET.weth,
    poolFee,
    MAINNET.owner,
    MAINNET.owner
  );
  
  // Combine bytecode with constructor args
  const deployData = BYTECODE_V2 + constructorArgs;
  
  console.log('📋 Configuration:');
  console.log('─'.repeat(60));
  console.log(`   Stablecoin:    ${stablecoin}`);
  console.log(`   NPM:           ${MAINNET.npm}`);
  console.log(`   WETH:          ${MAINNET.weth}`);
  console.log(`   Pool Fee:      ${poolFee} (${(poolFee / 10000).toFixed(2)}%)`);
  console.log(`   Strategy Mgr:  ${MAINNET.owner}`);
  console.log(`   Fee Recipient: ${MAINNET.owner}`);
  
  // Check balance
  const balance = await wallet.getBalance();
  const balanceEth = parseFloat(ethers.utils.formatEther(balance));
  console.log(`\n💰 Balance: ${balanceEth.toFixed(6)} ETH`);
  
  if (balanceEth < 0.001) {
    console.error('❌ Insufficient ETH for deployment!');
    return '';
  }
  
  // Deploy
  console.log('\n📤 Deploying...');
  
  const tx = await wallet.sendTransaction({ data: deployData });
  console.log(`⏳ Transaction: ${tx.hash}`);
  console.log(`   View: https://arbiscan.io/tx/${tx.hash}`);
  
  console.log('\n⏳ Waiting for confirmation...');
  const receipt = await tx.wait();
  
  if (receipt.status === 0) {
    console.error('❌ Transaction failed!');
    return '';
  }
  
  const contractAddress = receipt.contractAddress!;
  
  console.log('\n✅ DEPLOYMENT SUCCESSFUL!');
  console.log('─'.repeat(60));
  console.log(`📜 Contract: ${contractAddress}`);
  console.log(`🔗 Arbiscan: https://arbiscan.io/address/${contractAddress}`);
  
  // Verify
  console.log('\n🔍 Verifying...');
  
  const contract = new Contract(contractAddress, ABI, provider);
  
  try {
    const [owner, strategyManager, feeRecipient, asset, poolFeeRead, weth, npm, nameRead, symbol] = 
      await Promise.all([
        contract.owner(),
        contract.strategyManager(),
        contract.feeRecipient(),
        contract.asset(),
        contract.poolFee(),
        contract.WETH(),
        contract.NPM(),
        contract.name(),
        contract.symbol(),
      ]);
    
    console.log('─'.repeat(60));
    console.log(`   Name:          ${nameRead}`);
    console.log(`   Symbol:        ${symbol}`);
    console.log(`   Owner:         ${owner}`);
    console.log(`   Strategy Mgr:  ${strategyManager}`);
    console.log(`   Fee Recipient: ${feeRecipient}`);
    console.log(`   Asset:         ${asset}`);
    console.log(`   Pool Fee:      ${poolFeeRead}`);
    console.log(`   WETH:          ${weth}`);
    console.log(`   NPM:           ${npm}`);
    
    const allCorrect = 
      owner.toLowerCase() === MAINNET.owner.toLowerCase() &&
      strategyManager.toLowerCase() === MAINNET.owner.toLowerCase() &&
      feeRecipient.toLowerCase() === MAINNET.owner.toLowerCase() &&
      asset.toLowerCase() === stablecoin.toLowerCase() &&
      weth.toLowerCase() === MAINNET.weth.toLowerCase() &&
      npm.toLowerCase() === MAINNET.npm.toLowerCase();
    
    if (allCorrect) {
      console.log('\n✅ All verifications passed!');
    } else {
      console.warn('\n⚠️  Some values do not match expected!');
    }
  } catch (error) {
    console.error('❌ Verification error:', error);
  }
  
  return contractAddress;
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('🚀 AILiquidVaultV2 Deployment Script');
  console.log('   Arbitrum One Mainnet');
  console.log('═'.repeat(60));
  
  const privateKey = process.env.KEEPER_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ ERROR: KEEPER_PRIVATE_KEY not set');
    console.error('   Run: export KEEPER_PRIVATE_KEY=0x...');
    process.exit(1);
  }
  
  const provider = new providers.JsonRpcProvider(MAINNET.rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  
  // Verify wallet
  if (wallet.address.toLowerCase() !== MAINNET.owner.toLowerCase()) {
    console.error(`❌ ERROR: Wallet address mismatch!`);
    console.error(`   Expected: ${MAINNET.owner}`);
    console.error(`   Got: ${wallet.address}`);
    process.exit(1);
  }
  
  console.log(`\n👤 Deployer: ${wallet.address}`);
  
  // Deploy USDC Vault
  const usdcVaultAddress = await deployVault(
    wallet, provider,
    'USDC',
    MAINNET.usdc,
    MAINNET.poolFeeLow
  );
  
  // Deploy USDT Vault
  const usdtVaultAddress = await deployVault(
    wallet, provider,
    'USDT',
    MAINNET.usdt,
    MAINNET.poolFeeLow
  );
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📝 DEPLOYMENT SUMMARY');
  console.log('═'.repeat(60));
  
  if (usdcVaultAddress) {
    console.log(`\n✅ USDC Vault: ${usdcVaultAddress}`);
    console.log(`   NEXT_PUBLIC_VAULT_USDC_ADDRESS=${usdcVaultAddress}`);
  }
  
  if (usdtVaultAddress) {
    console.log(`\n✅ USDT Vault: ${usdtVaultAddress}`);
    console.log(`   NEXT_PUBLIC_VAULT_USDT_ADDRESS=${usdtVaultAddress}`);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('📝 POOL ADDRESSES (Arbitrum One):');
  console.log('═'.repeat(60));
  console.log(`   ETH/USDC 0.05%: 0xC6962004f452bE9203591991D15f6b388e09E8D0`);
  console.log(`   ETH/USDT 0.05%: 0x3416cF6C708Da44DB2624D63ea0AAef7113527C6`);
  
  console.log('\n' + '═'.repeat(60));
  console.log('🎉 Deployment Complete!');
  console.log('═'.repeat(60) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed!');
    console.error(error);
    process.exit(1);
  });
