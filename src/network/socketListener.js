const WebSocket = require ('ws');

function startSocketStream() {
    const ws = new WebSocket('wss://zkillboard.com/websocket/')

    ws.on('open', () => {
        const subCommand = {
            "action": "sub",
            "channel": "killstream"
        };
        ws.send(JSON.stringify(subCommand));
        console.log("[WSS] Connected to zKillboard Firehose. Stream active.");
    });

    ws.on('message', (data) => {
        try {
            const rawKill = JSON.parse(data);
            if(rawKill.killmail_id) {

            }
            
        } catch (err) {
            console.error ("❌ [WSS] Parse Error:", err.message);
        }
    });

    ws.on('close', () => {
        console.log("⚠️ [WSS] Connection lost. Retrying in 5 seconds...");
        setTimeout(startSocketStream, 5000);
    });

    ws.on('error', (err) => {
        console.error("❌ [WSS] Socket Error:", err.message);
    });
}

// Initialize the stream
startSocketStream();

module.exports = startSocketStream;
