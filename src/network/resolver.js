// This module handles the "Slow Path" without blocking the firehose
const resolveFullIntel = async (io, esi, killmail, zkb) => {
    try {
        // Parallel fetching to reduce wait time
        const [shipName, systemDetails, charName] = await Promise.all([
            esi.getTypeName(killmail.victim.ship_type_id),
            esi.getSystemDetails(killmail.solar_system_id),
            esi.getCharacterName(killmail.victim?.character_id),
        ]);

        // Broadcast the "Update" to the UI to fill in the names
        io.emit("update-kill", {
            id: killmail.killmail_id || zkb.killID,
            ship: shipName,
            system: systemDetails?.name || "Unknown",
            victimName: charName
        });

        // Trigger the "Heavy" social logic (Discord/Twitter)
        // These are also awaited here so they don't lag the main loop
        await handlePrivateIntel(killmail, zkb); 

    } catch (err) {
        console.error("Sidecar Resolution Failed:", err.message);
    }
};

module.exports = resolveFullIntel;