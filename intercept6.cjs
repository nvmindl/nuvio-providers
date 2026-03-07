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

    // Step 1: Load movie page for cookies
    console.log('1. Loading movie page...');
    await page.goto(MOVIE, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});

    const playerUrl = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[data-src*="video_player"]');
        return iframe?.dataset?.src || null;
    });
    if (!playerUrl) { console.log('No player URL'); await browser.close(); process.exit(1); }

    // Step 2: Navigate to player page
    console.log('2. Loading player page...');
    await page.goto(playerUrl, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});

    // Step 3: Dump _0x globals and their values
    const oxData = await page.evaluate(() => {
        const result = {};
        for (const key of Object.getOwnPropertyNames(window)) {
            if (key.startsWith('_0x')) {
                const val = window[key];
                const type = typeof val;
                if (type === 'string') {
                    result[key] = { type, value: val.slice(0, 200) };
                } else if (type === 'function') {
                    result[key] = { type, str: val.toString().slice(0, 200) };
                } else if (type === 'number' || type === 'boolean') {
                    result[key] = { type, value: val };
                } else if (Array.isArray(val)) {
                    result[key] = { type: 'array', length: val.length, sample: val.slice(0, 5).map(v => typeof v === 'string' ? v.slice(0, 50) : String(v)) };
                } else if (type === 'object' && val !== null) {
                    result[key] = { type: 'object', keys: Object.keys(val).slice(0, 10) };
                }
            }
        }
        return result;
    });
    
    console.log('\n=== _0x globals ===');
    for (const [k, v] of Object.entries(oxData)) {
        if (v.type === 'string') {
            console.log(`  ${k} = "${v.value}"`);
        } else if (v.type === 'function') {
            console.log(`  ${k} = fn: ${v.str.slice(0, 120)}`);
        } else {
            console.log(`  ${k} =`, JSON.stringify(v));
        }
    }

    // Step 4: Dump the quality_change div (which has the hd_btn buttons)
    const qualityDiv = await page.evaluate(() => {
        const div = document.querySelector('.quality_change');
        return div ? div.innerHTML : null;
    });
    console.log('\n=== Quality Buttons HTML ===');
    console.log(qualityDiv?.slice(0, 2000));

    // Step 5: Get the full inline scripts (the last two that are the _0x and player scripts)
    const inlineScripts = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('script:not([src])'));
        return all.map(s => ({
            len: s.textContent.length,
            first80: s.textContent.slice(0, 80),
            last200: s.textContent.slice(-200),
        }));
    });
    console.log('\n=== Inline Script Endings ===');
    inlineScripts.forEach((s, i) => {
        console.log(`\n[${i}] len=${s.len}`);
        console.log('  start:', s.first80);
        console.log('  end:  ', s.last200);
    });

    // Step 6: Check for CryptoJS usage
    const cryptoInfo = await page.evaluate(() => {
        if (typeof CryptoJS !== 'undefined') {
            return 'CryptoJS found: ' + Object.keys(CryptoJS).join(', ');
        }
        return 'No CryptoJS';
    });
    console.log('\n=== Crypto ===');
    console.log(cryptoInfo);

    // Step 7: Try to find the specific decryption function
    // Look for any function that takes the player token and outputs URLs
    const playerScript = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script:not([src])'));
        // Find the one starting with jwplayer.key
        const ps = scripts.find(s => s.textContent.includes('jwplayer.key'));
        if (!ps) return null;
        const text = ps.textContent;
        
        // Find AES/decrypt/CryptoJS references
        const patterns = [
            /CryptoJS[\w.]+/g,
            /AES/g,
            /decrypt/gi,
            /encrypt/gi,
            /\.parse\(/g,
            /Utf8/g,
            /Base64/g,
            /enc\./g,
            /mode\./g,
            /pad\./g,
        ];
        const found = {};
        patterns.forEach(p => {
            const matches = text.match(p);
            if (matches) found[p.source] = matches.slice(0, 10);
        });
        return found;
    });
    console.log('\n=== Player Script Crypto Patterns ===');
    console.log(JSON.stringify(playerScript, null, 2));

    await browser.close();
    process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
