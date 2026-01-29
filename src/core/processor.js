/**
 * src/core/processor.js
 * Surgical migration of killmail processing and intel dispatching logic.
 */
const axios = require("../network/agent"); // Use your existing configured agent
const helpers = require("./helpers");
const EmbedFactory = require("../services/embedFactory");
const TwitterService = require("../network/twitterService");


module.exports = (esi, mapper, io, statsManager) => {
    
    // Constants
    const THERA_ID = 31000005;
    const WHALE_THRESHOLD = 20000000000;

    // Helper: Identify Wormhole space
    const isWormholeSystem = (systemId) => systemId >= 31000001 && systemId <= 32000000;

    /**
     * Primary entry point for every killmail from the stream
     */
    async function processPackage(packageData) {
        const startProcessing = process.hrtime.bigint();
        
        // --- 1. NORMALIZATION LAYER ---
        const isR2 = !!packageData.zkb && !packageData.package;
        const killID = isR2 ? packageData.killmail_id : packageData.killID;
        const zkb = isR2 ? packageData.zkb : packageData.zkb; // Both use 'zkb'
        const rawValue = Number(zkb.totalValue || zkb.total_value) || 0;

        const zkbHref = isR2 
            ? `https://zkillboard.com/kill/${killID}/` 
            : zkb.href;

        let killmail;

        try {
            // --- 2. DATA SOURCE SELECTION ---
            if (isR2) {
                // R2 Native: zero network cost
                killmail = packageData.esi;
            } else {
                // Legacy: perform the fetch
                const esiResponse = await axios.get(zkbHref);
                killmail = esiResponse.data;
            }

            // --- 3. PARALLEL RESOLUTION (Optimized) ---
            const [systemDetails, shipName, charName, corpName] = await Promise.all([
                esi.getSystemDetails(killmail.solar_system_id),
                esi.getTypeName(killmail.victim.ship_type_id),
                esi.getCharacterName(killmail.victim?.character_id),
                esi.getCorporationName(killmail.victim?.corporation_id)
            ]);
            
            statsManager.increment();

            const systemName = systemDetails?.name || "Unknown System";
            const regionName = systemDetails?.region_id 
                ? await esi.getRegionName(systemDetails.region_id) 
                : "K-Space";

            const durationMs = Number(process.hrtime.bigint() - startProcessing) / 1_000_000;
            console.log(`[PERF] Kill ${killID} | Mode: ${isR2 ? 'R2' : 'LEG'} | Latency: ${durationMs.toFixed(3)}ms`);

            // --- 4. DISPATCH ---
            io.emit("gatekeeper-stats", { totalScanned: statsManager.getTotal() });
            io.emit("raw-kill", {
                id: killID,
                val: rawValue,
                ship: shipName,
                system: systemName,
                region: regionName,
                shipId: killmail.victim.ship_type_id,
                href: zkbHref,
                locationLabel: `System: ${systemName} | Region: ${regionName} | Corporation: ${corpName}`,
                zkillUrl: `https://zkillboard.com/kill/${killID}/`,
                victimName: charName,
                totalScanned: statsManager.getTotal(),
                shipImageUrl: `https://api.voidspark.org:2053/render/ship/${killmail.victim.ship_type_id}`,
                corpImageUrl: `https://api.voidspark.org:2053/render/corp/${killmail.victim.corporation_id}`
            });

            // --- 5. INTEL GATING ---
            const isWhale = rawValue >= WHALE_THRESHOLD;
            const isRelevantWH = isWormholeSystem(killmail.solar_system_id) && 
                               killmail.solar_system_id !== THERA_ID && 
                               mapper.isSystemRelevant(killmail.solar_system_id);

            if (isWhale || isRelevantWH) {
                // We pass a normalized zkb object to handlePrivateIntel
                const intelZkb = isR2 ? { ...zkb, href: zkbHref } : zkb;
                await handlePrivateIntel(killmail, intelZkb, {
                    shipName,
                    systemName,
                    charName,
                    corpName,
                    rawValue
                });
            }

        } catch (err) {
            console.error(`❌ [PROCESSOR-ERR] Kill ${killID} failed: ${err.message}`);
        }
    }

    /**
     * Handles Discord Webhooks and Twitter notifications
     */
    async function handlePrivateIntel(kill, zkb, identity) {
        const formattedValue = helpers.formatIsk(identity.rawValue);
        
        try {
            if (mapper.isSystemRelevant(kill.solar_system_id)) {
                const metadata = mapper.getSystemMetadata(kill.solar_system_id);
                
                const names = {
                    ...identity,
                    scoutName: metadata ? metadata.scannedBy : "Unknown Scout",
                    isAdjacent: metadata ? metadata.isAdjacent : false
                };
                
                const tripwireUrl = `${process.env.TRIPWIRE_URL}?system=${encodeURIComponent(identity.systemName)}`;
                const payload = EmbedFactory.createKillEmbed(kill, zkb, names, tripwireUrl);

                if (process.env.INTEL_WEBHOOK_URL) {
                    axios.post(process.env.INTEL_WEBHOOK_URL, payload)
                        .catch(e => console.error("Webhook Failed", e.message));
                }
            }

            if (identity.rawValue >= WHALE_THRESHOLD) {
                TwitterService.postWhale(identity, formattedValue, kill.killmail_id);
            }
        } catch (err) {
            console.error("❌ Error in handlePrivateIntel:", err.message);
        }
    }

    return { processPackage };
};