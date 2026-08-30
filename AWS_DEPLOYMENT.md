# Noctivus '26 — AWS Free Tier (EC2 / Lightsail) Deployment Guide

This guide details how to host Noctivus '26 on **AWS Free Tier (EC2 `t2.micro` or `t3.micro`)** with **zero crash guarantees** (anti-OOM protection and low-memory container architecture).

---

## 1. Prerequisites (AWS Free Tier Instance)
- **Instance Type**: `t2.micro` or `t3.micro` (1 vCPU, 1 GB RAM — 750 free hours/month).
- **OS**: Ubuntu 22.04 LTS or 24.04 LTS.
- **Security Group Inbound Rules**:
  - `HTTP` (Port 80) — `0.0.0.0/0`
  - `HTTPS` (Port 443) — `0.0.0.0/0`
  - `SSH` (Port 22) — `My IP` or `0.0.0.0/0`

---

## 2. One-Click Setup & Launch

SSH into your AWS EC2 instance:
```bash
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

Clone your repository or upload your files:
```bash
git clone https://github.com/aravind220806/Noctivus26.git
cd Noctivus26
```

Run the automated AWS Free Tier setup script:
```bash
chmod +x scripts/setup_aws_free_tier.sh
./scripts/setup_aws_free_tier.sh
```

---

## 3. How Anti-Crash Protection Works on 1 GB RAM

| Layer | Implementation | Benefit on AWS Free Tier |
|---|---|---|
| **Memory Buffer** | 2 GB Swap file with `swappiness=10` | Extends 1 GB RAM to 3 GB virtual memory, preventing Linux kernel OOM kills. |
| **Frontend Serving** | Multi-stage build with Nginx Alpine | Serves static assets at < 25 MB RAM with Gzip & Brotli compression. |
| **Reverse Proxy** | Nginx `/api/` internal upstream | Keeps backend port `4000` private and internal to Docker network. |
| **Backend Tuning** | Python 3.12 Slim + Uvicorn non-blocking workers | Caps backend memory at 512 MB with automatic resource reservations. |
| **Auto-Recovery** | `restart: unless-stopped` + Docker health checks | Automatically reboots container in < 2 seconds if a network glitch occurs. |

---

## 4. Useful Management Commands

```bash
# View real-time container status and memory usage
docker compose ps
docker stats

# View backend API logs
docker compose logs -f backend

# View frontend / Nginx access & proxy logs
docker compose logs -f frontend

# Restart services
docker compose restart

# Pull new updates and rebuild
git pull
docker compose build
docker compose up -d
```
