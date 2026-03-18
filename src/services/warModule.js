const r2 = require('../network/r2Writer');
const talker = require('../network/agent');

const ESI_BASE = 'https://esi.evetech.net/latest';

async function syncWars() {
    try {
        const res = await talker.get (`${ESI_BASE}/wars/`);
        const warIds = res.data;

        const wars = await Promise.all (
            warIds.slice(0,100).map(async id => {
                try {
                const war = await talker.get (`${ESI_BASE}/wars/${id}/`);
                return res.data;
            } catch {
                return null;
            }
        })
    );

    const active = wars.filter(w => w && !w.finished);
    await r2.put('wars.json', active);
    console.log(`[WARS] Synced ${active.length} active wars to R2`);
} catch (err) {
    console.error(`[WARS] Sync failed: ${err.message}`);
}
}

module.exports = { syncWars };