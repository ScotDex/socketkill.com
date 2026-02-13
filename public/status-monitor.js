const socket = io();

async function updateHealth() {
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        
        const statusEl = document.getElementById('status');
        if (!statusEl) return; // Guard clause

        statusEl.innerText = data.status;
        statusEl.style.color = (data.status === 'OPERATIONAL') ? "var(--neon-green)" : "#ff0000";

        // Map the rest of the UI
        document.getElementById('sequence').innerText = data.system?.sequence || '---';
        document.getElementById('rss').innerText = data.system?.rss || '---';
        document.getElementById('clients').innerText = data.stats?.activeClients || '0';
        document.getElementById('heap-ratio').innerText = data.system?.heapRatio || '---';

        socket.on('gatekeeper-stats', (data) => {
    // This updates the card instantly every time a kill is counted
    const counterElement = document.getElementById('kill-counter'); // Ensure this ID exists in your HTML
    if (counterElement && data.totalScanned) {
        counterElement.innerText = data.totalScanned.toLocaleString();
        
        // Bonus: Add a "pulse" effect so it looks alive on the CRT
        counterElement.style.color = "var(--neon-green)";
        setTimeout(() => counterElement.style.color = "", 100);
    }
});

socket.on('player-count', (data) => {
    const clientsEl = document.getElementById('clients');
    if (clientsEl && data.count) {
        clientsEl.innerText = data.count.toLocaleString();
    }
});
        
// FIXED PATHING: Your backend sends it as data.stats.cf
if (data.stats && data.stats.cf) {
    const shieldEl = document.getElementById('shield');
    const bandwidthEl = document.getElementById('bandwidth');

    if (shieldEl) shieldEl.innerText = data.stats.cf.shield || '0%';
    if (bandwidthEl) bandwidthEl.innerText = data.stats.cf.throughput || '0 MB';
}
        
    } catch (e) {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.innerText = 'OFFLINE';
            statusEl.style.color = '#ff0000';
        }
    }
}

// Initialize
setInterval(updateHealth, 5000);
updateHealth();