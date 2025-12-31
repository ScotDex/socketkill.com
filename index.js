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
        const killID = kill.killmail_id;
        const victim = kill.victim;

        // Use the ESIClient to translate IDs to Names
        // This leverages your RAM Map first, then ESI
        const shipName = await esi.getTypeName(victim?.ship_type_id);
        const corpName = await esi.getCorporationName(victim?.corporation_id);
        const charName = await esi.getCharacterName(victim?.character_id);

        // Translate the System ID using your staticUniverseData
        const system = esi.getSystemDetails(kill.solar_system_id);
        const systemName = system ? system.name : `System ${kill.solar_system_id}`;

        const totalValue = zkb.totalValue ? (zkb.totalValue / 1000000).toFixed(2) : "0.00";

        console.log(`\n--- NEW KILL DETECTED ---`);
        console.log(`Victim:  ${charName} (${corpName})`);
        console.log(`Ship:    ${shipName}`);
        console.log(`System:  ${systemName}`);
        console.log(`Value:   ${totalValue} Million ISK`);
        console.log(`URL:     https://zkillboard.com/kill/${killID}/`);
        console.log(`---------------------------\n`);
        
    } catch (err) {
        console.error("❌ Error translating killmail:", err.message);
    }
}

