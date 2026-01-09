const socket = io('https://api.voidspark.org:8443');
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

socket.on('nasa-update', (data) => {
    if (data && data.media_type === 'image') {
        // Use the URL provided by your server's cache
        const imageUrl = data.url; 
        
        document.body.style.backgroundImage = `linear-gradient(rgba(13, 17, 23, 0.85), rgba(13, 17, 23, 0.85)), url('${imageUrl}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundPosition = 'center';
        
        const credit = document.getElementById('nasa-credit');
        if (credit) {
            credit.innerText = `NASA APOD: ${data.title}`;
        }
        console.log("🌌 Background updated via Server Cache");
    }
});


const formatIskValue = (value) => {
    const num = Number(value);
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2) + "B";
    }
    return (num / 1000000).toFixed(2) + "M";
}

let totalKills = 0;
const counterElement = document.getElementById('kill-counter');

socket.on('raw-kill', (kill) => {
    const div = document.createElement('div');
    const val = Number(kill.val);
    const isWhale = val >= 10000000000; // 10B+
    const isBillion = val >= 1000000000; // 1B+
    div.className = `kill-row justify-content-between ${isWhale ? 'whale' : ''}`;
    const valueFormatted = formatIskValue(val);
    const iskClass = isBillion ? 'isk-billion' : 'isk-million';
    totalKills++;
    counterElement.innerText = totalKills.toLocaleString();

    div.innerHTML = `
        <div class="d-flex align-items-center" style="flex: 1;">
            <div class="ship-icon-container">
                <img src="${kill.shipImageUrl}" class="ship-render" loading="lazy">
            </div>
            <div class="kill-info">
                <div>
                    <span class="timestamp">[${new Date().toLocaleTimeString()}]</span>
                    <strong class="ship-name">${kill.ship}</strong>
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