let peer, conn, wakeLock = null;
let settings = JSON.parse(localStorage.getItem('wpSettings')) || {
    text: '', speed: 2, size: 60, mirrored: false
};

const isRemote = new URLSearchParams(window.location.search).has('remote');

// --- COMMON FUNCTIONS ---
const save = () => localStorage.setItem('wpSettings', JSON.stringify(settings));

async function lockWake() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}

// --- IPAD (HOST) LOGIC ---
function startHost() {
    settings.text = document.getElementById('script-input').value;
    save();
    document.getElementById('edit-mode').style.display = 'none';
    document.getElementById('prompter-mode').style.display = 'block';
    updateDisplay();
    initP2P();
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
}

function initP2P() {
    const id = 'bliz-' + Math.random().toString(36).substr(2, 5);
    peer = new Peer(id);
    peer.on('open', () => {
        const url = `${window.location.origin}${window.location.pathname}?remote=${id}`;
        new QRCode(document.getElementById("qrcode"), { text: url, width: 256, height: 256 });
        document.getElementById('qr-overlay').style.display = 'flex';
    });
    peer.on('connection', c => {
        conn = c;
        setupHostHandlers();
    });
}

function setupHostHandlers() {
    conn.on('open', () => {
        document.getElementById('status-bar').style.background = '#2ecc71';
        document.getElementById('status-bar').innerText = 'CONNECTED';
        document.getElementById('qr-overlay').style.display = 'none';
        lockWake();
    });

    // Handle explicit disconnects or errors
    conn.on('close', () => showReconnectUI());
    conn.on('error', () => showReconnectUI());
    
    let scrollInterval;
    let heartbeatTimeout;

    conn.on('data', data => {
        // Heartbeat: If no data for 15s, show QR code
        clearTimeout(heartbeatTimeout);
        heartbeatTimeout = setTimeout(() => showReconnectUI(), 15000);

        const container = document.getElementById('scroll-container');

        // Scroll Up
        if (data.action === 'page-up') {
            const scrollAmount = container.clientHeight * 0.8;
            container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
        }

        // Play/Stop Toggle
        if (data.action === 'toggle') {
            clearInterval(scrollInterval); // Fix: Prevents speed stacking
            if (data.state) {
                scrollInterval = setInterval(() => {
                    container.scrollTop += settings.speed;
                }, 20);
            }
        }

        // Granular Speed Control (0.5 steps)
        if (data.action === 'speed-up') {
            settings.speed += 0.5;
        }
        if (data.action === 'speed-down') {
            settings.speed = Math.max(0.5, settings.speed - 0.5);
        }

        // Formatting
        if (data.action === 'size-up') settings.size += 5;
        if (data.action === 'size-down') settings.size = Math.max(20, settings.size - 5);
        if (data.action === 'mirror') settings.mirrored = !settings.mirrored;
        
        updateDisplay();
        save();
    });
}

function showReconnectUI() {
    const status = document.getElementById('status-bar');
    if (status) {
        status.style.background = '#c03221';
        status.innerText = 'DISCONNECTED';
    }
    const qr = document.getElementById('qr-overlay');
    if (qr) qr.style.display = 'flex';
}

function updateDisplay() {
    const display = document.getElementById('text-display');
    display.innerText = settings.text;
    display.style.fontSize = settings.size + 'px';
    display.className = settings.mirrored ? 'mirrored' : '';
}
