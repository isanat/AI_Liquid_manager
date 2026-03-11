#!/bin/bash

# AI Liquidity Manager - Local Deploy Script
# Runs the full stack locally with Docker

set -e

echo "🚀 AI Liquidity Manager - Local Deploy"
echo "======================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required. Please install Docker Desktop."
    echo "   Download: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is required."
    exit 1
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose down 2>/dev/null || true

# Build and start services
echo ""
echo "🔨 Building containers (this may take a few minutes)..."
docker compose build

echo ""
echo "🚀 Starting services..."
docker compose up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check AI Engine health
echo ""
echo "🔍 Checking AI Engine health..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ AI Engine is healthy!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  AI Engine is starting... (this is normal for first run)"
    fi
    sleep 2
done

# Check Frontend
echo ""
echo "🔍 Checking Frontend..."
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Frontend is healthy!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Frontend is starting..."
    fi
    sleep 2
done

echo ""
echo "======================================="
echo "🎉 DEPLOY COMPLETE!"
echo "======================================="
echo ""
echo "📊 Services Running:"
echo ""
echo "   🖥️  Frontend:    http://localhost:3000"
echo "   🧠 AI Engine:   http://localhost:8000"
echo "   📊 AI Docs:     http://localhost:8000/docs"
echo "   🗄️  PostgreSQL:  localhost:5432"
echo "   🔴 Redis:       localhost:6379"
echo ""
echo "📝 Useful Commands:"
echo ""
echo "   View logs:      docker compose logs -f"
echo "   View AI logs:   docker compose logs -f ai-engine"
echo "   Stop all:       docker compose down"
echo "   Restart:        docker compose restart"
echo "   Remove volumes: docker compose down -v"
echo ""
echo "======================================="
