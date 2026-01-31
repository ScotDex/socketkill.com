const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

function startWebServer(esi) {
    const app = express();
    const server = http.createServer(app);

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