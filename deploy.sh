#!/bin/bash

# AI Liquidity Manager - Deploy Script
# Usage: ./deploy.sh [railway|fly|local]

set -e

echo "🚀 AI Liquidity Manager Deploy Script"
echo "====================================="

case "${1:-local}" in
  railway)
    echo "📦 Deploying to Railway..."
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
      echo "Installing Railway CLI..."
      npm install -g @railway/cli
    fi
    
    # Login check
    railway whoami || railway login
    
    # Create project if not exists
    railway project create ai-liquidity-manager || true
    
    # Add services
    echo "Adding PostgreSQL..."
    railway add --plugin postgresql || true
    
    echo "Adding Redis..."
    railway add --plugin redis || true
    
    # Deploy services
    echo "Deploying AI Engine..."
    railway up --service ai-engine --dockerfile Dockerfile.ai
    
    echo "Deploying Frontend..."
    railway up --service frontend
    
    echo "✅ Deploy complete!"
    echo "Run 'railway open' to view dashboard"
    ;;
    
  fly)
    echo "📦 Deploying to Fly.io..."
    
    # Check if Fly CLI is installed
    if ! command -v flyctl &> /dev/null; then
      echo "Installing Fly CLI..."
      curl -L https://fly.io/install.sh | sh
    fi
    
    # Login check
    flyctl auth whoami || flyctl auth login
    
    # Create app if not exists
    flyctl apps create ai-liquidity-engine || true
    flyctl apps create ai-liquidity-frontend || true
    
    # Deploy AI Engine
    echo "Deploying AI Engine..."
    flyctl deploy --app ai-liquidity-engine --dockerfile Dockerfile.ai
    
    # Deploy Frontend
    echo "Deploying Frontend..."
    flyctl deploy --app ai-liquidity-frontend
    
    echo "✅ Deploy complete!"
    ;;
    
  local)
    echo "📦 Running locally with Docker Compose..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
      echo "❌ Docker is required for local deployment"
      exit 1
    fi
    
    # Build and run
    docker-compose up --build -d
    
    echo ""
    echo "✅ Services running:"
    echo "   Frontend:    http://localhost:3000"
    echo "   AI Engine:   http://localhost:8000"
    echo "   PostgreSQL:  localhost:5432"
    echo "   Redis:       localhost:6379"
    echo ""
    echo "To view logs: docker-compose logs -f"
    echo "To stop:      docker-compose down"
    ;;
    
  *)
    echo "Usage: $0 [railway|fly|local]"
    echo ""
    echo "Options:"
    echo "  railway  - Deploy to Railway.app (recommended)"
    echo "  fly      - Deploy to Fly.io"
    echo "  local    - Run locally with Docker Compose"
    exit 1
    ;;
esac
