module.exports = {
    fromR2: (data) => {
        if (!data) return null;

        // 1. Identification: R2 uses 'killmail_id' at the root
        const killID = data.killmail_id || data.zkb?.killID || data.zkill?.killID;
        const hash = data.hash || data.zkb?.hash;
        
        // 2. Value Extraction: Root 'zkb' block is the source of truth now
        const totalValue = data.zkb?.totalValue || data.zkill?.zkb?.totalValue || 0;

        // 3. ESI Data Extraction: 
        // In your R2 dump, 'victim' and 'attackers' are at the ROOT.
        // We check if 'victim' exists at root; if not, we check 'esi' wrapper.
        const esiPayload = data.victim ? data : (data.esi || data);

        if (!killID) return null;

        return {
            killID: killID,
            zkb: {
                totalValue: totalValue,
                href: hash ? `https://esi.evetech.net/latest/killmails/${killID}/${hash}/` : null,
                // Add useful metadata from your R2 dump
                isNPC: data.zkb?.npc || false,
                labels: data.zkb?.labels || []
            },
            isR2: true,
            esiData: esiPayload,
            sequence: data.sequence_id // Good for tracking lag
        };
    }
};