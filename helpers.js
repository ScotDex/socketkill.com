require("dotenv").config();
const { default: axios } = require("axios");
const { error } = require("console");
const fs = require ("fs");
const path = require ("path");
const { json } = require("stream/consumers");

const DATA_PATH = path.join(__dirname, "../data/stats.json");

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

    static loadPersistentStats() {
        try { 
        if (!fs.existsSync(path.dirname(DATA_PATH))){
            fs.mkdirSync(path.dirname(DATA_PATH), {recursive: true});
        }
        if (fs.existsSync(DATA_PATH)) {
            const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
            return data.totalKills || 0;
        }
    } catch (err) {
        console.log("error loading stats counter", err.message);
    }
    return 0;
}


    static savePersistentStats(count) {
        try {
            fs.writeFileSync(DATA_PATH, JSON.stringify({ totalKills: count}));
        } catch (err) {
            console.error ("Error saving stats count", err.message);
        }
    }

}
module.exports = utils;