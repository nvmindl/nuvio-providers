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

    // Step 1: Load movie page to get cookies
    console.log('1. Loading movie page for cookies...');
    await page.goto(MOVIE, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});

    const playerUrl = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[data-src*="video_player"]');
        return iframe?.dataset?.src || null;
    });
    console.log('2. Player URL:', playerUrl ? 'found' : 'NOT FOUND');
    if (!playerUrl) { await browser.close(); process.exit(1); }

    // Step 2: Intercept scripts on player page to capture crypto operations
    await page.setRequestInterception(true);
    
    const capturedScripts = {};
    
    page.on('request', (req) => {
        req.continue();
    });

    // Before navigating to player, inject hooks
    await page.evaluateOnNewDocument(() => {
        // Capture all CryptoJS or atob/btoa usage
        window.__fasel_hooks = {
            atobCalls: [],
            cryptoCalls: [],
            jwplayerSetup: null,
            buttonUrls: [],
        };
        
        // Hook atob
        const origAtob = atob;
        window.atob = function(str) {
            const result = origAtob.call(this, str);
            if (str.length > 50) {
                window.__fasel_hooks.atobCalls.push({
                    input: str.slice(0, 100),
                    output: result.slice(0, 100),
                    inputLen: str.length,
                    outputLen: result.length,
                });
            }
            return result;
        };

        // Hook createElement to catch button creation
        const origCreate = document.createElement;
        document.createElement = function(tag) {
            const el = origCreate.call(this, tag);
            if (tag.toLowerCase() === 'button' || tag.toLowerCase() === 'div') {
                const origSetAttr = el.setAttribute;
                el.setAttribute = function(name, value) {
                    if (name === 'data-url' && value && value.includes('scdns')) {
                        window.__fasel_hooks.buttonUrls.push(value);
                    }
                    return origSetAttr.call(this, name, value);
                };
            }
            return el;
        };

        // Hook innerHTML setter
        const origInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        Object.defineProperty(Element.prototype, 'innerHTML', {
            set: function(val) {
                if (typeof val === 'string' && val.includes('data-url') && val.includes('scdns')) {
                    window.__fasel_hooks.buttonUrls.push('innerHTML:' + val.slice(0, 500));
                }
                return origInnerHTML.set.call(this, val);
            },
            get: origInnerHTML.get,
        });
    });

    // Step 3: Navigate to player page
    console.log('3. Loading player page...');
    await page.goto(playerUrl, { waitUntil: 'networkidle0', timeout: 30000 }).catch(e => console.log('timeout:', e.message));

    // Step 4: Extract hook data
    const hookData = await page.evaluate(() => window.__fasel_hooks);
    
    console.log('\n=== Hook Results ===');
    console.log('atob calls (len>50):', hookData.atobCalls.length);
    hookData.atobCalls.forEach((c, i) => {
        console.log(`  [${i}] inputLen=${c.inputLen} outputLen=${c.outputLen}`);
        console.log(`      in:  ${c.input}`);
        console.log(`      out: ${c.output}`);
    });
    
    console.log('Button URLs captured:', hookData.buttonUrls.length);
    hookData.buttonUrls.forEach(u => console.log('  ', u.slice(0, 250)));
    
    console.log('jwplayer setup:', hookData.jwplayerSetup);
    
    // Step 5: Also capture all scripts in order and their sizes
    const scripts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script')).map((s, i) => ({
            idx: i,
            src: s.src || null,
            inlineLen: s.textContent?.length || 0,
            inline10chars: s.textContent?.slice(0, 80),
        }));
    });
    console.log('\n=== Scripts ===');
    scripts.forEach(s => {
        console.log(`  [${s.idx}] ${s.src || `inline(${s.inlineLen})`} ${s.inline10chars || ''}`);
    });

    // Step 6: Check if there are any global crypto objects
    const globals = await page.evaluate(() => {
        const found = [];
        for (const key of Object.getOwnPropertyNames(window)) {
            const val = window[key];
            if (key.startsWith('_0x') || key.startsWith('CryptoJS') || key.match(/^[a-z]{2,5}$/)) continue;
            if (typeof val === 'function' && key.length > 4 && key.length < 30 && !key.startsWith('on') && !key.startsWith('webkit')) {
                // skip
            }
        }
        // Check for CryptoJS
        if (typeof CryptoJS !== 'undefined') found.push('CryptoJS:' + Object.keys(CryptoJS).join(','));
        // Check for common _0x patterns
        const ox = Object.keys(window).filter(k => k.startsWith('_0x'));
        found.push('_0x globals: ' + ox.length + ' => ' + ox.slice(0, 10).join(', '));
        return found;
    });
    console.log('\n=== Globals ===');
    globals.forEach(g => console.log(' ', g));

    await browser.close();
    process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
