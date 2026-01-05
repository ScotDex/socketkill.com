require('dotenv').config();
const axios = require('axios');
const path = require('path');
const ESIClient = require('./esi');
const MapperService = require('./mapper');
const EmbedFactory = require('./embedFactory');
const TwitterService = require('./twitterService');
const helpers = require('./helpers')

const esi = new ESIClient("Contact: @YourName");
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

    listeningStream();
})();



const QUEUE_ID = process.env.ZKILL_QUEUE_ID || 'Wingspan-TW-Monitor';
const REDISQ_URL = `https://zkillredisq.stream/listen.php?queueID=${QUEUE_ID}`;


let scanCount = 0;
async function listeningStream() {
    const WHALE_THRESHOLD = 20000000000;
    console.log(`📡 Listening to zKillboard Queue: ${QUEUE_ID}`);
    
    while (true) {
        try {
            const response = await axios.get(REDISQ_URL, { timeout: 15000 });
            const data = response.data;

            if (data && data.package) {
                const zkb = data.package.zkb;
                const rawValue = Number(zkb.totalValue) || 0;

                console.log(`📥 Package received. Fetching killmail details from ESI...`);
                const esiResponse = await axios.get(zkb.href);
                const killmail = esiResponse.data; 
                
                scanCount++;

                const isWhale = rawValue >= WHALE_THRESHOLD;

                if (isWhale || (isWormholeSystem(killmail.solar_system_id) && killmail.solar_system_id !== THERA_ID && mapper.isSystemRelevant(killmail.solar_system_id))) {
                    console.log(`🎯 TARGET MATCH: Kill ${data.package.killID} in system ${killmail.solar_system_id}`);
                    await handlePrivateIntel(killmail, zkb);
                } else {
                    if (scanCount % 500 === 0) {
                        console.log(`🛡️  Gatekeeper: ${scanCount} total kills scanned. Discarding kill in system ${killmail.solar_system_id}...`);
                    }
                }
            } else {
                console.log("⏳ RedisQ: No new kills (10s poll). Polling again...");
            }
        } catch (err) {
            const delay = err.response?.status === 429 ? 2000 : 5000;
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

        // TRACK B: Twitter Whale (Universal - NO Mapper Gate!)
        if (rawValue >= WHALE_THRESHOLD) {
            console.log(`🐋 WHALE DETECTED: ${formattedValue}! Tweeting...`);
            TwitterService.postWhale(names, formattedValue, kill.killmail_id);
        }

    } catch (err) {
        console.error("❌ Error in handlePrivateIntel:", err.message);
    }
}