module.exports = {

    fromR2: (r2Data) => {
        return {
            killID: r2Data.zkill.killID,
            zkb: {
                totalValue: r2Data.zkill.zkb.totalValue,
                href: `https://esi.evetech.net/latest/killmails/${r2Data.esi.killmail_id}/${r2Data.zkill.zkb.hash}/`
            },

            isR2: true,
            esiData: r2Data.esi
        };
    }
};