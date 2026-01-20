/**
 * Project: WiNGSPAN Intel & Whale Hunter
 * Author: Dexomus Viliana (scottishdex)
 * Version: 1.1.0 (Concurrent Refactor)
 */

require("dotenv").config();
const axios = require("./src/network/agent");
const path = require("path");
const ESIClient = require("./esi");
const MapperService = require("./mapper");
const EmbedFactory = require("./embedFactory");
const TwitterService = require("./src/network/twitterService");
const helpers = require("./helpers");
const HeartbeatService = require("./heartbeatService");
const startWebServer = require("./webServer");
const utils = require("./helpers");
const dropShipRender = require("./src/services/ship");

// Initialize Core Services
const esi = new ESIClient("Contact: @ScottishDex");
const { app, io } = startWebServer(esi);
const mapper = new MapperService(process.env.WINGSPAN_API);

// Constants & State
const THERA_ID = 31000005;
const WHALE_THRESHOLD = 20000000000;
const QUEUE_ID = process.env.ZKILL_QUEUE_ID || "Wingspan-Monitor";
const REDISQ_URL = `https://zkillredisq.stream/listen.php?queueID=${QUEUE_ID}&ttw=1`;
const ROTATION_SPEED = 10 * 60 * 1000;

let scanCount = utils.loadPersistentStats();
let currentSpaceBg = null;
const stats = {
    startTime: new Date(),
    scanCount: 0,
};

// Utilities
const isWormholeSystem = (systemId) => systemId >= 31000001 && systemId <= 32000000;

/**
 * UI & Socket Logic
 */
io.on("connection", (socket) => {
    if (currentSpaceBg) {
        socket.emit("nebula-update", currentSpaceBg);
    } else {
        refreshNebulaBackground();
    }
    socket.emit('gatekeeper-stats', { totalScanned: scanCount });
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

/**
 * Background Processor: Handles ESI lookups and Intel Dispatching
 * This runs concurrently for every killmail received.
 */
async function processPackage(packageData) {
    const startProcessing = process.hrtime.bigint();
    const { zkb, killID } = packageData;

    try {
        // 1. Initial Render Hand-off
        dropShipRender(io, packageData);
        const rawValue = Number(zkb.totalValue) || 0;

        // 2. Fetch Killmail Details from ESI
        const esiResponse = await axios.get(zkb.href);
        const killmail = esiResponse.data;

        // 3. Resolve Identity Data in Parallel
        const [systemDetails, shipName, charName, corpName] = await Promise.all([
            esi.getSystemDetails(killmail.solar_system_id),
            esi.getTypeName(killmail.victim.ship_type_id),
            esi.getCharacterName(killmail.victim?.character_id),
            esi.getCorporationName(killmail.victim?.corporation_id)
        ]);

        let regionName = "K-Space";
        if (systemDetails?.region_id) {
            regionName = await esi.getRegionName(systemDetails.region_id);
        }

        const systemName = systemDetails?.name || "Unknown System";

        // 4. Global Stats Increment
        stats.scanCount++;
        scanCount++;

        // 5. Broadcast to Web Front-end
        io.emit("gatekeeper-stats", { totalScanned: scanCount });
        io.emit("raw-kill", {
            id: killID,
            val: rawValue,
            ship: shipName,
            system: systemName,
            region: regionName,
            shipId: killmail.victim.ship_type_id,
            href: zkb.href,
            locationLabel: `System: ${systemName} | Region: ${regionName} | Corporation: ${corpName}`,
            zkillUrl: `https://zkillboard.com/kill/${killID}/`,
            victimName: charName,
            totalScanned: scanCount,
            shipImageUrl: `https://api.voidspark.org:2053/render/ship/${killmail.victim.ship_type_id}`,
            corpImageUrl: `https://api.voidspark.org:2053/render/corp/${killmail.victim.corporation_id}`
        });

        // 6. Performance Benchmarking
        benchmarkKill(killID, startProcessing);

        // 7. Gated Intel Logic (Discord/Twitter)
        const isWhale = rawValue >= WHALE_THRESHOLD;
        const isRelevantWH = isWormholeSystem(killmail.solar_system_id) && 
                           killmail.solar_system_id !== THERA_ID && 
                           mapper.isSystemRelevant(killmail.solar_system_id);

        if (isWhale || isRelevantWH) {
            console.log(`[INTEL] Processing relevant kill ${killID} in ${systemName}`);
            await handlePrivateIntel(killmail, zkb);
        } else if (scanCount % 1000 === 0) {
            console.log(`Gatekeeper: ${scanCount} total kills scanned.`);
        }

    } catch (err) {
        console.error(`❌ [PROCESS-ERR] Kill ${killID} failed: ${err.message}`);
    }
}

async function handlePrivateIntel(kill, zkb) {
    const rawValue = Number(zkb.totalValue) || 0;
    const formattedValue = helpers.formatIsk(rawValue);
    try {
        const names = {
            shipName: await esi.getTypeName(kill.victim?.ship_type_id),
            systemName: (await esi.getSystemDetails(kill.solar_system_id))?.name || "Unknown System",
        };

        if (mapper.isSystemRelevant(kill.solar_system_id)) {
            const metadata = mapper.getSystemMetadata(kill.solar_system_id);
            names.corpName = await esi.getCorporationName(kill.victim?.corporation_id);
            names.charName = await esi.getCharacterName(kill.victim?.character_id);
            names.scoutName = metadata ? metadata.scannedBy : "Unknown Scout";
            names.isAdjacent = metadata ? metadata.isAdjacent : false;
            
            const tripwireUrl = `${process.env.TRIPWIRE_URL}?system=${encodeURIComponent(names.systemName)}`;
            const payload = EmbedFactory.createKillEmbed(kill, zkb, names, tripwireUrl);

            if (process.env.INTEL_WEBHOOK_URL) {
                axios.post(process.env.INTEL_WEBHOOK_URL, payload).catch(e => console.error("Webhook Failed", e.message));
                console.log(`✅ [DISCORD] Intel Posted: ${names.shipName} (${formattedValue})`);
            }
        }

        if (rawValue >= WHALE_THRESHOLD) {
            console.log(`Big kill detected: ${formattedValue}! Tweeting...`);
            TwitterService.postWhale(names, formattedValue, kill.killmail_id);
        }
    } catch (err) {
        console.error("❌ Error in handlePrivateIntel:", err.message);
    }
}

/**
 * Main Ingestion Stream
 */
async function listeningStream() {
    console.log(`Listening to zKillboard Queue: ${QUEUE_ID}`);
    while (true) {
        try {
            const response = await axios.get(REDISQ_URL, { timeout: 5000 });
            const data = response.data;

            if (data && data.package) {
                // Trigger background resolution without 'await' to keep the pipe moving
                processPackage(data.package);
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
    
    console.log("🌌 Universe Map, Background & Chain Loaded.");

    // Chain Refresh: 1 Minute
    setInterval(() => mapper.refreshChain(esi.getSystemDetails.bind(esi)), 60000);

    // Background Rotation: 10 Minutes
    setInterval(refreshNebulaBackground, ROTATION_SPEED);

    // Stats Persistence: 1 Minute
    setInterval(() => {
        utils.savePersistentStats(scanCount);
        console.log(`💾 [AUTO-SAVE] Stats: ${scanCount}`);
    }, 60000);

    // Daily Heartbeat
    setInterval(() => {
        HeartbeatService.sendReport(process.env.MON_WEBHOOK, stats, mapper, esi);
        stats.scanCount = 0;
    }, 24 * 60 * 60 * 1000);

    console.log("Web Server Module Ready.");
    listeningStream();
})();

function benchmarkKill(killID, startTime) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    console.log(`[PERF] Kill ${killID} | Latency: ${durationMs.toFixed(3)}ms`);
    io.emit('perf-stats', { killID, latency: durationMs.toFixed(3) });
}