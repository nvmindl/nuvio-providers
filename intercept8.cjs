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

    await page.goto(MOVIE, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    const playerUrl = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[data-src*="video_player"]');
        return iframe?.dataset?.src || null;
    });
    if (!playerUrl) { console.log('No player URL'); await browser.close(); process.exit(1); }

    // Before loading player, record ALL globals
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1440, height: 900 });
    await page2.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    
    // Capture globals BEFORE scripts by intercepting scripts
    await page2.setRequestInterception(true);
    
    const scriptContents = {};
    let scriptIndex = 0;
    
    page2.on('request', (req) => {
        req.continue();
    });

    // Hook to track what Script 0 adds to window
    await page2.evaluateOnNewDocument(() => {
        // Record all window property names before any script
        window.__beforeScripts = new Set(Object.getOwnPropertyNames(window));
        
        // Track script executions via MutationObserver
        window.__scriptSnapshots = [];
        
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.tagName === 'SCRIPT') {
                        const currentGlobals = new Set(Object.getOwnPropertyNames(window));
                        const newGlobals = [...currentGlobals].filter(k => !window.__beforeScripts.has(k) && !k.startsWith('__'));
                        window.__scriptSnapshots.push({
                            src: node.src || null,
                            inlineStart: node.textContent?.slice(0, 60),
                            newGlobals: newGlobals.slice(0, 50),
                        });
                        // Update baseline
                        window.__beforeScripts = currentGlobals;
                    }
                }
            }
        });
        observer.observe(document, { childList: true, subtree: true });
    });

    await page2.goto(playerUrl, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});

    // Get script snapshots
    const snapshots = await page2.evaluate(() => window.__scriptSnapshots || []);
    console.log('=== Script Execution Order & New Globals ===');
    snapshots.forEach((s, i) => {
        console.log(`\n[${i}] ${s.src || s.inlineStart?.slice(0, 80)}`);
        if (s.newGlobals.length) {
            console.log('  New globals:', s.newGlobals.join(', '));
        } else {
            console.log('  No new globals');
        }
    });

    // Also get the Script 0 (protection) full text to analyze
    const protectionScript = await page2.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script:not([src])'));
        // Find the protection script (starts with (()=>{var K=')
        const s0 = scripts.find(s => s.textContent.startsWith('(()=>{var K='));
        if (!s0) return null;
        return s0.textContent;
    });
    
    if (protectionScript) {
        console.log('\n=== Script 0 (Protection) Analysis ===');
        console.log('Length:', protectionScript.length);
        console.log('Start:', protectionScript.slice(0, 200));
        console.log('End:', protectionScript.slice(-300));
        
        // Search for window assignments
        const windowAssigns = protectionScript.match(/window\[?['"][^'"]+['"]\]?\s*=/g) || [];
        console.log('Window assignments:', windowAssigns.length, windowAssigns.slice(0, 10));
        
        // Search for document.write
        const docWrites = protectionScript.match(/document\[?['"]?write['"]?\]?\(/g) || [];
        console.log('document.write calls:', docWrites.length);
    }

    // Get Script 2 (the _0x main decoder) to understand its dependency
    const script2 = await page2.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script:not([src])'));
        const s2 = scripts.find(s => s.textContent.includes('_0x') && s.textContent.includes('function') && !s.textContent.startsWith('(()=>{var K=') && !s.textContent.includes('use strict') && !s.textContent.startsWith(' jwplayer'));
        return s2?.textContent?.slice(0, 500);
    });
    console.log('\n=== Script 2 Start ===');
    console.log(script2);

    await browser.close();
    process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
