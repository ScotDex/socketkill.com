const axios = require('axios');

class MapperService {
    /**
     * @param {string} apiUrl - The URL for the DeliveryNetwork data
     */
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        // CHANGED: Use a Map instead of a Set to store [systemID -> metadataObject]
        this.activeSystems = new Map();
    }

    /**
     * Fetches the signature data and extracts unique system IDs and scanner names.
     */
    async refreshChain(getSystemDetails) {
        try {
            const { data } = await axios.get(this.apiUrl);
            
            if (!data || !data.signatures) {
                console.error("❌ Mapper Error: No signatures found in API response.");
                return false;
            }

            // CHANGED: New Map to replace the old one
            const newMap = new Map();
            const namesFound = [];
            const sigs = data.signatures;

            Object.keys(sigs).forEach(key => {
                const sig = sigs[key];
                const systemID = Number(sig.systemID);
                
                if (systemID > 100) {
                    // STORE METADATA: Map the ID to an object containing the scout's name
                    newMap.set(systemID, {
                        scannedBy: sig.modifiedByName || sig.createdByName || "Unknown Scout"
                    });

                    // Resolve names for console logging if helper is provided
                    if (getSystemDetails) {
                        const details = getSystemDetails(systemID);
                        if (details && !namesFound.includes(details.name)) {
                            namesFound.push(details.name);
                        }
                    }
                }
            });

            this.activeSystems = newMap;
            
            if (namesFound.length > 0) {
                console.log(`✅ Mapper Sync: Monitoring ${this.activeSystems.size} systems: [${namesFound.join(', ')}]`);
            } else {
                console.log(`✅ Mapper Sync: Monitoring ${this.activeSystems.size} unique system IDs.`);
            }

            return true;
        } catch (err) {
            console.error("❌ Mapper Sync Error:", err.message);
            return false;
        }
    }

    /**
     * Checks if a system is in the chain.
     */
    isInChain(systemId) {
        return this.activeSystems.has(Number(systemId));
    }

    /**
     * NEW HELPER: Retrieves the metadata (like scout name) for a specific system.
     */
    getSystemMetadata(systemId) {
        return this.activeSystems.get(Number(systemId));
    }
}

module.exports = MapperService;