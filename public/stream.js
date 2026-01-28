/* ========================================
   Socket.Kill - Core Terminal Logic
   ======================================== */

/* --- Configuration & State --- */
const socket = io();
const feed = document.getElementById('feed');
const status = document.getElementById('status');
const counterElement = document.getElementById('kill-counter');
const regionSearch = document.getElementById('regionSearch');
const MAX_FEED_SIZE = 50;
let isTyping = false; 

/* --- 1. Utility Functions --- */

/**
 * Formats raw ISK numbers into readable terminal shorthand (M/B)
 */
const formatIskValue = (value) => {
    const num = Number(value);
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + "B";
    return (num / 1000000).toFixed(2) + "M";
};

/**
 * Retro-terminal typewriter effect for titles
 */
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
            element.style.borderRight = "none";
        }
    }
    type();
};

/* --- 2. Global Event Listeners --- */

/**
 * Filter existing kills and manage terminal visibility
 * Placed globally to prevent duplicate listener stacking
 */
regionSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll('.kill-row');

    rows.forEach(row => {
        const locationText = row.querySelector('.location-label')?.textContent.toLowerCase() || "";
        // If term is empty, show all. If typing, show matches only.
        row.hidden = term !== "" && !locationText.includes(term);
    });
});

/* --- 3. Socket Handlers --- */

socket.on('connect', () => {
    status.innerText = "ONLINE";
    status.className = "badge bg-success";
});

socket.on('disconnect', () => {
    status.innerText = "OFFLINE";
    status.className = "badge bg-danger";
});

/**
 * Populates the GOTO_REGION datalist from server-side cache
 */
socket.on('region-list', (regionNames) => {
    const datalist = document.getElementById('regionOptions');
    if (!datalist) return;
    
    datalist.innerHTML = ''; 
    regionNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        datalist.appendChild(opt);
    });
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
    }
});

/**
 * Main Killmail Processor
 */
socket.on('raw-kill', (kill) => {
    // Remove loading state on first data packet
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.remove();

    if (counterElement && kill.totalScanned) {
        counterElement.innerText = kill.totalScanned.toLocaleString();
    }

    const val = Number(kill.val);
    const isWhale = val >= 10000000000; 
    const isBillion = val >= 1000000000; 
    
    const div = document.createElement('div');
    div.className = `kill-row justify-content-between ${isWhale ? 'whale' : ''}`;
    
    const valueFormatted = formatIskValue(val);
    const iskClass = isBillion ? 'isk-billion' : 'isk-million';
    const victim = kill.victimName || "Unknown Pilot";
    
    const now = new Date();
    const timestamp = `[${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}]`;

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

    // Visual Flicker on update
    const overlay = document.querySelector('body');
    overlay.style.opacity = '0.9';
    setTimeout(() => overlay.style.opacity = '1', 50);

    // Apply Active Filter to incoming data
    const currentFilter = regionSearch.value.toLowerCase().trim();
    if (currentFilter !== "") {
        const locationMatch = kill.locationLabel.toLowerCase();
        if (!locationMatch.includes(currentFilter)) {
            div.hidden = true; 
        }
    }

    feed.prepend(div);

    // Memory Management: Prune old rows
    if (feed.children.length > MAX_FEED_SIZE) {
        feed.lastChild.remove();
    }
});

/* --- 4. Unified Bootloader --- */

const initApp = () => {
    typeTitle('socket-title', 'Socket.Kill', 150);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}