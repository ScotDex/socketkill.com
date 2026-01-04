require('dotenv').config();
const axios = require('axios');
const path = require('path');
const ESIClient = require('./esi');
const MapperService = require('./mapper');
const EmbedFactory = require('./embedFactory');

const esi = new ESIClient("Contact: @YourName");
const mapper = new MapperService('http://api.deliverynetwork.space/data');

const isWormholeSystem = (systemId) => {
    return systemId >= 31000001 && systemId <= 32000000;
};

;(async () => {
    console.log("Initializing Tripwire Kill Monitor...");
    await esi.loadSystemCache('./data/systems.json');
    await esi.loadCache(path.join(__dirname, 'data', 'esi_cache.json'));

    await mapper.refreshChain(esi.getSystemDetails.bind(esi));
    await triggerAdjacentTestKill();
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
    console.log(`📡 Listening to zKillboard Queue: ${QUEUE_ID}`);
    
    while (true) {
        try {
            const response = await axios.get(REDISQ_URL, { timeout: 15000 });
            const data = response.data;

            if (data && data.package) {
                const zkb = data.package.zkb;
                
                console.log(`📥 Package received. Fetching killmail details from ESI...`);
                
                const esiResponse = await axios.get(zkb.href);
                const killmail = esiResponse.data; 
                
                scanCount++;

                if (isWormholeSystem(killmail.solar_system_id) && mapper.isSystemRelevant(killmail.solar_system_id)) {
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
    if (!mapper.isSystemRelevant(kill.solar_system_id)) {
        return; 
    }

    try {

        const metadata = mapper.getSystemMetadata(kill.solar_system_id);
        const names = {
            shipName: await esi.getTypeName(kill.victim?.ship_type_id),
            corpName: await esi.getCorporationName(kill.victim?.corporation_id),
            charName: await esi.getCharacterName(kill.victim?.character_id),
            systemName: esi.getSystemDetails(kill.solar_system_id)?.name || "Unknown System",
            scoutName: metadata ? metadata.scannedBy : "Unknown Scout", // Added this
            isAdjacent: metadata ? metadata.isAdjacent : false
        };

        const tripwireUrl = `https://tw.torpedodelivery.com/?system=${encodeURIComponent(names.systemName)}`;

        const payload = EmbedFactory.createKillEmbed(kill, zkb, names, tripwireUrl);
        const totalValue = (zkb.totalValue / 1000000).toFixed(2);
        const targetWebhook = process.env.INTEL_WEBHOOK_URL;

        if (targetWebhook) {
            await axios.post(targetWebhook, payload);
            console.log(`✅ [INTEL] Posted: ${names.shipName} kill in ${names.systemName} (${totalValue}M ISK)`);
        }

    } catch (err) {
        if (err.response?.status === 404) {
            console.error("❌ Webhook Error: Your INTEL_WEBHOOK_URL in .env returned a 404. Check the link!");
        } else {
            console.error("❌ Error in handlePrivateIntel:", err.message);
        }
    }
}

async function triggerAdjacentTestKill() {
    // 1. Pick a system you KNOW is scanned (e.g., J1151 / 31001151)
    const knownScannedSystem = 31001151;

    // 2. Pick a "Ghost ID" that is definitely NOT scanned (e.g., 999999)
    const ghostSystemID = 999999;

    // 3. MANUALLY tell the mapper they are connected for this test
    // This bypasses the API data just to test the Embed Label
    if (!mapper.adjacencies.has(ghostSystemID)) {
        mapper.adjacencies.set(ghostSystemID, new Set([knownScannedSystem]));
    }

    const mockKillmail = {
        killmail_id: 99999,
        solar_system_id: ghostSystemID, // The Ghost ID
        victim: { character_id: 1, ship_type_id: 11987 }
    };

    console.log(`🧪 TESTING GHOST ADJACENCY: Kill in ${ghostSystemID} connected to ${knownScannedSystem}`);
    await handlePrivateIntel(mockKillmail, { totalValue: 500000000 });
}