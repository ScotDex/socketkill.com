# 🛰️ EVE Online Intel Engine (2025)

A high-performance, stateful intelligence engine built in Node.js for streaming and resolving EVE Online killmail data via zKillboard's RedisQ service.

## ⚠️ Status: Development & Testing
**This project is currently in a testing phase.**
* **Experimental**: Features are being refined for performance and API efficiency.
* **Not for General Hosting**: This codebase is intended for development environments and is not yet optimized for end-user deployment.

## 📖 Features
The engine is designed to be "ESI-Light" by prioritizing local data over network requests.

* **Persistent Caching**: Uses a "Write-Behind" strategy to save Character, Corporation, and Type data to local JSON files.
* **Static Universe Mapping**: Pre-loads a complete SDE-based system database to resolve solar system names and security statuses instantly.
* **Memory Efficiency**: Utilizes JavaScript `Map` objects for $O(1)$ lookup speeds during high-traffic events.
* **Automatic Throttling**: Built-in 1-minute "Dirty Flag" save interval to minimize disk I/O on your hosting hardware.



## 🛠️ Tech Stack
* **Language**: Node.js
* **HTTP Layer**: Axios with custom User-Agent headers (CCP Compliance)
* **Data Source**: zKillboard RedisQ (Long-polling)
* **Database**: Flat-file JSON persistence

## 🚀 Setup & Usage

### 1. Prerequisites
Ensure you have Node.js installed and a `data/` folder in your root directory.

### 2. Configuration
The `ESIClient` requires a contact string for the User-Agent header to comply with CCP's ESI guidelines.
* Populate `data/systems.json` with EVE Static Data.
* Ensure a valid (or empty) `esi_cache.json` exists in the root or `data/` folder.

### 3. Running the Engine
```bash
node index.js