# AI Liquidity Manager - Next.js Frontend
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client before build (needs DATABASE_URL for postgresql provider)
ARG DATABASE_URL=postgresql://liquidity:liquidity_secret_2024@ai-liquid-db:5432/liquidity_manager
ENV DATABASE_URL=$DATABASE_URL
RUN bunx prisma generate

# NEXT_PUBLIC_* vars must be present at build time (next build bakes them in).
# These are the PRODUCTION defaults for self-hosted deployment
# Vault V2 Addresses (supports both USDC and USDT)
ARG NEXT_PUBLIC_VAULT_USDC_ADDRESS=0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C
ARG NEXT_PUBLIC_VAULT_USDT_ADDRESS=0x12a20d3569da6DD2d99E7bC95748283B10729c4C
ARG NEXT_PUBLIC_VAULT_ADDRESS=0x876aBa48F1263Ffb16046Ef2909265BeDCb3174C
ARG NEXT_PUBLIC_CHAIN_ID=42161
ARG NEXT_PUBLIC_AI_ENGINE_URL=http://164.68.126.14:8001
ARG NEXT_PUBLIC_WC_PROJECT_ID=9a9a4ec5bde3ebded3da0745fbb6cad3

ENV NEXT_PUBLIC_VAULT_USDC_ADDRESS=$NEXT_PUBLIC_VAULT_USDC_ADDRESS
ENV NEXT_PUBLIC_VAULT_USDT_ADDRESS=$NEXT_PUBLIC_VAULT_USDT_ADDRESS
ENV NEXT_PUBLIC_VAULT_ADDRESS=$NEXT_PUBLIC_VAULT_ADDRESS
ENV NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID
ENV NEXT_PUBLIC_AI_ENGINE_URL=$NEXT_PUBLIC_AI_ENGINE_URL
ENV NEXT_PUBLIC_WC_PROJECT_ID=$NEXT_PUBLIC_WC_PROJECT_ID

# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN bun run build

# Production - Use Node.js Bookworm (Debian 12 with OpenSSL 3.0.x)
FROM node:20-bookworm AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs nextjs

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

CMD ["node", "server.js"]
