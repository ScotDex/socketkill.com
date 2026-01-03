require('dotenv').config();
const axios = require('axios');
const path = require('path');
const ESIClient = require('./esi');
const MapperService = require('./mapper');
const EmbedFactory = require('./embedFactory');

const esi = new ESIClient("Contact: @YourName");
const mapper = new MapperService('http://api.deliverynetwork.space/data');

;(async () => {
    console.log("🚀 Initializing Tripwire Kill Monitor...");
    await esi.loadSystemCache('./data/systems.json');
    await esi.loadCache(path.join(__dirname, 'data', 'esi_cache.json'));

    await mapper.refreshChain(esi.getSystemDetails.bind(esi));
    console.log("🌌 Universe Map & Chain Loaded.");

    // 3. Background Sync (Every 1 minute)
    setInterval(() => {
        mapper.refreshChain(esi.getSystemDetails.bind(esi));
    }, 1 * 60 * 1000);

    // 4. Start the Engine
    axios.post(process.env.INTEL_WEBHOOK_URL, { content: "Intel Bot Online and Filtering Chain!" })
        .catch(err => console.error("Test Ping Failed:", err.message));

    listeningStream();
})();



const REDISQ_URL = `https://zkillredisq.stream/listen.php?queueID=Wingspan_Intel_2025`;

async function listeningStream() {
    while (true) {
        try {
            const response = await axios.get(REDISQ_URL, { timeout: 15000 });
            const data = response.data;

            if (data && data.package) {
                const killmail = data.package.killmail;
                const zkb = data.package.zkb;
                if (mapper.isInChain(killmail.solar_system_id)) {
                    console.log(`🎯 TARGET in chain: Kill ${data.package.killID}`);
                    await handlePrivateIntel(killmail, zkb);
                }
            }
        } catch (err) {
            const delay = err.response?.status === 429 ? 2000 : 5000;
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

async function handlePrivateIntel(kill, zkb) {
    if (!mapper.isInChain(kill.solar_system_id)) {
        return; 
    }

    try {
        const names = {
            shipName: await esi.getTypeName(kill.victim?.ship_type_id),
            corpName: await esi.getCorporationName(kill.victim?.corporation_id),
            charName: await esi.getCharacterName(kill.victim?.character_id),
            systemName: esi.getSystemDetails(kill.solar_system_id)?.name || "Unknown System"
        };

        const payload = EmbedFactory.createKillEmbed(kill, zkb, names);
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
