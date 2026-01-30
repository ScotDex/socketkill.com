module.exports = {
    fromR2: (data) => {
        if (!data) return null;

        // 1. Identification: Look in the root, 'zkill', or 'zkb' blocks
        const killID = data.killmail_id || data.zkill?.killID || data.zkb?.killID;
        const hash = data.hash || data.zkill?.zkb?.hash || data.zkb?.hash;
        const totalValue = data.zkill?.zkb?.totalValue || data.zkb?.totalValue || data.totalValue || 0;

        // 2. ESI Data Extraction: Navigate the 'esi' nesting
        // Note: Sometimes it's data.esi, sometimes it's data.esi.esi
        const esiPayload = data.esi?.esi ? data.esi.esi : (data.esi || data);

        // Validation: If we don't have a Kill ID, we can't process it.
        if (!killID) {
            return null;
        }

        return {
            killID: killID,
            zkb: {
                totalValue: totalValue,
                // Construct link using root or zkb data
                href: hash ? `https://esi.evetech.net/latest/killmails/${killID}/${hash}/` : null
            },
            isR2: true,
            esiData: esiPayload 
        };
    }
};