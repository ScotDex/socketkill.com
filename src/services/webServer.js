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

    const PORT = process.env.PORT || 80;

    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '..', '..', 'public')));

    app.get ('/api/health', (req, res) => {
        const mem = process.memoryUsage();
        const healthData = {
            status: isThrottled ? "DEGRADED" : "OPERATIONAL",
            uptime: Math.round((Date.now() - statsManager.startTime) / 1000),
            stats: {
                killsProcessed: statsManager.totalKills,
                iskDestroyed: statsManager.totalIsk,
                activeClients: io.engine.clientsCount
            },

            system: {
                rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
                sequence: currentSequence
            }
        };
        res.status(isThrottled ? 299 : 200).json(healthData);
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