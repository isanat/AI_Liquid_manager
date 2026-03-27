/**
 * vault-contract.ts
 * ─────────────────
 * ABI and helpers for AILiquidVaultV2 (ERC-4626) on Arbitrum One Mainnet.
 *
 * USDC Vault: 0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C
 * USDT Vault: 0x12a20d3569da6DD2d99E7bC95748283B10729c4C
 * Network: Arbitrum One (Chain ID: 42161)
 *
 * The vault asset is a stablecoin (USDC or USDT, 6 decimals).
 * The vault share token is vAI (18 decimals).
 */

import type { PublicClient, WalletClient, Address } from 'viem';
import { parseUnits, formatUnits } from 'viem';

// ─── Vault Addresses ─────────────────────────────────────────────────────────

/** USDC Vault - Primary vault for USDC deposits */
export const VAULT_USDC_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_USDC_ADDRESS || '0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C') as Address;

/** USDT Vault - Vault for USDT deposits */
export const VAULT_USDT_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_USDT_ADDRESS || '0x12a20d3569da6DD2d99E7bC95748283B10729c4C') as Address;

/** Default vault (USDC for backwards compatibility) */
export const VAULT_ADDRESS = VAULT_USDC_ADDRESS;

// ─── Token Addresses ─────────────────────────────────────────────────────────

/** USDC native on Arbitrum One */
export const USDC_ARBITRUM_ONE = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address;

/** USDT on Arbitrum One */
export const USDT_ARBITRUM_ONE = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as Address;

/** WETH on Arbitrum One */
export const WETH_ARBITRUM_ONE = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address;

/** Circle testnet USDC on Arbitrum Sepolia */
export const USDC_ARBITRUM_SEPOLIA = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as Address;

/**
 * Active USDC address — driven by NEXT_PUBLIC_CHAIN_ID env var.
 */
export const USDC_ARBITRUM: Address =
  process.env.NEXT_PUBLIC_CHAIN_ID === '421614'
    ? USDC_ARBITRUM_SEPOLIA
    : USDC_ARBITRUM_ONE;

/**
 * Get vault address for a given asset
 */
export function getVaultAddressForAsset(asset: Address): Address {
  if (asset.toLowerCase() === USDC_ARBITRUM_ONE.toLowerCase()) {
    return VAULT_USDC_ADDRESS;
  }
  if (asset.toLowerCase() === USDT_ARBITRUM_ONE.toLowerCase()) {
    return VAULT_USDT_ADDRESS;
  }
  // Default to USDC vault
  return VAULT_USDC_ADDRESS;
}

// ─── ABI ─────────────────────────────────────────────────────────────────────

export const VAULT_ABI = [
  // ── ERC-20 (shares) ──
  { name: 'name',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string'  }] },
  { name: 'symbol',      type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string'  }] },
  { name: 'decimals',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8'   }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  // ── ERC-4626 read ──
  { name: 'asset',       type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'totalAssets', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'convertToShares', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'convertToAssets', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  // ── ERC-4626 write ──
  {
    name: 'deposit', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'mint', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }],
    outputs: [{ name: 'assets', type: 'uint256' }],
  },
  {
    name: 'withdraw', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets',   type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner',    type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'redeem', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares',   type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner',    type: 'address' },
    ],
    outputs: [{ name: 'assets', type: 'uint256' }],
  },
  // ── Custom vault state (view) ──
  { name: 'sharePrice',          type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'deployedCapital',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'activePositionCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getActiveTokenIds',   type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256[]' }] },
  { name: 'strategyManager',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'feeRecipient',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'highWaterMark',       type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'lastFeeTimestamp',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'managementFeeBps',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'performanceFeeBps',   type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'paused',              type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool'    }] },
  { name: 'poolFee',             type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24'  }] },
  { name: 'WETH',                type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'NPM',                 type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'assetSymbol',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string'  }] },
  // ── Strategy (keeper-only write) ──
  {
    name: 'rebalance', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'tickLower',      type: 'int24'   },
      { name: 'tickUpper',      type: 'int24'   },
      { name: 'amountWeth',     type: 'uint256' },  // Changed from amount0Desired
      { name: 'amountStable',   type: 'uint256' },  // Changed from amount1Desired
    ],
    outputs: [],
  },
  {
    name: 'collectFees', type: 'function', stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // ── Admin (owner-only write) ──
  {
    name: 'setStrategyManager', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: '_manager', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setFeeRecipient', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: '_recipient', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setFees', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: '_mgmtBps', type: 'uint256' }, { name: '_perfBps', type: 'uint256' }],
    outputs: [],
  },
  { name: 'pause',         type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'unpause',       type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'emergencyExit', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  // ── Events ──
  {
    name: 'Deposit', type: 'event',
    inputs: [
      { name: 'sender',   type: 'address', indexed: true  },
      { name: 'owner',    type: 'address', indexed: true  },
      { name: 'assets',   type: 'uint256', indexed: false },
      { name: 'shares',   type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Withdraw', type: 'event',
    inputs: [
      { name: 'sender',   type: 'address', indexed: true  },
      { name: 'receiver', type: 'address', indexed: true  },
      { name: 'owner',    type: 'address', indexed: true  },
      { name: 'assets',   type: 'uint256', indexed: false },
      { name: 'shares',   type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Rebalanced', type: 'event',
    inputs: [
      { name: 'tickLower',    type: 'int24',   indexed: false },
      { name: 'tickUpper',    type: 'int24',   indexed: false },
      { name: 'tokenId',      type: 'uint256', indexed: false },
      { name: 'liquidity',    type: 'uint128', indexed: false },
      { name: 'stablecoinDeployed', type: 'uint256', indexed: false },  // Changed from usdcDeployed
    ],
  },
  {
    name: 'FeesCollected', type: 'event',
    inputs: [
      { name: 'stablecoinAmount', type: 'uint256', indexed: false },
      { name: 'wethAmount',       type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'StrategyManagerUpdated', type: 'event',
    inputs: [
      { name: 'oldManager', type: 'address', indexed: true },
      { name: 'newManager', type: 'address', indexed: true },
    ],
  },
  {
    name: 'ManagementFeeCharged', type: 'event',
    inputs: [{ name: 'feeShares', type: 'uint256', indexed: false }],
  },
  {
    name: 'PerformanceFeeCharged', type: 'event',
    inputs: [{ name: 'feeShares', type: 'uint256', indexed: false }],
  },
] as const;

/** ERC-20 approve ABI (for USDC/USDT → vault approval) */
export const ERC20_APPROVE_ABI = [
  {
    name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'symbol', type: 'function', stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'decimals', type: 'function', stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetType = 'USDC' | 'USDT';

export interface VaultState {
  totalAssets: bigint;       // Stablecoin 6-dec
  totalSupply: bigint;       // vAI 18-dec
  deployedCapital: bigint;   // Stablecoin in LP
  sharePrice: bigint;        // scaled 1e18 per vAI share
  activePositions: bigint;
  managementFeeBps: bigint;
  performanceFeeBps: bigint;
  paused: boolean;
  asset: Address;
  assetSymbol: string;
  // formatted
  totalAssetsUsd: string;
  sharePriceUsd: string;
  nav: string;
}

export interface UserVaultState {
  shares: bigint;            // vAI balance
  assetsValue: bigint;       // Stablecoin equivalent
  assetsValueUsd: string;
  stablecoinBalance: bigint; // Stablecoin in wallet
  stablecoinAllowance: bigint; // Stablecoin allowance for vault
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

export async function readVaultState(
  publicClient: PublicClient,
  vaultAddress: Address = VAULT_ADDRESS
): Promise<VaultState | null> {
  if (!vaultAddress) return null;
  try {
    const [
      totalAssets,
      totalSupply,
      deployedCapital,
      sharePrice,
      activePositions,
      managementFeeBps,
      performanceFeeBps,
      paused,
      asset,
      assetSymbol,
    ] = await Promise.all([
      publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: 'totalAssets' }),
      publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: 'totalSupply' }),
      publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: 'deployedCapital' }),
      publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: 'sharePrice' }),
      publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: 'activePositionCount' }),
      publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: 'managementFeeBps' }),
      publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: 'performanceFeeBps' }),
      publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: 'paused' }),
      publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: 'asset' }),
      publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: 'assetSymbol' }),
    ]);

    const totalAssetsUsd = formatUnits(totalAssets as bigint, 6);
    const sharePriceUsd  = formatUnits((sharePrice as bigint) / 10n ** 12n, 6);

    return {
      totalAssets:      totalAssets as bigint,
      totalSupply:      totalSupply as bigint,
      deployedCapital:  deployedCapital as bigint,
      sharePrice:       sharePrice as bigint,
      activePositions:  activePositions as bigint,
      managementFeeBps: managementFeeBps as bigint,
      performanceFeeBps:performanceFeeBps as bigint,
      paused:           paused as boolean,
      asset:            asset as Address,
      assetSymbol:      assetSymbol as string,
      totalAssetsUsd,
      sharePriceUsd,
      nav: totalAssetsUsd,
    };
  } catch {
    return null;
  }
}

export async function readUserVaultState(
  publicClient: PublicClient,
  userAddress: Address,
  vaultAddress: Address = VAULT_ADDRESS,
  assetAddress?: Address
): Promise<UserVaultState | null> {
  if (!vaultAddress) return null;
  try {
    // Get asset address from vault if not provided
    const asset = assetAddress ?? await publicClient.readContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'asset',
    }) as Address;

    const [shares, stablecoinBalance, stablecoinAllowance] = await Promise.all([
      publicClient.readContract({ address: vaultAddress,   abi: VAULT_ABI,          functionName: 'balanceOf',  args: [userAddress] }),
      publicClient.readContract({ address: asset,          abi: ERC20_APPROVE_ABI,  functionName: 'balanceOf',  args: [userAddress] }),
      publicClient.readContract({ address: asset,          abi: ERC20_APPROVE_ABI,  functionName: 'allowance', args: [userAddress, vaultAddress] }),
    ]);

    // Convert shares → assets via vault
    const assetsValue = shares as bigint > 0n
      ? await publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: 'convertToAssets', args: [shares as bigint] }) as bigint
      : 0n;

    return {
      shares:          shares as bigint,
      assetsValue,
      assetsValueUsd:  formatUnits(assetsValue, 6),
      stablecoinBalance:     stablecoinBalance as bigint,
      stablecoinAllowance:   stablecoinAllowance as bigint,
    };
  } catch {
    return null;
  }
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Step 1: Approve stablecoin spending.
 * @param amount  human-readable USD amount, e.g. "1000.50"
 * @param asset   stablecoin address (USDC or USDT)
 */
export async function approveStablecoin(
  walletClient: WalletClient,
  account: Address,
  amount: string,
  asset: Address,
  vaultAddress: Address = VAULT_ADDRESS
): Promise<`0x${string}`> {
  const amountRaw = parseUnits(amount, 6);
  return walletClient.writeContract({
    address:      asset,
    abi:          ERC20_APPROVE_ABI,
    functionName: 'approve',
    args:         [vaultAddress, amountRaw],
    account,
    chain: walletClient.chain ?? null,
  });
}

/**
 * Step 2: Deposit stablecoin into vault — receives vAI shares.
 * @param amount  human-readable USD amount
 */
export async function depositToVault(
  walletClient: WalletClient,
  account: Address,
  amount: string,
  vaultAddress: Address = VAULT_ADDRESS
): Promise<`0x${string}`> {
  const amountRaw = parseUnits(amount, 6);
  return walletClient.writeContract({
    address:      vaultAddress,
    abi:          VAULT_ABI,
    functionName: 'deposit',
    args:         [amountRaw, account],
    account,
    chain: walletClient.chain ?? null,
  });
}

/**
 * Redeem vAI shares for stablecoin.
 * @param shares  bigint amount of vAI shares to burn
 */
export async function redeemFromVault(
  walletClient: WalletClient,
  account: Address,
  shares: bigint,
  vaultAddress: Address = VAULT_ADDRESS
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address:      vaultAddress,
    abi:          VAULT_ABI,
    functionName: 'redeem',
    args:         [shares, account, account],
    account,
    chain: walletClient.chain ?? null,
  });
}
