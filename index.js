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

// Initialize Core Services
const esi = new ESIClient("Contact: @ScottishDex");
const { app, io } = startWebServer(esi);
const mapper = new MapperService(process.env.WINGSPAN_API);

// Constants & State
const QUEUE_ID = process.env.ZKILL_QUEUE_ID || "Wingspan-Monitor";
const REDISQ_URL = `https://zkillredisq.stream/listen.php?queueID=${QUEUE_ID}&ttw=1`;
const ROTATION_SPEED = 10 * 60 * 1000;

let currentSpaceBg = null;
let processor = null;

io.on("connection", (socket) => {
    if (currentSpaceBg) {
        socket.emit("nebula-update", currentSpaceBg);
    } else {
        refreshNebulaBackground();
    }
    socket.emit('gatekeeper-stats', { totalScanned: statsManager.getTotal() });
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
