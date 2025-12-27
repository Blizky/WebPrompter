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
    
    let scrollInterval;
    conn.on('data', data => {
        /* scroll up */
        const container = document.getElementById('scroll-container');
        if (data.action === 'page-up') {
                // Move up by 80% of the container height to keep some context
                const scrollAmount = container.clientHeight * 0.8;
                container.scrollBy({
                    top: -scrollAmount,
                    behavior: 'smooth'
                });
            }

        /*
        if (data.action === 'toggle') {
            if (data.state) {
                scrollInterval = setInterval(() => {
                    document.getElementById('scroll-container').scrollTop += settings.speed;
                }, 20);
            } else {
                clearInterval(scrollInterval);
            }
        }
*/
        if (data.action === 'toggle') {
            if (data.state) {
                // The "Piggy Bank" for decimal numbers
                let pixelBank = 0; 
                
                scrollInterval = setInterval(() => {
                    // Add the current speed setting to the bank
                    pixelBank += settings.speed;
                    
                    // If the bank is full (has at least 1 whole pixel)...
                    if (pixelBank >= 1) {
                        const pixelsToMove = Math.floor(pixelBank); // Take the whole number
                        
                        // Physically move the screen
                        document.getElementById('scroll-container').scrollTop += pixelsToMove;
                        
                        // Keep the change (decimals) for the next loop
                        pixelBank -= pixelsToMove;
                    }
                }, 20); // Keeps the smooth 50 updates per second
            } else {
                clearInterval(scrollInterval);
            }
        }

       /* 
        if (data.action === 'speed-up') settings.speed++;
        if (data.action === 'speed-down') settings.speed = Math.max(1, settings.speed - 1);
        */

        // Increase speed by small steps (0.25)
        if (data.action === 'speed-up') settings.speed += 0.25;
        // Decrease speed by small steps, allowing it to go very slow (0.25)
        if (data.action === 'speed-down') settings.speed = Math.max(0.25, settings.speed - 0.25);
        
        if (data.action === 'size-up') settings.size += 5;
        if (data.action === 'size-down') settings.size = Math.max(20, settings.size - 5);
        if (data.action === 'mirror') settings.mirrored = !settings.mirrored;
        
        updateDisplay();
        save();
    });
}

function updateDisplay() {
    const display = document.getElementById('text-display');
    display.innerText = settings.text;
    display.style.fontSize = settings.size + 'px';
    display.className = settings.mirrored ? 'mirrored' : '';
}
