class EmbedFactory {
    static createKillEmbed(kill, zkb, names) {
        const totalValue = zkb.totalValue ? (zkb.totalValue / 1000000).toFixed(2) : "0.00";
        const isBigKill = zkb.totalValue >= (process.env.MIN_ISK_FOR_BIG_KILL || 1000000000);

        // CCP Image Server URL for Ship Renders
        const shipIcon = `https://images.evetech.net/types/${kill.victim.ship_type_id}/render?size=128`;

        return {
            username: isBigKill ? "🚨 Big Kill" : "Intel Feed",
            avatar_url: "https://images.evetech.net/types/605/icon",
            embeds: [{
                author: {
                    name: `${names.charName} lost a ${names.shipName}`,
                    icon_url: `https://images.evetech.net/characters/${kill.victim.character_id}/portrait?size=64`
                },
                title: `Killboard Link`,
                url: `https://zkillboard.com/kill/${kill.killmail_id}/`,
                thumbnail: { url: shipIcon }, // Adds the 3D ship render to the right side
                color: isBigKill ? 0xe74c3c : 0x3498db, // Red for big kills, Blue for standard
                fields: [
                    { name: "💰 Value", value: `**${totalValue}M ISK**`, inline: true },
                    { name: "📍 System", value: `**${names.systemName}**`, inline: true },
                    { name: "🏢 Corporation", value: names.corpName, inline: false }
                ],
                footer: { text: `Kill Stream Delivery • ${new Date().toLocaleTimeString()}` }
            }]
        };
    }
}

module.exports = EmbedFactory;