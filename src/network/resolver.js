/**
 * src/network/resolver.js
 */
module.exports = async function resolveKillData(pkg, esi, axios) {
    try {
        // The package from zKill contains 'killmail' and 'zkb'
        const killmail = pkg.killmail; 
        const killID = pkg.killID;

        if (!killmail) throw new Error("Killmail data missing in package");

        // Now killmail is defined for the rest of the function
        const [shipName, systemDetails, charName] = await Promise.all([
            esi.getTypeName(killmail.victim.ship_type_id),
            esi.getSystemDetails(killmail.solar_system_id),
            esi.getCharacterName(killmail.victim?.character_id),
        ]);

        const systemName = systemDetails ? systemDetails.name : "Unknown System";
        const constellationId = systemDetails ? systemDetails.constellation_id : null;
        let regionName = "K-Space";

        if (constellationId) {
            const constellationReq = await axios.get(
                `https://esi.evetech.net/latest/universe/constellations/${constellationId}/`
            );
            regionName = await esi.getRegionName(constellationReq.data.region_id);
        }

        return { shipName, systemName, regionName, charName, systemDetails, killID };
    } catch (err) {
        console.error(`[RESOLVER INTERNAL ERROR]: ${err.message}`);
        return null;
    }
};