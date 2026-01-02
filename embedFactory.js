class EmbedFactory {
    static createKillEmbed(kill, zkb, enrichedData) {
        const totalValue = zkb.totalValue ? (zkb.totalValue / 1000000).toFixed(2) : "0.00";
        return {
            title: `💥 ${enrichedData.shipName || 'Unknown Ship'} | ${totalValue}m ISK`,
            description: `**Victim:** ${enrichedData.charName} (${enrichedData.corpName})`,
            url: `https://zkillboard.com/kill/${kill.killmail_id}/`,
            color: this._getSecurityColor(enrichedData.systemSecurity),
            fields: [
                { name: "System", value: enrichedData.systemName, inline: true },
                { name: "Region", value: enrichedData.regionName || "Unknown", inline: true },
            ],
            footer: { text: "Jeff the Kill Bot" },
            timestamp: new Date().toISOString()
        };
    }

static _getSecurityColor(sec) {
        if (sec >= 0.5) return 0x2ecc71; // Green (Highsec)
        if (sec > 0.0) return 0xf1c40f;  // Yellow (Lowsec)
        return 0xe74c3c;                // Red (Nullsec/J-Space)
    }
}

module.exports = EmbedFactory;