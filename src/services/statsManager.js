/**
 * src/services/statsManager.js
 * Manages killmail counters and session metrics.
 */
const utils = require("../core/helpers");

class StatsManager {
    constructor() {
        // Initialize from persistent storage
        this.totalScanned = utils.loadPersistentStats() || 0;
        
        // Session-specific metrics
        this.sessionScanned = 0;
        this.startTime = new Date();
    }

    /**
     * Increment both session and lifetime counters
     * Returns the new total
     */
    increment() {
        this.totalScanned++;
        this.sessionScanned++;
        return this.totalScanned;
    }

    /**
     * Current global lifetime count
     */
    getTotal() {
        return this.totalScanned;
    }

    /**
     * Snapshot for the Heartbeat report
     */
    getStatsForReport() {
        return {
            startTime: this.startTime,
            scanCount: this.sessionScanned, // This is what the heartbeat resets daily
        };
    }

    /**
     * Resets the session-only counter (after a report is sent)
     */
    resetSession() {
        this.sessionScanned = 0;
    }

    /**
     * Write current total to data/persistent file
     */
    save() {
        utils.savePersistentStats(this.totalScanned);
    }
}

// Export as a Singleton so the whole app shares one instance
module.exports = new StatsManager();