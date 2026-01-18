const axios = require("../network/agent");
 
const resolveFullIntel = async (io, esi, pkg) => {
    try {
        const zkb = pkg.zkb;
        const esiResponse = await axios.get(zkb.href);
        const killmail = esiResponse.data;
        // 1. Execute the blocking ESI calls here
        // This is where the 500ms-2000ms delay happens, safely away from the main loop
        const [shipName, charName] = await Promise.all([
            esi.getTypeName(killmail.victim.ship_type_id),
            esi.getCharacterName(killmail.victim?.character_id),
        ]);

        // 2. Spatial lookup (Using your repaired local JSON via the esi client)
        const systemId = killmail.solar_system_id;
        const systemDetails = esi.systemCache[systemId]; 
        const systemName = systemDetails?.name || "Unknown System";
        
        // 3. Resolve Region Name (Cached lookup)
        const regionName = systemDetails 
            ? await esi.getRegionName(systemDetails.region_id) 
            : "K-Space";

        // 4. UPDATE THE UI
        // We use a specific event name so the frontend knows to "fill in" the text
        io.emit("update-kill", {
            id: zkb.killID,
            ship: shipName,
            system: systemName,
            region: regionName,
            victimName: charName,
            locationLabel: `System: ${systemName} | Region: ${regionName}`
        });

        console.log(`[Sidecar] Resolved Intel for Kill ${zkb.killID}`);

    } catch (err) {
        console.error(`⚠️ [Sidecar] Resolution Failed: ${err.message}`);
    }
};

module.exports = resolveFullIntel;