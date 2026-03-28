/**
 * Network Configuration Validator
 * Valida consistência de rede no startup da aplicação
 * 
 * Previne erros de deploy verificando:
 * - Chain ID vs endereços de vault
 * - RPC URL vs rede esperada
 * - Secrets obrigatórios por ambiente
 */

import { Address } from 'viem';

// ─────────────────────────────────────────────────────────────────────────────
// Network Configurations
// ─────────────────────────────────────────────────────────────────────────────

export const NETWORK_CONFIGS = {
  // Arbitrum One Mainnet
  '42161': {
    name: 'Arbitrum One',
    chainId: 42161,
    rpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    vaults: {
      USDC: '0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C' as Address,
      USDT: '0x12a20d3569da6DD2d99E7bC95748283B10729c4C' as Address,
    },
    tokens: {
      USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as Address,
      WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address,
    },
    pools: {
      ETH_USDC: '0xC6962004f452bE9203591991D15f6b388e09E8D0' as Address,
      ETH_USDT: '0x3416cF6C708Da44DB2624D63ea0AAef7113527C6' as Address,
    },
    keeperRequired: true,
  },
  // Arbitrum Sepolia Testnet
  '421614': {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    vaults: {
      USDC: '0x0000000000000000000000000000000000000000' as Address,
      USDT: '0x0000000000000000000000000000000000000000' as Address,
    },
    tokens: {
      USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as Address,
      USDT: '0x0000000000000000000000000000000000000000' as Address,
      WETH: '0xE591bf0A0CF924A0674d7792db046B23CEbF5f34' as Address,
    },
    pools: {
      ETH_USDC: '0x77F8dA77c8fb5ADAf3088937B934beC2B0ff97bF' as Address,
      ETH_USDT: '0x0000000000000000000000000000000000000000' as Address,
    },
    keeperRequired: false,
  },
} as const;

export type ChainId = keyof typeof NETWORK_CONFIGS;

// ─────────────────────────────────────────────────────────────────────────────
// Validation Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  network: string;
  chainId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize address for comparison (case-insensitive)
 */
function normalizeAddress(address: string | undefined): string {
  if (!address) return '';
  return address.toLowerCase();
}

/**
 * Check if address matches expected (case-insensitive)
 */
function addressMatches(actual: string | undefined, expected: Address): boolean {
  if (!actual) return true; // Skip if not set
  return normalizeAddress(actual) === normalizeAddress(expected);
}

/**
 * Validate network configuration against environment variables
 */
export function validateNetworkConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || '42161';
  const expected = NETWORK_CONFIGS[chainId as ChainId];
  
  // Check if chain ID is supported
  if (!expected) {
    errors.push(
      `Chain ID "${chainId}" não suportado. ` +
      `Valores aceitos: ${Object.keys(NETWORK_CONFIGS).join(', ')}`
    );
    return { 
      valid: false, 
      errors, 
      warnings, 
      network: 'unknown',
      chainId 
    };
  }

  // ─── Validate Vault Addresses ────────────────────────────────────────────
  
  const usdcVault = process.env.NEXT_PUBLIC_VAULT_USDC_ADDRESS;
  const usdtVault = process.env.NEXT_PUBLIC_VAULT_USDT_ADDRESS;
  const defaultVault = process.env.NEXT_PUBLIC_VAULT_ADDRESS;
  
  // USDC Vault
  if (usdcVault && !addressMatches(usdcVault, expected.vaults.USDC)) {
    if (chainId === '42161' && expected.vaults.USDC !== '0x0000000000000000000000000000000000000000') {
      errors.push(
        `VAULT_USDC_ADDRESS mismatch!\n` +
        `  Expected: ${expected.vaults.USDC}\n` +
        `  Got:      ${usdcVault}`
      );
    } else {
      warnings.push(`VAULT_USDC_ADDRESS differs from default: ${usdcVault}`);
    }
  }
  
  // USDT Vault
  if (usdtVault && !addressMatches(usdtVault, expected.vaults.USDT)) {
    if (chainId === '42161' && expected.vaults.USDT !== '0x0000000000000000000000000000000000000000') {
      errors.push(
        `VAULT_USDT_ADDRESS mismatch!\n` +
        `  Expected: ${expected.vaults.USDT}\n` +
        `  Got:      ${usdtVault}`
      );
    } else {
      warnings.push(`VAULT_USDT_ADDRESS differs from default: ${usdtVault}`);
    }
  }
  
  // Default vault should match USDC
  if (defaultVault && !addressMatches(defaultVault, expected.vaults.USDC)) {
    warnings.push(
      `VAULT_ADDRESS (default) should match USDC vault:\n` +
      `  Expected: ${expected.vaults.USDC}\n` +
      `  Got:      ${defaultVault}`
    );
  }

  // ─── Validate RPC URL ────────────────────────────────────────────────────
  
  const rpcUrl = process.env.RPC_URL_ARBITRUM;
  
  if (rpcUrl) {
    // Check if RPC matches the expected network
    if (chainId === '42161') {
      // Mainnet RPC validation
      const isOfficialRpc = rpcUrl.includes('arb1.arbitrum.io');
      const isKnownProvider = 
        rpcUrl.includes('alchemy.com') ||
        rpcUrl.includes('infura.io') ||
        rpcUrl.includes('ankr.com') ||
        rpcUrl.includes('quicknode.com') ||
        rpcUrl.includes('drpc.org');
      
      if (!isOfficialRpc && !isKnownProvider) {
        warnings.push(
          `RPC_URL_ARBITRUM não é um provedor conhecido:\n` +
          `  ${rpcUrl}\n` +
          `  Provedores recomendados: Arbitrum, Alchemy, Infura, Ankr`
        );
      }
    } else if (chainId === '421614') {
      // Testnet RPC validation
      if (!rpcUrl.includes('sepolia')) {
        warnings.push(
          `RPC_URL_ARBITRUM parece não ser para testnet Sepolia:\n` +
          `  ${rpcUrl}`
        );
      }
    }
  } else {
    warnings.push('RPC_URL_ARBITRUM não configurado - usando RPC público fallback');
  }

  // ─── Validate Required Secrets ───────────────────────────────────────────
  
  if (expected.keeperRequired) {
    if (!process.env.KEEPER_PRIVATE_KEY) {
      errors.push(
        'KEEPER_PRIVATE_KEY não configurado!\n' +
        '  Obrigatório para mainnet - keeper não funcionará.'
      );
    }
    
    if (!process.env.KEEPER_TRIGGER_SECRET) {
      warnings.push(
        'KEEPER_TRIGGER_SECRET não configurado.\n' +
        '  Endpoint /api/keeper/trigger ficará sem autenticação.'
      );
    }
  }
  
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL não configurado - banco de dados indisponível');
  }
  
  if (!process.env.AI_ENGINE_URL) {
    warnings.push(
      'AI_ENGINE_URL não configurado.\n' +
      '  Keeper e AI features não funcionarão.'
    );
  }

  // ─── Validate WalletConnect ──────────────────────────────────────────────
  
  if (!process.env.NEXT_PUBLIC_WC_PROJECT_ID) {
    warnings.push('NEXT_PUBLIC_WC_PROJECT_ID não configurado - WalletConnect pode falhar');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    network: expected.name,
    chainId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging Functions
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Log validation results to console
 */
export function logNetworkValidation(): ValidationResult {
  const result = validateNetworkConfig();
  
  const line = '═'.repeat(55);
  const separator = '─'.repeat(55);
  
  console.log('');
  console.log(`${COLORS.cyan}${line}${COLORS.reset}`);
  console.log(`${COLORS.cyan}🔗 Network Configuration Validation${COLORS.reset}`);
  console.log(`${COLORS.cyan}${line}${COLORS.reset}`);
  console.log('');
  console.log(`  Network:  ${COLORS.cyan}${result.network}${COLORS.reset}`);
  console.log(`  Chain ID: ${result.chainId}`);
  console.log('');
  
  if (result.errors.length > 0) {
    console.log(`${COLORS.red}  ❌ ERRORS (${result.errors.length}):${COLORS.reset}`);
    result.errors.forEach(e => {
      console.log('');
      e.split('\n').forEach(line => {
        console.log(`     ${line}`);
      });
    });
    console.log('');
  }
  
  if (result.warnings.length > 0) {
    console.log(`${COLORS.yellow}  ⚠️  WARNINGS (${result.warnings.length}):${COLORS.reset}`);
    result.warnings.forEach(w => {
      console.log('');
      w.split('\n').forEach(line => {
        console.log(`     ${line}`);
      });
    });
    console.log('');
  }
  
  console.log(`${COLORS.cyan}${separator}${COLORS.reset}`);
  
  if (result.valid) {
    console.log(`${COLORS.green}  ✅ Network configuration valid${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}  ❌ Network configuration INVALID${COLORS.reset}`);
    console.log(`${COLORS.red}     Fix errors before proceeding${COLORS.reset}`);
  }
  
  console.log(`${COLORS.cyan}${line}${COLORS.reset}`);
  console.log('');
  
  return result;
}

/**
 * Get current network config
 */
export function getCurrentNetworkConfig() {
  const chainId = (process.env.NEXT_PUBLIC_CHAIN_ID || '42161') as ChainId;
  return NETWORK_CONFIGS[chainId] || null;
}

/**
 * Check if we're on mainnet
 */
export function isMainnet(): boolean {
  return process.env.NEXT_PUBLIC_CHAIN_ID === '42161';
}

/**
 * Check if we're on testnet
 */
export function isTestnet(): boolean {
  return process.env.NEXT_PUBLIC_CHAIN_ID === '421614';
}
