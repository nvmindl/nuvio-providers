const puppeteer = require('puppeteer-core');

const BRAVE = '/var/lib/flatpak/app/com.brave.Browser/x86_64/stable/active/files/brave/brave';
const BASE = 'https://web376x.faselhdx.best';
const MOVIE_URL = BASE + '/anime-movies/%d9%81%d9%8a%d9%84%d9%85-jujutsu-kaisen-0';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: BRAVE,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', 
               '--disable-gpu', '--disable-brave-shields', '--disable-features=BraveShields'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    
    const m3u8Urls = [];
    const allUrls = [];
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const url = req.url();
        allUrls.push({url, time: Date.now()});
        if (/\.m3u8/i.test(url) || (/scdns\.io/i.test(url) && !/thumb|img/i.test(url))) {
            m3u8Urls.push(url);
            console.log('[M3U8]', url.slice(0, 250));
        }
        req.continue();
    });
    
    // Navigate to movie page directly
    console.log('Loading movie page...');
    await page.goto(MOVIE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Find and click the player iframe or tab
    const frameInfo = await page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe[data-src], iframe[src]');
        const result = [];
        iframes.forEach(f => {
            result.push({
                src: f.getAttribute('src'),
                dataSrc: f.getAttribute('data-src'),
                width: f.width,
                height: f.height,
            });
        });
        // Also look for player tabs/buttons
        const tabs = document.querySelectorAll('[data-ep], .fa-play, .watchBTN, [class*="play"], [class*="watch"]');
        const tabData = Array.from(tabs).map(t => ({
            tag: t.tagName,
            text: t.textContent?.trim().slice(0, 50),
            className: t.className,
            href: t.getAttribute('href'),
        }));
        return { iframes: result, tabs: tabData };
    });
    
    console.log('Frame info:', JSON.stringify(frameInfo, null, 2));
    
    // Try to find and trigger the player
    // First check if there's a lazy-loaded iframe that needs triggering
    await page.evaluate(() => {
        // Trigger lazy load of iframes
        document.querySelectorAll('iframe[data-src]').forEach(f => {
            if (!f.src && f.dataset.src) {
                f.src = f.dataset.src;
            }
        });
    });
    
    console.log('Waiting for player to load...');
    await new Promise(r => setTimeout(r, 15000));
    
    // Check all frames for m3u8 and hd_btn
    const frames = page.frames();
    console.log('Frames:', frames.length);
    for (const frame of frames) {
        try {
            const url = frame.url();
            if (url.includes('video_player') || url.includes('player')) {
                console.log('Player frame:', url.slice(0, 200));
                
                const data = await frame.evaluate(() => {
                    const btns = document.querySelectorAll('.hd_btn[data-url]');
                    const buttonData = Array.from(btns).map(b => ({
                        text: b.textContent.trim(),
                        url: b.getAttribute('data-url'),
                    }));
                    
                    let playerInfo = null;
                    try {
                        if (typeof jwplayer !== 'undefined') {
                            const p = jwplayer('player');
                            const item = p.getPlaylistItem?.() || {};
                            playerInfo = {
                                file: item?.file,
                                sources: item?.sources,
                                state: p.getState?.(),
                            };
                        }
                    } catch(e) {}
                    
                    return { buttonData, playerInfo, bodyHTML: document.body?.innerHTML?.slice(0, 2000) };
                });
                
                console.log('Buttons:', data.buttonData.length);
                data.buttonData.forEach(b => console.log('  ', b.text, '→', b.url?.slice(0,200)));
                console.log('Player:', JSON.stringify(data.playerInfo));
                console.log('Body HTML sample:', data.bodyHTML?.slice(0, 500));
            }
        } catch(e) { /* cross-origin */ }
    }
    
    console.log('\nm3u8 URLs:', m3u8Urls.length);
    m3u8Urls.forEach(u => console.log('  ', u));
    
    console.log('\nAll scdns URLs:');
    allUrls.filter(u => /scdns/i.test(u.url)).forEach(u => console.log('  ', u.url));
    
    await browser.close();
    process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
