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
const normalizer = require("./src/core/normalizer");
const utils = require("./src/core/helpers");
const statsManager = require("./src/services/statsManager");
const ProcessorFactory = require("./src/core/processor");
const { arrayBuffer } = require("stream/consumers");
const cleanAxios = require("axios");

// Initialize Core Services
const esi = new ESIClient("Contact: @ScottishDex");
const { app, io } = startWebServer(esi);
const mapper = new MapperService(process.env.WINGSPAN_API);

// Constants & State
const QUEUE_ID = process.env.ZKILL_QUEUE_ID || "Wingspan-Monitor";
const REDISQ_URL = `https://zkillredisq.stream/listen.php?queueID=${QUEUE_ID}&ttw=1`;
const ROTATION_SPEED = 10 * 60 * 1000;
const R2_BASE_URL = "https://r2z2.zkillboard.com/ephemeral";
const SEQUENCE_CACHE_URL = `${R2_BASE_URL}/sequence.json`;

let currentSequence = 0; // Initialize as 0, will be overwritten by priming
let consecutive404s = 0;
const duplicateGuard = new Set();


const startMonitor = require('./src/network/monitor'); // Path to your file
startMonitor(750);

let currentSpaceBg = null;
let processor = null;

async function syncPlayerCount() {
    const status = await utils.getPlayerCount();
    if (status) {
        io.emit('player-count', status);
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
        console.log(`✅ Background Synced: ${data.name}`);
    }
}

async function listeningStream() {
    console.log(`Listening to zKillboard Queue: ${QUEUE_ID}`);
    while (true) {
        try {
            const response = await axios.get(REDISQ_URL, { timeout: 5000 });
            const data = response.data;

            if (data && data.package) {
                // Trigger background resolution without 'await' to keep the pipe moving
                processor.processPackage(data.package);
            } else {
                // Polling...
                await new Promise((res) => setTimeout(res, 500));
            }
        } catch (err) {
            const delay = err.response?.status === 429 ? 2000 : 5000;
            console.error(`❌ [STREAM-ERR]: ${err.message}`);
            await new Promise((res) => setTimeout(res, delay));
        }
    }
}
async function r2BackgroundWorker() {
    console.log("🚀 R2 Shadow Worker: Starting Polling Loop...");

    const res = await cleanAxios.get(SEQUENCE_CACHE_URL, { 
    headers: { 'User-Agent': 'WiNGSPAN-Intel-Shadow-Worker' } });
    try {
        // FIX: Ensure the variable name matches the one used below
        const res = await axios.get(SEQUENCE_CACHE_URL, { timeout: 5000 });
        
        if (res.data && res.data.sequence) {
            currentSequence = parseInt(res.data.sequence) - 5;
            console.log('✅ R2_WORKER: Primed at sequence:', currentSequence);
        } else {
            throw new Error("Malformed sequence data");
        }
    } catch (e) {
        // Detailed error logging helps find these "ReferenceErrors" faster
        console.error(`❌ R2_WORKER: Failed to prime sequence. (${e.message})`);
        setTimeout(r2BackgroundWorker, 10000);
        return;
    }
console.log("🏃 R2_WORKER: Transitioning to live polling...");
while (true) {
        try {
            const url = `${R2_BASE_URL}/${currentSequence}.json?cb=${Date.now()}`;
            const response = await cleanAxios.get(url, { timeout: 3000 });

            if (response.status === 200) {
                const r2Package = normalizer.fromR2(response.data);

                if (r2Package && r2Package.killID) {
                    if (!duplicateGuard.has(r2Package.killID)) {
                        duplicateGuard.add(r2Package.killID);
                        
                        console.log(`[R2_WIN] Beat Socket for Kill ${r2Package.killID}`);
                        
                        // Maintenance: Keep the Set lean
                        if (duplicateGuard.size > 500) {
                            const firstValue = duplicateGuard.values().next().value;
                            duplicateGuard.delete(firstValue);
                        }

                        console.log(`[R2_SHADOW] Sequence ${currentSequence} detected.`);
                        processor.processPackage(r2Package);
                    } else {
                        console.log(`[R2_LOSS] Socket beat R2 for Kill ${r2Package.killID}`);
                    }
                } // This closes: if (r2Package && r2Package.killID)

                currentSequence++;
                consecutive404s = 0;
            } // This closes: if (response.status === 200)
        } catch (err) {
            if (err.response?.status === 404) {
                consecutive404s++;
                if (consecutive404s > 10) {
                    try {
                        const sync = await axios.get(SEQUENCE_CACHE_URL);
                        if (sync.data.sequence > currentSequence) {
                            currentSequence = sync.data.sequence;
                        }
                    } catch (syncErr) {
                        console.error("❌ R2_SYNC_ERR: Failed to re-sync sequence.");
                    }
                    consecutive404s = 0;
                }
                await new Promise(r => setTimeout(r, 1000)); // Poll faster at tip
            } else {
                console.error(`❌ R2_NETWORK_ERR: ${err.message}`);
                await new Promise(r => setTimeout(r, 10000));
            }
        }
    }
}
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
    r2BackgroundWorker();
})();
