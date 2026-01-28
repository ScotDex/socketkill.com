// monitor.js
const v8 = require('v8');

function startMonitor(thresholdMB = 750) {
    console.log(`[SYSTEM] Vital Signs Monitor Active (Threshold: ${thresholdMB}MB)`);

    setInterval(() => {
        const mem = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();
        
        const toMB = (bytes) => Math.round(bytes / 1024 / 1024);
        
        const metrics = {
            rss: toMB(mem.rss),           // Total memory allocated
            heapUsed: toMB(mem.heapUsed), // Actual JS objects in memory
            heapLimit: toMB(heapStats.heap_size_limit) // Max allowed RAM
        };

        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] RSS: ${metrics.rss}MB | Heap: ${metrics.heapUsed}/${metrics.heapLimit}MB`);

        // Trigger warning if exceeding 75% of your target threshold
        if (metrics.heapUsed > thresholdMB) {
            console.warn(`⚠️  ALERT: High Memory Usage! ${metrics.heapUsed}MB exceeds ${thresholdMB}MB limit.`);
        }
    }, 10000); // 10-second intervals to avoid overhead
}

module.exports = startMonitor;