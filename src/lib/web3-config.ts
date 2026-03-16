/**
 * wagmi v3 + viem configuration
 * Primary network: Arbitrum One (cheap gas, Uniswap V3 native)
 * Connectors: MetaMask (injected), WalletConnect, Coinbase Wallet
 */
import { createConfig, http } from 'wagmi';
import { arbitrum, arbitrumSepolia, mainnet, base, optimism } from 'wagmi/chains';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';

// WalletConnect Project ID — get one free at https://cloud.walletconnect.com
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'demo-project-id';

const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'https://ai-liquid-frontend.onrender.com';

export const wagmiConfig = createConfig({
  // Arbitrum One first = default chain for the app
  chains: [arbitrum, arbitrumSepolia, mainnet, base, optimism],
  connectors: [
    injected({ target: 'metaMask' }),
    coinbaseWallet({ appName: 'AI Liquidity Manager' }),
    walletConnect({
      projectId: WC_PROJECT_ID,
      metadata: {
        name: 'AI Liquidity Manager',
        description: 'AI-powered Uniswap V3 liquidity management',
        url: FRONTEND_URL,
        icons: [`${FRONTEND_URL}/favicon.ico`],
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [arbitrum.id]:        http(process.env.NEXT_PUBLIC_RPC_ARBITRUM        ?? 'https://arb1.arbitrum.io/rpc'),
    [arbitrumSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA ?? 'https://sepolia-rollup.arbitrum.io/rpc'),
    [mainnet.id]:         http(process.env.NEXT_PUBLIC_RPC_MAINNET          ?? 'https://cloudflare-eth.com'),
    [base.id]:            http(process.env.NEXT_PUBLIC_RPC_BASE             ?? 'https://mainnet.base.org'),
    [optimism.id]:        http(process.env.NEXT_PUBLIC_RPC_OPTIMISM         ?? 'https://mainnet.optimism.io'),
  },
  ssr: true,
});

// ETH/USDC 0.05% pool — network-aware
// Arbitrum Sepolia: 0x77F8dA77c8fb5ADAf3088937B934beC2B0ff97bF (deployed Dec 2024)
// Arbitrum One:     0xC6962004f452bE9203591991D15f6b388e09E8D0
export const ETH_USDC_POOL =
  process.env.NEXT_PUBLIC_CHAIN_ID === '421614'
    ? '0x77F8dA77c8fb5ADAf3088937B934beC2B0ff97bF'
    : '0xC6962004f452bE9203591991D15f6b388e09E8D0';
