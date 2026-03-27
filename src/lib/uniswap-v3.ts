/**
 * Uniswap V3 contract interactions via viem
 *
 * Covers:
 *  - Read pool state (slot0, liquidity, ticks)
 *  - Mint new position (NonfungiblePositionManager.mint)
 *  - Increase / decrease liquidity
 *  - Collect fees
 *  - Burn position
 */
import { type Address, type PublicClient, type WalletClient, encodeFunctionData, parseUnits } from 'viem';

// ─── ABIs (minimal, only what we call) ───────────────────────────────────────

export const POOL_ABI = [
  {
    name: 'slot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96',   type: 'uint160' },
      { name: 'tick',           type: 'int24'   },
      { name: 'observationIndex',              type: 'uint16' },
      { name: 'observationCardinality',        type: 'uint16' },
      { name: 'observationCardinalityNext',    type: 'uint16' },
      { name: 'feeProtocol',    type: 'uint8'  },
      { name: 'unlocked',       type: 'bool'   },
    ],
  },
  {
    name: 'liquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint128' }],
  },
  {
    name: 'fee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint24' }],
  },
  {
    name: 'token0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'token1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export const NPM_ABI = [
  // mint
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'token0',              type: 'address' },
          { name: 'token1',              type: 'address' },
          { name: 'fee',                 type: 'uint24'  },
          { name: 'tickLower',           type: 'int24'   },
          { name: 'tickUpper',           type: 'int24'   },
          { name: 'amount0Desired',      type: 'uint256' },
          { name: 'amount1Desired',      type: 'uint256' },
          { name: 'amount0Min',          type: 'uint256' },
          { name: 'amount1Min',          type: 'uint256' },
          { name: 'recipient',           type: 'address' },
          { name: 'deadline',            type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'tokenId',      type: 'uint256' },
      { name: 'liquidity',    type: 'uint128' },
      { name: 'amount0',      type: 'uint256' },
      { name: 'amount1',      type: 'uint256' },
    ],
  },
  // increaseLiquidity
  {
    name: 'increaseLiquidity',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenId',        type: 'uint256' },
          { name: 'amount0Desired', type: 'uint256' },
          { name: 'amount1Desired', type: 'uint256' },
          { name: 'amount0Min',     type: 'uint256' },
          { name: 'amount1Min',     type: 'uint256' },
          { name: 'deadline',       type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0',   type: 'uint256' },
      { name: 'amount1',   type: 'uint256' },
    ],
  },
  // decreaseLiquidity
  {
    name: 'decreaseLiquidity',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenId',    type: 'uint256' },
          { name: 'liquidity',  type: 'uint128' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'deadline',   type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
  // collect
  {
    name: 'collect',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenId',          type: 'uint256' },
          { name: 'recipient',        type: 'address' },
          { name: 'amount0Max',       type: 'uint128' },
          { name: 'amount1Max',       type: 'uint128' },
        ],
      },
    ],
    outputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
  // burn
  {
    name: 'burn',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
  // positions (read)
  {
    name: 'positions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce',                  type: 'uint96'  },
      { name: 'operator',               type: 'address' },
      { name: 'token0',                 type: 'address' },
      { name: 'token1',                 type: 'address' },
      { name: 'fee',                    type: 'uint24'  },
      { name: 'tickLower',              type: 'int24'   },
      { name: 'tickUpper',              type: 'int24'   },
      { name: 'liquidity',              type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0',            type: 'uint128' },
      { name: 'tokensOwed1',            type: 'uint128' },
    ],
  },
  // balanceOf
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // tokenOfOwnerByIndex
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

// ─── Contract addresses ───────────────────────────────────────────────────────

/** Uniswap V3 NonfungiblePositionManager — same address on mainnet + all L2s */
export const NONFUNGIBLE_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88' as const;
/** WETH on Arbitrum One */
export const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as const;
/** USDC native on Arbitrum One */
export const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const;
/** ETH/USDC 0.05% pool on Arbitrum One */
export const ETH_USDC_POOL_ARBITRUM = '0xC6962004f452bE9203591991D15f6b388e09E8D0' as const;

// ─── Tick helpers ─────────────────────────────────────────────────────────────

/** Uniswap V3 tick spacing per fee tier */
export const TICK_SPACING: Record<number, number> = {
  100:   1,
  500:   10,
  3000:  60,
  10000: 200,
};

/** Round tick to nearest valid spacing */
export function nearestUsableTick(tick: number, tickSpacing: number): number {
  return Math.round(tick / tickSpacing) * tickSpacing;
}

/** Convert price → tick  (token1/token0) */
export function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

/** Convert tick → price */
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

/** Deadline: current time + minutes */
export function deadline(minutes = 20): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
}

/** Max uint128 — used for collect-all-fees */
export const MAX_UINT128 = (2n ** 128n) - 1n;

// ─── Read helpers ─────────────────────────────────────────────────────────────

export interface PoolSlot0 {
  sqrtPriceX96: bigint;
  tick: number;
  unlocked: boolean;
}

export async function readPoolSlot0(
  publicClient: PublicClient,
  poolAddress: Address,
): Promise<PoolSlot0> {
  const result = await publicClient.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: 'slot0',
  });
  return {
    sqrtPriceX96: result[0],
    tick: result[1],
    unlocked: result[6],
  };
}

export async function readPositions(
  publicClient: PublicClient,
  npmAddress: Address,
  owner: Address,
): Promise<bigint[]> {
  const count = await publicClient.readContract({
    address: npmAddress,
    abi: NPM_ABI,
    functionName: 'balanceOf',
    args: [owner],
  });

  const ids: bigint[] = [];
  for (let i = 0n; i < count; i++) {
    const tokenId = await publicClient.readContract({
      address: npmAddress,
      abi: NPM_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [owner, i],
    });
    ids.push(tokenId);
  }
  return ids;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

export interface MintParams {
  npmAddress: Address;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  recipient: Address;
  slippageBps?: number; // default 50 = 0.5%
}

export interface MintResult {
  hash: `0x${string}`;
  tokenId?: bigint;
}

export async function mintPosition(
  walletClient: WalletClient,
  publicClient: PublicClient,
  params: MintParams,
): Promise<MintResult> {
  const slippage = BigInt(params.slippageBps ?? 50);
  const amount0Min = (params.amount0Desired * (10000n - slippage)) / 10000n;
  const amount1Min = (params.amount1Desired * (10000n - slippage)) / 10000n;

  const [account] = await walletClient.getAddresses();

  const hash = await walletClient.writeContract({
    address: params.npmAddress,
    abi: NPM_ABI,
    functionName: 'mint',
    args: [{
      token0:         params.token0,
      token1:         params.token1,
      fee:            params.fee,
      tickLower:      params.tickLower,
      tickUpper:      params.tickUpper,
      amount0Desired: params.amount0Desired,
      amount1Desired: params.amount1Desired,
      amount0Min,
      amount1Min,
      recipient:      params.recipient,
      deadline:       deadline(),
    }],
    account,
    chain: walletClient.chain ?? null,
  });

  return { hash };
}

export async function collectFees(
  walletClient: WalletClient,
  npmAddress: Address,
  tokenId: bigint,
  recipient: Address,
): Promise<`0x${string}`> {
  const [account] = await walletClient.getAddresses();

  return walletClient.writeContract({
    address: npmAddress,
    abi: NPM_ABI,
    functionName: 'collect',
    args: [{
      tokenId,
      recipient,
      amount0Max: MAX_UINT128,
      amount1Max: MAX_UINT128,
    }],
    account,
    chain: walletClient.chain ?? null,
  });
}

export async function approveToken(
  walletClient: WalletClient,
  tokenAddress: Address,
  spender: Address,
  amount: bigint,
): Promise<`0x${string}`> {
  const [account] = await walletClient.getAddresses();

  return walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spender, amount],
    account,
    chain: walletClient.chain ?? null,
  });
}
