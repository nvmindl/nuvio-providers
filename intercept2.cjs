const puppeteer = require('puppeteer-core');
const https = require('https');

const BRAVE = '/var/lib/flatpak/app/com.brave.Browser/x86_64/stable/active/files/brave/brave';
const BASE = 'https://web376x.faselhdx.best';
const MOVIE_PATH = '/anime-movies/%d9%81%d9%8a%d9%84%d9%85-jujutsu-kaisen-0';

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': BASE + '/',
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400) {
                return fetchUrl(res.headers.location).then(resolve).catch(reject);
            }
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(d));
        }).on('error', reject);
    });
}

(async () => {
    // Step 1: Fetch movie page to get player token
    console.log('Fetching movie page...');
    const movieHtml = await fetchUrl(BASE + MOVIE_PATH);
    
    // Find player iframe
    const iframeMatch = movieHtml.match(/data-src="([^"]*video_player[^"]*)"/);
    if (!iframeMatch) {
        console.log('No player iframe found');
        // Try alternative pattern
        const altMatch = movieHtml.match(/player_token=([^"&\s]+)/);
        console.log('Alt token match:', altMatch?.[1]?.slice(0, 50));
        process.exit(1);
    }
    
    let playerUrl = iframeMatch[1];
    if (playerUrl.startsWith('//')) playerUrl = 'https:' + playerUrl;
    else if (playerUrl.startsWith('/')) playerUrl = BASE + playerUrl;
    console.log('Fresh player URL:', playerUrl);
    
    // Step 2: Launch browser and load the player page
    const browser = await puppeteer.launch({
        executablePath: BRAVE,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-brave-shields'],
    });
    
    const page = await browser.newPage();
    
    const m3u8Urls = [];
    const allUrls = [];
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const url = req.url();
        allUrls.push(url);
        if (/\.m3u8|scdns\.io/i.test(url)) {
            m3u8Urls.push(url);
            console.log('[M3U8 REQUEST]', url);
        }
        req.continue();
    });
    
    page.on('response', (res) => {
        const url = res.url();
        if (/\.m3u8|scdns\.io/i.test(url)) {
            console.log('[M3U8 RESP]', res.status(), url.slice(0, 200));
        }
    });
    
    console.log('Loading player page in browser...');
    await page.goto(playerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for dynamic content
    console.log('Waiting for dynamic content...');
    await new Promise(r => setTimeout(r, 10000));
    
    // Check for hd_btn elements and JWPlayer state
    const result = await page.evaluate(() => {
        const btns = document.querySelectorAll('.hd_btn[data-url]');
        const buttonData = Array.from(btns).map(b => ({
            text: b.textContent.trim(),
            url: b.getAttribute('data-url'),
        }));
        
        let playerInfo = 'no player';
        try {
            if (typeof jwplayer !== 'undefined') {
                const p = jwplayer('player');
                const item = p.getPlaylistItem ? p.getPlaylistItem() : {};
                const config = p.getConfig ? p.getConfig() : {};
                playerInfo = JSON.stringify({
                    file: item?.file || item?.sources?.[0]?.file || null,
                    sources: item?.sources,
                    state: p.getState?.(),
                    error: config?.error,
                });
            }
        } catch(e) { playerInfo = 'err: ' + e.message; }
        
        // Also get all video/source elements
        const vids = Array.from(document.querySelectorAll('video source, video')).map(v => ({
            src: v.getAttribute('src'),
            type: v.getAttribute('type'),
        }));
        
        return { buttonData, playerInfo, vids };
    });
    
    console.log('\n=== RESULTS ===');
    console.log('m3u8 URLs intercepted:', m3u8Urls.length);
    m3u8Urls.forEach(u => console.log('  ', u));
    
    console.log('\nhd_btn buttons:', result.buttonData.length);
    result.buttonData.forEach(b => console.log('  ', b.text, '→', b.url?.slice(0, 200)));
    
    console.log('\nPlayer info:', result.playerInfo?.slice(0, 500));
    console.log('Video elements:', JSON.stringify(result.vids));
    
    console.log('\nAll URLs (non-trivial):');
    allUrls.filter(u => !/\.js$|\.css$|\.png$|\.jpg$|\.gif$|\.ico$|\.woff|beacon|rum\?|ping\.gif|jwpcdn|cdnjs|cloudflare|madurird|browsecoherent|gukahdbam|bootstrapcdn/i.test(u))
        .forEach(u => console.log('  ', u.slice(0, 200)));
    
    await browser.close();
    process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
