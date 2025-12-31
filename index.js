const axios = require ('axios')
const ESIClient = require ('./esi')
const esi = new ESIClient("Contact Info");
const path = require('path');

(async () => {
    console.log("Intializing Intel");
    const cachePath = path.join(__dirname, 'esi_cache.json');
    console.log(`📂 Looking for cache at: ${cachePath}`);
    
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

function handlePrivateIntel(kill, zkb) {
    const killID = kill.killmail_id;
    const time = kill.killmail_time;
    
    // Victim Data from ESI
    const victim = kill.victim;
    const shipID = victim?.ship_type_id || "Unknown";
    const damageTaken = victim?.damage_taken?.toLocaleString() || 0;
    
    // Stats from zKill (zkb object)
    const totalValue = zkb.totalValue ? (zkb.totalValue / 1000000).toFixed(2) : "0.00";
    const labels = zkb.labels ? zkb.labels.join(', ') : "None";
    
    // Logic for "Big Kill" highlighting (e.g., over 1 Billion ISK)
    const color = zkb.totalValue > 1000000000 ? '\x1b[31m' : '\x1b[32m'; // Red for 1B+, Green for others
    const reset = '\x1b[0m';

    console.log(`\n--- ${color}NEW KILL DETECTED${reset} ---`);
    console.log(`ID:      ${killID}`);
    console.log(`Ship ID: ${shipID}`);
    console.log(`Value:   ${totalValue} Million ISK`);
    console.log(`Damage:  ${damageTaken}`);
    console.log(`Labels:  [${labels}]`);
    console.log(`URL:     https://zkillboard.com/kill/${killID}/`);
    console.log(`---------------------------\n`);
}

