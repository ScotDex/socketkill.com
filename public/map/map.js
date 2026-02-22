
let scene, camera, renderer, controls;
let systems = [];
let systemPoints; // The Points object for all systems
let activeMeshes = new Map(); // Active combat zone meshes
let heatmap = new Map(); // Kill tracking data
let raycaster, mouse;

// Constants
const SCALE = 1e-12; // Scale EVE coordinates down
const DECAY_TIME = 300000; // 5 minutes in ms
const DECAY_INTERVAL = 10000; // Check every 10 seconds

// === SOCKET.IO CONNECTION ===
const socket = io();

socket.on('connect', () => {
    console.log('✅ Connected to kill stream');
    updateConnectionStatus('connected');
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from kill stream');
    updateConnectionStatus('disconnected');
});

socket.on('killmail', (kill) => {
    const systemId = kill.solar_system_id;
    
    // Update heatmap data
    const current = heatmap.get(systemId) || { 
        count: 0, 
        value: 0, 
        lastKill: 0 
    };
    
    current.count++;
    current.value += kill.zkb.totalValue;
    current.lastKill = Date.now();
    
    heatmap.set(systemId, current);
    
    // Update visual marker
    updateSystemMarker(systemId, current);
    
    // Update HUD stats
    updateStats();
});

// === CONNECTION STATUS UPDATE ===
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    const statusText = document.querySelector('.status-text');
    
    if (status === 'connected') {
        statusElement.classList.add('connected');
        statusElement.classList.remove('disconnected');
        statusText.textContent = 'CONNECTED';
    } else {
        statusElement.classList.add('disconnected');
        statusElement.classList.remove('connected');
        statusText.textContent = 'DISCONNECTED';
    }
}

// === UPDATE STATS ===
function updateStats() {
    // Active systems count
    document.getElementById('active-systems').textContent = heatmap.size;
    
    // Total kills and ISK
    let totalKills = 0;
    let totalISK = 0;
    let hottestSystem = null;
    let maxKills = 0;
    
    heatmap.forEach((data, systemId) => {
        totalKills += data.count;
        totalISK += data.value;
        
        if (data.count > maxKills) {
            maxKills = data.count;
            const system = systems.find(s => s.id === systemId);
            if (system) hottestSystem = system.name;
        }
    });
    
    document.getElementById('kill-count').textContent = totalKills;
    document.getElementById('hottest-system').textContent = hottestSystem || '--';
    
    // Format ISK (billions)
    const iskB = (totalISK / 1e9).toFixed(1);
    document.getElementById('total-isk').textContent = iskB + 'B';
    
    // Add flash animation to values
    document.querySelectorAll('.stat .value').forEach(el => {
        el.classList.add('updating');
        setTimeout(() => el.classList.remove('updating'), 400);
    });
}

// === UPDATE SYSTEM MARKER ===
function updateSystemMarker(systemId, data) {
    const system = systems.find(s => s.id === systemId);
    if (!system) {
        console.warn(`System ${systemId} not found in dataset`);
        return;
    }
    
    const position = new THREE.Vector3(
        system.x * SCALE,
        system.y * SCALE,
        system.z * SCALE
    );
    
    let mesh = activeMeshes.get(systemId);
    
    if (!mesh) {
        // Create new sphere for this active system
        const geometry = new THREE.SphereGeometry(100, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.8
        });
        
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.userData = { 
            systemId, 
            system,
            pulsePhase: 0
        };
        
        scene.add(mesh);
        activeMeshes.set(systemId, mesh);
        
        console.log(`Created marker for ${system.name} (${data.count} kills)`);
    }
    
    // Update size and intensity based on activity
    const intensity = Math.min(data.count / 10, 1);
    const baseSize = 100;
    const size = baseSize + (data.count * 20);
    
    mesh.scale.setScalar(size / baseSize);
    mesh.material.opacity = 0.5 + (intensity * 0.5);
}

// === DECAY OLD ACTIVITY ===
setInterval(() => {
    const now = Date.now();
    
    heatmap.forEach((data, systemId) => {
        const age = now - data.lastKill;
        
        if (age > DECAY_TIME) {
            // Reduce kill count
            data.count = Math.max(0, data.count - 1);
            
            if (data.count === 0) {
                // Remove from heatmap
                heatmap.delete(systemId);
                
                // Remove and dispose mesh
                const mesh = activeMeshes.get(systemId);
                if (mesh) {
                    scene.remove(mesh);
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                    activeMeshes.delete(systemId);
                    
                    const system = systems.find(s => s.id === systemId);
                    console.log(`Removed marker for ${system?.name || systemId}`);
                }
            } else {
                // Update existing marker
                updateSystemMarker(systemId, data);
            }
        }
    });
    
    updateStats();
}, DECAY_INTERVAL);

// === LOAD SYSTEMS ===
async function loadSystems() {
    try {
        updateLoadingStatus('Loading system coordinates...');
        
        const response = await fetch('/map/data/systems.json');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        systems = await response.json();
        
        // Debug output
        console.log('✅ Loaded', systems.length, 'systems');
        console.log('First system:', systems[0]);
        console.log('Sample security values:', systems.slice(0, 5).map(s => s.security));
        
        updateLoadingStatus(`Loaded ${systems.length} systems`);
        
        return true;
        
    } catch (err) {
        console.error('❌ Failed to load systems:', err);
        updateLoadingStatus('ERROR: Failed to load system data');
        return false;
    }
}

// === UPDATE LOADING STATUS ===
function updateLoadingStatus(message) {
    const statusElement = document.getElementById('loading-status');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

// === HIDE LOADING SCREEN ===
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

// === SCENE INITIALIZATION ===
function initScene() {
    console.log('🎨 Initializing Three.js scene...');
    
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.00000001);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        1,
        1e15
    );
    camera.position.set(5e13, 5e13, 5e13);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    const canvas = document.getElementById('galaxy-map');
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.2;
    controls.minDistance = 1e12;
    controls.maxDistance = 1e14;
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
    
    // Raycaster for hover/click
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);
    
    console.log('✅ Scene initialized');
    
    // Render systems
    renderSystems();
    
    // Hide loading screen
    hideLoadingScreen();
    
    // Start animation loop
    animate();
}

// === RENDER ALL SYSTEMS ===
function renderSystems() {
    console.log('🌌 Rendering systems...');
    
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    
    systems.forEach(sys => {
        // Scale coordinates
        positions.push(
            sys.x * SCALE,
            sys.y * SCALE,
            sys.z * SCALE
        );
        
        // Color by security status
        const color = getSecurityColor(sys.security);
        colors.push(color.r, color.g, color.b);
    });
    
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(colors, 3)
    );
    
    // Material
    const material = new THREE.PointsMaterial({
        size: 50,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true
    });
    
    // Create points
    systemPoints = new THREE.Points(geometry, material);
    scene.add(systemPoints);
    
    console.log('✅ Rendered', systems.length, 'systems');
}

// === GET COLOR BY SECURITY STATUS ===
function getSecurityColor(security) {
    if (security >= 0.5) {
        // High sec - green
        return new THREE.Color(0x00ff00);
    } else if (security > 0) {
        // Low sec - gradient from red to yellow
        const t = security / 0.5;
        return new THREE.Color().lerpColors(
            new THREE.Color(0xff0000),
            new THREE.Color(0xffff00),
            t
        );
    } else {
        // Null sec - red
        return new THREE.Color(0xff0000);
    }
}

// === ANIMATION LOOP ===
function animate() {
    requestAnimationFrame(animate);
    
    // Update controls
    controls.update();
    
    // Animate active system spheres (pulsing)
    activeMeshes.forEach(mesh => {
        if (mesh.userData.pulsePhase !== undefined) {
            mesh.userData.pulsePhase += 0.05;
            const scale = 1 + Math.sin(mesh.userData.pulsePhase) * 0.2;
            mesh.scale.setScalar(scale);
        }
    });
    
    // Render
    renderer.render(scene, camera);
}

// === WINDOW RESIZE ===
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// === MOUSE MOVE (HOVER) ===
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Raycast to find hovered system
    raycaster.setFromCamera(mouse, camera);
    
    const meshArray = Array.from(activeMeshes.values());
    const intersects = raycaster.intersectObjects(meshArray);
    
    const tooltip = document.getElementById('tooltip');
    
    if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const system = mesh.userData.system;
        const data = heatmap.get(system.id);
        
        // Update tooltip content
        const tooltipContent = `
            <div class="tooltip-content">
                <div class="system-name">${system.name}</div>
                <div class="system-info">
                    <span class="info-item">
                        <span class="info-label">Security:</span> 
                        <span class="info-value">${system.security.toFixed(1)}</span>
                    </span>
                    <span class="info-item">
                        <span class="info-label">Kills:</span> 
                        <span class="info-value">${data.count}</span>
                    </span>
                    <span class="info-item">
                        <span class="info-label">ISK Lost:</span> 
                        <span class="info-value">${(data.value / 1e9).toFixed(1)}B</span>
                    </span>
                </div>
                <div class="system-hint">Click to filter feed</div>
            </div>
        `;
        
        tooltip.innerHTML = tooltipContent;
        tooltip.style.left = event.clientX + 15 + 'px';
        tooltip.style.top = event.clientY + 15 + 'px';
        tooltip.classList.add('visible');
    } else {
        tooltip.classList.remove('visible');
    }
}

// === CLICK HANDLER ===
function onClick(event) {
    raycaster.setFromCamera(mouse, camera);
    
    const meshArray = Array.from(activeMeshes.values());
    const intersects = raycaster.intersectObjects(meshArray);
    
    if (intersects.length > 0) {
        const system = intersects[0].object.userData.system;
        
        // Redirect to main feed filtered by this system
        window.location.href = `/?system=${encodeURIComponent(system.name)}`;
    }
}

// === INITIALIZATION ===
async function init() {
    console.log('🚀 Initializing tactical map...');
    
    // Load system data
    const success = await loadSystems();
    
    if (!success) {
        console.error('Failed to load systems - aborting initialization');
        return;
    }
    
    // Test data
    console.log('✅ Systems loaded:', systems.length);
    console.log('First system:', systems[0]);
    console.log('Last system:', systems[systems.length - 1]);
    
    // Test coordinate scaling
    const testSys = systems[0];
    console.log('Original coords:', testSys.x, testSys.y, testSys.z);
    console.log('Scaled coords:', 
        testSys.x * SCALE, 
        testSys.y * SCALE, 
        testSys.z * SCALE
    );
    
    // Initialize Three.js scene
    initScene();
}

// Start when page loads
window.addEventListener('DOMContentLoaded', init);