/**
 * Project: WiNGSPAN Intel & Whale Hunter
 * Author: Dexomus Viliana (scottishdex)
 * Version: 1.0.0
 */

require('dotenv').config();
const axios = require('axios');
const path = require('path');
const ESIClient = require('./esi');
const MapperService = require('./mapper');
const EmbedFactory = require('./embedFactory');
const TwitterService = require('./twitterService');
const helpers = require('./helpers')
const HeartbeatService = require('./heartbeatService');
const startWebServer = require('./webServer');
const { promiseHooks } = require('v8');

const esi = new ESIClient("Contact: @YourName");
const { app, io } = startWebServer(esi);

const stats = {
    startTime: new Date(),
    scanCount: 0
};


const mapper = new MapperService('http://api.deliverynetwork.space/data');
const THERA_ID = 31000005;


const isWormholeSystem = (systemId) => {
    return systemId >= 31000001 && systemId <= 32000000;
};

;(async () => {
    console.log("Initializing Tripwire Kill Monitor...");
    await esi.loadSystemCache('./data/systems.json');
    await esi.loadCache(path.join(__dirname, 'data', 'esi_cache.json'));

    await mapper.refreshChain(esi.getSystemDetails.bind(esi));
    console.log("🌌 Universe Map & Chain Loaded.");

    // 3. Background Sync (Every 1 minute)
    setInterval(() => {
        mapper.refreshChain(esi.getSystemDetails.bind(esi));
    }, 1 * 60 * 1000);

    // 4. Start the Engine
    axios.post(process.env.INTEL_WEBHOOK_URL, { content: "Online" })
        .catch(err => console.error("Test Ping Failed:", err.message));
    
    console.log("🚀 Web Server Module Ready.");
    listeningStream();
})();

const QUEUE_ID = process.env.ZKILL_QUEUE_ID || 'Wingspan-TW-Monitor';
const REDISQ_URL = `https://zkillredisq.stream/listen.php?queueID=${QUEUE_ID}&ttw=1`;


let scanCount = 0;
async function listeningStream() {
    console.log(`📡 RedisQ Active: ${QUEUE_ID} (Dec 2025 Mode)`);
    
    while (true) {
        try {
            // 1. Fetch from RedisQ (follows redirect to object.php automatically)
            const response = await axios.get(REDISQ_URL, { 
                timeout: 20000,
                maxRedirects: 5 
            });
            
            const pack = response.data?.package;
            if (!pack) {
                console.log("⏳ RedisQ: Null package (10s window).");
                continue; 
            }

            const zkb = pack.zkb;
            if (!zkb || !zkb.href) continue;

            // 2. Fetch Full Killmail from ESI
            const esiKillResponse = await axios.get(zkb.href);
            const killmail = esiKillResponse.data;

            // 3. Centralized Name Resolution (Do it once!)
            const systemInfo = esi.getSystemDetails(killmail.solar_system_id);
            const victim = killmail.victim;
            const finalBlow = killmail.attackers.find(a => a.final_blow) || killmail.attackers[0];

            const [shipName, victimName, victimCorp, attackerName, attackerCorp] = await Promise.all([
                esi.getTypeName(victim.ship_type_id),
                esi.getCharacterName(victim.character_id),
                esi.getCorporationName(victim.corporation_id),
                esi.getCharacterName(finalBlow?.character_id),
                esi.getCorporationName(finalBlow?.corporation_id)
            ]);

            const resolvedNames = {
                shipName,
                victimName,
                victimCorp,
                attackerName,
                attackerCorp,
                systemName: systemInfo.name,
                regionName: systemInfo.regionName
            };

            // 4. Emit to Socket
            io.emit('raw-kill', {
                id: pack.killID,
                val: Number(zkb.totalValue),
                ship: shipName,
                system: systemInfo.name,
                victimName,
                attackerName
            });

            // 5. Pass to Intel Handler (Pass resolvedNames to avoid double-fetching)
            await handlePrivateIntel(killmail, zkb, resolvedNames);

            stats.scanCount++;

        } catch (err) {
            const delay = err.response?.status === 429 ? 5000 : 2000;
            console.error(`❌ Loop Error: ${err.message}`);
            await new Promise(res => setTimeout(res, delay));
        }
    }
}


async function handlePrivateIntel(kill, zkb) {
    // 1. Setup our Threshold inside this function too
    const WHALE_THRESHOLD = 20000000000; 
    const rawValue = Number(zkb.totalValue) || 0;
    const formattedValue = helpers.formatIsk(rawValue);

    console.log(`🔍 DEBUG: System: ${kill.solar_system_id} | Value: ${formattedValue}`);

    try {
        const names = {
            shipName: await esi.getTypeName(kill.victim?.ship_type_id),
            systemName: esi.getSystemDetails(kill.solar_system_id)?.name || "Unknown System"
        };

        // TRACK A: Discord Intel (Gated by Mapper)
        if (mapper.isSystemRelevant(kill.solar_system_id)) {
            const metadata = mapper.getSystemMetadata(kill.solar_system_id);
            names.corpName = await esi.getCorporationName(kill.victim?.corporation_id);
            names.charName = await esi.getCharacterName(kill.victim?.character_id);
            names.scoutName = metadata ? metadata.scannedBy : "Unknown Scout";
            names.isAdjacent = metadata ? metadata.isAdjacent : false;

            const tripwireUrl = `https://tw.torpedodelivery.com/?system=${encodeURIComponent(names.systemName)}`;
            const payload = EmbedFactory.createKillEmbed(kill, zkb, names, tripwireUrl);
            
            if (process.env.INTEL_WEBHOOK_URL) {
                await axios.post(process.env.INTEL_WEBHOOK_URL, payload);
                console.log(`✅ [DISCORD] Intel Posted: ${names.shipName} (${formattedValue})`);
            }
        }
        if (rawValue >= WHALE_THRESHOLD) {
            console.log(`🐋 WHALE DETECTED: ${formattedValue}! Tweeting...`);
            TwitterService.postWhale(names, formattedValue, kill.killmail_id);
        }

    } catch (err) {
        console.error("❌ Error in handlePrivateIntel:", err.message);
    }
}

// Send report every 24 hours
setInterval(() => {
    HeartbeatService.sendReport(process.env.INTEL_WEBHOOK_URL, stats, mapper, esi);
    stats.scanCount = 0; // Reset counter for the new day
},  24 * 60 * 60 * 1000);

