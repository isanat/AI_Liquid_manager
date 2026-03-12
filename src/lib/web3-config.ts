/**
 * wagmi v3 + viem configuration
 * Connectors: MetaMask (injected), WalletConnect, Coinbase Wallet
 */
import { createConfig, http } from 'wagmi';
import { mainnet, arbitrum, base, optimism } from 'wagmi/chains';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';

// WalletConnect Project ID — get one free at https://cloud.walletconnect.com
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'demo-project-id';

export const wagmiConfig = createConfig({
  chains: [mainnet, arbitrum, base, optimism],
  connectors: [
    injected({ target: 'metaMask' }),
    coinbaseWallet({ appName: 'AI Liquidity Manager' }),
    walletConnect({ projectId: WC_PROJECT_ID }),
  ],
  transports: {
    [mainnet.id]:   http(process.env.NEXT_PUBLIC_RPC_MAINNET  ?? 'https://cloudflare-eth.com'),
    [arbitrum.id]:  http(process.env.NEXT_PUBLIC_RPC_ARBITRUM ?? 'https://arb1.arbitrum.io/rpc'),
    [base.id]:      http(process.env.NEXT_PUBLIC_RPC_BASE     ?? 'https://mainnet.base.org'),
    [optimism.id]:  http(process.env.NEXT_PUBLIC_RPC_OPTIMISM ?? 'https://mainnet.optimism.io'),
  },
  ssr: true,
});

// ETH/USDC 0.3% pool on mainnet
export const ETH_USDC_POOL = '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8' as const;
