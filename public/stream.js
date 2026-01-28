/* --- Configuration & State --- */
const socket = io();
const feed = document.getElementById('feed');
const status = document.getElementById('status');
const counterElement = document.getElementById('kill-counter');
const MAX_FEED_SIZE = 50;
let isTyping = false; // Safety flag to prevent double-typing

/* --- Utility Functions --- */

async function initRegionFilter() {
    try {
        const response = await fetch('/data/esi_cache.json'); 
        const json = await response.json();
        const datalist = document.getElementById('regionOptions');
        
        // Extract names directly from your "regions" object
        if (json.regions) {
            Object.values(json.regions).sort().forEach(regionName => {
                const opt = document.createElement('option');
                opt.value = regionName;
                datalist.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Terminal Error: Region index inaccessible.", err);
    }
}

// Attach the listener to the search input
document.getElementById('regionSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('.kill-row');

    rows.forEach(row => {
        // Target your .location-info where the region string exists
        const locationStr = row.querySelector('.location-info')?.textContent.toLowerCase() || "";
        
        // Use the native hidden attribute to hide non-matches
        // If the box is empty, all rows stay visible (row.hidden = false)
        row.hidden = term !== "" && !locationStr.includes(term);
    });
});

initRegionFilter();
// Types text character-by-character into a target element
const typeTitle = (elementId, text, speed = 150) => {
    if (isTyping) return;
    isTyping = true;
    
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = ""; 
    let i = 0;
    
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else {
            element.style.borderRight = "none"; // Hide cursor on completion
        }
    }
    type();
};

// Converts raw ISK values to readable shorthand
const formatIskValue = (value) => {
    const num = Number(value);
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + "B";
    return (num / 1000000).toFixed(2) + "M";
};

/* --- Socket Handlers --- */

socket.on('connect', () => {
    status.innerText = "ONLINE";
    status.className = "badge bg-success";
});

socket.on('disconnect', () => {
    status.innerText = "OFFLINE";
    status.className = "badge bg-danger";
});

socket.on('gatekeeper-stats', (data) => {
    if (counterElement && data.totalScanned) {
        counterElement.innerText = data.totalScanned.toLocaleString();
    }
});

socket.on('player-count', (data) => {
    const display = document.getElementById('player-count');
    const toast = document.getElementById('player-toast');
    
    if (data && data.active) {
        toast.classList.remove('d-none');
        display.innerText = data.count.toLocaleString();
    } else {
        // Handle the "OFFLINE" state if ESI fails
        display.innerText = "OFFLINE";
        display.classList.replace('text-success', 'text-danger');
    }
});

socket.on('nebula-update', (data) => {
    if (data && data.url) {
        const tempImg = new Image();
        tempImg.src = data.url;
        tempImg.onload = () => {
            document.body.style.backgroundImage = `linear-gradient(rgba(13, 17, 23, 0.8), rgba(13, 17, 23, 0.8)), url('${data.url}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundAttachment = 'fixed';
            document.body.style.backgroundPosition = 'center';

            const credit = document.getElementById('image-credit');
            if (credit) {
                const displayName = data.name.split('.')[0].replace(/_/g, ' ').toUpperCase();
                credit.innerHTML = `LOCATION: <span class="text-success">${displayName}</span> | ART: <span class="text-white">RIXX JAVIX</span>`;
            }
        };
        console.log("Background updated via API");
    }
});

socket.on('raw-kill', (kill) => {

    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.remove(); // loading state

    if (counterElement && kill.totalScanned) {
        counterElement.innerText = kill.totalScanned.toLocaleString();
    }

    const val = Number(kill.val);
    const isWhale = val >= 10000000000; // 10B+
    const isBillion = val >= 1000000000; // 1B+
    
    const div = document.createElement('div');
    div.className = `kill-row justify-content-between ${isWhale ? 'whale' : ''}`;
    
    const valueFormatted = formatIskValue(val);
    const iskClass = isBillion ? 'isk-billion' : 'isk-million';
    const victim = kill.victimName || "Unknown Pilot";
    
    // EVE Time (UTC) refinement
    const now = new Date();
    const timestamp = `[${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}]`;

/* --- Updated inside socket.on('raw-kill') --- */

div.innerHTML = `
    <div class="d-flex align-items-center" style="flex: 1;">
        <div class="ship-icon-container">
            <img src="${kill.shipImageUrl}" class="ship-render" loading="lazy">
        </div>
        <div class="kill-info">
            <div>
                <span class="timestamp">${timestamp}</span>
                <strong class="ship-name">${victim} lost a ${kill.ship}</strong>
            </div>
            <div class="small">
                <span class="location-label">${kill.locationLabel}</span>
            </div>
        </div>
    </div>
    
    <div class="d-flex align-items-center">
        <div class="corp-square-container me-3">
            <img src="${kill.corpImageUrl}" class="corp-logo-square" loading="lazy">
        </div>
        
        <div class="text-end" style="width: 100px;">
            <div class="${iskClass} fw-bold">${valueFormatted}</div>
            <a href="${kill.zkillUrl}" target="_blank" class="btn btn-sm btn-outline-secondary mt-1" style="font-size: 10px; width: 100%;">DETAILS</a>
        </div>
    </div>
`;

    const overlay = document.querySelector('body');
    overlay.style.opacity = '0.9';
    setTimeout(() => overlay.style.opacity = '1', 50);

    feed.prepend(div);
    if (feed.children.length > MAX_FEED_SIZE) feed.lastChild.remove();
});

/* --- Unified Bootloader --- */

const initApp = () => {
    typeTitle('socket-title', 'Socket.Kill', 150);
};

// Ensures one single execution trigger
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}