// monitor.js
const v8 = require('v8');

function startMonitor(thresholdMB = 750) {
    console.log(`[SYSTEM] Vital Signs Monitor Active (Threshold: ${thresholdMB}MB)`);

    setInterval(() => {
        const mem = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();
        
        const toMB = (bytes) => Math.round(bytes / 1024 / 1024);
        
        const metrics = {
            rss: toMB(mem.rss),           
            heapUsed: toMB(mem.heapUsed), 
            heapLimit: toMB(heapStats.heap_size_limit) 
        };

        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] RSS: ${metrics.rss}MB | Heap: ${metrics.heapUsed}/${metrics.heapLimit}MB`);
        if (metrics.heapUsed > thresholdMB) {
            console.warn(`⚠️  ALERT: High Memory Usage! ${metrics.heapUsed}MB exceeds ${thresholdMB}MB limit.`);
        }
    }, 10000); 
}

module.exports = startMonitor;