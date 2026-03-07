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

    const interesting = [];

    // Intercept ALL network requests
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const url = req.url();
        if (/m3u8|scdns\.io|master\./i.test(url) && !/thumb|img\.scdns/i.test(url)) {
            interesting.push({type: 'req', url: url.slice(0, 300), time: Date.now()});
            console.log('[REQ]', url.slice(0, 300));
        }
        req.continue();
    });
    page.on('response', async (res) => {
        const url = res.url();
        if (/m3u8|scdns\.io|master\./i.test(url) && !/thumb|img\.scdns/i.test(url)) {
            interesting.push({type: 'res', url: url.slice(0, 300), status: res.status()});
            console.log('[RES]', res.status(), url.slice(0, 300));
        }
    });

    // Step 1: Load movie page to get cookies
    console.log('1. Loading movie page...');
    await page.goto(MOVIE, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    
    // Step 2: Get the player URL from iframe data-src
    const playerUrl = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[data-src*="video_player"]');
        return iframe?.dataset?.src || null;
    });
    console.log('2. Player URL:', playerUrl ? playerUrl.slice(0, 120) + '...' : 'NOT FOUND');
    
    if (!playerUrl) {
        console.log('No player URL found');
        await browser.close();
        process.exit(1);
    }

    // Step 3: Navigate to the player directly (same context, with cookies)
    console.log('3. Loading player page...');
    await page.goto(playerUrl, { waitUntil: 'networkidle0', timeout: 30000 }).catch(e => console.log('   nav timeout:', e.message));

    // Step 4: Check player state immediately
    const check = async (label) => {
        const data = await page.evaluate(() => {
            const btns = document.querySelectorAll('.hd_btn');
            const btnData = Array.from(btns).map(b => ({
                text: b.textContent?.trim(),
                url: b.getAttribute('data-url'),
                cls: b.className,
            }));
            let playerState = null;
            try {
                if (typeof jwplayer !== 'undefined') {
                    const p = jwplayer('player') || jwplayer();
                    const item = p.getPlaylistItem?.() || {};
                    playerState = {
                        file: item?.file || null,
                        sources: item?.sources?.map(s => ({file: s.file, label: s.label})) || [],
                        state: p.getState?.(),
                    };
                }
            } catch(e) { playerState = {error: e.message}; }
            
            // Check for any video/source elements
            const videos = Array.from(document.querySelectorAll('video source, video')).map(v => ({
                src: v.src || v.getAttribute('src'),
                type: v.type,
            }));
            
            return { btns: btnData, playerState, videos, scripts: document.querySelectorAll('script').length };
        });
        console.log(`[${label}] Buttons: ${data.btns.length}, Scripts: ${data.scripts}`);
        if (data.btns.length) data.btns.forEach(b => console.log(`  BTN: ${b.text} → ${b.url?.slice(0,200)}`));
        if (data.playerState) console.log(`  Player: ${JSON.stringify(data.playerState)}`);
        if (data.videos.length) console.log(`  Videos: ${JSON.stringify(data.videos)}`);
        return data;
    };

    await check('immediate');

    // Step 5: Wait and recheck periodically
    for (let i = 1; i <= 6; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const d = await check(`+${i*5}s`);
        if (d.btns.length > 0 || d.playerState?.file) {
            console.log('SUCCESS: Found buttons or file URL!');
            break;
        }
    }

    // Step 6: Try clicking play area
    console.log('6. Trying to click play area...');
    try {
        await page.click('#player');
        await new Promise(r => setTimeout(r, 3000));
        await check('after-click');
    } catch(e) { console.log('   click failed:', e.message); }

    // Final summary
    console.log('\n=== Summary ===');
    console.log('Interesting URLs:', interesting.length);
    interesting.forEach(i => console.log(' ', i.type, i.url?.slice(0, 250)));

    await browser.close();
    process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
