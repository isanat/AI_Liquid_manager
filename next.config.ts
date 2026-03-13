import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // Expose NEXT_PUBLIC_* vars at build time with fallback defaults.
  // In Docker builds on Render, env vars are not automatically ARG-forwarded,
  // so we read them here (available via Dockerfile ARG or native Node build).
  env: {
    NEXT_PUBLIC_VAULT_ADDRESS:
      process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? "0xF9FD652453801749768e5660bbE624Ee90bE39a3",
    NEXT_PUBLIC_CHAIN_ID:
      process.env.NEXT_PUBLIC_CHAIN_ID ?? "421614",
    NEXT_PUBLIC_AI_ENGINE_URL:
      process.env.NEXT_PUBLIC_AI_ENGINE_URL ?? "https://ai-liquid-manager.onrender.com",
    NEXT_PUBLIC_WC_PROJECT_ID:
      process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "9a9a4ec5bde3ebded3da0745fbb6cad3",
  },
};

export default nextConfig;
