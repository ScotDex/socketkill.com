
require('dotenv').config();
const express = require('express');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const fs = require('fs');

function startWebServer(esi, statsManager, getState) {
    const app = express();

    const options = {
        key: fs.readFileSync(path.join(__dirname, '..', '..', 'ssl', 'socketkillcom.key')),
        cert: fs.readFileSync(path.join(__dirname, '..', '..', 'ssl', 'socketkillcom.pem'))
    };

    const server = https.createServer(options, app);

    app.use(helmet({
        contentSecurityPolicy: false,
    }));

    const io = new Server(server, {
        pingTimeout: 2000,
        pingInterval: 5000,
        cors: { origin: "*",
        methods: ["GET", "POST"],
        },
        transports: ['websocket', 'polling'],
    });

    const PORT = process.env.PORT 

    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '..', '..', 'public')));

const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ZONE_ID = process.env.CF_ZONE_ID;

async function getCloudflareStats() {
    // Cloudflare uses UTC dates
    const today = new Date().toISOString().split('T')[0];

    const query = `
    query GetStats($zoneTag: String!, $date: Date!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 1, 
            filter: { date: $date }
          ) {
            sum {
              requests
              cachedRequests
              bytes
            }
          }
        }
      }
    }`;

    try {
        const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                query: query, 
                variables: { 
                    zoneTag: CF_ZONE_ID,
                    date: today 
                } 
            })
        });

        const result = await response.json();
        
        if (!result.data || !result.data.viewer || !result.data.viewer.zones[0]) {
            console.error('CF API Detailed Error:', JSON.stringify(result.errors || "Empty Response"));
            return { shield: "ERR", throughput: "ERR" };
        }

        const groups = result.data.viewer.zones[0].httpRequests1dGroups;
        
        if (groups.length === 0) {
            return { shield: "0%", throughput: "0.00 MB" };
        }

        const stats = groups[0].sum;
        
        return {
            shield: stats.requests > 0 
                ? ((stats.cachedRequests / stats.requests) * 100).toFixed(1) + "%" 
                : "0.0%",
            throughput: (stats.bytes / 1024 / 1024).toFixed(2) + " MB"
        };
    } catch (err) {
        console.error('Network Error:', err);
        return { shield: "---", throughput: "---" };
    }
}
    app.get ('/api/health', async (req, res) => {
        const mem = process.memoryUsage();
        const cfStats = await getCloudflareStats();
        const healthData = {
            status: getState.isThrottled ? "DEGRADED" : "OPERATIONAL",
            uptime: Math.round((Date.now() - statsManager.startTime) / 1000),
            stats: {
                killsProcessed: statsManager.totalKills,
                iskDestroyed: statsManager.totalIsk,
                activeClients: io.engine.clientsCount,
                cf: cfStats
            },

            system: {
                rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
                sequence: getState.currentSequence
            }
        };
        res.status(getState.isThrottled ? 299 : 200).json(healthData);
    }

)
    
    app.get('/', (req, res) => {
        res.sendFile(path.join(publicPath, 'index.html'));
    });

    // Socket.io connection logging
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected to Intel Stream: ${socket.id}`);
        socket.on('disconnect', () => console.log('❌ Client disconnected'));
    });

    server.listen(PORT, () => {
        console.log(`Web Module Loaded on ${PORT}`);
        }).on('error', (err) => {
        if (err.code === 'EACCES') {
            console.error(`❌ ERROR: Port ${PORT} requires root privileges! Try 'sudo node index.js'`);
        } else if (err.code === 'EADDRINUSE') {
            console.error(`❌ ERROR: Port ${PORT} is already in use by another app!`);
        } else {
            console.error(`❌ ERROR:`, err);
        }
    });
    return { app, io };
}

module.exports = startWebServer;