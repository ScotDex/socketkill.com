require('dotenv').config();
const axios = require ('axios')
const ESIClient = require ('./esi')
const esi = new ESIClient("Contact Info");
const EmbedFactory = require('./embedFactory');
const path = require('path');

const BIG_KILL_THRESHOLD = Number(process.env.MIN_ISK_FOR_BIG_KILL) || 1000000000;


;(async () => {
    console.log("Intializing Intel");
    const cachePath = path.join(__dirname, 'data', 'esi_cache.json');
    console.log(`📂 Looking for cache at: ${cachePath}`);

    const systemsLoaded = await esi.loadSystemCache('./data/systems.json');
    
    if (systemsLoaded) {
        console.log("🌌 Universe Map Loaded.");
    }
    
    await esi.loadCache(cachePath);
    console.log("Engine Ready");
    axios.post(process.env.INTEL_WEBHOOK_URL, { content: "🛰️ Intel Bot Online and Connected!" })
  .then(() => console.log("Test Ping Sent!"))
  .catch(err => console.error("Test Ping Failed:", err.message));
    listeningStream();})();


const QUEUE_ID = "Wingspan_Private_Intel_Bot_2025";
const REDISQ_URL = `https://zkillredisq.stream/listen.php?queueID=${QUEUE_ID}`;

async function listeningStream() {
    console.log("Starting Listening Stream")
    
    while (true) {
        try {
            const response = await axios.get(REDISQ_URL, { timeout: 15000 }); 
            const data = response.data;

            if (!data.package) {
                console.log("Empty package received (Waiting for kills...)");
            }

            if (data.package) {
                console.log(`📦 Received Killmail ${data.package.killID}`);
                const { killID, zkb } = data.package;

                const esiData = await axios.get(zkb.href);
                const fullKillmail = esiData.data;

                handlePrivateIntel(fullKillmail, zkb);
            }
        } catch (err) {
            if (err.response?.status === 429){
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.error("❌ RedisQ Connection Error:", err.message);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        
        }
    }
}

async function handlePrivateIntel(kill, zkb) {
    try {
        // 1. Gather Names
        const names = {
            shipName: await esi.getTypeName(kill.victim?.ship_type_id),
            corpName: await esi.getCorporationName(kill.victim?.corporation_id),
            charName: await esi.getCharacterName(kill.victim?.character_id),
            systemName: esi.getSystemDetails(kill.solar_system_id)?.name || "Unknown System"
        };

        // 2. Generate the payload via Factory
        const payload = EmbedFactory.createKillEmbed(kill, zkb, names);

        // 3. Strict Mathematical Comparison
        // We use the pre-converted Number here to ensure accuracy
        const totalValue = zkb.totalValue || 0;
        const isBigKill = totalValue >= BIG_KILL_THRESHOLD;

        // 4. Route to the correct hook
        const targetWebhook = isBigKill 
            ? process.env.BIG_KILLS_WEBHOOK_URL 
            : process.env.INTEL_WEBHOOK_URL;

        // 5. Fire the Webhook
        if (targetWebhook) {
            await axios.post(targetWebhook, payload);
            console.log(`✅ ${isBigKill ? '[BIG KILL]' : '[INTEL]'} ${names.shipName} (${(totalValue/1000000).toFixed(2)}M)`);
        }

    } catch (err) {
        if (err.response?.status === 429) {
            console.warn("⚠️ Discord Webhook Rate Limited.");
        } else {
            console.error("❌ Error in handlePrivateIntel:", err.message);
        }
    }
}
