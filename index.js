const axios = require ('axios')
const ESIClient = require ('./esi')
const esi = new ESIClient("Contact Info");
const path = require('path');

(async () => {
    console.log("Intializing Intel");
    const cachePath = path.join(__dirname, 'data', 'esi_cache.json');
    console.log(`📂 Looking for cache at: ${cachePath}`);

    const systemsLoaded = await esi.loadSystemCache('./data/systems.json');
    
    if (systemsLoaded) {
        console.log("🌌 Universe Map Loaded.");
    }
    
    await esi.loadCache(cachePath);
    console.log("Engine Ready");
    listeningStream();})();


const QUEUE_ID = "Wingspan_Private_Intel_Bot_2025";
const REDISQ_URL = `https://zkillredisq.stream/listen.php?queueID=${QUEUE_ID}`;

async function listeningStream() {
    console.log("Starting Listening Stream")
    
    while (true) {
        try {
            const response = await axios.get(REDISQ_URL, { timeout: 15000 }); 
            const data = response.data;

            if (data.package) {
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
        // 1. Gather Names (Your existing ESI logic)
        const names = {
            shipName: await esi.getTypeName(kill.victim?.ship_type_id),
            corpName: await esi.getCorporationName(kill.victim?.corporation_id),
            charName: await esi.getCharacterName(kill.victim?.character_id),
            systemName: esi.getSystemDetails(kill.solar_system_id)?.name || "Unknown System"
        };

        // 2. Generate the payload via Factory
        const payload = EmbedFactory.createKillEmbed(kill, zkb, names);

        // 3. Determine which hook to use
        const isBigKill = zkb.totalValue >= process.env.MIN_ISK_FOR_BIG_KILL;
        const targetWebhook = isBigKill 
            ? process.env.BIG_KILLS_WEBHOOK_URL 
            : process.env.INTEL_WEBHOOK_URL;

        // 4. Fire the Webhook
        if (targetWebhook) {
            await axios.post(targetWebhook, payload);
            console.log(`✅ ${isBigKill ? '[BIG KILL]' : '[INTEL]'} Sent to Discord.`);
        }

    } catch (err) {
        if (err.response?.status === 429) {
            console.warn("⚠️ Discord Webhook Rate Limited. Skipping this kill.");
        } else {
            console.error("❌ Error in handlePrivateIntel:", err.message);
        }
    }
}
