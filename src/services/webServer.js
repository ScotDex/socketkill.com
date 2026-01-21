const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

function startWebServer(esi) {
    const app = express();
    
    // 🛡️ SURGICAL SECURITY HARDENING
    // Helmet must be initialized BEFORE other middleware to set headers correctly
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                // Allow images from your proxy and EVE ESI
                "img-src": ["'self'", "data:", "https://images.evetech.net", "https://api.voidspark.org"],
                // Allow Socket.io to connect back to your subdomain
                "connect-src": ["'self'", "https://killstream.voidspark.org", "wss://killstream.voidspark.org", "https://*.voidspark.org"],
                // Allow your CRT/Alien fonts if hosted externally
                "font-src": ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
                // Allow your inline typewriter scripts to function
                "script-src": ["'self'", "'unsafe-inline'", "https://killstream.voidspark.org"]
            },
        },
        // Ensures the site only opens via HTTPS (Fixes the HSTS warning)
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }));

    const server = http.createServer(app);
    const io = new Server(server, {
        cors: { origin: "https://killstream.voidspark.org" }, // Tightened from "*"
        transports: ['websocket', 'polling'],
    });

    const PORT = process.env.PORT || 80;

    app.use(cors());
    app.use(express.json());
    
    // Correctly resolve the public path based on your src/services/ directory
    const publicPath = path.join(__dirname, '..', '..', 'public');
    app.use(express.static(publicPath));
    
    app.get('/', (req, res) => {
        res.sendFile(path.join(publicPath, 'index.html'));
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected to Intel Stream: ${socket.id}`);
        socket.on('disconnect', () => console.log('❌ Client disconnected'));
    });

    server.listen(PORT, () => {
        console.log(`🚀 Web Module Hardened & Loaded on ${PORT}`);
    }).on('error', (err) => {
        if (err.code === 'EACCES') {
            console.error(`❌ ERROR: Port ${PORT} requires root privileges!`);
        } else if (err.code === 'EADDRINUSE') {
            console.error(`❌ ERROR: Port ${PORT} is already in use!`);
        } else {
            console.error(`❌ ERROR:`, err);
        }
    });

    return { app, io };
}

module.exports = startWebServer;