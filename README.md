# 🛰️ Socket.Kill | Tactical Intel Engine

**Internal Protocol: Operational Intelligence Aggregation**

A high-performance intelligence aggregator designed to bridge mapper telemetry with the real-time killmail stream. This engine serves as the tactical backbone for chain monitoring and capital-class asset detection.

## 🛠️ System Architecture & Logic
The engine utilizes a "Reject-by-Default" philosophy to maintain sub-millisecond processing times during peak EVE activity.

* **The Gatekeeper Protocol**: Implements a strict $O(1)$ Set-lookup against a monitored interest list. Incoming data packets not explicitly mapped in the system interest list are discarded before secondary processing.
* **Write-Behind Persistence**: To manage rate-limiting and I/O overhead, the system utilizes a 60-second "Dirty Cache" cycle. Identity and entity data are held in memory and persisted to disk in bulk.
* **Stateful Contextualization**: The engine maintains a local copy of static universe data and entity caches to ensure all broadcasts are fully hydrated with human-readable names without redundant external calls.
* **Diegetic Front-End**: The UI is optimized as a low-overhead terminal. By deferring non-critical render-blocking requests, the system prioritizes the initial visual paint and stabilizes the Speed Index.

## 🚀 Internal Configuration

```env
# --- LOGISTICS & ALERTS ---
INTEL_WEBHOOK_URL=
MON_WEBHOOK=

# --- DATA STREAM SELECTION ---
ZKILL_QUEUE_ID=
WINGSPAN_API=

# --- THRESHOLDS & ENGINE TUNING ---
WHALE_THRESHOLD=
ROTATION_SPEED=