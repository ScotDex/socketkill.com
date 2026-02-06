/**
 * Project: WiNGSPAN Intel & Whale Hunter
 * Author: Dexomus Viliana (scottishdex)
 * Version: 1.1.0 (Concurrent Refactor)
 */

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

// Initialize Core Services
const esi = new ESIClient("Contact: @ScottishDex");
const { app, io } = startWebServer(esi);
const mapper = new MapperService(process.env.WINGSPAN_API);

// Constants & State
// const QUEUE_ID = process.env.ZKILL_QUEUE_ID || "Wingspan-Monitor";
// const REDISQ_URL = `https://zkillredisq.stream/listen.php?queueID=${QUEUE_ID}&ttw=1`;
const ROTATION_SPEED = 10 * 60 * 1000;
const R2_BASE_URL = "https://r2z2.zkillboard.com/ephemeral"; // Non Production
const SEQUENCE_CACHE_URL = `${R2_BASE_URL}/sequence.json`;

let currentSequence = 0;
let consecutive404s = 0;
// const duplicateGuard = {
//     cache: new Map(),
//     ttl: 10 * 60 * 1000,

//     has(id) {
//         return this.cache.has(id);
//     },

//     add(id) {
//         this.cache.set(id, Date.now());

//         setTimeout(() => this.cache.delete(id), this.ttl);
//     },
//     size() { return this.cache.size; }
// };

const startMonitor = require("./src/network/monitor"); // Path to your file
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
  if (currentSpaceBg) {
    socket.emit("nebula-update", currentSpaceBg);
  } else {
    refreshNebulaBackground();
  }
  const regions = Array.from(esi.cache.regions.values()).sort();
  socket.emit("region-list", regions);
  socket.emit("gatekeeper-stats", { totalScanned: statsManager.getTotal() });
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

// async function listeningStream() {
//     console.log(`Listening to zKillboard Queue: ${QUEUE_ID}`);
//     while (true) {
//         try {
//             const response = await axios.get(REDISQ_URL, { timeout: 5000 });
//             const data = response.data;

//             if (data && data.package) {
//                 // Trigger background resolution without 'await' to keep the pipe moving

//                 const killID = data.package.killID;

//                 // 2. THE GUARD: Check if R2 already won this race
//                 if (duplicateGuard.has(killID)) {
//                     // SILENT EXIT: R2 already processed this.
//                     // No log, no processor call, no front-end emit.
//                     continue;
//                 }

//                 // 3. CLAIM IT: If socket won, mark it so R2 doesn't double-process
//                 duplicateGuard.add(killID);
//                 processor.processPackage(data.package);
//             } else {
//                 // Polling...
//                 await new Promise((res) => setTimeout(res, 500));
//             }
//         } catch (err) {
//             const delay = err.response?.status === 429 ? 2000 : 5000;
//             console.error(`❌ [STREAM-ERR]: ${err.message}`);
//             await new Promise((res) => setTimeout(res, delay));
//         }
//     }
// }

console.log(`📡 Network Agent Identity: ${talker.defaults.headers['User-Agent']}`);
async function r2BackgroundWorker() {
  try {
    const res = await talker.get(SEQUENCE_CACHE_URL, { timeout: 5000 });
    if (res.data && res.data.sequence) {
      currentSequence = parseInt(res.data.sequence) - 5;
      console.log(
        `🚀 R2_WORKER: Primed and ready at sequence ${currentSequence}`,
      );
    } else {
      throw new Error("Invalid sequence data");
    }
  } catch (e) {
    console.error(
      `❌ R2_WORKER: Priming failed (${e.message}). Retrying in 10s...`,
    );
    setTimeout(r2BackgroundWorker, 10000);
    return;
  }

  while (true) {
    try {
      const url = `${R2_BASE_URL}/${currentSequence}.json?cb=${Date.now()}`;

      // TRACE 1: Confirm the loop is actually ticking
      if (consecutive404s % 10 === 0) {
        console.log(`[R2_TRACE] Polling Seq: ${currentSequence} | URL: ${url}`);
      }

      const response = await talker.get(url, { timeout: 2000 });

      if (response.status === 200) {
        // TRACE 2: Found a file!
        console.log(
          `[R2_TRACE] Found file for Seq: ${currentSequence}. Parsing...`,
        );

        const r2Package = normalizer.fromR2(response.data);

        if (r2Package && r2Package.killID) {
          // REMOVED duplicateGuard check - sequential IDs don't duplicate
          console.log(`🏆 [R2_INGEST] Captured Kill ${r2Package.killID}`);
          processor.processPackage(r2Package);
        } else {
          console.error(
            `❌ [R2_TRACE] Normalizer failed for Seq: ${currentSequence}.`,
          );
        }

        currentSequence++;
        consecutive404s = 0;
      }
// ... existing r2BackgroundWorker code ...
} catch (err) {
    if (err.response?.status === 404) {
        consecutive404s++;

        // 1. SET THE BACKOFF (Following zkillbot standard)
        // We wait 10 seconds before asking for the next sequence again.
        const backoffTime = 10000; 

        if (consecutive404s % 5 === 0) {
            console.log(`😴 [R2_STALL] Sequence ${currentSequence} still 404. Backing off 10s. (Total 404s: ${consecutive404s})`);
        }

        // 2. THE RE-SYNC TRIGGER (Safety Valve)
        // If we hit 404 for too long (e.g., 30 attempts), the sequence might have jumped.
        if (consecutive404s >= 30) {
            console.warn(`⚠️ [R2_SYNC] High 404 count. Re-priming sequence from master...`);
            return r2BackgroundWorker(); // Restart worker to fetch fresh sequence.json
        }

        await new Promise((r) => setTimeout(r, backoffTime));
    } else {
        // Handle 429 (Rate Limit) or 500s with even longer delays
        const errorDelay = err.response?.status === 429 ? 30000 : 5000;
        console.error(`📡 [R2_TRACE] Network Error: ${err.message}`);
        await new Promise((r) => setTimeout(r, errorDelay));
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
  // listeningStream();
  r2BackgroundWorker();
})();
