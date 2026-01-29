/**
 * Project: WiNGSPAN Intel & Whale Hunter
 * Author: Dexomus Viliana (scottishdex)
 * Version: 1.1.0 (Concurrent Refactor)
 */

require("dotenv").config();
const axios = require("./src/network/agent");
const path = require("path");
const ESIClient = require("./src/network/esi");
const MapperService = require("./src/network/mapper");
const HeartbeatService = require("./src/services/heartbeatService");
const startWebServer = require("./src/services/webServer");
const utils = require("./src/core/helpers");
const statsManager = require("./src/services/statsManager");
const ProcessorFactory = require("./src/core/processor");
const { arrayBuffer } = require("stream/consumers");

// Initialize Core Services
const esi = new ESIClient("Contact: @ScottishDex");
const { app, io } = startWebServer(esi);
const mapper = new MapperService(process.env.WINGSPAN_API);

// Constants & State
const QUEUE_ID = process.env.ZKILL_QUEUE_ID || "Wingspan-Monitor";
const REDISQ_URL = `https://zkillredisq.stream/listen.php?queueID=${QUEUE_ID}&ttw=1`;
const ROTATION_SPEED = 10 * 60 * 1000;
const USE_R2 = true;
const R2_BASE_URL = "https://r2z2.zkillboard.com/ephemeral";
const SEQUENCE_CACHE_URL = `${R2_BASE_URL}/sequence.json`;

let currentSequence = null;
let consecutive404s = 0;
const duplicateGuard = new Set();

const startMonitor = require('./src/network/monitor'); 
startMonitor(750);

let currentSpaceBg = null;
let processor = null;

async function syncPlayerCount() {
    const status = await utils.getPlayerCount();
    if (status) {
        io.emit('player-count', status)
    }

}

io.on("connection", async(socket) => {
    if (currentSpaceBg) {
        socket.emit("nebula-update", currentSpaceBg);
    } else {
        refreshNebulaBackground();
    }
    const regions = Array.from(esi.cache.regions.values()).sort();
    socket.emit("region-list", regions);
    socket.emit('gatekeeper-stats', { totalScanned: statsManager.getTotal() });
    const currentStatus = await utils.getPlayerCount();
    socket.emit('player-count', currentStatus);
});

async function refreshNebulaBackground() {
    console.log("Fetching Background Image");
    const data = await utils.getBackPhoto();
    if (data) {
        currentSpaceBg = data;
        io.emit("nebula-update", data);
        
    }
}

async function listeningStream() {
    const mode = USE_R2 ? 'R2_SEQUENCE' : 'REDIS_Q';
    console.log(`📡 Dev Uplink Active | Mode: ${mode}`);
    console.log(`Listening to zKillboard Queue: ${QUEUE_ID}`);
    while (true) {
        try {
            if (USE_R2) {
                if (currentSequence === null) {
                    const sync = await axios.get(SEQUENCE_CACHE_URL);
                    currentSequence = sync.data.sequence;
                    console.log(`🛰️ [R2-SYNC] Starting at: ${currentSequence}`);
                }

                const response = await axios.get(`${R2_BASE_URL}/${currentSequence}.json`, {
                    timeout: 3000,
                    validateStatus: (s) => s < 500

                });

                if (response.status === 200) {
                    consecutive404s = 0; // Reset stall counter
                    const pkg = response.data;

                    // Idempotency check for reprocessed kills (Edit 2)
                    if (!duplicateGuard.has(pkg.killmail_id)) {
                        // SURGICAL WRAP: We wrap it in { package: pkg } so your 
                        // existing processor logic remains untouched.
                        processor.processPackage(pkg);

                        duplicateGuard.add(pkg.killmail_id);
                        if (duplicateGuard.size > 1000) {
                            const oldest = duplicateGuard.values().next().value;
                            duplicateGuard.delete(oldest);
                        }
                    }

                    currentSequence++;
                    continue; // Burst mode: skip wait if we found a file
                }

                if (response.status === 404) {
                    consecutive404s++;
                    // If we've stalled for ~30s (15 * 2s), the sequence might have jumped
                    if (consecutive404s > 15) {
                        console.warn("⚠️ [R2] Potential sequence gap detected. Re-priming...");
                        currentSequence = null;
                    }
                    await new Promise(res => setTimeout(res, 2000));
                }
            } else {

                const response = await axios.get(REDISQ_URL, { timeout: 5000 });
                if (response.data && response.data.package) {
                    processor.processPackage(response.data.package);
                } else {
                    await new Promise((res) => setTimeout(res, 500));
                }

            }
        } catch (err) {
            const delay = err.response?.status === 429 ? 2000 : 5000;
            console.error(`❌ [STREAM-ERR]: ${err.message}`);
            await new Promise((res) => setTimeout(res, delay));
        }
    }
}

/**
 * Initialization & Maintenance Loops
 */
(async () => {
    console.log("Initializing WiNGSPAN Intel Monitor...");
    await esi.loadSystemCache("./data/systems.json");
    await esi.loadCache(path.join(__dirname, "data", "esi_cache.json"));
    await mapper.refreshChain(esi.getSystemDetails.bind(esi));
    refreshNebulaBackground();
    processor = ProcessorFactory(esi, mapper, io, statsManager);
    console.log("🌌 Universe Map, Background & Chain Loaded.");
    syncPlayerCount();
    // Chain Refresh: 1 Minute
    setInterval(() => mapper.refreshChain(esi.getSystemDetails.bind(esi)), 60000);

    // Background Rotation: 10 Minutes
    setInterval(refreshNebulaBackground, ROTATION_SPEED);

    // Stats Persistence: 1 Minute
    setInterval(() => {
        statsManager.save();
        console.log(`💾 [AUTO-SAVE] Stats: ${statsManager.getTotal()}`);
    }, 60000);

    // Daily Heartbeat
    setInterval(() => {
        const reportStats = statsManager.getStatsForReport();
        HeartbeatService.sendReport(process.env.MON_WEBHOOK, reportStats, mapper, esi);
        statsManager.resetSession();
    }, 24 * 60 * 60 * 1000);

    console.log("Web Server Module Ready.");
    listeningStream();
})();
