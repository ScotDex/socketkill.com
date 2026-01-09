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
    const WHALE_THRESHOLD = 20000000000;
    console.log(`📡 Listening to zKillboard Queue: ${QUEUE_ID}`);
    
    while (true) {
        try {
            const response = await axios.get(REDISQ_URL, { timeout: 15000 });
            // FIX 1: Correctly define 'pack' from response.data
            const pack = response.data?.package; 

            if (pack && pack.zkb) {
                const zkb = pack.zkb;

                // FIX 2: REQUIRED FETCH for Dec 2025 RedisQ Change
                // Package no longer contains 'killmail' object; must fetch from href
                const esiResponse = await axios.get(zkb.href);
                const killmail = esiResponse.data;
                const victim = killmail.victim;

                // FIX 3: Define systemInfo before using it in emit
                // Uses your Mapper to get Name and Region (fixing the undefined error)
                const systemInfo = mapper.getSystem(killmail.solar_system_id) || 
                                   { name: "Unknown", regionName: "Unknown" };

                // Logic for Final Blow
                const finalBlowAttacker = killmail.attackers.find(a => a.final_blow === true) || killmail.attackers[0];

                // Parallel lookups for all required display fields
                const [shipName, victimName, victimCorp, attackerName, attackerCorp] = await Promise.all([
                    esi.getTypeName(victim.ship_type_id),
                    esi.getCharacterName(victim.character_id),
                    esi.getCorporationName(victim.corporation_id),
                    esi.getCharacterName(finalBlowAttacker?.character_id),
                    esi.getCorporationName(finalBlowAttacker?.corporation_id)
                ]);

                // Emit the data the frontend expects
                io.emit('raw-kill', {
                    id: pack.killID,
                    val: Number(zkb.totalValue),
                    ship: shipName,
                    shipId: victim.ship_type_id,
                    system: systemInfo.name,
                    region: systemInfo.regionName, // Prevents (undefined) on UI
                    victimName: victimName || "Unknown Pilot",
                    victimCorp: victimCorp || "Unknown Corp",
                    attackerName: attackerName || "NPC / Unknown",
                    attackerCorp: attackerCorp || ""
                });

                // Update counters and trigger hunt logic
                stats.scanCount++;
                scanCount++;
                const rawValue = Number(zkb.totalValue);
                const isWhale = rawValue >= WHALE_THRESHOLD;

                if (isWhale || (isWormholeSystem(killmail.solar_system_id) && 
                    killmail.solar_system_id !== THERA_ID && 
                    mapper.isSystemRelevant(killmail.solar_system_id))) {
                    
                    console.log(`🎯 TARGET MATCH: Kill ${pack.killID}`);
                    await handlePrivateIntel(killmail, zkb);
                } else {
                    if (scanCount % 500 === 0) {
                        console.log(`🛡️ Gatekeeper: ${scanCount} total kills scanned.`);
                    }
                }
            } else {
                console.log("⏳ RedisQ: No new kills (10s poll).");
            }
        } catch (err) {
            // Error handling for 429 rate limits or network timeouts
            const delay = err.response?.status === 429 ? 5000 : 2000;
            console.error(`❌ Error: ${err.message}`);
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

