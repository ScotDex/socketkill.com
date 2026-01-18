const axios = require('../network/agent');

const resolveFullIntel = async (io, esi, pkg, mapper) => {
    try {
        const zkb = pkg.zkb;
        
        // 🐢 THE HEAVY LIFT: Fetch the killmail data CCP-side in the background
        const esiResponse = await axios.get(zkb.href);
        const killmail = esiResponse.data;

        // 1. Parallel ESI Lookups (Dynamic Data)
        const [shipName, charName] = await Promise.all([
            esi.getTypeName(killmail.victim.ship_type_id),
            esi.getCharacterName(killmail.victim?.character_id),
        ]);

        // 2. Spatial lookup from your repaired local JSON
        const systemId = killmail.solar_system_id;
        const systemDetails = esi.systemCache ? esi.systemCache[systemId] : null; 
        const systemName = systemDetails?.name || "Unknown System";
        
        // 3. Resolve Region Name (Cached lookup)
        const regionName = systemDetails 
            ? await esi.getRegionName(systemDetails.region_id) 
            : "K-Space";

        // 4. UI UPDATE
        // This 'patches' the 5ms ghost-row with real names
        io.emit("update-kill", {
            id: zkb.killID,
            ship: shipName,
            system: systemName,
            region: regionName,
            victimName: charName,
            locationLabel: `System: ${systemName} | Region: ${regionName}`
        });

        // 5. SOCIAL/INTEL (Handle Discord/Twitter here if needed)
        // ... call handlePrivateIntel(killmail, zkb) here ...

    } catch (err) {
        console.error(`⚠️ [Sidecar] Resolution Failed: ${err.message}`);
    }
};

module.exports = resolveFullIntel;