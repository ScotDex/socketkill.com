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
        
        // Add the new Cloudflare mappings here too
        if(data.cf) {
            document.getElementById('shield').innerText = data.stats.cf.shield;
            document.getElementById('bandwidth').innerText = data.stats.cf.throughput;
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