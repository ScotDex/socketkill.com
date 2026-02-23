
require('dotenv').config();
const express = require('express');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const fs = require('fs');


function startWebServer() {
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
    const publicPath = path.join(__dirname, '..', '..', 'public');

    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '..', '..', 'public')));

    
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
    });
    return { app, io };
}

module.exports = startWebServer;