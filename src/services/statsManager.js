/**
 * src/services/statsManager.js
 * Manages killmail counters and session metrics.
 */
const utils = require("../core/helpers");

class StatsManager {
    constructor() {
        // Initialize from persistent storage
        this.totalScanned = utils.loadPersistentStats() || 0;
        this.totalIsk = utils.loadPersistentIsk() || 0;
        
        // Session-specific metrics
        this.sessionScanned = 0;
        this.sessionIsk = 0;
        this.startTime = new Date();
    }

    /**
     * Increment both session and lifetime counters
     * Returns the new total
     */
    increment(iskValue = 0) {
        const val = Number(iskValue) || 0;
        this.totalScanned++;
        this.sessionScanned++;
        this.totalIsk += val;
        this.sessionIsk += val;
        return {
            total: this.totalScanned,
            isk: this.totalIsk
        };
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
        utils.savePersistentIsk(this.totalIsk);
    }
}

// Export as a Singleton so the whole app shares one instance
module.exports = new StatsManager();