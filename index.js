require("dotenv").config();
const talker = require("./src/network/agent");
const path = require("path");
const ESIClient = require("./src/network/esi");
const MapperService = require("./src/network/mapper");
const HeartbeatService = require("./src/services/heartbeatService");
const startWebServer = require("./src/services/webServer");
const normalizer = require("./src/core/normalizer");
const utils = require("./src/core/helpers");
const statsManager = require("./src/services/statsManager");
const ProcessorFactory = require("./src/core/processor");
const esi = new ESIClient("Contact: @ScottishDex");
const { io } = startWebServer(esi);
const mapper = new MapperService(process.env.WINGSPAN_API);

const ROTATION_SPEED = 10 * 60 * 1000;
const R2_BASE_URL = process.env.R2_BASE_URL
const SEQUENCE_CACHE_URL = `${R2_BASE_URL}/sequence.json`;

let currentSequence = 0;
let consecutive404s = 0;
let lastSuccessfulIngest = Date.now();
let lastErrorStatus = null;
let isThrottled = false;

const startMonitor = require("./src/network/monitor"); 
startMonitor(750);

let currentSpaceBg = null;
let processor = null;

async function syncPlayerCount() {
  const status = await utils.getPlayerCount();
  if (status) {
    io.emit("player-count", status);
  }
}

io.on("connection", async (socket) => {
  const clientCount = io.engine.clientsCount;
  console.log(`🔌 [NETWORK] New connection: ${socket.id} | Total Active: ${clientCount}`);
  if (currentSpaceBg) {
    socket.emit("nebula-update", currentSpaceBg);
  } else {
    refreshNebulaBackground();
  }
  const regions = Array.from(esi.cache.regions.values()).sort();
  socket.emit("region-list", regions);
  socket.emit("gatekeeper-stats", { totalScanned: statsManager.getTotal(),
    totalIsk:statsManager.totalIsk
   });
  const currentStatus = await utils.getPlayerCount();
  socket.emit("player-count", currentStatus);
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

// --- Configuration ---
const POLLING_CONFIG = {
    CATCHUP_SPEED: 75,    
    STALL_DELAY: 1000,    
    ERROR_BACKOFF: 5000,  
    PANIC_DELAY: 120000   
};

async function r2BackgroundWorker() {
    // 1. Priming Phase
    try {
        const res = await talker.get(SEQUENCE_CACHE_URL, { timeout: 5000 });
        if (res.data?.sequence) {
            currentSequence = parseInt(res.data.sequence) - 5;
            console.log(`🚀 R2_WORKER: Primed at sequence ${currentSequence}`);
        } else {
            throw new Error("Invalid sequence data");
        }
    } catch (e) {
        const status = e.response?.status;
        lastErrorStatus = status;
        const wait = status === 429 ? POLLING_CONFIG.PANIC_DELAY : 10000;
        console.error(`❌ Priming failed. Retrying in ${wait/1000}s...`);
        return setTimeout(r2BackgroundWorker, wait);
    }

    // 2. The Centralized Recursive Tick
    const poll = async () => {
        if (isThrottled) return;

        // Cache-buster ONLY active during 404/Stall recovery
        const url = `${R2_BASE_URL}/${currentSequence}.json${consecutive404s > 0 ? `?cb=${Date.now()}` : ''}`;
        let nextTick = POLLING_CONFIG.CATCHUP_SPEED;

        try {
            const response = await talker.get(url, { timeout: 2000 });
            const r2Package = normalizer.fromR2(response.data);

            if (r2Package?.killID) {
// R2 time is often a ISO string; parsing it safely here
    const killTime = Date.parse(r2Package.time); 
    const latency = Date.now() - killTime;
    
    // Log with a fallback to '??' if parsing fails
    console.log(`[INGEST] Seq: ${currentSequence} | Kill: ${r2Package.killID} | Latency: ${isNaN(latency) ? '??' : latency}ms`);
                processor.processPackage(r2Package);
                currentSequence++;
                consecutive404s = 0;
                lastSuccessfulIngest = Date.now();
                lastErrorStatus = 200;
                isThrottled = false;
            } else {
                // DATA GAP: File exists but normalize failed or no kill data
                consecutive404s++;
                if (consecutive404s === 1) console.log(`❓ [GAP] Potential ghost file at ${currentSequence}. Retrying...`);
                nextTick = POLLING_CONFIG.STALL_DELAY;
                
                if (consecutive404s >= 5) {
                    console.warn(`⏭️ [SKIP] Seq ${currentSequence} is ghost data. Skipping to next.`);
                    currentSequence++;
                    consecutive404s = 0;
                }
            }
        } catch (err) {
            const status = err.response?.status;
            lastErrorStatus = status;

            if (status === 429) {
                isThrottled = true;
                console.error("🛑 [429] Rate Limited. Entering 2m quiet period.");
                setTimeout(() => { isThrottled = false; poll(); }, POLLING_CONFIG.PANIC_DELAY);
                return; // Break recursion until timeout finishes
            }

            const is404 = status === 404;
            consecutive404s = is404 ? consecutive404s + 1 : 0;
            nextTick = is404 ? 12000 : POLLING_CONFIG.ERROR_BACKOFF;

            if (is404 && consecutive404s >= 30) {
                console.warn("🔄 [RE-SYNC] 404 limit reached. Re-priming...");
                return r2BackgroundWorker();
            }
        }

        setTimeout(poll, nextTick);
    };

    poll();
}

(async () => {
  console.log("Initializing Socket.Kill...");
  await esi.loadSystemCache("./data/systems.json");
  await esi.loadCache(path.join(__dirname, "data", "esi_cache.json"));
  await mapper.refreshChain(esi.getSystemDetails.bind(esi));
  refreshNebulaBackground();
  processor = ProcessorFactory(esi, mapper, io, statsManager);
  console.log("🌌 Universe Map, Background & Chain Loaded.");
  syncPlayerCount();
  setInterval(() => mapper.refreshChain(esi.getSystemDetails.bind(esi)), 60000);
  setInterval(refreshNebulaBackground, ROTATION_SPEED);
  setInterval(() => {
    statsManager.save();
    console.log(`💾 [AUTO-SAVE] Stats: ${statsManager.getTotal()}`);
  }, 60000);
  setInterval(
    () => {
      const reportStats = statsManager.getStatsForReport();
      HeartbeatService.sendReport(
        process.env.MON_WEBHOOK,
        reportStats,
        mapper,
        esi,
      );
      statsManager.resetSession();
    },
    24 * 60 * 60 * 1000,
  );
  console.log("Web Server Module Ready.");
  r2BackgroundWorker();
})();
