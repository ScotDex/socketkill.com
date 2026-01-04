class EmbedFactory {
    static createKillEmbed(kill, zkb, names, tripwireUrl) {
        let totalValue;
        const rawValue = zkb.totalValue || 0;
        if (rawValue >= 1000000000) {
            totalValue = `${(rawValue / 1000000000).toFixed(2)}B`;
        } else {
            totalValue = `${(rawValue / 1000000).toFixed(2)}M`;
        }
        const shipIcon = `https://images.evetech.net/types/${kill.victim.ship_type_id}/render?size=128`;
        return {
            username: "Chain Intel", 
            avatar_url: "https://images.evetech.net/types/605/icon",
            embeds: [{
                author: {
                    name: `${names.charName} lost a ${names.shipName}`,
                    icon_url: `https://images.evetech.net/characters/${kill.victim.character_id}/portrait?size=64`
                },
                title: `Zkill Link`,
                url: `https://zkillboard.com/kill/${kill.killmail_id}/`,
                description: `**[Open System in Tripwire](${tripwireUrl})**`,
                thumbnail: { url: shipIcon }, 
                color: 0xf39c12, 
                fields: [
                    { name: "Value", value: `**${totalValue} ISK**`, inline: true },
                    { name: "System", value: `**${names.systemName}**`, inline: true },
                    { name: "Corporation", value: names.corpName, inline: false },
                    { name: names.isAdjacent ? " Adjacent Chain Owner" : "Chain Owner",
                        value: `**${names.scoutName}**`,
                        inline: true
                    }
                ],
                footer: { text: `WiNGSPAN Delivery Service • ${new Date().toLocaleTimeString()}` }
            }]
        };
    }
}

module.exports = EmbedFactory;