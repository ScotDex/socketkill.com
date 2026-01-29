/**
 * src/core/processor.js
 * Hot-Swappable Dual-Stack Processor (R2 + RedisQ)
 */
const axios = require("../network/agent");
const helpers = require("./helpers");
const EmbedFactory = require("../services/embedFactory");
const TwitterService = require("../network/twitterService");

module.exports = (esi, mapper, io, statsManager) => {
    const THERA_ID = 31000005;
    const WHALE_THRESHOLD = 20000000000;
    const isWormholeSystem = (systemId) => systemId >= 31000001 && systemId <= 32000000;

    async function processPackage(packageData) {
        const startProcessing = process.hrtime.bigint();

        // --- 1. SURGICAL NORMALIZATION LAYER ---
        // Detect shape: R2 has 'zkb' at root; Legacy has it inside 'package'
        const isR2 = !!packageData.zkb && !packageData.package;
        const isLegacy = !!packageData.package;

        let killID, zkb, killmail;

        if (isR2) {
            // PowerShell-verified R2 mapping
            killID = packageData.killmail_id;
            zkb = packageData.zkb;
            killmail = packageData.esi; // ESI data is pre-bundled in R2
        } else if (isLegacy) {
            // Traditional RedisQ mapping
            killID = packageData.package.killID;
            zkb = packageData.package.zkb;
            // killmail remains null; we will fetch it via axios below
        } else {
            console.error("❌ [PROCESSOR-ERR] Received unrecognized packet shape.");
            return;
        }

        // Standardize the href for UI and Intel
        const zkbHref = isR2 ? `https://zkillboard.com/kill/${killID}/` : zkb.href;
        const rawValue = Number(zkb?.totalValue || 0);

        try {
            // --- 2. DATA SOURCE SELECTION ---
            if (!killmail) {
                // If it's not R2, we must perform the Legacy ESI fetch
                const esiResponse = await axios.get(zkbHref);
                killmail = esiResponse.data;
            }

            // Safety check for malformed ESI data
            if (!killmail?.solar_system_id) {
                throw new Error("Missing solar_system_id in killmail payload");
            }

            // --- 3. PARALLEL RESOLUTION ---
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
                // Ensure handlePrivateIntel gets a normalized ZKB object with the href
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
            console.error(`❌ [PROCESSOR-ERR] Kill ${killID || 'Unknown'} failed: ${err.message}`);
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