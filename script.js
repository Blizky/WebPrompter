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
    updateHUD(); 
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
    
    // Listen for incoming connections
    peer.on('connection', c => {
        conn = c;
        setupHostHandlers();
    });
}

function setupHostHandlers() {
    let scrollInterval; // Keep this variable here so we can clear it on disconnect

    conn.on('open', () => {
        // 1. CHANGE TO DOT
        const sb = document.getElementById('status-bar');
        sb.classList.add('status-dot');
        sb.innerText = ''; // Clear text
        
        // Hide QR Overlay
        document.getElementById('qr-overlay').style.display = 'none';
        lockWake();
    });
    
    // 2. DETECT DISCONNECTION
    conn.on('close', () => {
        // Stop scrolling if it was running
        if(scrollInterval) clearInterval(scrollInterval);
        
        // Reset UI: Remove Dot, Show Text
        const sb = document.getElementById('status-bar');
        sb.classList.remove('status-dot');
        sb.innerText = 'WAITING FOR REMOTE...';
        sb.style.background = 'var(--red)'; // Reset to red
        
        // Show QR Code again for reconnection
        document.getElementById('qr-overlay').style.display = 'flex';
    });
    
    conn.on('data', data => {
        /* scroll up logic */
        const container = document.getElementById('scroll-container');
        if (data.action === 'page-up') {
            const scrollAmount = container.clientHeight * 0.8;
            container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
        }

        /* Toggle Play/Pause */
        if (data.action === 'toggle') {
            if (data.state) {
                let pixelBank = 0; 
                scrollInterval = setInterval(() => {
                    pixelBank += settings.speed;
                    if (pixelBank >= 1) {
                        const pixelsToMove = Math.floor(pixelBank); 
                        document.getElementById('scroll-container').scrollTop += pixelsToMove;
                        pixelBank -= pixelsToMove;
                    }
                    updateHUD();
                }, 20); 
            } else {
                clearInterval(scrollInterval);
            }
        }

        /* Settings Updates */
        if (data.action === 'speed-up') settings.speed += 0.25;
        if (data.action === 'speed-down') settings.speed = Math.max(0.25, settings.speed - 0.25);
        if (data.action === 'size-up') settings.size += 5;
        if (data.action === 'size-down') settings.size = Math.max(20, settings.size - 5);
        if (data.action === 'mirror') settings.mirrored = !settings.mirrored;
        
        updateDisplay();
        updateHUD();
        save();
    });
}

function updateDisplay() {
    const display = document.getElementById('text-display');
    display.innerText = settings.text;
    display.style.fontSize = settings.size + 'px';
    const container = document.getElementById('scroll-container');
    container.className = settings.mirrored ? 'mirrored' : '';
}

function updateHUD() {
    const speedEl = document.getElementById('hud-speed');
    if(speedEl) speedEl.innerText = settings.speed.toFixed(2);

    const container = document.getElementById('scroll-container');
    const timeEl = document.getElementById('hud-time');
    
    if(!container || !timeEl) return;

    const pixelsRemaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    
    if (pixelsRemaining <= 0) {
        timeEl.innerText = "00:00";
        return;
    }

    const pixelsPerSecond = settings.speed * 50;
    const secondsLeft = pixelsRemaining / pixelsPerSecond;

    const m = Math.floor(secondsLeft / 60);
    const s = Math.floor(secondsLeft % 60);
    
    timeEl.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
