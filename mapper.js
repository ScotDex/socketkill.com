const axios = require('axios');

class MapperService {
    /**
     * @param {string} apiUrl - The URL for the DeliveryNetwork data
     */
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.activeSystems = new Set();
    }

    /**
     * Fetches the signature data and extracts unique system IDs.
     * @param {Function} getSystemDetails - Optional ESI helper to resolve names for logging
     */
    async refreshChain(getSystemDetails) {
        try {
            const { data } = await axios.get(this.apiUrl);
            
            if (!data || !data.signatures) {
                console.error("❌ Mapper Error: No signatures found in API response.");
                return false;
            }

            const newSet = new Set();
            const namesFound = [];
            const sigs = data.signatures;

            // Extract IDs from the signature objects
            Object.keys(sigs).forEach(key => {
                const systemID = Number(sigs[key].systemID);
                
                // Filter out placeholder IDs (0, 11, etc.)
                if (systemID > 100) {
                    newSet.add(systemID);

                    // Optional: resolve names for the console log
                    if (getSystemDetails) {
                        const details = getSystemDetails(systemID);
                        if (details && !namesFound.includes(details.name)) {
                            namesFound.push(details.name);
                        }
                    }
                }
            });

            this.activeSystems = newSet;
            
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
     * Quick O(1) check to see if a system is in the chain.
     */
    isInChain(systemId) {
        return this.activeSystems.has(Number(systemId));
    }
}

// THE FORGOTTEN EXPORT
module.exports = MapperService;