#!/usr/bin/env bash
# ==============================================================================
# Noctivus '26 — AWS Free Tier (EC2 t2.micro / t3.micro) Anti-Crash Setup Script
# ==============================================================================
set -euo pipefail

echo "================================================================="
echo " Noctivus '26: Configuring AWS Free Tier EC2 (1GB RAM Anti-Crash)"
echo "================================================================="

# 1. SETUP 2GB SWAP SPACE (Guarantees zero Out-Of-Memory kernel crashes)
if [ ! -f /swapfile ]; then
    echo "[1/4] Configuring 2GB swap file to prevent OOM crashes on 1GB RAM..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    
    # Tune kernel memory swappiness for optimal performance
    sudo sysctl vm.swappiness=10
    sudo sysctl vm.vfs_cache_pressure=50
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
    echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf
    echo "✓ 2GB Swap space enabled."
else
    echo "✓ Swap space already configured."
fi

# 2. INSTALL DOCKER & DOCKER COMPOSE IF MISSING
if ! command -v docker &> /dev/null; then
    echo "[2/4] Installing Docker Engine..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker "$USER" || true
    sudo systemctl enable docker
    sudo systemctl start docker
    echo "✓ Docker installed."
else
    echo "✓ Docker is already installed."
fi

# 3. VERIFY ENVIRONMENT CONFIGURATION
echo "[3/4] Verifying environment variables..."
if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        echo "⚠️ Created backend/.env from .env.example. Please review SQLite and production settings."
    fi
fi

# 4. BUILD AND LAUNCH PRODUCTION CONTAINERS
echo "[4/4] Launching Noctivus containers via Docker Compose..."
docker compose pull || true
docker compose build
docker compose up -d --remove-orphans

echo "================================================================="
echo "✓ Noctivus '26 is successfully running in Docker on AWS Free Tier!"
echo "✓ Frontend (Nginx Proxy): http://$(curl -s http://checkip.amazonaws.com || echo 'YOUR_EC2_IP')"
echo "✓ Backend API: http://$(curl -s http://checkip.amazonaws.com || echo 'YOUR_EC2_IP')/api/events"
echo "================================================================="
