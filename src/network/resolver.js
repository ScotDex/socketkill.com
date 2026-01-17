
// src/network/resolver.js
const axios = require("./agent"); // This MUST point to your persistent agent file

module.exports = async function resolveKillData(killmail, esi, axios) {
    try {
        // 1. Parallel Resolution
        const [shipName, systemDetails, charName] = await Promise.all([
            esi.getTypeName(killmail.victim.ship_type_id),
            esi.getSystemDetails(killmail.solar_system_id),
            esi.getCharacterName(killmail.victim?.character_id),
        ]);

        const systemName = systemDetails ? systemDetails.name : "Unknown System";
        const constellationId = systemDetails ? systemDetails.constellation_id : null;
        let regionName = "K-Space";

        // 2. Region Resolution
        if (constellationId) {
            try {
                const constellationReq = await axios.get(
                    `https://esi.evetech.net/latest/universe/constellations/${constellationId}/`
                );
                regionName = await esi.getRegionName(constellationReq.data.region_id);
            } catch (err) {
                console.error(`[RESOLVER] Region lookup failed`);
            }
        }

        // Return the enriched data back to the loop
        return {
            shipName,
            systemName,
            regionName,
            charName,
            systemDetails
        };
    } catch (err) {
        console.error(`[RESOLVER ERROR]: ${err.message}`);
        return null;
    }
};