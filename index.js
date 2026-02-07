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
        let response;
        const url = `${R2_BASE_URL}/${currentSequence}.json?cb=${Date.now()}`;
        try {
            response = await talker.get(url, { timeout: 2000 });
        } catch (err) {
            const is404 = err.response?.status === 404;
            consecutive404s = is404 ? consecutive404s + 1 : 0;
            const backoff = is404 ? 12000 : 5000; 
            if (is404 && consecutive404s >= 30) return r2BackgroundWorker(); 
            await new Promise(r => setTimeout(r, backoff));
            continue; 
        }
        const r2Package = normalizer.fromR2(response.data);
        if (r2Package?.killID) {
            console.log(`[R2_INGEST] Captured Kill ${r2Package.killID}`);
            processor.processPackage(r2Package);
            currentSequence++;
            consecutive404s = 0;
        }
    }
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
