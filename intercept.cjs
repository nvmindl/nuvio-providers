const puppeteer = require('puppeteer-core');

const BRAVE = '/var/lib/flatpak/app/com.brave.Browser/x86_64/stable/active/files/brave/brave';
const TOKEN = 'QmIvYXo4U0oxRjh6ajdueFphUTBTUVZEUzNPZEpYL3EvSm5sUVc3MXQ3UFF3ZXkv';
const URL = `https://web376x.faselhdx.best/video_player?player_token=${TOKEN}`;

(async () => {
    const browser = await puppeteer.launch({
        executablePath: BRAVE,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    
    const page = await browser.newPage();
    
    // Intercept all network requests
    const m3u8Urls = [];
    const interestingUrls = [];
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const url = req.url();
        if (/\.m3u8|scdns\.io|master\.m3u8|stream/i.test(url)) {
            m3u8Urls.push(url);
            console.log('[M3U8]', url);
        }
        if (/video|player|stream|media|cdn/i.test(url) && !/\.js$|\.css$|\.png$|\.jpg$|\.gif$|\.ico$/i.test(url)) {
            interestingUrls.push(url);
        }
        req.continue();
    });
    
    page.on('response', (res) => {
        const url = res.url();
        if (/\.m3u8|scdns\.io/i.test(url)) {
            console.log('[M3U8 RESPONSE]', res.status(), url);
        }
    });
    
    console.log('Navigating to:', URL);
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait a bit more for dynamic loading
    await new Promise(r => setTimeout(r, 5000));
    
    // Check for hd_btn elements
    const buttons = await page.evaluate(() => {
        const btns = document.querySelectorAll('.hd_btn[data-url]');
        return Array.from(btns).map(b => ({
            text: b.textContent.trim(),
            url: b.getAttribute('data-url'),
            className: b.className,
        }));
    });
    
    console.log('\n=== RESULTS ===');
    console.log('m3u8 URLs found:', m3u8Urls.length);
    m3u8Urls.forEach(u => console.log('  ', u));
    
    console.log('\nhd_btn buttons found:', buttons.length);
    buttons.forEach(b => console.log('  ', b.text, '→', b.url));
    
    console.log('\nInteresting URLs:', interestingUrls.length);
    interestingUrls.forEach(u => console.log('  ', u));
    
    // Also get the JWPlayer source directly
    const playerState = await page.evaluate(() => {
        try {
            const p = (typeof jwplayer !== 'undefined') ? jwplayer('player') : null;
            if (!p) return 'no player';
            const item = p.getPlaylistItem ? p.getPlaylistItem() : null;
            return JSON.stringify({ item, source: p.getSource?.() });
        } catch(e) { return 'err: ' + e.message; }
    });
    console.log('\nPlayer state:', playerState);
    
    await browser.close();
    process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
