/* ========================================
   Socket.Kill - Core Terminal Logic
   ======================================== */

/* --- Configuration & State --- */
const socket = io();
const feed = document.getElementById('feed');
const status = document.getElementById('status');
const counterElement = document.getElementById('kill-counter');
const regionSearch = document.getElementById('regionSearch');
const autocompleteBox = document.getElementById('terminal-autocomplete'); // New
const suggestionList = document.getElementById('suggestion-list');     // New

const MAX_FEED_SIZE = 50;
let isTyping = false; 
let regionCache = []; // Internal search index to prevent duplication bugs

const SUPPORTERS = ["Shaftmaster Mastershafts", "Romulus", "Pheonix Venom", "Zoey Deninardes", "Himo Naerth"];
let supporterIndex = 0;


const cycleSupporters = () => {
    const display = document.getElementById('active-supporter');
    if (!display || SUPPORTERS.length === 0) return;

    display.innerText = SUPPORTERS[supporterIndex];
    supporterIndex = (supporterIndex + 1) % SUPPORTERS.length;
};

/**
 * Formats raw ISK numbers into readable terminal shorthand (M/B)
 */
const formatIskValue = (value) => {
    const num = Number(value);
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + "B";
    return (num / 1000000).toFixed(2) + "M";
};

/**
 * Surgically types text into an element
 */
const typeShipNameSurgical = (el, text, speed = 2) => {
    let i = 0;
    const final = text
    el.classList.add('typewriter-cursor');

    const render = () => {
        if (i < final.length) {
            // Add characters every X frames for a steady "data-write" feel
            if (Math.floor(performance.now() / 200) > i) { 
                el.innerText += final[i];
                i++;
            }
            requestAnimationFrame(render);
        } else {
            // Keep the cursor for 2 seconds after finishing, then fade it
            setTimeout(() => el.classList.remove('typewriter-cursor'), 2000);
        }
    };
    render();
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
 * Unified Input Handler: Manages both Feed Filtering and Custom Autocomplete
 */
regionSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll('.kill-row');

    // 1. Feed Filtering Logic
    rows.forEach(row => {
        const locationText = row.querySelector('.location-label')?.textContent.toLowerCase() || "";
        row.hidden = term !== "" && !locationText.includes(term);
    });

    // 2. Custom Autocomplete Engine
    suggestionList.innerHTML = ''; // Purge old suggestions immediately
    
    if (term.length < 2) {
        autocompleteBox.classList.add('d-none');
        return;
    }

    // Surgical Filter: Limit to top 5 matches
    const matches = regionCache
        .filter(r => r.toLowerCase().includes(term))
        .slice(0, 5); 

    if (matches.length > 0) {
        autocompleteBox.classList.remove('d-none');
        matches.forEach(match => {
            const item = document.createElement('div');
            item.className = 'suggestion-item p-1 pointer';
            item.innerHTML = `> ${match.toUpperCase()}`;
            
            item.onclick = () => {
                regionSearch.value = match;
                autocompleteBox.classList.add('d-none');
                // Force a re-trigger to filter the live feed by the full selection
                regionSearch.dispatchEvent(new Event('input')); 
            };
            suggestionList.appendChild(item);
        });
    } else {
        autocompleteBox.classList.add('d-none');
    }
});


socket.on('connect', () => {
    status.innerText = "ONLINE";
    status.className = "badge bg-success";
});

socket.on('disconnect', () => {
    status.innerText = "OFFLINE";
    status.className = "badge bg-danger";
});

/**
 * Updates the internal region index from server-side cache
 */
socket.on('region-list', (regionNames) => {
    regionCache = regionNames; // Direct overwrite prevents duplication bug
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
        };
    }
});

/**
 * Main Killmail Processor: Handles dynamic injection and memory management
 */
socket.on('raw-kill', (kill) => {

    const oscWave = document.querySelector('.osc-wave');
    if (oscWave) {
        oscWave.classList.add('osc-active');
        // Reset the spike after 800ms to mimic a signal pulse
        setTimeout(() => oscWave.classList.remove('osc-active'), 800);
    }
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.remove();

if (counterElement && kill.totalScanned) {
        counterElement.innerText = kill.totalScanned.toLocaleString();
        counterElement.classList.remove('counter-update');
        void counterElement.offsetWidth; 
        counterElement.classList.add('counter-update');
    }

    const val = Number(kill.val);
    const div = document.createElement('div');
    div.className = `kill-row justify-content-between ${val >= 10000000000 ? 'whale' : ''}`;
    
    const now = new Date();
    const timestamp = `[${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}]`;

    div.innerHTML = `
        <div class="d-flex align-items-center" style="flex: 1;">
            <div class="ship-icon-container">
                <img src="${kill.shipImageUrl}" alt="Ship Render" class="ship-render" loading="lazy">
            </div>
            <div class="kill-info">
                <div>
                    <span class="timestamp">${timestamp}</span>
                    <strong class="ship-name">${kill.victimName || "Unknown"} lost  
                    <span class"article-target"></span>
                    <span class="type-target ship-name-container"></span></strong>
                </div>
                <div class="small">
                    <span class="location-label">${kill.locationLabel}</span>
                </div>
            </div>
        </div>
        <div class="d-flex align-items-center">
            <div class="corp-square-container me-3">
                <img src="${kill.corpImageUrl}" alt="Corporation Logo" class="corp-logo-square" loading="lazy">
            </div>
            <div class="text-end" style="width: 100px;">
                <div class="${val >= 1000000000 ? 'isk-billion' : 'isk-million'} fw-bold">${formatIskValue(val)}</div>
                <a href="${kill.zkillUrl}" target="_blank" class="btn btn-sm btn-outline-secondary mt-1" style="font-size: 10px; width: 100%;">DETAILS</a>
            </div>
        </div>
    `;

    // Visual flicker effect on body
    const overlay = document.querySelector('body');
    overlay.style.opacity = '0.9';
    setTimeout(() => overlay.style.opacity = '1', 50);

    // Filter Injection: Check if new kill matches active terminal filter
    const currentFilter = regionSearch.value.toLowerCase().trim();
    if (currentFilter !== "" && !kill.locationLabel.toLowerCase().includes(currentFilter)) {
        div.hidden = true; 
    }

    feed.prepend(div);
    const articleTarget = div.querySelector('.article-target');
    articleTarget.innerText = kill.article || "a";
    const target = div.querySelector('.type-target');
    typeShipNameSurgical(target, kill.ship);
    if (feed.children.length > MAX_FEED_SIZE) feed.lastChild.remove();
});

/**
 * Fetches and updates the NPC ticker in the footer
 */
const updateNPCTicker = async () => {
    const npcDisplay = document.getElementById('npc-count');
    if (!npcDisplay) return;

    try {
        // Direct hit to your background service on port 2053
        const response = await fetch('https://api.socketkill.com:2053/stats/npc-kills');
        const data = await response.json();

        if (data && data.lifetimeTotal) {
            // Use lifetimeTotal for the "Big Number" branding
            npcDisplay.innerText = data.lifetimeTotal.toLocaleString();
            
            // Optional: Add a subtle flicker to show it updated
            npcDisplay.style.opacity = "0.5";
            setTimeout(() => npcDisplay.style.opacity = "1", 200);
        }
    } catch (err) {
        npcDisplay.innerText = "OFFLINE";
        npcDisplay.classList.replace('text-warning', 'text-danger');
    }
};

// Initial sync on page load
updateNPCTicker();

// Refresh every 5 minutes (300,000ms)
setInterval(updateNPCTicker, 300000);



/* --- 4. Unified Bootloader --- */
const initApp = () => {
    typeTitle('socket-title', 'Socket.Kill', 150);

    if (SUPPORTERS.length > 0) {
        cycleSupporters(); // Run once immediately
        setInterval(cycleSupporters, 7000); // Cycle every 7 seconds
    }
};
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}