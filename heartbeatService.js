const axios = require('axios');
const helpers = require('./helpers')

class HeartbeatService {
    static async sendReport(webhookUrl, stats, mapper, esi){

    const uptimeStr = helpers.formatDuration(new Date() - stats.startTime);
    const payload = {
            username: "Chain Intel Status",
            avatar_url: "https://images.evetech.net/types/22430/icon",
            embeds: [{
                title: "Daily System Heartbeat",
                color: 0x2ecc71, 
                fields: [
                    { name: "Uptime", value: `**${uptimeStr}**`, inline: true },
                    { name: "Daily Scans", value: `**${stats.scanCount.toLocaleString()}**`, inline: true },
                    { name: "Systems Monitored", value: `**${mapper.getSystemsCount()}**`, inline: true },
                    { name: "Character Cache", value: `**${Object.keys(esi.cache).length}**`, inline: true }
                ],
                footer: { text: `WiNGSPAN Intel Engine • ${new Date().toUTCString()}` }
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