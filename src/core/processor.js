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
        const { zkb, killID, isR2, esiData } = packageData;

        try {
            // 1. Resolve Killmail and Core Identity in Parallel
            // We use the raw zkb.href to get full details not present in the RedisQ package
            let killmail;

            if (isR2 && esiData){
                killmail = esiData;
            } else {
                const esiResponse = await axios.get(zkb.href);
                killmail = esiResponse.data;
            }
            const rawValue = Number(zkb.totalValue) || 0;

            const [systemDetails, shipName, charName, corpName] = await Promise.all([
                esi.getSystemDetails(killmail.solar_system_id),
                esi.getTypeName(killmail.victim.ship_type_id),
                esi.getCharacterName(killmail.victim?.character_id),
                esi.getCorporationName(killmail.victim?.corporation_id)
            ]);

            const finalVictimName = (charName == "Unknown" || !charName ) ? corpName : charName;

            // Pass the ISK value into the incrementer so it can update totalIsk
            statsManager.increment(rawValue);

            const systemName = systemDetails?.name || "Unknown System";
            const regionName = systemDetails?.region_id 
                ? await esi.getRegionName(systemDetails.region_id) 
                : "K-Space";

            const durationMs = Number(process.hrtime.bigint() - startProcessing) / 1_000_000;
            console.log(`[PERF] Kill ${killID} | Latency: ${durationMs.toFixed(3)}ms`);

          
            // 2. Update Stats
            

            // 3. Dispatch to Web Front-end
            io.emit("gatekeeper-stats", { totalScanned: statsManager.getTotal() });
            io.emit("raw-kill", {
                id: killID,
                val: rawValue,
                ship: shipName,
                system: systemName,
                region: regionName,
                article: helpers.getArticle(shipName),
                shipId: killmail.victim.ship_type_id,
                href: zkb.href,
                locationLabel: `System: ${systemName} | Region: ${regionName} | Corporation: ${corpName}`,
                zkillUrl: `https://zkillboard.com/kill/${killID}/`,
                victimName: finalVictimName,
                totalScanned: statsManager.getTotal(),
                shipImageUrl: `https://api.socketkill.com/render/ship/${killmail.victim.ship_type_id}`,
                corpImageUrl: `https://api.socketkill.com/render/corp/${killmail.victim.corporation_id}`
            });

            // 4. Performance Benchmarking
            

            // 5. Intel Gating Logic
            const isWhale = rawValue >= WHALE_THRESHOLD;
            const isRelevantWH = isWormholeSystem(killmail.solar_system_id) && 
                               killmail.solar_system_id !== THERA_ID && 
                               mapper.isSystemRelevant(killmail.solar_system_id);

            if (isWhale || isRelevantWH) {
                await handlePrivateIntel(killmail, zkb, {
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