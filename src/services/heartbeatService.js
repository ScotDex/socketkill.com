const axios = require("../network/agent");
const helpers = require('../core/helpers')

class HeartbeatService {
    static async sendReport(webhookUrl, stats, mapper, esi){
    const uptimeStr = helpers.formatDuration(new Date() - stats.startTime);
    const totalCacheSize = Object.values(esi.cache)
    .reduce((acc, map) => acc + (map instanceof Map ? map.size : 0), 0);
    const memUsage = process.memoryUsage().rss / 1024 / 1024;
    const payload = {
            username: "Socket.Kill Heartbeat Monitor",
            avatar_url: "https://images.evetech.net/types/22430/icon",
            embeds: [{
                title: "Daily System Heartbeat",
                color: 0x2ecc71, 
                fields: [
                    { name: "Uptime", value: `**${uptimeStr}**`, inline: true },
                    { name: "Total Cache Entries", value: `**${totalCacheSize.toLocaleString()}**`, inline: true },
                    { name: "Process RAM", value: `**${memUsage.toFixed(2)} MB**`, inline: true }
                ],
                footer: { text: `Site Monitor ${new Date().toUTCString()}` }
            }]
        };
        try {
            await axios.post(webhookUrl, payload);
            console.log("Heartbeat report sent to Discord.");
        } catch (err) {
            console.error(" Heartbeat report failed:", err.message);
        }
    }
}
module.exports = HeartbeatService