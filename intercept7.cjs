const puppeteer = require('puppeteer-core');

const BRAVE = '/var/lib/flatpak/app/com.brave.Browser/x86_64/stable/active/files/brave/brave';
const BASE = 'https://web376x.faselhdx.best';
const MOVIE = BASE + '/anime-movies/%d9%81%d9%8a%d9%84%d9%85-jujutsu-kaisen-0';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: BRAVE,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
               '--disable-gpu', '--disable-brave-shields', '--disable-brave-extension',
               '--disable-features=BraveShields,BraveAdBlock'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    // Load movie page for cookies
    await page.goto(MOVIE, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    const playerUrl = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[data-src*="video_player"]');
        return iframe?.dataset?.src || null;
    });
    if (!playerUrl) { console.log('No player URL'); await browser.close(); process.exit(1); }

    // Navigate to player 
    await page.goto(playerUrl, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});

    // Dump the key objects that contain URLs
    const data = await page.evaluate(() => {
        const result = {};
        
        // Find all _0x globals that are objects with interesting keys
        for (const key of Object.getOwnPropertyNames(window)) {
            if (!key.startsWith('_0x')) continue;
            const val = window[key];
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                const keys = Object.keys(val);
                if (keys.includes('file') || keys.includes('sources') || keys.includes('preload')) {
                    // Deep serialize
                    result[key] = JSON.parse(JSON.stringify(val));
                }
            }
        }
        
        // Get the buttons with full data-url
        const btns = document.querySelectorAll('.hd_btn');
        result.__buttons = Array.from(btns).map(b => ({
            text: b.textContent.trim(),
            url: b.getAttribute('data-url'),
            className: b.className,
            outerHTML: b.outerHTML.slice(0, 500),
        }));
        
        // Get jwplayer playlist item  
        try {
            const p = jwplayer('player') || jwplayer();
            const item = p.getPlaylistItem?.();
            result.__jwplayerItem = JSON.parse(JSON.stringify(item || {}));
            result.__jwplayerConfig = {
                state: p.getState?.(),
            };
        } catch(e) { result.__jwplayerError = e.message; }
        
        // Get quality_change full HTML
        const qc = document.querySelector('.quality_change');
        result.__qualityHTML = qc?.innerHTML;
        
        return result;
    });

    console.log('=== JWPlayer Playlist Item ===');
    console.log(JSON.stringify(data.__jwplayerItem, null, 2));
    
    console.log('\n=== Buttons ===');
    data.__buttons?.forEach(b => {
        console.log(`  ${b.text}: ${b.url}`);
    });
    
    console.log('\n=== _0x Objects with file/sources ===');
    for (const [k, v] of Object.entries(data)) {
        if (k.startsWith('_0x')) {
            console.log(`\n${k}:`);
            console.log(JSON.stringify(v, null, 2));
        }
    }

    // Now let's understand the URL structure
    console.log('\n=== URL Pattern Analysis ===');
    data.__buttons?.forEach(b => {
        if (!b.url) return;
        const parts = new URL(b.url);
        console.log(`\n${b.text}:`);
        console.log(`  host: ${parts.hostname}`);
        console.log(`  path: ${parts.pathname}`);
        const pathParts = parts.pathname.split('/');
        pathParts.forEach((p, i) => console.log(`    [${i}]: ${p}`));
    });
    
    // Check the quality_change script to understand how URLs are built
    console.log('\n=== Quality Change Full HTML length ===');
    console.log(data.__qualityHTML?.length || 0);
    
    // Also check if there's an API call that returns URLs
    // By looking at XHR/fetch requests
    
    await browser.close();
    process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
