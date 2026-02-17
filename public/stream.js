
const socket = io();
const feed = document.getElementById('feed');
const status = document.getElementById('status');
const counterElement = document.getElementById('kill-counter');
const regionSearch = document.getElementById('regionSearch');


const MAX_FEED_SIZE = 50;
let isTyping = false; 
let regionCache = []; 
const SUPPORTERS = ["Shaftmaster Mastershafts", "Romulus", "Pheonix Venom", "Zoey Deninardes", "Himo Naerth", "Shaayaa"];
let supporterIndex = 0;



const cycleSupporters = () => {
    const display = document.getElementById('active-supporter');
    if (!display || SUPPORTERS.length === 0) return;

    display.innerText = SUPPORTERS[supporterIndex];
    supporterIndex = (supporterIndex + 1) % SUPPORTERS.length;
};

function formatIskShorthand(value) {
    if (value >= 1e12) return (value / 1e12).toFixed(2) + "T";
    if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
    if (value >= 1e6) return (value / 1e6).toFixed(1) + "M";
    return value.toLocaleString();
}

function typeBootSequence() {
    const bootLines = [
        '> INITIALIZING GRID MONITOR...',
        '> CONNECTING TO ESI DATASOURCE...',
        '> PARSING ZKILLBOARD STREAM...',
        '> UPLINK ESTABLISHED',
        '> AWAITING KILL DATA'
    ];
    const bootDisplay = document.querySelector('.boot-sequence');
    if (!bootDisplay) return;

    bootDisplay.innerHTML = ''; 
    let lineIndex = 0;
    let charIndex = 0;

    function typeChar() {
        if (lineIndex < bootLines.length) {
            if (charIndex < bootLines[lineIndex].length) {
                bootDisplay.innerHTML += bootLines[lineIndex][charIndex];
                charIndex++;
                setTimeout(typeChar, 30);
            } else {
                bootDisplay.innerHTML += '<br>';
                lineIndex++;
                charIndex = 0;
                if (lineIndex < bootLines.length) {
                    setTimeout(typeChar, 200);
                } else {

                    bootDisplay.innerHTML+= '<span class="dot-pulse"></span>'

            }
        }
    }

}

typeChar();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', typeBootSequence);
} else {
    typeBootSequence();
}




const formatIskValue = (value) => {
    const num = Number(value);
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + "B";
    return (num / 1000000).toFixed(2) + "M";
};


const typeShipNameSurgical = (el, text) => {
    let i = 0;
    const startTime = performance.now(); 
    el.classList.add('typewriter-cursor');

    const render = () => {
        if (i < text.length) {
            if (Math.floor((performance.now() - startTime) / 300) > i) { 
                el.innerText += text[i];
                i++;
            }
            requestAnimationFrame(render);
        } else {
            setTimeout(() => el.classList.remove('typewriter-cursor'), 2000);
        }
    };
    render();
};

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

regionSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll('.kill-row');
    rows.forEach(row => {
        const locationText = row.querySelector('.location-label')?.textContent.toLowerCase() || "";
        row.hidden = term !== "" && !locationText.includes(term);
    });
    suggestionList.innerHTML = ''; 
    
    if (term.length < 2) {
        autocompleteBox.classList.add('d-none');
        return;
    }

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


socket.on('region-list', (regionNames) => {
    regionCache = regionNames; 
});

socket.on('gatekeeper-stats', (data) => {
    if (counterElement && data.totalScanned) {
        counterElement.innerText = data.totalScanned.toLocaleString();
    }
    if (data.totalIsk){
        totalIskDestroyed = data.totalIsk;
        const ticker = document.getElementById("isk-ticker-val")
        if (ticker){
            ticker.innerText = formatIskShorthand(totalIskDestroyed);
        }
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

socket.on('raw-kill', (kill) => {

    const prefetchShip = new Image();
    const prefetchCorp = new Image();
    prefetchShip.src = kill.shipImageUrl;
    prefetchCorp.src = kill.corpImageUrl;
    const val = Number(kill.val) || 0;
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.remove();

if (counterElement && kill.totalScanned) {
        counterElement.innerText = kill.totalScanned.toLocaleString();
        counterElement.classList.remove('counter-update');
        void counterElement.offsetWidth; 
        counterElement.classList.add('counter-update');
    }
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
                <div><strong class="ship-name">
                    <span class="timestamp">${timestamp}</span>
                    ${kill.victimName || "Unknown"} lost
                    <span class="article-target"></span><span class="type-target ship-name-container"></span></strong>
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
                <a href="${kill.zkillUrl}" target="_blank" class="zkill-link">DETAILS</a>
            </div>
        </div>
    `;

    // In your kill handler
div.classList.add('fresh');
setTimeout(() => div.classList.remove('fresh'), 300);
    const overlay = document.querySelector('body');
    overlay.style.opacity = '0.9';
    setTimeout(() => overlay.style.opacity = '1', 50);
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
const updateNPCTicker = async () => {
    const npcDisplay = document.getElementById('npc-count');
    if (!npcDisplay) return;

    try {
        const response = await fetch('https://api.socketkill.com/stats/npc-kills');
        const data = await response.json();

        if (data && data.lifetimeTotal) {
            npcDisplay.innerText = data.lifetimeTotal.toLocaleString();
            npcDisplay.style.opacity = "0.5";
            setTimeout(() => npcDisplay.style.opacity = "1", 200);
        }
    } catch (err) {
        npcDisplay.innerText = "OFFLINE";
        npcDisplay.classList.replace('text-warning', 'text-danger');
    }
};
updateNPCTicker();
setInterval(updateNPCTicker, 300000);
const initApp = () => {
    typeTitle('socket-title', 'Socket.Kill', 150);

    if (SUPPORTERS.length > 0) {
        cycleSupporters(); 
        setInterval(cycleSupporters, 7000); 
    }
};
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}