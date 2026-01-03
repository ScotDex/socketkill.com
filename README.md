
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/X7X21RDFR0)

# 🛰️ EVE Online Intel Engine: Wingspan Edition (2026)

A high-performance, containerized intelligence engine built in Node.js that bridges **Tripwire mapper data** with **zKillboard's RedisQ**. This service dynamically monitors active wormhole chains and delivers real-time, filtered kill alerts to Discord.

## 🛠️ Tactical Overview
Unlike generic killmail listeners, this engine is **stateful and context-aware**. It prioritizes local data and dynamic filtering to provide a "Gatekeeper" service for specific wormhole operations.

* **Dynamic Chain Filtering**: Automatically pulls active `systemID`s from a Tripwire-based API (deliverynetwork.space) every 60 seconds.
* **The Gatekeeper Logic**: Uses $O(1)$ Set-lookup to filter the global zKillboard "firehose," instantly discarding any killmail not occurring within the monitored chain.
* **ESI-Light Persistence**: Implements a "Write-Behind" strategy for Character, Corporation, and Ship data to stay within ESI rate limits while building a rich local database.
* **Docker Optimized**: Designed for 24/7 deployment on low-resource environments (e.g., DigitalOcean Droplets) with a footprint of <256MB RAM.

## 🚀 Setup & Usage

### 1. Prerequisites
* Docker and Docker Compose installed.
* A `data/` directory in the root (for persistent JSON caches).

### 2. Configuration (`.env`)
Create a `.env` file in the root directory:
```env
INTEL_WEBHOOK_URL=[https://discord.com/api/webhooks/](https://discord.com/api/webhooks/)...
