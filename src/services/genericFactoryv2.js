const helpers = require('../core/helpers');

const IS_COMPONENTS_V2 = 1 << 15;

class NewsEmbedFactoryV2 {
    static createEmbed(kill, zkb, names, category) {
        const totalValue = helpers.formatIsk(names.rawValue);
        const article = helpers.getArticle(names.shipName);
        const zkillUrl = `https://zkillboard.com/kill/${kill.killmail_id}/`;

        let accentColor = 0x3fb950;
        if (names.rawValue >= 10_000_000_000) accentColor = 0xf1c40f;
        if (category === 'officer' || category === 'at_ships') accentColor = 0xa335ee;

        return {
            username: "Socket.Kill Intel",
            avatar_url: "https://edge.socketkill.com/favicon.png",
            flags: IS_COMPONENTS_V2,
            components: [
                {
                    type: 17,
                    accent_color: accentColor,
                    components: [
                        // SECTION 1: Victim Name & Portrait
                        {
                            type: 9,
                            components: [
                                {
                                    type: 10,
                                    content: `## ${names.finalVictimName} lost ${article} ${names.shipName}`
                                }
                            ],
                            accessory: {
                                type: 11,
                                media: { url: `https://images.evetech.net/characters/${kill.victim.character_id}/portrait?size=128` }
                            }
                        },
                        // SECTION 2: Corp Name & Logo (The fix for the 400 error)
                        {
                            type: 9,
                            components: [
                                {
                                    type: 10,
                                    content: `**Corp:** ${names.corpName}`
                                }
                            ],
                            accessory: {
                                type: 11,
                                media: { url: `https://images.evetech.net/corporations/${kill.victim.corporation_id}/logo?size=64` }
                            }
                        },
                        { type: 14, spacing: 1, divider: true },

                        // SECTION 3: Tactical Grid
                        {
                            type: 9,
                            components: [
                                {
                                    type: 10,
                                    content: `**Economic Impact**\nValue: ${totalValue} ISK\nDropped: ${helpers.formatIsk(zkb.droppedValue || 0)}`
                                },
                                {
                                    type: 10,
                                    content: `**Environment**\nSystem: ${names.systemName}\nRegion: ${names.regionName}`
                                }
                            ],
                            accessory: {
                                type: 11,
                                media: { url: `https://images.evetech.net/types/${kill.victim.ship_type_id}/render?size=128` }
                            }
                        },

                        { type: 14, spacing: 1, divider: true },
                        {
                            type: 10,
                            content: `**Engagement:** ${names.attackerCount} Attackers | **Final Blow:** ${names.finalBlowCorp}`
                        },
                        {
                            type: 10,
                            content: `-# socketkill.com | Real-time EVE Intel · <t:${Math.floor(Date.now() / 1000)}:R>`
                        }
                    ]
                },
                {
                    type: 1,
                    components: [
                        { type: 2, style: 5, label: "View on zKillboard", url: zkillUrl },
                        { type: 2, style: 5, label: "Socket.Kill Analysis", url: `https://socketkill.com/kill/${kill.killmail_id}` }
                    ]
                }
            ]
        };
    }
}

module.exports = NewsEmbedFactoryV2;