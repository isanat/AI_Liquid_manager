#!/bin/bash
# Quick deploy to Railway
# Run: ./railway-deploy.sh

set -e

echo "🚀 Deploying AI Liquidity Manager to Railway..."
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login if needed
railway whoami 2>/dev/null || railway login

# Create or link project
echo ""
echo "Creating/linking project..."
railway project create ai-liquidity-manager 2>/dev/null || railway link

# Add PostgreSQL if not exists
echo ""
echo "Adding PostgreSQL..."
railway add --plugin postgresql 2>/dev/null || echo "PostgreSQL already added"

# Add Redis if not exists  
echo ""
echo "Adding Redis..."
railway add --plugin redis 2>/dev/null || echo "Redis already added"

# Deploy AI Engine
echo ""
echo "Deploying AI Engine..."
railway up --service ai-engine --dockerfile Dockerfile.ai || railway up

# Set environment variables
echo ""
echo "Setting environment variables..."
railway variables set AI_ENGINE_URL=https://${{ai-engine.RAILWAY_PUBLIC_DOMAIN}} --service frontend 2>/dev/null || true
railway variables set DATABASE_URL=${{postgres.DATABASE_URL}} 2>/dev/null || true
railway variables set REDIS_URL=${{redis.REDIS_URL}} 2>/dev/null || true

echo ""
echo "✅ Deploy complete!"
echo ""
echo "Run these commands to deploy the frontend:"
echo "  railway up --service frontend"
echo ""
echo "Or open the dashboard:"
echo "  railway open"
