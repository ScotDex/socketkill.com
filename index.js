/**
 * Project: WiNGSPAN Intel & Whale Hunter
 * Author: Dexomus Viliana (scottishdex)
 * Version: 1.0.0
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

const esi = new ESIClient("Contact: @YourName");
const { app, io } = startWebServer(esi);

let scanCount = utils.loadPersistentStats();
console.log(`[BOOT] Lifetime scans loaded; ${scanCount}`)

const stats = {
  startTime: new Date(),
  scanCount: 0,
};

let currentSpaceBg = null;

io.on("connection", (socket) => {
  if (currentSpaceBg) {
    socket.emit("nebula-update", currentSpaceBg);
  } else {
    refreshNebulaBackground();
  }
  socket.emit('gatekeeper-stats', { 
        totalScanned: scanCount 
    });
 
});

async function refreshNebulaBackground() {
  console.log ("Fetching Background Image")
  const data = await utils.getBackPhoto();
  if (data) {
    currentSpaceBg = data;
    io.emit("nebula-update", data); 
    console.log(`✅ Background Synced: ${data.name}`);
  }
}

const mapper = new MapperService(process.env.WINGSPAN_API);
const THERA_ID = 31000005;
const isWormholeSystem = (systemId) => {
  return systemId >= 31000001 && systemId <= 32000000;
};
(async () => {
  console.log("Initializing Tripwire Kill Monitor...");
  await esi.loadSystemCache("./data/systems.json");
  await esi.loadCache(path.join(__dirname, "data", "esi_cache.json"));
  await mapper.refreshChain(esi.getSystemDetails.bind(esi));
  refreshNebulaBackground();
  console.log("🌌 Universe Map, Background & Chain Loaded.");
  setInterval(() => {
    mapper.refreshChain(esi.getSystemDetails.bind(esi));
  }, 1 * 60 * 1000);

  
  // axios.post(process.env.INTEL_WEBHOOK_URL, { content: "Online" })
  //   .catch(err => console.error("Test Ping Failed:", err.message));

  console.log("Web Server Module Ready.");
  listeningStream();
})();

const QUEUE_ID = process.env.ZKILL_QUEUE_ID || "Wingspan-Monitor";
const REDISQ_URL = `https://zkillredisq.stream/listen.php?queueID=${QUEUE_ID}&ttw=1`;


async function listeningStream() {
  const WHALE_THRESHOLD = 20000000000;
  console.log(`Listening to zKillboard Queue: ${QUEUE_ID}`);
  let pollDelay = 1000;
  while (true) {
    try {
      const response = await axios.get(REDISQ_URL, { timeout: 10000 });
      const data = response.data;

      if (data && data.package) {
        const startProcessing = process.hrtime.bigint();
        const zkb = data.package.zkb;
        const rawValue = Number(zkb.totalValue) || 0;
        const esiResponse = await axios.get(zkb.href);
        const killmail = esiResponse.data;
          pollDelay = 300;
        const [shipName, systemDetails, charName] = await Promise.all([
          esi.getTypeName(killmail.victim.ship_type_id),
          esi.getSystemDetails(killmail.solar_system_id),
          esi.getCharacterName(killmail.victim?.character_id),
        ]);
        const systemName = systemDetails
          ? systemDetails.name
          : "Unknown System";
        const constellationId = systemDetails
          ? systemDetails.constellation_id
          : null;
        let regionName = "K-Space";
        let realRegionId = "Unknown";
        stats.scanCount++;
        scanCount++;
        
        if (scanCount % 100 == 0){
            utils.savePersistentStats(scanCount);
            console.log(`Disk Milestone Reached ${scanCount}. Save triggered`);
        }

        if (constellationId) {
          try {
            const constellationReq = await axios.get(
              `https://esi.evetech.net/latest/universe/constellations/${constellationId}/`,
              {
                headers: { "X-Compatibility-Date": "2025-12-16" },
              }
            );

            // 3. Resolve the name using your helper (saves to esi_cache.json)
            regionName = await esi.getRegionName(
              constellationReq.data.region_id
            );
          } catch (err) {
            console.error("Resolving region failed:", err.message);
          }
        }

        console.log(`Killmail recieved, processing...`);
        const shipImageUrl = `https://api.voidspark.org:2053/render/ship/${killmail.victim.ship_type_id}`;

        io.emit("gatekeeper-stats", {
          totalScanned: scanCount,
        });
        io.emit("raw-kill", {
          id: data.package.killID,
          val: Number(data.package.zkb.totalValue),
          ship: shipName,
          system: systemName,
          region: regionName,
          shipId: killmail.victim.ship_type_id,
          shipImageUrl: shipImageUrl,
          href: data.package.zkb.href,
          locationLabel: `System: ${systemName} | Region: ${regionName}`,
          zkillUrl: `https://zkillboard.com/kill/${data.package.killID}/`,
          victimName: charName,
          totalScanned: scanCount,
        });
        const isWhale = rawValue >= WHALE_THRESHOLD;
        benchmarkKill(data.package.killID, startProcessing);
        if (
          isWhale ||
          (isWormholeSystem(killmail.solar_system_id) &&
            killmail.solar_system_id !== THERA_ID &&
            mapper.isSystemRelevant(killmail.solar_system_id))
        ) {
          console.log(
            `Kill ${data.package.killID} in system ${killmail.solar_system_id}`
          );
          await handlePrivateIntel(killmail, zkb);
        } else {
          if (scanCount % 1000 === 0) {
            console.log(
              `Gatekeeper: ${scanCount} total kills scanned.`
            );
          }
        }
      } else {
        console.log('Polling...')
      }
    } catch (err) {
      const delay = err.response?.status === 429 ? 2000 : 5000;
      console.error(`❌ Error: ${err.message}`);
      await new Promise((res) => setTimeout(res, pollDelay, delay));
    }
  }
}

async function handlePrivateIntel(kill, zkb) {
  // 1. Setup our Threshold inside this function too
  const WHALE_THRESHOLD = 20000000000;
  const rawValue = Number(zkb.totalValue) || 0;
  const formattedValue = helpers.formatIsk(rawValue);
  try {
    const names = {
      shipName: await esi.getTypeName(kill.victim?.ship_type_id),
      systemName:
        esi.getSystemDetails(kill.solar_system_id)?.name || "Unknown System",
    };

    // TRACK A: Discord Intel (Gated by Mapper)
    if (mapper.isSystemRelevant(kill.solar_system_id)) {
      const metadata = mapper.getSystemMetadata(kill.solar_system_id);
      names.corpName = await esi.getCorporationName(
        kill.victim?.corporation_id
      );
      names.charName = await esi.getCharacterName(kill.victim?.character_id);
      names.scoutName = metadata ? metadata.scannedBy : "Unknown Scout";
      names.isAdjacent = metadata ? metadata.isAdjacent : false;
      const tripwireUrl = `${
        process.env.TRIPWIRE_URL
      }?system=${encodeURIComponent(names.systemName)}`;
      const payload = EmbedFactory.createKillEmbed(
        kill,
        zkb,
        names,
        tripwireUrl
      );

      if (process.env.INTEL_WEBHOOK_URL) {
        await axios.post(process.env.INTEL_WEBHOOK_URL, payload);
        console.log(
          `✅ [DISCORD] Intel Posted: ${names.shipName} (${formattedValue})`
        );
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
setInterval(() => {
  HeartbeatService.sendReport(
    process.env.INTEL_WEBHOOK_URL,
    stats,
    mapper,
    esi
  );
  stats.scanCount = 0;
}, 24 * 60 * 60 * 1000);

const ROTATION_SPEED = 10 * 60 * 1000;

setInterval(() => {
  console.log("Changing background");
  refreshNebulaBackground();
}, ROTATION_SPEED);

function benchmarkKill(killID, startTime) {
    const endTime = process.hrtime.bigint();
    const durationNs = endTime - startTime;
    const durationMs = Number(durationNs) / 1_000_000; // Convert to ms

    // Log the "Processing Tax"
    console.log(`[PERF] Kill ${killID} | Processing Latency: ${durationMs.toFixed(3)}ms`);
    
    // Broadcast to UI for a "Dev Mode" dashboard
    io.emit('perf-stats', {
        killID,
        latency: durationMs.toFixed(3)
    });
}