const axios = require('axios');

class MapperService {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.activeSystems = new Map();
        this.adjacencies = new Map();
    }

    async refreshChain(getSystemDetails) {
        try {
            const { data } = await axios.get(this.apiUrl);
            
            if (!data || !data.signatures) {
                console.error("❌ Mapper Error: No signatures found in API response.");
                return false;
            }

            const newMap = new Map();
            const newAdjacencies = new Map();
            const namesFound = [];
            const sigs = data.signatures;
            const whs = data.wormholes || {}; // Declared once here

            // 1. SIGNATURE LOOP: Build the list of scanned systems
            Object.keys(sigs).forEach(key => {
                const sig = sigs[key];
                const systemID = Number(sig.systemID);
                
                if (systemID > 100) {
                    newMap.set(systemID, {
                        scannedBy: sig.modifiedByName || sig.createdByName || "Unknown Scout"
                    });

                    if (getSystemDetails) {
                        const details = getSystemDetails(systemID);
                        if (details && !namesFound.includes(details.name)) {
                            namesFound.push(details.name);
                        }
                    }
                }
            });

            // 2. WORMHOLE LOOP: Build the Adjacency Map (Calculation Layer)
            Object.values(whs).forEach(wh => {
                const sigA = sigs[wh.initialID];
                const sigB = sigs[wh.secondaryID];

                if (sigA && sigB && sigA.systemID && sigB.systemID){
                    const sysA = Number(sigA.systemID);
                    const sysB = Number(sigB.systemID);
                    
                    if (!newAdjacencies.has(sysA)) newAdjacencies.set(sysA, new Set());
                    if (!newAdjacencies.has(sysB)) newAdjacencies.set(sysB, new Set());  

                    newAdjacencies.get(sysA).add(sysB);
                    newAdjacencies.get(sysB).add(sysA);
                }
            });

            this.activeSystems = newMap;
            this.adjacencies = newAdjacencies; // Fixed typo: was 'adjacencie'
            
            if (namesFound.length > 0) {
                console.log(`✅ Mapper Sync: Monitoring ${this.activeSystems.size} systems: [${namesFound.join(', ')}]`);
            }
            return true;
        } catch (err) {
            console.error("❌ Mapper Sync Error:", err.message);
            return false;
        }
    }

    isSystemRelevant(systemId) {
        const id = Number(systemId);
        // Is it one of ours?
        if (this.activeSystems.has(id)) return true;

        // Is it touching one of ours?
        const neighbors = this.adjacencies.get(id);
        if (neighbors) {
            for (let neighborId of neighbors) {
                if (this.activeSystems.has(neighborId)) return true;
            }
        }
        return false;
    }

    isInChain(systemId) {
        return this.activeSystems.has(Number(systemId));
    }

    getSystemMetadata(systemId) {
        const id = Number(systemId);
        let meta = this.activeSystems.get(id);

        if (meta){
            return { ... meta, isAdjacent: false};
        }
        const neighbors = this.adjacencies.get(id);
        if (neighbors) {
            for (let neighborId of neighbors) {
                const neighborMeta = this.activeSystems.get(neighborId);
                    if (neighborMeta) {
                        return { ...neighborMeta, isAdjacent : true};
                    }
                    
                }
            }
        return {scannedBy: "Unknown Scout", isAdjacent: false};
    }
}

module.exports = MapperService;