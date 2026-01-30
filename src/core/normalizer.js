module.exports = {
    fromR2: (r2Data) => {
        // Strict Check: Ensure both wrapper keys exist
        if (!r2Data || !r2Data.zkill || !r2Data.esi) {
            return null;
        }

        const zkb = r2Data.zkill.zkb || {};
        
        return {
            // Map from the zkill block
            killID: r2Data.zkill.killID,
            
            zkb: {
                totalValue: zkb.totalValue || 0,
                // Construct the ESI link using both blocks
                href: `https://esi.evetech.net/latest/killmails/${r2Data.esi.killmail_id}/${zkb.hash}/`
            },

            isR2: true,
            // Pass the ESI block as the primary data source for the processor
            esiData: r2Data.esi 
        };
    }
};