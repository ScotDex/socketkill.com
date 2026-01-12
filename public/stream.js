const socket = io();
const feed = document.getElementById('feed');
const status = document.getElementById('status');

socket.on('connect', () => {
    status.innerText = "ONLINE";
    status.className = "badge bg-success";
});

socket.on('disconnect', () => {
    status.innerText = "OFFLINE";
    status.className = "badge bg-danger";
});

socket.on('nebula-update', (data) => {
    if (data && data.url) {
        // Apply the Rixx Javix background with a subtle overlay for readability
        document.body.style.backgroundImage = `linear-gradient(rgba(13, 17, 23, 0.8), rgba(13, 17, 23, 0.8)), url('${data.url}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundPosition = 'center';
        
        // Update the Credit to Rixx Javix
        const credit = document.getElementById('image-credit'); // Updated ID
        if (credit) {
            // Cleans the filename for the display (e.g., 'Cloud_Ring.jpg' -> 'CLOUD RING')
            const displayName = data.name.split('.')[0].replace(/_/g, ' ');
            credit.innerHTML = `LOCATION: <span class="text-success">${displayName.toUpperCase()}</span> | ART: <span class="text-white">RIXX JAVIX</span>`;
        }
        console.log("🌌 Background updated via Nebula Service");
    }
});


const formatIskValue = (value) => {
    const num = Number(value);
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2) + "B";
    }
    return (num / 1000000).toFixed(2) + "M";
}

const counterElement = document.getElementById('kill-counter');

socket.on('gatekeeper-stats', (data) => {
    if (counterElement && data.totalScanned) {
        counterElement.innerText = data.totalScanned.toLocaleString();
    }
});

socket.on('raw-kill', (kill) => {

    if (counterElement && kill.totalScanned) {
        counterElement.innerText = kill.totalScanned.toLocaleString();
    }
    const div = document.createElement('div');
    const val = Number(kill.val);
    const isWhale = val >= 10000000000; // 10B+
    const isBillion = val >= 1000000000; // 1B+
    div.className = `kill-row justify-content-between ${isWhale ? 'whale' : ''}`;
    const valueFormatted = formatIskValue(val);
    const iskClass = isBillion ? 'isk-billion' : 'isk-million';
    const victim = kill.victimName || "Unknown Pilot";

    div.innerHTML = `
        <div class="d-flex align-items-center" style="flex: 1;">
            <div class="ship-icon-container">
                <img src="${kill.shipImageUrl}" class="ship-render" loading="lazy">
            </div>
            <div class="kill-info">
                <div>
                    <span class="timestamp">[${new Date().toLocaleTimeString()}]</span>
                    <strong class="ship-name">${victim} lost a ${kill.ship}</strong>
                </div>
                <div class="small">
                    <span class="location-label">${kill.locationLabel}</span>
                </div>
            </div>
        </div>
        <div class="text-end" style="width: 150px;">
            <div class="${iskClass}">${valueFormatted}</div>
            <a href="${kill.zkillUrl}" target="_blank" class="btn btn-sm btn-outline-secondary mt-1" style="font-size: 10px;">DETAILS</a>
        </div>
    `;

    feed.prepend(div);
    if (feed.children.length > 50) feed.lastChild.remove();

});