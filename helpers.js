require("dotenv").config();
const axios = require("./src/network/agent");
const { error } = require("console");
const fs = require ("fs");
const path = require ("path");
const { json } = require("stream/consumers");

// Use process.cwd() to stay inside the /usr/src/app folder
const DATA_PATH = path.join(process.cwd(), "data", "stats.json");

class utils {

    static formatIsk (rawValue) {
        const value = rawValue || 0;
        if (value >= 1000000000) {
            return `${(value / 1000000000).toFixed(2)}B`;
        }
        return `${(value / 1000000).toFixed(2)}M`;
    }


    static getZkillLink (killId){
        return `https://zkillboard.com/kill/${killId}/`;
    }

    static async getBackPhoto(){
        try {
            const url = (process.env.BACKGROUND_API_URL);
            const response = await axios.get(url)

            return{
                url: response.data.url,
                title: response.data.name.split('.')[0].replace(/_/g, ' '),
                media_type: 'image'
            };

        } catch (err) {
            console.error("Background Pic Retrieval Issue", err.message);
            return null;            
        }
    }



    static formatDuration(ms) {
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);

        let parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

        return parts.join(' ');
    }

    // helpers.js

static loadPersistentStats() {
    try {
        const directory = path.dirname(DATA_PATH);
        
        // Ensure directory exists
        if (!fs.existsSync(directory)) {
            console.log(`[STORAGE] Creating missing directory: ${directory}`);
            fs.mkdirSync(directory, { recursive: true });
        }

        // Check if file exists
        if (!fs.existsSync(DATA_PATH)) {
            console.log("[STORAGE] No stats file found. Starting fresh.");
            return 0;
        }

        // Read and parse
        const rawData = fs.readFileSync(DATA_PATH, "utf8");
        
        // Check if file is empty string
        if (!rawData || rawData.trim() === "") {
            console.log("[STORAGE] Stats file is empty. Initializing with 0.");
            return 0;
        }

        const data = JSON.parse(rawData);
        console.log(`[STORAGE] Successfully loaded ${data.totalKills} kills from disk.`);
        return Number(data.totalKills) || 0;

    } catch (err) {
        console.error("❌ [STORAGE] Critical error loading stats:", err.message);
        return 0;
    }
}

static async savePersistentStats(count) {
        try {
            // Force save as an object with totalKills key
            const payload = JSON.stringify({ totalKills: Math.floor(count) });
            await fs.promises.writeFile(DATA_PATH, payload);
        } catch (err) {
            console.error("❌ [STORAGE] Error saving stats count:", err.message);
        }
    }

}
module.exports = utils;