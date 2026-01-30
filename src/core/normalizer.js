module.exports = {
    fromR2: (r2Data) => {
        if (!r2Data) return null;

        // Extract IDs regardless of nesting
        const killID = r2Data.killID || (r2Data.zkill ? r2Data.zkill.killID : null);
        const killmail_id = r2Data.killmail_id || (r2Data.esi ? r2Data.esi.killmail_id : null);
        const hash = r2Data.hash || (r2Data.zkill ? r2Data.zkill.zkb.hash : null);
        const totalValue = r2Data.totalValue || (r2Data.zkill ? r2Data.zkill.zkb.totalValue : 0);

        if (!killID || !killmail_id) {
            return null;
        }

        return {
            killID: killID,
            zkb: {
                totalValue: totalValue,
                href: `https://esi.evetech.net/latest/killmails/${killmail_id}/${hash}/`
            },
            isR2: true,
            // Pass the whole object as esiData so the processor finds what it needs
            esiData: r2Data 
        };
    }
};