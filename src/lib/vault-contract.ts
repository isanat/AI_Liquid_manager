/**
 * vault-contract.ts
 * ─────────────────
 * ABI and helpers for AILiquidVault (ERC-4626) on Arbitrum.
 *
 * After deploying the contract set these env vars:
 *   NEXT_PUBLIC_VAULT_ADDRESS   – deployed vault address
 *
 * The vault asset is USDC (6 decimals).
 * The vault share token is vAI (18 decimals).
 */

import type { PublicClient, WalletClient, Address } from 'viem';
import { parseUnits, formatUnits } from 'viem';

// ─── Addresses ────────────────────────────────────────────────────────────────

export const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? '') as Address;

/** USDC native on Arbitrum One (production) */
export const USDC_ARBITRUM_ONE    = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address;
/** Circle testnet USDC on Arbitrum Sepolia */
export const USDC_ARBITRUM_SEPOLIA = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as Address;

/**
 * Active USDC address — driven by NEXT_PUBLIC_CHAIN_ID env var.
 * Default: Arbitrum One (production). Set NEXT_PUBLIC_CHAIN_ID=421614 for testnet.
 */
export const USDC_ARBITRUM: Address =
  process.env.NEXT_PUBLIC_CHAIN_ID === '421614'
    ? USDC_ARBITRUM_SEPOLIA
    : USDC_ARBITRUM_ONE;

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
  // ── Strategy (keeper-only write) ──
  {
    name: 'rebalance', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'tickLower',      type: 'int24'   },
      { name: 'tickUpper',      type: 'int24'   },
      { name: 'amount0Desired', type: 'uint256' },
      { name: 'amount1Desired', type: 'uint256' },
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
      { name: 'usdcDeployed', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'FeesCollected', type: 'event',
    inputs: [{ name: 'usdcAmount', type: 'uint256', indexed: false }],
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

/** ERC-20 approve ABI (for USDC → vault approval) */
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
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VaultState {
  totalAssets: bigint;       // USDC 6-dec
  totalSupply: bigint;       // vAI 18-dec
  deployedCapital: bigint;   // USDC in LP
  sharePrice: bigint;        // scaled 1e18 per vAI share (USDC units)
  activePositions: bigint;
  managementFeeBps: bigint;
  performanceFeeBps: bigint;
  paused: boolean;
  // formatted
  totalAssetsUsd: string;
  sharePriceUsd: string;
  nav: string;
}

export interface UserVaultState {
  shares: bigint;            // vAI balance
  assetsValue: bigint;       // USDC equivalent
  assetsValueUsd: string;
  usdcBalance: bigint;       // USDC in wallet
  usdcAllowance: bigint;     // USDC allowance for vault
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

export async function readVaultState(publicClient: PublicClient): Promise<VaultState | null> {
  if (!VAULT_ADDRESS) return null;
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
    ] = await Promise.all([
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalAssets' }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalSupply' }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'deployedCapital' }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'sharePrice' }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'activePositionCount' }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'managementFeeBps' }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'performanceFeeBps' }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'paused' }),
    ]);

    const totalAssetsUsd = formatUnits(totalAssets as bigint, 6);
    // sharePrice is scaled 1e18 per vAI; convert to USDC per share (6 dec)
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
): Promise<UserVaultState | null> {
  if (!VAULT_ADDRESS) return null;
  try {
    const [shares, usdcBalance, usdcAllowance] = await Promise.all([
      publicClient.readContract({ address: VAULT_ADDRESS,   abi: VAULT_ABI,          functionName: 'balanceOf',  args: [userAddress] }),
      publicClient.readContract({ address: USDC_ARBITRUM,   abi: ERC20_APPROVE_ABI,  functionName: 'balanceOf',  args: [userAddress] }),
      publicClient.readContract({ address: USDC_ARBITRUM,   abi: ERC20_APPROVE_ABI,  functionName: 'allowance',  args: [userAddress, VAULT_ADDRESS] }),
    ]);

    // Convert shares → assets via vault
    const assetsValue = shares as bigint > 0n
      ? await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'convertToAssets', args: [shares as bigint] }) as bigint
      : 0n;

    return {
      shares:          shares as bigint,
      assetsValue,
      assetsValueUsd:  formatUnits(assetsValue, 6),
      usdcBalance:     usdcBalance as bigint,
      usdcAllowance:   usdcAllowance as bigint,
    };
  } catch {
    return null;
  }
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Step 1: Approve USDC spending.
 * @param amountUsdc  human-readable USD amount, e.g. "1000.50"
 */
export async function approveUsdc(
  walletClient: WalletClient,
  account: Address,
  amountUsdc: string,
): Promise<`0x${string}`> {
  const amount = parseUnits(amountUsdc, 6);
  return walletClient.writeContract({
    address:      USDC_ARBITRUM,
    abi:          ERC20_APPROVE_ABI,
    functionName: 'approve',
    args:         [VAULT_ADDRESS, amount],
    account,
    chain: walletClient.chain ?? null,
  });
}

/**
 * Step 2: Deposit USDC into vault — receives vAI shares.
 * @param amountUsdc  human-readable USD amount
 */
export async function depositToVault(
  walletClient: WalletClient,
  account: Address,
  amountUsdc: string,
): Promise<`0x${string}`> {
  const amount = parseUnits(amountUsdc, 6);
  return walletClient.writeContract({
    address:      VAULT_ADDRESS,
    abi:          VAULT_ABI,
    functionName: 'deposit',
    args:         [amount, account],
    account,
    chain: walletClient.chain ?? null,
  });
}

/**
 * Redeem vAI shares for USDC.
 * @param shares  bigint amount of vAI shares to burn
 */
export async function redeemFromVault(
  walletClient: WalletClient,
  account: Address,
  shares: bigint,
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address:      VAULT_ADDRESS,
    abi:          VAULT_ABI,
    functionName: 'redeem',
    args:         [shares, account, account],
    account,
    chain: walletClient.chain ?? null,
  });
}
