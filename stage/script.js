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
    updateHUD(); // Show initial stats
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
    
    let scrollInterval;
    conn.on('data', data => {
        /* scroll up logic */
        const container = document.getElementById('scroll-container');
        if (data.action === 'page-up') {
            const scrollAmount = container.clientHeight * 0.8;
            container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
        }

        /* Toggle Play/Pause with Smooth Decimal Scrolling */
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

        /* Speed Control (Decimal Steps) */
        if (data.action === 'speed-up') settings.speed += 0.25;
        if (data.action === 'speed-down') settings.speed = Math.max(0.25, settings.speed - 0.25);
        
        /* Other Controls */
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
    
    // IMPORTANT: Apply the mirror class to the CONTAINER, not the text div
    // This ensures the scroll direction flips along with the text
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
