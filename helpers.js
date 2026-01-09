const { default: axios } = require("axios");

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

    static async getNasaPhoto(apiKey){
        try {
            const url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;
            const response = await axios.get(url)

            return{
                url: response.data.hdurl || response.data.url,
                title: response.data.title,
                media_type: response.data.media_type
            };

        } catch (error) {
            console.error("NASA Pic Retrieval Issue", err.message);
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
}

module.exports = utils;