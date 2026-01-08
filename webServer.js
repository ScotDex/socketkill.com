const express = require('express');
const cors = require('cors');
const path = require('path');

/**
 * @param {ESIClient} esi - Your existing ESI instance for type lookups
 */
function startWebServer(esi) {
    const app = express();
    app.use(cors());
    const PORT = process.env.PORT || 1098;

    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

    app.post('/api/v1/scan', async (req, res) => {
        try {
            const { paste } = req.body;
            if (!paste) return res.status(400).json({ error: "No data pasted" });

            const lines = paste.trim().split(/\r?\n/);
            
            // We use an object to aggregate counts (The "Outcome" logic)
            const shipCounts = {};
            const rawResults = [];

            for (const line of lines) {
                const cols = line.split('\t');
                
                // Basic D-Scan/Fleet Scan check (at least 3 columns)
                if (cols.length >= 3) {
                    const typeName = cols[2];
                    
                    // 1. Store raw line for the "All Items" table
                    rawResults.push({
                        name: cols[1] || "Unknown",
                        type: typeName,
                        distance: cols[3] || "-"
                    });

                    // 2. Aggregate counts for the "Summary" panels
                    if (!shipCounts[typeName]) {
                        shipCounts[typeName] = {
                            count: 0,
                            // We use your existing ESI client to get the ID if needed
                            // shipId: await esi.getTypeId(typeName) 
                        };
                    }
                    shipCounts[typeName].count++;
                }
            }

            // Convert the object back to a sorted array for the frontend
            const summary = Object.keys(shipCounts).map(type => ({
                type: type,
                count: shipCounts[type].count
            })).sort((a, b) => b.count - a.count);

            res.json({ 
                status: "success", 
                summary: summary, // Grouped ship totals
                raw: rawResults    // Individual items
            });

        } catch (err) {
            console.error("Parser Error:", err.message);
            res.status(500).json({ status: "error", message: err.message });
        }
    });

    app.listen(PORT, () => {
        console.log(`🌐 Scan Parser Web Interface active on port ${PORT}`);
    });
}

module.exports = startWebServer;