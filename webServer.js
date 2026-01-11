const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

function startWebServer(esi) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: { origin: "*" }, // Keep this for now to ensure connectivity
        transports: ['websocket', 'polling'],
    });

    const PORT = process.env.PORT || 80;

    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Socket.io connection logging
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected to Intel Stream: ${socket.id}`);
        socket.on('disconnect', () => console.log('❌ Client disconnected'));
    });

    server.listen(PORT, () => {
        console.log(`🌐 zKill Light Stream active on port ${PORT}`);
        }).on('error', (err) => {
        if (err.code === 'EACCES') {
            console.error(`❌ ERROR: Port ${PORT} requires root privileges! Try 'sudo node index.js'`);
        } else if (err.code === 'EADDRINUSE') {
            console.error(`❌ ERROR: Port ${PORT} is already in use by another app!`);
        } else {
            console.error(`❌ ERROR:`, err);
        }
    });

    // We return BOTH so the main app can use 'io' to broadcast
    return { app, io };
}

module.exports = startWebServer;