class EmbedFactory {
    static createKillEmbed(kill, zkb, names, tripwireUrl) {
        // 1. Calculate the ISK value in Millions
        const totalValue = zkb.totalValue ? (zkb.totalValue / 1000000).toFixed(2) : "0.00";

        // 2. CCP Image Server URL for Ship Renders
        const shipIcon = `https://images.evetech.net/types/${kill.victim.ship_type_id}/render?size=128`;

        return {
            // FIXED: Removed isBigKill check
            username: "Chain Intel Feed", 
            avatar_url: "https://images.evetech.net/types/605/icon",
            embeds: [{
                author: {
                    name: `${names.charName} lost a ${names.shipName}`,
                    icon_url: `https://images.evetech.net/characters/${kill.victim.character_id}/portrait?size=64`
                },
                title: `Killboard Link`,
                url: `https://zkillboard.com/kill/${kill.killmail_id}/`,
                description: `**[Open System in Tripwire](${tripwireUrl})**`,
                thumbnail: { url: shipIcon }, 
                color: 0xf39c12, 
                fields: [
                    { name: "Value", value: `**${totalValue}M ISK**`, inline: true },
                    { name: "System", value: `**${names.systemName}**`, inline: true },
                    { name: "Corporation", value: names.corpName, inline: false },
                    { name: "Chain Owner", value: `**${names.scoutName}**`, inline: true }
                ],
                footer: { text: `WiNGSPAN Delivery Service • ${new Date().toLocaleTimeString()}` }
            }]
        };
    }
}

module.exports = EmbedFactory;