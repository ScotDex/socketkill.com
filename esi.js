const axios = require(`axios`);
const fs = require(`fs`).promises;


class ESIClient{
    constructor(contactInfo) {
        this.api = axios.create({
            baseURL: "https://esi.evetech.net/latest",
            timeout: 15000,
            headers: {
                'User-Agent': `KillStream (${contactInfo})`,
            }
        });

        this.cache = {
            characters: new Map(),
            corporations: new Map(),
            types: new Map(),
            systems: new Map(),
            regions: new Map()
        };

        this.staticSystemData = {};
        this.isDirty = false;

        setInterval(() => {
            if (this.isDirty){
                this.saveCache('./data/esi_cache.json');   
            }
        }, 1 * 60 * 1000);
    }
    async fetchAndCache(id, cacheCategory, endpoint) {
        if (!id || id === 0) return "Unknown";

        const internalCache = this.cache[cacheCategory];
        if (internalCache && internalCache.has(id)) {
            return internalCache.get(id);
        }

        try {
            const response = await this.api.get(`${endpoint}/${id}/`);
            const name = response.data.name;
            
            if (internalCache) internalCache.set(id, name);
            this.isDirty = true;
            return name;
        } catch (error) {
            console.error(`[ESI Error] Category: ${cacheCategory}, ID: ${id} - ${error.message}`);
            return "Unknown";
        }
    }

    async saveCache(filePath) {
        try {
            const persistData = {
                characters: Object.fromEntries(this.cache.characters),
                corporations: Object.fromEntries(this.cache.corporations),
                types: Object.fromEntries(this.cache.types),
                regions: Object.fromEntries(this.cache.regions)
            };
            await fs.writeFile(filePath, JSON.stringify(persistData, null, 2));
            this.isDirty = false; // Reset flag after successful save
            console.log("💾 Cache persisted to disk.");
        } catch (err) {
            console.error("❌ Save failed:", err.message);
        }
    }

    async loadCache(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            if (!data || data.trim() === "") {
            console.warn("📁 Cache file is empty. Initializing default structure...");
            this.isDirty = true; // Force a save later
            return;
        }
            const json = JSON.parse(data);
            this.cache.characters = new Map(Object.entries(json.characters || {}));
            this.cache.corporations = new Map(Object.entries(json.corporations || {}));
            this.cache.types = new Map(Object.entries(json.types || {}));
            this.cache.regions = new Map(Object.entries(json.regions || {}));
            console.log("📂 Persistent cache loaded.");
        } catch (err) {
            console.warn("⚠️ No cache file found, starting fresh.");
        }
    }

    async getCharacterID(name) {
        try {
            const { data } = await this.api.post('/universe/ids/', [name]);
            return data.characters?.[0]?.id || null;
        } catch (error) {
            console.error(`Could not resolve ID for ${name}`);
            return null;
        }
    }

    async getCharacterName(id) {
        return this.fetchAndCache(id, 'characters', '/characters');
    }

    async getCorporationName(id) {
        return this.fetchAndCache(id, 'corporations', '/corporations');
    }

    async getTypeName(id) { 
        return this.fetchAndCache(id, 'types', '/universe/types');
    }

    

    async loadSystemCache(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            this.staticSystemData = JSON.parse(data);
            return true;
        } catch (err) {
            console.error("Failed to load static system data:", err.message);
            return false;
        }
    }

    findSystemByName(name) {
        if (!name) return null;
        const query = name.toLowerCase();
        return Object.values(this.staticSystemData).find(sys => 
            sys.name.toLowerCase().startsWith(query)
        ) || null;
    }

    async getRoute(originId, destinationId) {
        try {
            const { data } = await this.api.get(`/route/${originId}/${destinationId}/`);
            return data;
        } catch (error) {
            return null;
        }
    }

    getSystemDetails(id) {
        return this.staticSystemData[id] || null;
    }

    async getRegionName(id){
        return await this.fetchAndCache(id, 'regions', '/universe/regions');
    }



}
module.exports = ESIClient;
