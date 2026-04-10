const helpers = require('../core/helpers');

const IS_COMPONENTS_V2 = 1 << 15;

class NewsEmbedFactoryV2 {
    static createEmbed(kill, zkb, names, category) {
        // Use your helper for that clean "1.25B" look
        const totalValue = helpers.formatIsk(names.rawValue);
        const article = helpers.getArticle(names.shipName);

        // Dynamic color based on category/value
        let accentColor = 0x3fb950; // Default Socket.Kill Green
        if (category === 'officer' || category === 'at_ships') accentColor = 0xa335ee; // Epic/Purple
        if (names.rawValue >= 10000000000) accentColor = 0xf1c40f; // Legendary/Gold

        return {
            username: "Socket.Kill Intel",
            avatar_url: "https://edge.socketkill.com/favicon.png",
            flags: IS_COMPONENTS_V2,
            components: [
                {
                    type: 17, // Section Container
                    accent_color: accentColor,
                    components: [
                        // HEADER SECTION: Victim and Ship info
                        {
                            type: 9,
                            components: [
                                {
                                    type: 10,
                                    content: `## ${names.finalVictimName} lost ${article} ${names.shipName}\n**Corp:** ${names.corpName}`
                                }
                            ],
                            accessory: {
                                type: 11,
                                media: {
                                    url: `https://images.evetech.net/characters/${kill.victim.character_id}/portrait?size=128`
                                }
                            }
                        },
                        { type: 14, spacing: 1, divider: true },
                        // INTEL GRID: Tactical and Geographical data
                        {
                            type: 9,
                            components: [
                                {
                                    type: 10,
                                    content: `**Value**\n${totalValue} ISK\n\n**Attackers**\n${names.attackerCount}`,
                                },
                                {
                                    type: 10,
                                    content: `**Location**\n${names.systemName}\n\n**Region**\n${names.regionName}`
                                }
                            ],
                            accessory: {
                                type: 11,
                                media: {
                                    url: `https://images.evetech.net/types/${kill.victim.ship_type_id}/render?size=128`
                                }
                            }
                        },
                        // FOOTER: Attribution and "Trigger" context
                        { type: 14, spacing: 1, divider: false },
                        {
                            type: 10,
                            content: `-# **Final Blow:** ${names.finalBlowCorp} | <t:${Math.floor(Date.now() / 1000)}:R>`
                        }
                    ]
                },
                // ACTION ROW: Production-grade interaction
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 5,
                            label: "View on zKillboard",
                            url: `https://zkillboard.com/kill/${kill.killmail_id}/`
                        },
                        {
                            type: 2,
                            style: 5,
                            label: "External Fit",
                            url: `https://zkillboard.com/kill/${kill.killmail_id}/#fitting`
                        }
                    ]
                }
            ]
        };
    }
}

module.exports = NewsEmbedFactoryV2;