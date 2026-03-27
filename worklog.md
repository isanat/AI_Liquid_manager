---
Task ID: Migration Plan
Agent: Plan Agent
Task: Create Migration Plan from Render to Self-Hosted Server

---

# AI Liquid Manager: Migration Plan
## From Render to Self-Hosted Server

**Project:** AI Liquid Manager  
**Source:** Render (srv-d6p11514tr6s73adveog)  
**Current URL:** https://ai-liquid-manager.onrender.com  
**GitHub:** https://github.com/isanat/AI_Liquid_manager  
**Dependency:** ai-liquidity-engine.onrender.com (separate Render service)

---

## Executive Summary

This document outlines a comprehensive migration plan for moving the AI Liquid Manager application from Render's managed platform to a self-hosted server. The project consists of:

| Component | Technology | Current Port |
|-----------|------------|--------------|
| Frontend | Next.js 16 + Bun | 3000 |
| AI Engine | Python FastAPI + LightGBM | 8000 |
| Database | PostgreSQL 15 / SQLite | 5432 |
| Cache | Redis 7 | 6379 |
| Reverse Proxy | Caddy (on Render) | 81 |

---

## Phase 1: Pre-Migration Checklist

### 1.1 Data Backup

- [ ] **Database Backup**
  ```bash
  # If using SQLite on Render (current setup)
  # Download the SQLite database file
  scp user@render-server:/opt/render/project/src/prisma/prod.db ./backup/prod.db
  
  # If using PostgreSQL
  pg_dump -h <render-postgres-host> -U liquidity liquidity_manager > backup_$(date +%Y%m%d).sql
  ```

- [ ] **Redis Data Export** (if applicable)
  ```bash
  redis-cli -h <render-redis-host> --rdb backup/dump.rdb
  ```

- [ ] **Environment Variables Export**
  ```bash
  # Document all environment variables from Render dashboard
  # Create .env.production file with all values
  ```

- [ ] **AI Model Files**
  ```bash
  # Backup trained LightGBM models
  scp -r user@render-server:/app/ai_engine/models/saved ./backup/models/
  ```

### 1.2 DNS Preparation

- [ ] **Current DNS Records** (document before changes)
  ```
  ai-liquid-manager.onrender.com    → Render service
  ai-liquid-frontend.onrender.com   → Render frontend (if separate)
  ```

- [ ] **New DNS Records** (prepare but don't activate yet)
  ```
  ai-liquid-manager.yourdomain.com  → Self-hosted server IP
  api.yourdomain.com                → Self-hosted server IP (AI Engine)
  ```

- [ ] **TTL Reduction**
  - Reduce DNS TTL to 300 seconds (5 minutes) 24 hours before migration
  - Allows faster DNS propagation during cutover

### 1.3 Dependencies Review

- [ ] **External Service: ai-liquidity-engine.onrender.com**
  - This is a separate Render service that the AI Engine depends on
  - **Decision needed:** Migrate together or keep on Render?
  - If migrating separately, update `AI_ENGINE_URL` environment variable

---

## Phase 2: Server Requirements

### 2.1 Minimum Hardware Specifications

| Resource | Minimum | Recommended | Production |
|----------|---------|-------------|------------|
| CPU | 2 vCPU | 4 vCPU | 4-8 vCPU |
| RAM | 4 GB | 8 GB | 16 GB |
| Storage | 40 GB SSD | 80 GB SSD | 160 GB SSD |
| Network | 1 Gbps | 1 Gbps | 1 Gbps |

**Rationale:**
- **Frontend (Next.js):** ~512MB-1GB RAM under load
- **AI Engine (Python + LightGBM):** ~1-2GB RAM for inference
- **PostgreSQL:** ~512MB-2GB depending on data size
- **Redis:** ~256MB-1GB for caching
- **Overhead:** Docker, OS, monitoring ~1-2GB

### 2.2 Recommended Server Providers

| Provider | Instance Type | Est. Monthly Cost |
|----------|---------------|-------------------|
| DigitalOcean | Droplet 4GB/2CPU | $24/mo |
| Hetzner | CX31 (4GB/2CPU) | ~$8/mo |
| Linode | 4GB/2CPU | $24/mo |
| AWS | t3.medium | ~$35/mo |
| Vultr | 4GB/2CPU | $24/mo |

### 2.3 Operating System

**Recommended:** Ubuntu 22.04 LTS or 24.04 LTS
- Long-term support until 2027/2029
- Excellent Docker support
- Well-documented security practices

---

## Phase 3: Software Installation

### 3.1 Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y \
  curl \
  wget \
  git \
  htop \
  iotop \
  net-tools \
  ca-certificates \
  gnupg \
  lsb-release \
  ufw

# Create application user
sudo useradd -m -s /bin/bash appuser
sudo usermod -aG docker appuser
```

### 3.2 Docker Installation

```bash
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker
sudo systemctl enable docker
sudo systemctl start docker

# Verify installation
docker --version
docker compose version
```

### 3.3 Caddy Installation (Recommended Reverse Proxy)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Verify installation
caddy version
```

### 3.4 Alternative: Nginx Installation

```bash
# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Enable Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Phase 4: Configuration Steps

### 4.1 Directory Structure

```bash
# Create application directories
sudo mkdir -p /opt/ai-liquid-manager/{data,logs,backups}
sudo chown -R appuser:appuser /opt/ai-liquid-manager

# Clone repository
cd /opt/ai-liquid-manager
git clone https://github.com/isanat/AI_Liquid_manager.git repo
```

### 4.2 Environment Variables Configuration

Create `/opt/ai-liquid-manager/.env.production`:

```env
# ===========================================
# AI Engine Configuration
# ===========================================
PORT=8000
PYTHONPATH=/app
PYTHONUNBUFFERED=1
MODEL_PATH=/app/models/saved

# The Graph API Keys
THE_GRAPH_API_KEY=your_key_here
THE_GRAPH_API_KEY2=your_key_here

# Smart Contract (AILiquidVault on Arbitrum Sepolia)
VAULT_ADDRESS=0xF9FD652453801749768e5660bbE624Ee90bE39a3

# RPC Endpoints
RPC_URL_ARBITRUM=https://arb1.arbitrum.io/rpc
RPC_URL_ARBITRUM_SEPOLIA=https://sepolia-rollup.arbitrum.io/rpc

# Keeper Private Key (SET SECURELY - NEVER COMMIT)
KEEPER_PRIVATE_KEY=

# ===========================================
# Frontend Configuration
# ===========================================
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# AI Engine URL (internal Docker network)
AI_ENGINE_URL=http://ai-engine:8000
NEXT_PUBLIC_AI_ENGINE_URL=https://api.yourdomain.com

# The Graph API Keys
THE_GRAPH_API_KEY=your_key_here
THE_GRAPH_API_KEY2=your_key_here

# Smart Contract
NEXT_PUBLIC_VAULT_ADDRESS=0xF9FD652453801749768e5660bbE624Ee90bE39a3
NEXT_PUBLIC_CHAIN_ID=421614

# WalletConnect
NEXT_PUBLIC_WC_PROJECT_ID=your_project_id

# RPC (public endpoints)
NEXT_PUBLIC_RPC_ARBITRUM=https://arb1.arbitrum.io/rpc
NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA=https://sepolia-rollup.arbitrum.io/rpc

# Pool Address
POOL_ADDRESS=0xC6962004f452bE9203591991D15f6b388e09E8D0

# Frontend URL
NEXT_PUBLIC_FRONTEND_URL=https://yourdomain.com

# ===========================================
# Database Configuration
# ===========================================
# PostgreSQL
DATABASE_URL=postgresql://liquidity:secure_password_here@postgres:5432/liquidity_manager

# Redis
REDIS_URL=redis://redis:6379
```

### 4.3 Docker Compose Production Configuration

Create `/opt/ai-liquid-manager/docker-compose.prod.yml`:

```yaml
services:
  # ===========================================
  # Next.js Frontend Dashboard
  # ===========================================
  frontend:
    build:
      context: ./repo
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_VAULT_ADDRESS: ${NEXT_PUBLIC_VAULT_ADDRESS}
        NEXT_PUBLIC_CHAIN_ID: ${NEXT_PUBLIC_CHAIN_ID}
        NEXT_PUBLIC_AI_ENGINE_URL: ${NEXT_PUBLIC_AI_ENGINE_URL}
        NEXT_PUBLIC_WC_PROJECT_ID: ${NEXT_PUBLIC_WC_PROJECT_ID}
    ports:
      - "3000:3000"
    environment:
      - AI_ENGINE_URL=http://ai-engine:8000
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      postgres:
        condition: service_healthy
      ai-engine:
        condition: service_healthy
    networks:
      - liquidity-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # ===========================================
  # Python AI Engine
  # ===========================================
  ai-engine:
    build:
      context: ./repo
      dockerfile: Dockerfile.render
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
      - PYTHONUNBUFFERED=1
      - PYTHONPATH=/app
      - THE_GRAPH_API_KEY=${THE_GRAPH_API_KEY}
      - THE_GRAPH_API_KEY2=${THE_GRAPH_API_KEY2}
      - VAULT_ADDRESS=${VAULT_ADDRESS}
      - RPC_URL_ARBITRUM=${RPC_URL_ARBITRUM}
      - RPC_URL_ARBITRUM_SEPOLIA=${RPC_URL_ARBITRUM_SEPOLIA}
      - KEEPER_PRIVATE_KEY=${KEEPER_PRIVATE_KEY}
    volumes:
      - ai-models:/app/models
      - ./data:/app/data
    networks:
      - liquidity-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped

  # ===========================================
  # PostgreSQL Database
  # ===========================================
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=liquidity
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-liquidity_secret}
      - POSTGRES_DB=liquidity_manager
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - liquidity-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U liquidity -d liquidity_manager"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ===========================================
  # Redis Cache
  # ===========================================
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    networks:
      - liquidity-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

networks:
  liquidity-network:
    driver: bridge

volumes:
  ai-models:
  postgres-data:
  redis-data:
```

### 4.4 Caddy Configuration (Recommended)

Create `/etc/caddy/Caddyfile`:

```caddyfile
# Main domain - Frontend
yourdomain.com {
    encode gzip zstd
    
    # Rate limiting
    rate_limit {
        zone dynamic {
            key {remote_host}
            events 100
            window 1m
        }
    }
    
    # Frontend proxy
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        
        # WebSocket support
        header_up Upgrade {http.upgrade}
        header_up Connection {http.connection}
    }
    
    # Logging
    log {
        output file /var/log/caddy/yourdomain.com.log {
            roll_size 100mb
            roll_keep 10
        }
    }
}

# API subdomain - AI Engine
api.yourdomain.com {
    encode gzip zstd
    
    # Rate limiting (stricter for API)
    rate_limit {
        zone api {
            key {remote_host}
            events 60
            window 1m
        }
    }
    
    # AI Engine proxy
    reverse_proxy localhost:8000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        
        # Timeouts for long-running operations (backtest, training)
        transport {
            read_timeout 300s
            write_timeout 300s
        }
    }
    
    # CORS headers for cross-origin requests
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Access-Control-Allow-Headers *
    }
    
    log {
        output file /var/log/caddy/api.yourdomain.com.log
    }
}
```

### 4.5 Alternative: Nginx Configuration

Create `/etc/nginx/sites-available/ai-liquid-manager`:

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Rate limiting
        limit_req zone=general burst=20 nodelay;
    }
}

# AI Engine API
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Extended timeouts for AI operations
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        
        # Rate limiting
        limit_req zone=api burst=10 nodelay;
        
        # CORS
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    }
}
```

---

## Phase 5: Database Migration Strategy

### 5.1 PostgreSQL Migration (Recommended for Production)

```bash
# On Render - Export database
pg_dump -Fc -h <render-postgres-host> -U liquidity liquidity_manager > render_backup.dump

# Transfer to new server
scp render_backup.dump user@new-server:/opt/ai-liquid-manager/backups/

# On new server - Restore database
docker compose -f docker-compose.prod.yml up -d postgres
sleep 10

# Restore into container
cat /opt/ai-liquid-manager/backups/render_backup.dump | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U liquidity -d liquidity_manager

# Run Prisma migrations
docker compose -f docker-compose.prod.yml exec frontend \
  npx prisma migrate deploy
```

### 5.2 SQLite to PostgreSQL Migration (If currently using SQLite)

```bash
# 1. Export SQLite data
sqlite3 prod.db .dump > sqlite_dump.sql

# 2. Convert SQLite syntax to PostgreSQL
# Use a tool like pgloader or manual conversion
pgloader sqlite://prod.db postgresql://liquidity:password@postgres:5432/liquidity_manager

# 3. Update Prisma schema (already done - change provider to postgresql)
# datasource db {
#   provider = "postgresql"
#   url      = env("DATABASE_URL")
# }

# 4. Push schema changes
docker compose -f docker-compose.prod.yml exec frontend \
  npx prisma db push
```

### 5.3 Redis Migration

```bash
# Export from Render (if data is important)
redis-cli -h <render-redis-host> --rdb dump.rdb

# Copy to new server
scp dump.rdb user@new-server:/opt/ai-liquid-manager/data/

# Import into new Redis
docker cp dump.rdb $(docker compose -f docker-compose.prod.yml ps -q redis):/data/dump.rdb
docker compose -f docker-compose.prod.yml restart redis
```

---

## Phase 6: SSL/TLS Configuration

### 6.1 Caddy (Automatic HTTPS)

Caddy automatically provisions and renews Let's Encrypt certificates:

```bash
# Enable Caddy service
sudo systemctl enable caddy
sudo systemctl start caddy

# Check status
sudo systemctl status caddy

# View logs
journalctl -u caddy -f
```

### 6.2 Nginx with Certbot

```bash
# Obtain SSL certificates
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Certbot automatically configures Nginx for HTTPS
```

---

## Phase 7: Testing and Validation

### 7.1 Pre-Cutover Testing (Internal)

```bash
# Test with local hosts file modification
# Add to /etc/hosts on your local machine:
# <new-server-ip> yourdomain.com
# <new-server-ip> api.yourdomain.com

# Run comprehensive tests
./scripts/test-deployment.sh
```

### 7.2 Health Check Validation

```bash
# AI Engine health check
curl -s https://api.yourdomain.com/health | jq

# Expected response:
# {
#   "status": "healthy",
#   "model_loaded": true,
#   "model_version": "lgbm-v1-loaded",
#   "uptime_seconds": 1234.56
# }

# Frontend health check
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com

# Expected: 200

# API endpoints test
curl -X POST https://api.yourdomain.com/inference \
  -H "Content-Type: application/json" \
  -d '{
    "price": 1850,
    "volume_1h": 500000,
    "volume_24h": 12000000,
    "total_liquidity": 25000000,
    "active_liquidity": 12000000
  }' | jq
```

### 7.3 Database Connectivity Test

```bash
# Connect to PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U liquidity -d liquidity_manager -c "SELECT COUNT(*) FROM Vault;"

# Test Redis
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
# Expected: PONG
```

### 7.4 Load Testing (Optional)

```bash
# Install hey for load testing
go install github.com/rakyll/hey@latest

# Test frontend
hey -n 1000 -c 50 https://yourdomain.com/

# Test AI Engine
hey -n 100 -c 10 -m POST \
  -H "Content-Type: application/json" \
  -d '{"price":1850,"volume_1h":500000,"volume_24h":12000000,"total_liquidity":25000000,"active_liquidity":12000000}' \
  https://api.yourdomain.com/inference
```

---

## Phase 8: DNS Cutover Plan

### 8.1 Zero-Downtime Migration Strategy

**Option A: Blue-Green Deployment (Recommended)**

1. Deploy to new server (Green) with temporary subdomain
2. Test thoroughly on temporary domain
3. Switch DNS to point to new server
4. Keep old server (Blue) running for rollback

**Option B: Staged Migration**

1. Migrate database first (with read replica if possible)
2. Migrate AI Engine (update environment variables)
3. Migrate Frontend last

### 8.2 DNS Update Steps

```bash
# Step 1: Lower TTL (done 24h before)
# Already completed in pre-migration

# Step 2: Update A records
# yourdomain.com -> NEW_SERVER_IP
# api.yourdomain.com -> NEW_SERVER_IP

# Step 3: Verify propagation
dig yourdomain.com
dig api.yourdomain.com

# Step 4: Monitor for issues
# Use monitoring dashboard to track error rates
```

### 8.3 Cutover Checklist

- [ ] DNS TTL reduced to 300 seconds
- [ ] All services tested on new server
- [ ] Database fully migrated and verified
- [ ] SSL certificates provisioned
- [ ] Monitoring alerts configured
- [ ] Team notified of cutover window
- [ ] Rollback plan documented
- [ ] DNS records updated
- [ ] Old services monitored for traffic drop
- [ ] New services monitored for traffic increase
- [ ] Error rates checked after cutover

---

## Phase 9: Rollback Procedures

### 9.1 Immediate Rollback (< 5 minutes)

```bash
# 1. Revert DNS changes
# Update A records back to Render IPs

# 2. Verify Render services still running
curl -s https://ai-liquid-manager.onrender.com/health

# 3. Monitor propagation
dig yourdomain.com
```

### 9.2 Database Rollback

```bash
# If database was modified during migration
# Restore from pre-migration backup

docker compose -f docker-compose.prod.yml exec postgres \
  psql -U liquidity -d liquidity_manager < /backups/pre_migration_backup.sql
```

### 9.3 Full Rollback Checklist

- [ ] DNS reverted to Render
- [ ] Verify Render services healthy
- [ ] Database restored (if modified)
- [ ] Notify team of rollback
- [ ] Document rollback reason
- [ ] Schedule post-mortem

---

## Phase 10: Monitoring and Logging

### 10.1 Docker Container Monitoring

```yaml
# Add to docker-compose.prod.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - liquidity-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - liquidity-network
```

### 10.2 Log Management

```bash
# Create log directories
sudo mkdir -p /var/log/ai-liquid-manager
sudo chown appuser:appuser /var/log/ai-liquid-manager

# Docker logs to file
docker compose -f docker-compose.prod.yml logs -f > /var/log/ai-liquid-manager/app.log 2>&1 &
```

### 10.3 Alerting (Optional)

```yaml
# alertmanager/config.yml
global:
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK'

route:
  receiver: 'team-notifications'
  
receivers:
  - name: 'team-notifications'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true
```

---

## Phase 11: Security Hardening

### 11.1 Firewall Configuration

```bash
# Enable UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

### 11.2 Docker Security

```bash
# Run containers as non-root user
# Already configured in Dockerfiles

# Limit container resources
# Add to docker-compose.prod.yml:
services:
  frontend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
```

### 11.3 Secret Management

```bash
# Use Docker secrets for sensitive data
echo "your_keeper_private_key" | docker secret create keeper_private_key -

# Or use environment files with restricted permissions
chmod 600 /opt/ai-liquid-manager/.env.production
```

### 11.4 Regular Security Updates

```bash
# Create update script
cat > /opt/ai-liquid-manager/scripts/security-update.sh << 'EOF'
#!/bin/bash
set -e

# Update system packages
sudo apt update
sudo apt upgrade -y

# Update Docker images
cd /opt/ai-liquid-manager
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Clean up
docker system prune -f
EOF

chmod +x /opt/ai-liquid-manager/scripts/security-update.sh
```

---

## Phase 12: Post-Migration Tasks

### 12.1 Decommission Render Services

- [ ] Verify all traffic on new server
- [ ] Wait 48-72 hours for full DNS propagation
- [ ] Export final data from Render
- [ ] Delete Render services (or keep as backup for 7 days)
- [ ] Update documentation with new URLs

### 12.2 Documentation Updates

- [ ] Update README.md with new deployment instructions
- [ ] Update DEPLOYMENT.md
- [ ] Document new server access procedures
- [ ] Update team runbooks

---

## Cost Comparison: Render vs Self-Hosted

### Render Pricing (Current)

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| AI Engine | Free/Starter | $0-7 |
| Frontend | Free/Starter | $0-7 |
| PostgreSQL | Starter | $7 |
| Redis | Starter | $5 |
| **Total** | | **$0-26/mo** |

*Note: Free tier has limitations (spin-down, limited hours)*

### Self-Hosted Pricing

| Provider | Instance | Monthly Cost | Notes |
|----------|----------|--------------|-------|
| Hetzner | CX31 (4GB) | ~$8 | Best value |
| DigitalOcean | 4GB Droplet | $24 | Good support |
| Linode | 4GB | $24 | Good network |
| AWS | t3.medium | ~$35 | Enterprise features |

### Cost Analysis

| Factor | Render | Self-Hosted |
|--------|--------|-------------|
| Base Cost | $0-26/mo | $8-35/mo |
| Maintenance | Included | Your time |
| SSL/Security | Included | Manual setup |
| Auto-scaling | Limited | Manual |
| Backups | Manual | Manual |
| Monitoring | Basic | Custom |
| Full Control | No | Yes |
| No Spin-down | Paid only | Yes |
| Custom Domains | Yes | Yes |

**Recommendation:** Self-hosting on Hetzner CX31 (~$8/mo) offers:
- 4x RAM of Render free tier
- No cold starts
- Full control over configuration
- 70% cost savings vs Render paid tier

---

## Quick Reference: Migration Commands

```bash
# ========== INITIAL SETUP ==========
# Clone and setup
cd /opt/ai-liquid-manager
git clone https://github.com/isanat/AI_Liquid_manager.git repo
cp .env.example .env.production
nano .env.production

# ========== BUILD AND START ==========
# Build images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# ========== HEALTH CHECKS ==========
curl http://localhost:8000/health
curl http://localhost:3000

# ========== DATABASE ==========
# Run migrations
docker compose -f docker-compose.prod.yml exec frontend npx prisma db push

# Backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U liquidity liquidity_manager > backup.sql

# ========== UPDATES ==========
# Pull latest code
cd repo && git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# ========== TROUBLESHOOTING ==========
# View container status
docker compose -f docker-compose.prod.yml ps

# Enter container
docker compose -f docker-compose.prod.yml exec ai-engine bash
docker compose -f docker-compose.prod.yml exec frontend sh

# Check resource usage
docker stats

# Restart specific service
docker compose -f docker-compose.prod.yml restart ai-engine
```

---

## Appendix: Environment Variables Reference

### AI Engine Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | Server port | 8000 |
| THE_GRAPH_API_KEY | The Graph API key | bb60df2c... |
| VAULT_ADDRESS | Smart contract address | 0xF9FD... |
| RPC_URL_ARBITRUM | Arbitrum RPC | https://arb1... |
| KEEPER_PRIVATE_KEY | Keeper wallet key | (sensitive) |

### Frontend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| AI_ENGINE_URL | Internal AI engine URL | http://ai-engine:8000 |
| NEXT_PUBLIC_AI_ENGINE_URL | Public AI engine URL | https://api.domain.com |
| NEXT_PUBLIC_VAULT_ADDRESS | Contract address | 0xF9FD... |
| NEXT_PUBLIC_CHAIN_ID | Chain ID | 421614 |
| NEXT_PUBLIC_WC_PROJECT_ID | WalletConnect ID | 9a9a4ec... |
| DATABASE_URL | PostgreSQL URL | postgresql://... |

---

**Document Version:** 1.0  
**Created:** $(date +%Y-%m-%d)  
**Author:** Migration Agent  
**Status:** Ready for Review

---
Task ID: 1
Agent: Migration Planner
Task: Create Migration Checklist and Gap Analysis

Work Log:
- Analyzed current Render setup (ai-liquid-manager.onrender.com)
- Verified Coolify server access (http://164.68.126.14:8000)
- Documented environment variables from AI_Liquid_manager.env
- Checked existing databases in Coolify
- Verified DNS status for aitradinglab.cloud
- Created gap analysis

Stage Summary:

## ═══════════════════════════════════════════════════════════════
## MIGRATION CHECKLIST: Render → Coolify
## ═══════════════════════════════════════════════════════════════

### 📦 WHAT WE HAVE ✅

| Item | Status | Details |
|------|--------|---------|
| **GitHub Repository** | ✅ Available | https://github.com/isanat/AI_Liquid_manager |
| **Coolify Server Access** | ✅ Working | http://164.68.126.14:8000 (API: 200 OK) |
| **Render API Key** | ✅ Available | rnd_lu7VqrcLFGD69x5GWF8su5GZiq7b |
| **Render Service ID** | ✅ Available | srv-d6p11514tr6s73adveog |
| **Render App Running** | ✅ Healthy | https://ai-liquid-manager.onrender.com (200 OK) |
| **Environment Variables** | ✅ Documented | /home/z/my-project/upload/AI_Liquid_manager.env |
| **Local Code** | ✅ Available | Next.js 16 + Prisma + SQLite |
| **SQLite Database** | ✅ Exists | db/custom.db (24KB) |
| **Coolify Databases** | ✅ Available | PostgreSQL instances running |
| **Coolify Traefik** | ✅ Running | SSL/HTTPS ready via Let's Encrypt |

### 🔧 WHAT WE NEED ❌

| Item | Status | Priority | Details |
|------|--------|----------|---------|
| **DNS Configuration** | ❌ Required | HIGH | aitradinglab.cloud → needs A record to 164.68.126.14 |
| **Coolify Application** | ❌ Create | HIGH | New app for AI Liquid Manager |
| **Database Decision** | ⚠️ Pending | HIGH | SQLite → PostgreSQL migration OR keep SQLite |
| **Environment Variables** | ❌ Configure | HIGH | Add all env vars to Coolify app |
| **AI Engine Service** | ⚠️ Decision | MEDIUM | ai-liquidity-engine.onrender.com - migrate or keep? |
| **Dockerfile** | ⚠️ Verify | MEDIUM | Check if Dockerfile exists in repo |
| **Build Settings** | ❌ Configure | MEDIUM | Port, build command, start command |
| **Health Checks** | ❌ Configure | LOW | Configure health check endpoints |

### 📋 STEP-BY-STEP MIGRATION CHECKLIST

#### Phase 1: Pre-Migration Tasks

- [ ] **1.1 Backup Current Data**
  - [ ] Download SQLite database from Render
  - [ ] Export any persistent data
  - [ ] Document all environment variables
  - [ ] Screenshot current Render configuration

- [ ] **1.2 Prepare DNS**
  - [ ] Access domain registrar (aitradinglab.cloud)
  - [ ] Reduce TTL to 300 seconds (5 minutes)
  - [ ] Prepare A record: @ → 164.68.126.14
  - [ ] Prepare A record: www → 164.68.126.14
  - [ ] Prepare A record: api → 164.68.126.14 (for AI Engine)

- [ ] **1.3 Verify GitHub Repository**
  - [ ] Confirm Dockerfile exists
  - [ ] Confirm repository is accessible
  - [ ] Note default branch (main/master)

#### Phase 2: Coolify Setup Tasks

- [ ] **2.1 Create New Application**
  - [ ] Log into Coolify dashboard
  - [ ] Create new application: "ai-liquid-manager"
  - [ ] Connect GitHub repository: isanat/AI_Liquid_manager
  - [ ] Select branch: main (or appropriate branch)
  - [ ] Set build pack: Dockerfile

- [ ] **2.2 Configure Build Settings**
  - [ ] Set Dockerfile location: /Dockerfile
  - [ ] Set exposed port: 3000
  - [ ] Configure build timeout: 600 seconds
  - [ ] Set build command (if needed)

- [ ] **2.3 Configure Database**
  - [ ] **Option A: Keep SQLite (Simple)**
    - [ ] Ensure database file is in persistent volume
    - [ ] Configure volume: /app/db or /app/prisma
  - [ ] **Option B: Migrate to PostgreSQL (Recommended)**
    - [ ] Create new PostgreSQL database in Coolify
    - [ ] Update Prisma schema: provider = "postgresql"
    - [ ] Update DATABASE_URL environment variable
    - [ ] Run prisma migrate deploy

- [ ] **2.4 Configure Environment Variables**
  ```
  AI_ENGINE_URL=https://ai-liquidity-engine.onrender.com (or internal URL)
  KEEPER_PRIVATE_KEY=[SENSITIVE - from env file]
  NEXT_PUBLIC_AI_ENGINE_URL=https://api.aitradinglab.cloud
  NEXT_PUBLIC_FRONTEND_URL=https://aitradinglab.cloud
  POOL_ADDRESS=0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640
  PYTHONPATH=/opt/render/project/src
  PYTHONUNBUFFERED=1
  RPC_URL_ARBITRUM=https://sepolia-rollup.arbitrum.io/rpc
  THE_GRAPH_API_KEY=[SENSITIVE]
  THE_GRAPH_API_KEY2=[SENSITIVE]
  USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
  VAULT_ADDRESS=0x69d8ec9d32c26e652cd5643100a2ec0149d76c3d
  DATABASE_URL=[if using PostgreSQL]
  ```

- [ ] **2.5 Configure Domain**
  - [ ] Set FQDN: https://aitradinglab.cloud
  - [ ] Enable SSL (automatic via Let's Encrypt)
  - [ ] Configure redirect: www → non-www (or vice versa)

- [ ] **2.6 Configure Health Checks**
  - [ ] Enable health check
  - [ ] Path: /
  - [ ] Interval: 30s
  - [ ] Timeout: 10s
  - [ ] Retries: 3

#### Phase 3: Deployment Tasks

- [ ] **3.1 Initial Deployment**
  - [ ] Deploy application
  - [ ] Monitor build logs
  - [ ] Verify deployment success
  - [ ] Check container logs for errors

- [ ] **3.2 Database Migration (if PostgreSQL)**
  - [ ] Run Prisma migrations
  - [ ] Seed initial data
  - [ ] Verify database connectivity

- [ ] **3.3 Verify Application**
  - [ ] Test health endpoint
  - [ ] Test frontend loads
  - [ ] Test API endpoints
  - [ ] Verify environment variables loaded

#### Phase 4: Post-Migration Validation

- [ ] **4.1 Functional Testing**
  - [ ] User login/authentication
  - [ ] Database operations
  - [ ] API responses
  - [ ] WebSocket connections (if any)

- [ ] **4.2 Performance Testing**
  - [ ] Response time comparison
  - [ ] Load testing (optional)
  - [ ] Memory usage check

- [ ] **4.3 Security Validation**
  - [ ] SSL certificate valid
  - [ ] HTTPS redirects working
  - [ ] Environment variables secured
  - [ ] No sensitive data in logs

#### Phase 5: DNS Cutover

- [ ] **5.1 Pre-Cutover**
  - [ ] Verify application works via IP
  - [ ] Test with local hosts file modification
  - [ ] Notify team of cutover window

- [ ] **5.2 DNS Update**
  - [ ] Update A record: aitradinglab.cloud → 164.68.126.14
  - [ ] Update A record: www.aitradinglab.cloud → 164.68.126.14
  - [ ] Update A record: api.aitradinglab.cloud → 164.68.126.14

- [ ] **5.3 Post-Cutover**
  - [ ] Verify DNS propagation (dig, nslookup)
  - [ ] Test domain resolves correctly
  - [ ] Verify SSL certificate provisioned
  - [ ] Monitor for errors

#### Phase 6: Render Decommission

- [ ] **6.1 Monitoring Period (48-72 hours)**
  - [ ] Monitor new application health
  - [ ] Check error logs
  - [ ] Verify all functionality
  - [ ] Address any issues

- [ ] **6.2 Decommission Render**
  - [ ] Stop Render service (don't delete yet)
  - [ ] Export final data backup
  - [ ] Keep Render service for 7 days as backup
  - [ ] Delete Render service after confirmation

- [ ] **6.3 Documentation Update**
  - [ ] Update README with new URLs
  - [ ] Update team documentation
  - [ ] Archive migration notes

### ⚠️ RISKS AND MITIGATIONS

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| **Data Loss** | HIGH | Low | Backup SQLite DB before migration; use volume persistence |
| **Downtime During Cutover** | MEDIUM | Medium | Use low DNS TTL; cutover during low-traffic period |
| **Configuration Mismatch** | MEDIUM | Medium | Document all env vars; test thoroughly before cutover |
| **DNS Propagation Delay** | LOW | High | Reduce TTL 24h before; expect up to 48h propagation |
| **SSL Certificate Issues** | LOW | Low | Coolify auto-provisions Let's Encrypt; verify domain first |
| **AI Engine Dependency** | HIGH | Low | Decide: migrate together OR update env vars for external URL |
| **Build Failures** | MEDIUM | Medium | Verify Dockerfile; check build logs; test locally first |
| **Database Migration Issues** | MEDIUM | Medium | Test SQLite→PostgreSQL migration; have rollback plan |

### 🔄 ROLLBACK PLAN

If migration fails:
1. **Immediate (< 5 min)**: Revert DNS to Render
2. **Verify Render**: Confirm Render app still running
3. **Database**: Restore from backup if modified
4. **Document**: Record failure reason
5. **Retry**: Fix issues and reschedule migration

### 📊 RESOURCE REQUIREMENTS

| Resource | Current (Render) | Coolify Requirement |
|----------|------------------|---------------------|
| CPU | Shared | 1-2 vCPU recommended |
| RAM | ~512MB-1GB | 1-2GB recommended |
| Storage | Ephemeral | 5-10GB persistent |
| Database | SQLite (ephemeral) | PostgreSQL or SQLite with volume |
| SSL | Managed | Let's Encrypt (automatic) |

### 📝 ENVIRONMENT VARIABLES CHECKLIST

**Required Variables (from AI_Liquid_manager.env):**
```bash
# AI Engine Connection
AI_ENGINE_URL=https://ai-liquidity-engine.onrender.com
NEXT_PUBLIC_AI_ENGINE_URL=https://ai-liquidity-engine.onrender.com

# Frontend URLs
NEXT_PUBLIC_FRONTEND_URL=https://ai-liquid-frontend.onrender.com

# Blockchain Configuration
POOL_ADDRESS=0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640
USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
VAULT_ADDRESS=0x69d8ec9d32c26e652cd5643100a2ec0149d76c3d
RPC_URL_ARBITRUM=https://sepolia-rollup.arbitrum.io/rpc

# API Keys (SENSITIVE)
THE_GRAPH_API_KEY=bb60df2c64bb3cfe2c8662b74bcb7276
THE_GRAPH_API_KEY2=4406f8139d6b9ab212d613efbd414988
KEEPER_PRIVATE_KEY=0x25591da6693f5fb1262d7736961881c4eab0aafe0d6ef672f120c4b78e5c8896

# Python Configuration
PYTHONPATH=/opt/render/project/src
PYTHONUNBUFFERED=1

# Database (if using PostgreSQL)
# DATABASE_URL=postgresql://user:password@host:5432/database
```

### ✅ NEXT IMMEDIATE ACTIONS

1. **Create Coolify Application** - Log into Coolify and create new app
2. **Configure Environment Variables** - Add all required env vars
3. **Deploy and Test** - Initial deployment on Coolify
4. **Update DNS** - Point aitradinglab.cloud to 164.68.126.14
5. **Monitor and Validate** - Ensure everything works correctly

---
**End of Migration Checklist**
**Created:** 2025-03-27
**Status:** Ready for Execution

---
Task ID: 3
Agent: Coolify Deployment Agent
Task: Create and Deploy Application in Coolify

Work Log:
- Created application "ai-liquid-manager" via Coolify API
- Application UUID: bqlgtwm4u74j3lxal9oycdiz
- Added all 10 environment variables
- Triggered deployment
- Build completed but application returned 404

Stage Summary:
- ✅ Application created successfully
- ✅ Environment variables configured
- ✅ Build completed
- ⚠️ Application unhealthy - needs troubleshooting
- ❌ Domain aitradinglab.cloud not configured (needs manual setup in Coolify dashboard)

## COOLIFY APPLICATION DETAILS

| Field | Value |
|-------|-------|
| **App UUID** | bqlgtwm4u74j3lxal9oycdiz |
| **Name** | ai-liquid-manager |
| **Status** | exited:unhealthy |
| **Git Repository** | isanat/AI_Liquid_manager |
| **Branch** | main |
| **Build Pack** | dockerfile |
| **Port** | 3000 |
| **Temp URL** | http://bqlgtwm4u74j3lxal9oycdiz.164.68.126.14.sslip.io |

## NEXT STEPS REQUIRED

1. **Access Coolify Dashboard**: http://164.68.126.14:8000/
2. **Navigate to Application**: Project "Jarvis Travel" → "ai-liquid-manager"
3. **Configure Domain**:
   - Go to "Configuration" → "Domains"
   - Set FQDN to: `https://aitradinglab.cloud`
   - Enable SSL (Let's Encrypt)
4. **Check Build Logs**:
   - Go to "Deployments" → Click on latest deployment
   - Check "Debug Logs" for errors
5. **Restart Application**:
   - Click "Redeploy" button
6. **Configure DNS**:
   - Point aitradinglab.cloud A record to 164.68.126.14

## TROUBLESHOOTING NOTES

The build completed but the application is unhealthy. Possible causes:
- Missing NEXT_PUBLIC_* build arguments
- Database not initialized (Prisma migrate needed)
- Health check failing

Check the deployment logs in Coolify dashboard for detailed error messages.

---
Task ID: 4
Agent: Migration Complete
Task: Finalize Migration and Confirm Success

Work Log:
- Verified DNS configuration in Contabo
- Verified DNS propagation via DNSChecker
- Confirmed application running in Coolify
- SSL certificate active via Let's Encrypt

Stage Summary:
- ✅ DNS configured: aitradinglab.cloud → 164.68.126.14
- ✅ DNS propagation verified globally
- ✅ Application deployed and running in Coolify
- ✅ SSL/HTTPS active
- 🎉 Migration from Render to Coolify COMPLETE!

## MIGRATION SUMMARY

| Source | Target |
|--------|--------|
| Render: ai-liquid-manager.onrender.com | Coolify: aitradinglab.cloud |
| Render Service ID: srv-d6p11514tr6s73adveog | Coolify App UUID: bqlgtwm4u74j3lxal9oycdiz |

## NEXT STEPS

1. Monitor application for 48-72 hours
2. Consider migrating AI Engine (ai-liquidity-engine.onrender.com)
3. Decommission Render service after confirmation
4. Update documentation with new URLs

---
Task ID: 2-a
Agent: Coolify API Inspector
Task: Verify Coolify API and List Resources

---

# Coolify API Verification Report

## API Connection Test

**Status:** ✅ SUCCESS

| Endpoint | Status | Response |
|----------|--------|----------|
| GET /api/v1/health | ✅ OK | `OK` |
| GET /api/v1/version | ✅ OK | `4.0.0-beta.469` |
| GET /api/v1/projects | ✅ OK | 5 projects |
| GET /api/v1/servers | ✅ OK | 1 server |
| GET /api/v1/applications | ✅ OK | 11+ applications |
| GET /api/v1/databases | ✅ OK | 3 databases |
| GET /api/v1/resources | ✅ OK | All resources |
| GET /api/v1/teams | ✅ OK | 1 team |

## Coolify Server Details

**Version:** 4.0.0-beta.469

| Property | Value |
|----------|-------|
| Name | localhost |
| UUID | dk0ccw0sswgcwgk484sokoo8 |
| IP | host.docker.internal |
| Port | 22 |
| User | root |
| Is Coolify Host | Yes |
| Is Reachable | Yes |
| Is Usable | Yes |

### Server Settings

| Setting | Value |
|---------|-------|
| Concurrent Builds | 2 |
| Deployment Queue Limit | 25 |
| Dynamic Timeout | 3600s |
| Docker Cleanup Frequency | Daily at midnight |
| Docker Cleanup Threshold | 80% |
| Server Timezone | UTC |
| Delete Unused Volumes | Yes |
| Delete Unused Networks | Yes |
| Terminal Enabled | Yes |

### Proxy Configuration

| Property | Value |
|----------|-------|
| Type | Traefik v3.1 |
| Status | Running |
| Detected Version | 3.1.7 |
| Latest Available | 3.6.11 |
| Redirect Enabled | Yes |
| HTTP Port | 80 |
| HTTPS Port | 443 |
| Dashboard Port | 8080 |
| SSL Provider | Let's Encrypt |

## Projects (5 Total)

| ID | Name | UUID | Description |
|----|------|------|-------------|
| 2 | VeltrixPay | q4o4kkcgcgwog448480cs8o4 | - |
| 7 | Jarvis Travel | y4kwgg4o0kwoggk0gc4go8sg | Assistente Inteligente de Viagem |
| 10 | zurionpay | ngo4gcco84gc4k8oos0osk4c | (clone) |
| 1 | Cryptospin | fkgoo4k88k0css4o88sco8g8 | - |
| 11 | ai-liquidy | o6abm1hb5kul436k5vie3xw5 | - |

## Applications (11+ Total)

### Running Applications

| UUID | Name | FQDN | Status | Project |
|------|------|------|--------|---------|
| vgwwgw8gkw00csg08os4go0w | Flyisa Travel | https://travelconcierge.site | running:healthy | Jarvis Travel |
| g0swwgc84g8so48osocgoccs | Flyisa-agent-live | https://app.travelconcierge.site | running:healthy | Jarvis Travel |
| kgskgko8kcscscwk8s4c8gso | cryptospincasinos-api | https://api.cryptospincasinos.com | running:healthy | Cryptospin |
| qos8wwso8k8ss88c404s04kc | cryptospincasinos-web | https://cryptospincasinos.com | running:unknown | Cryptospin |
| qgggc4okggoowkswwk8g00ow | veltrixpay-app | https://app.veltrixpay.com | running:unknown | VeltrixPay |
| tco408os0ok8g4w8sc84cgsk | veltrixpay-backoffice | https://backoffice.veltrixpay.com | running:unknown | VeltrixPay |
| g8s0ccgs4wkoo0cgww4o4wo8 | zuryonpay-backoffice | https://backoffice.zuryonpay.com | running:unknown | zurionpay |
| qsokc0w4og404044kwc08w4k | zuryonpay-app | https://app.zuryonpay.com | running:unknown | zurionpay |
| c4ssgk40c88wskwoogss40go | zuryonpay-api | https://api.zuryonpay.com | running:healthy | zurionpay |
| fgk44g0ooskk40c0404okgck | zuryonpay/landingpage | - | running:unknown | zurionpay |

### Stopped/Unhealthy Applications

| UUID | Name | FQDN | Status |
|------|------|------|--------|
| xco8sg44s44g88kks0o40sgk | veltrixpay-api | https://api.veltrixpay.com | exited:unhealthy |

## Databases (3 Total)

| UUID | Name | Type | Status | Public Port |
|------|------|------|--------|-------------|
| nsok8g884g4occs0gw8kw8sk | veltrixpay-database | PostgreSQL 16 | exited:unhealthy | 5432 |
| ao8o8s4ckw44k4ss8ogkksco | zuryonpay-data | PostgreSQL 17 | running:healthy | 5434 |
| of1oylaggnbk4xpkiposv6db | cryptospincasinos-database | PostgreSQL 16 | running:healthy | 5433 |

### Database Connection Details

**cryptospincasinos-database (PostgreSQL 16)**
- External URL: `postgres://postgres:***@164.68.126.14:5433/database`
- Internal URL: `postgres://postgres:***@of1oylaggnbk4xpkiposv6db:5432/database`

**zuryonpay-data (PostgreSQL 17)**
- External URL: `postgres://zuryonpay:***@164.68.126.14:5434/postgres`
- Internal URL: `postgres://zuryonpay:***@ao8o8s4ckw44k4ss8ogkksco:5432/postgres`

**veltrixpay-database (PostgreSQL 16)**
- External URL: `postgres://veltrixpay:***@164.68.126.14:5432/database`
- Internal URL: `postgres://veltrixpay:***@nsok8g884g4occs0gw8kw8sk:5432/database`
- **Note:** Currently stopped/unhealthy

## Docker Network

| Network Name | UUID | Server ID |
|--------------|------|-----------|
| coolify | zwgokcow88owgkcwwgook84g | 0 |

All applications are deployed on the `coolify` Docker network.

## API Response Format

### Authentication
```
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

### Standard Response Structure

**Projects:**
```json
[
  {
    "id": 2,
    "uuid": "q4o4kkcgcgwog448480cs8o4",
    "name": "VeltrixPay",
    "description": ""
  }
]
```

**Applications:**
```json
[
  {
    "uuid": "vgwwgw8gkw00csg08os4go0w",
    "name": "Flyisa Travel",
    "fqdn": "https://travelconcierge.site",
    "status": "running:healthy",
    "git_repository": "isanat/JarvisTravel",
    "git_branch": "claude/analyze-github-repos-86oS0",
    "build_pack": "dockerfile",
    "ports_exposes": "4001",
    "environment_id": 7,
    "destination": {
      "name": "coolify",
      "network": "coolify"
    }
  }
]
```

**Databases:**
```json
[
  {
    "uuid": "ao8o8s4ckw44k4ss8ogkksco",
    "name": "zuryonpay-data",
    "database_type": "standalone-postgresql",
    "image": "postgres:17-alpine",
    "status": "running:healthy",
    "postgres_db": "postgres",
    "postgres_user": "zuryonpay",
    "public_port": 5434,
    "external_db_url": "postgres://..."
  }
]
```

## Resource Capacity

### Server Configuration

The Coolify server (localhost) is the host server where Coolify itself runs. Based on server settings:

- **Concurrent Builds:** 2
- **Deployment Queue Limit:** 25
- **Dynamic Timeout:** 3600 seconds (1 hour)
- **Docker Cleanup:** Daily at midnight when disk reaches 80%
- **Force Docker Cleanup:** Enabled

### Available API Endpoints for Resource Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/version` | GET | Coolify version |
| `/api/v1/projects` | GET | List all projects |
| `/api/v1/servers` | GET | List all servers |
| `/api/v1/servers/{uuid}` | GET | Get server details |
| `/api/v1/servers/{uuid}/resources` | GET | Get server resources |
| `/api/v1/servers/{uuid}/validate` | GET | Validate server connection |
| `/api/v1/applications` | GET | List all applications |
| `/api/v1/databases` | GET | List all databases |
| `/api/v1/resources` | GET | List all resources |
| `/api/v1/teams` | GET | List all teams |

## Stage Summary

### Working API Endpoints
- ✅ GET /api/v1/health
- ✅ GET /api/v1/version
- ✅ GET /api/v1/projects
- ✅ GET /api/v1/servers
- ✅ GET /api/v1/servers/{uuid}
- ✅ GET /api/v1/servers/{uuid}/resources
- ✅ GET /api/v1/servers/{uuid}/validate
- ✅ GET /api/v1/applications
- ✅ GET /api/v1/databases
- ✅ GET /api/v1/resources
- ✅ GET /api/v1/teams

### Available Servers
- **localhost** (UUID: dk0ccw0sswgcwgk484sokoo8) - Coolify host server, reachable and usable

### Available Projects
1. **VeltrixPay** (ID: 2)
2. **Jarvis Travel** (ID: 7) 
3. **zurionpay** (ID: 10)
4. **Cryptospin** (ID: 1)
5. **ai-liquidy** (ID: 11) - **Target project for AI Liquid Manager deployment**

### Resource Capacity
- Single server deployment (localhost)
- 2 concurrent builds supported
- 25 deployment queue limit
- PostgreSQL databases available (ports 5432, 5433, 5434)
- Traefik reverse proxy with Let's Encrypt SSL
- Docker network: `coolify`

### Notes for Deployment
- The **ai-liquidy** project (ID: 11) exists and is available for AI Liquid Manager
- Docker network `coolify` is available for all applications
- PostgreSQL databases can be created via Coolify API or UI
- Traefik handles SSL automatically with Let's Encrypt
- Server supports 2 concurrent builds

---

**Task ID:** 2-a  
**Agent:** Coolify API Inspector  
**Completed:** 2026-03-27  
**Status:** Complete

---
Task ID: 2-b
Agent: Repo Analyzer
Task: Analyze GitHub Repository for Coolify Deployment

---

# Coolify Deployment Specification
## AI Liquid Manager - Complete Analysis

**Repository:** https://github.com/isanat/AI_Liquid_manager  
**Branch:** main  
**Analysis Date:** $(date +%Y-%m-%d)

---

## Work Log

- ✅ Analyzed Dockerfiles (Dockerfile, Dockerfile.ai, Dockerfile.render, Dockerfile.frontend)
- ✅ Analyzed docker-compose.yml for service orchestration
- ✅ Analyzed nixpacks.toml for Railway/Nixpacks builds
- ✅ Analyzed render.yaml for Render deployment config
- ✅ Identified service architecture (4 services)
- ✅ Extracted all environment variables (build-time vs runtime vs secrets)
- ✅ Documented database requirements (SQLite/PostgreSQL with Prisma)
- ✅ Documented AI Engine requirements (Python 3.11, LightGBM)
- ✅ Created comprehensive Coolify deployment specification

---

## Stage Summary

### Services Required: 4 Applications

| Service | Type | Port | Dockerfile | Description |
|---------|------|------|------------|-------------|
| **frontend** | Web Application | 3000 | `Dockerfile` | Next.js 16 Dashboard (Bun) |
| **ai-engine** | API Service | 8000 | `Dockerfile.render` | Python FastAPI + LightGBM |
| **postgres** | Database | 5432 | Image: `postgres:15-alpine` | PostgreSQL Database |
| **redis** | Cache | 6379 | Image: `redis:7-alpine` | Redis Cache |

---

## 1. Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        COOLIFY DEPLOYMENT                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────────┐ │
│  │   Frontend   │────▶│  AI Engine   │────▶│   PostgreSQL    │ │
│  │  (Next.js)   │     │   (Python)   │     │                 │ │
│  │   Port 3000  │     │   Port 8000  │     │    Port 5432    │ │
│  └──────────────┘     └──────────────┘     └─────────────────┘ │
│         │                    │                                   │
│         │                    ▼                                   │
│         │            ┌──────────────┐                           │
│         └───────────▶│    Redis     │                           │
│                      │   (Cache)    │                           │
│                      │   Port 6379  │                           │
│                      └──────────────┘                           │
│                                                                  │
│  Reverse Proxy: Caddy (automatic HTTPS)                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Service Dependencies

```
frontend:
  - depends_on: ai-engine (healthy)
  - depends_on: postgres (healthy)
  
ai-engine:
  - depends_on: postgres (optional)
  - depends_on: redis (optional)

postgres:
  - standalone

redis:
  - standalone
```

---

## 2. Environment Variables

### 2.1 Build-Time Variables (NEXT_PUBLIC_*)

These variables are **baked into the frontend build** and must be set during the Docker build:

| Variable | Description | Example Value | Required |
|----------|-------------|---------------|----------|
| `NEXT_PUBLIC_VAULT_ADDRESS` | Smart contract address | `0xF9FD652453801749768e5660bbE624Ee90bE39a3` | ✅ Yes |
| `NEXT_PUBLIC_CHAIN_ID` | Arbitrum Sepolia chain ID | `421614` | ✅ Yes |
| `NEXT_PUBLIC_AI_ENGINE_URL` | Public AI engine URL | `https://api.yourdomain.com` | ✅ Yes |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect project ID | `9a9a4ec5bde3ebded3da0745fbb6cad3` | ✅ Yes |
| `NEXT_PUBLIC_RPC_ARBITRUM` | Arbitrum RPC endpoint | `https://arb1.arbitrum.io/rpc` | ❌ Optional |
| `NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA` | Arbitrum Sepolia RPC | `https://sepolia-rollup.arbitrum.io/rpc` | ❌ Optional |
| `NEXT_PUBLIC_FRONTEND_URL` | Frontend URL | `https://yourdomain.com` | ❌ Optional |

### 2.2 Runtime Variables - AI Engine

| Variable | Description | Example Value | Required |
|----------|-------------|---------------|----------|
| `PORT` | Server port | `8000` | ✅ Yes |
| `PYTHONPATH` | Python module path | `/app` | ✅ Yes |
| `PYTHONUNBUFFERED` | Unbuffered output | `1` | ✅ Yes |
| `MODEL_PATH` | ML model storage | `/app/models/saved` | ❌ Optional |
| `THE_GRAPH_API_KEY` | The Graph API key (primary) | `your_key_here` | ✅ Yes |
| `THE_GRAPH_API_KEY2` | The Graph API key (backup) | `your_key_here` | ❌ Optional |
| `VAULT_ADDRESS` | Smart contract address | `0xF9FD...` | ✅ Yes |
| `RPC_URL_ARBITRUM` | Arbitrum RPC | `https://arb1.arbitrum.io/rpc` | ✅ Yes |
| `RPC_URL_ARBITRUM_SEPOLIA` | Arbitrum Sepolia RPC | `https://sepolia-rollup.arbitrum.io/rpc` | ✅ Yes |
| `KEEPER_PRIVATE_KEY` | Keeper wallet private key | `0x...` | ⚠️ **SECRET** |
| `REBALANCE_INTERVAL` | Rebalance interval (minutes) | `15` | ❌ Optional |

### 2.3 Runtime Variables - Frontend

| Variable | Description | Example Value | Required |
|----------|-------------|---------------|----------|
| `AI_ENGINE_URL` | Internal AI engine URL | `http://ai-engine:8000` | ✅ Yes |
| `NODE_ENV` | Node environment | `production` | ✅ Yes |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://liquidity:pass@postgres:5432/liquidity_manager` | ✅ Yes |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` | ❌ Optional |
| `THE_GRAPH_API_KEY` | The Graph API key | `your_key_here` | ❌ Optional |
| `POOL_ADDRESS` | Uniswap pool address | `0xC6962004f452bE9203591991D15f6b388e09E8D0` | ❌ Optional |

### 2.4 Secrets (Never Commit)

| Secret | Description | Storage Location |
|--------|-------------|------------------|
| `KEEPER_PRIVATE_KEY` | Wallet private key for keeper bot | Coolify Secrets / Environment |
| `DATABASE_URL` (password) | PostgreSQL password | Coolify Secrets |
| `THE_GRAPH_API_KEY` | The Graph API key | Coolify Secrets |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect project ID | Coolify Secrets |

---

## 3. Database Requirements

### 3.1 Current Setup (SQLite)

The project currently uses **SQLite** via Prisma:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### 3.2 Recommended for Production (PostgreSQL)

For Coolify deployment, use PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 3.3 Database Schema Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Vault` | LP vaults | name, protocol, network, poolAddress, TVL |
| `Position` | LP positions | tickLower, tickUpper, liquidity, fees |
| `Strategy` | AI strategies | type, rangeWidth, allocations, confidence |
| `Trade` | Trade history | type, amounts, gas, PnL |
| `MarketData` | OHLCV data | timestamp, open, high, low, close, volume |
| `ModelVersion` | ML model tracking | version, metrics, feature importance |
| `ApiKey` | External API keys | service, key, rateLimit |

### 3.4 Migrations

**Option A: Prisma DB Push (Development)**
```bash
npx prisma db push --skip-generate
```

**Option B: Prisma Migrate (Production)**
```bash
npx prisma migrate deploy
```

### 3.5 Data Directory

Create persistent volume for SQLite (if used):
```
DATABASE_URL="file:/app/data/prod.db"
```

---

## 4. AI Engine Requirements

### 4.1 Python Version

**Required:** Python 3.11.x (specified in `runtime.txt`)

### 4.2 Python Dependencies

```
# Web Framework
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3

# HTTP Client
httpx==0.26.0

# ML Stack
lightgbm==4.3.0
scikit-learn==1.4.0
numpy==1.26.4
pandas==2.2.0
joblib==1.3.2

# Blockchain
web3==7.3.0
apscheduler==3.10.4

# Logging
structlog==24.1.0

# Environment
python-dotenv==1.0.0
```

### 4.3 System Dependencies

The Dockerfile includes:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*
```

- `libgomp1` - Required for LightGBM (OpenMP)
- `curl` - Required for health checks

### 4.4 Model Storage

AI models are saved to `/app/models/saved`:
- Requires persistent volume for model persistence
- Auto-trains on first startup if no model exists
- Uses CoinGecko data for training (no API key needed)

### 4.5 Health Check Endpoint

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_version": "lgbm-v1-coingecko-auto",
  "uptime_seconds": 1234.56,
  "data_source": "The Graph (key: configured)"
}
```

---

## 5. Coolify Deployment Options

### Option A: Docker Compose (Recommended)

Deploy using the existing `docker-compose.yml`:

**Steps:**
1. Create new **Docker Compose** project in Coolify
2. Connect GitHub repository
3. Set environment variables in Coolify dashboard
4. Deploy

**Advantages:**
- Single project manages all services
- Built-in networking between services
- Easier to manage dependencies
- Automatic health checks

### Option B: Separate Services

Deploy each service as a separate Coolify application:

1. **PostgreSQL** - Managed database service
2. **Redis** - Managed cache service
3. **AI Engine** - Web service (Dockerfile.render)
4. **Frontend** - Web service (Dockerfile)

**Advantages:**
- Independent scaling
- Individual resource limits
- Easier to debug individual services

---

## 6. Resource Requirements

### Minimum (Development)

| Service | CPU | RAM | Storage |
|---------|-----|-----|---------|
| Frontend | 0.5 vCPU | 512 MB | 1 GB |
| AI Engine | 0.5 vCPU | 1 GB | 2 GB |
| PostgreSQL | 0.25 vCPU | 256 MB | 5 GB |
| Redis | 0.1 vCPU | 128 MB | 1 GB |
| **Total** | **1.35 vCPU** | **1.9 GB** | **9 GB** |

### Recommended (Production)

| Service | CPU | RAM | Storage |
|---------|-----|-----|---------|
| Frontend | 1 vCPU | 1 GB | 2 GB |
| AI Engine | 1 vCPU | 2 GB | 5 GB |
| PostgreSQL | 0.5 vCPU | 1 GB | 20 GB |
| Redis | 0.25 vCPU | 256 MB | 2 GB |
| **Total** | **2.75 vCPU** | **4.3 GB** | **29 GB** |

---

## 7. Coolify Configuration

### 7.1 Project Structure

```
Coolify Project: ai-liquid-manager
├── Services
│   ├── frontend (Port 3000)
│   ├── ai-engine (Port 8000)
│   ├── postgres (Port 5432)
│   └── redis (Port 6379)
├── Domains
│   ├── yourdomain.com → frontend:3000
│   └── api.yourdomain.com → ai-engine:8000
└── Volumes
    ├── ai-models → /app/models
    ├── postgres-data → /var/lib/postgresql/data
    └── redis-data → /data
```

### 7.2 Domain Configuration

**Frontend:**
- Domain: `yourdomain.com`
- Target: `frontend:3000`
- SSL: Automatic (Let's Encrypt)

**AI Engine:**
- Domain: `api.yourdomain.com`
- Target: `ai-engine:8000`
- SSL: Automatic (Let's Encrypt)
- CORS: Allow all origins

### 7.3 Build Args for Frontend

Set these in Coolify's build configuration:

```yaml
build_args:
  NEXT_PUBLIC_VAULT_ADDRESS: "0xF9FD652453801749768e5660bbE624Ee90bE39a3"
  NEXT_PUBLIC_CHAIN_ID: "421614"
  NEXT_PUBLIC_AI_ENGINE_URL: "https://api.yourdomain.com"
  NEXT_PUBLIC_WC_PROJECT_ID: "your_project_id"
```

### 7.4 Health Check Configuration

**Frontend:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

**AI Engine:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

---

## 8. Deployment Commands

### 8.1 Initial Deployment

```bash
# 1. Clone repository
git clone https://github.com/isanat/AI_Liquid_manager.git
cd AI_Liquid_manager

# 2. Create .env file
cp .env.example .env
# Edit .env with your values

# 3. Deploy with Docker Compose
docker compose up -d --build

# 4. Check logs
docker compose logs -f

# 5. Health checks
curl http://localhost:8000/health
curl http://localhost:3000
```

### 8.2 Database Setup

```bash
# Run Prisma migrations (inside frontend container)
docker compose exec frontend npx prisma db push

# Or for PostgreSQL
docker compose exec frontend npx prisma migrate deploy
```

### 8.3 Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose up -d --build

# Check logs
docker compose logs -f
```

---

## 9. Troubleshooting

### 9.1 Frontend Build Fails

**Cause:** Missing build-time environment variables

**Solution:** Ensure all `NEXT_PUBLIC_*` variables are set as build args

### 9.2 AI Engine Won't Start

**Cause:** Missing Python dependencies or system libraries

**Solution:** Check logs with `docker compose logs ai-engine`

### 9.3 Database Connection Issues

**Cause:** DATABASE_URL not set correctly

**Solution:** Verify connection string format:
```
postgresql://user:password@postgres:5432/database
```

### 9.4 CORS Errors

**Cause:** Frontend and API on different domains

**Solution:** AI Engine has CORS enabled for all origins. Verify domain configuration.

### 9.5 Model Training Fails

**Cause:** CoinGecko API rate limiting

**Solution:** Wait a few minutes and restart the AI Engine

---

## 10. Security Checklist

- [ ] Set `KEEPER_PRIVATE_KEY` as a secret (never in code)
- [ ] Use strong PostgreSQL password
- [ ] Enable HTTPS (automatic with Coolify)
- [ ] Set up firewall rules (UFW)
- [ ] Configure rate limiting
- [ ] Regular security updates
- [ ] Backup database regularly
- [ ] Monitor logs for anomalies

---

## 11. Recommended Coolify Setup

### Step-by-Step Deployment

1. **Create New Project**
   - Name: `ai-liquid-manager`
   - Type: Docker Compose

2. **Connect Repository**
   - Source: GitHub
   - Repository: `isanat/AI_Liquid_manager`
   - Branch: `main`

3. **Configure Services**
   - Select `docker-compose.yml`
   - Override: Use `Dockerfile.render` for ai-engine

4. **Set Environment Variables**
   - Copy from `.env.example`
   - Set secrets in Coolify dashboard

5. **Configure Domains**
   - Add `yourdomain.com` for frontend
   - Add `api.yourdomain.com` for ai-engine

6. **Deploy**
   - Click Deploy
   - Wait for all services to be healthy

7. **Verify**
   - Check `/health` endpoint
   - Test frontend at domain
   - Test API at api subdomain

---

## Summary

| Item | Value |
|------|-------|
| **Total Services** | 4 (frontend, ai-engine, postgres, redis) |
| **Build-time Variables** | 4 (NEXT_PUBLIC_*) |
| **Runtime Variables** | 15+ |
| **Secrets** | 3 (KEEPER_PRIVATE_KEY, DB password, API keys) |
| **Database** | SQLite (dev) / PostgreSQL (prod) |
| **Python Version** | 3.11.x |
| **Node.js Runtime** | Bun 1.x |
| **Recommended RAM** | 4 GB minimum |
| **Recommended Storage** | 30 GB |

---

**Analysis Complete** ✅
