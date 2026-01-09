const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

function startWebServer(esi) {
    const app = express();
    const server = http.createServer(app);
    
    // Initialize Socket.io with CORS for local dev support
    const io = new Server(server, {
        cors: { origin: "*" }
    });

    const PORT = process.env.PORT || 8443;

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
    });

    // We return BOTH so the main app can use 'io' to broadcast
    return { app, io };
}

module.exports = startWebServer;