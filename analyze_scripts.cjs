// Fetch fresh player page, extract the quality_change inline script, 
// and try to run it in Node.js with minimal DOM stubs
const https = require('https');
const http = require('http');

const BASE = 'https://web376x.faselhdx.best';
const MOVIE = BASE + '/anime-movies/%d9%81%d9%8a%d9%84%d9%85-jujutsu-kaisen-0';

function fetch(url, opts = {}) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            ...(opts.headers || {}),
        };
        const req = mod.get(url, { headers, timeout: 15000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetch(res.headers.location, opts).then(resolve).catch(reject);
            }
            const cookies = res.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ body: data, cookies, status: res.statusCode }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}

(async () => {
    // Step 1: Get movie page to find player URL and cookies
    console.log('Fetching movie page...');
    const movieRes = await fetch(MOVIE);
    console.log('Movie page:', movieRes.status, movieRes.body.length, 'bytes');
    
    // Extract player iframe data-src
    const iframeMatch = movieRes.body.match(/data-src="([^"]*video_player[^"]*)"/);
    if (!iframeMatch) { console.log('No player iframe found'); process.exit(1); }
    const playerUrl = iframeMatch[1].replace(/&amp;/g, '&');
    console.log('Player URL:', playerUrl.slice(0, 120));
    
    // Step 2: Fetch player page
    console.log('\nFetching player page...');
    const playerRes = await fetch(playerUrl, {
        headers: { 
            'Referer': MOVIE,
            'Cookie': movieRes.cookies,
        }
    });
    console.log('Player page:', playerRes.status, playerRes.body.length, 'bytes');
    
    // Step 3: Extract all inline scripts
    const scriptRegex = /<script[^>]*>([^<]+(?:<(?!\/script>)[^<]*)*)<\/script>/gi;
    const inlineScripts = [];
    let match;
    while ((match = scriptRegex.exec(playerRes.body)) !== null) {
        const content = match[1].trim();
        if (content.length > 100 && !match[0].includes(' src=')) {
            inlineScripts.push(content);
        }
    }
    console.log('\nInline scripts found:', inlineScripts.length);
    inlineScripts.forEach((s, i) => console.log(`  [${i}] ${s.length} chars: ${s.slice(0, 60)}`));
    
    // Step 4: Find the quality_change script (the one that builds buttons)
    // It's the one that starts with a shuffle IIFE and has hd_btn/data-url
    const qcScript = inlineScripts.find(s => s.includes('hd_btn') || s.includes('data-url'));
    if (!qcScript) {
        console.log('No quality_change script found');
        // Try to find it within quality_change div
        const qcMatch = playerRes.body.match(/<div class="quality_change">([\s\S]*?)<\/div>/);
        if (qcMatch) {
            const qcHtml = qcMatch[1];
            console.log('quality_change div:', qcHtml.length, 'chars');
            const innerScript = qcHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/);
            if (innerScript) {
                console.log('Found script in quality_change:', innerScript[1].length, 'chars');
            }
        }
        process.exit(1);
    }
    
    console.log('\nQuality change script:', qcScript.length, 'chars');
    console.log('Contains _0x:', (qcScript.match(/_0x/g) || []).length, 'refs');
    console.log('Contains hd_btn:', qcScript.includes('hd_btn'));
    console.log('Contains scdns:', qcScript.includes('scdns'));
    console.log('Contains data-url:', qcScript.includes('data-url'));
    console.log('Start:', qcScript.slice(0, 200));
    console.log('End:', qcScript.slice(-200));
    
    // Step 5: Find the jwplayer.key script (Script 3)
    const jwScript = inlineScripts.find(s => s.includes('jwplayer.key'));
    console.log('\nJWPlayer script:', jwScript?.length || 0, 'chars');

    // Step 6: Check if quality_change script is self-contained
    // Extract all function/var declarations at the top level
    const topLevelDefs = qcScript.match(/(?:var|let|const|function)\s+(_0x[a-f0-9]+)/g) || [];
    console.log('\nTop-level definitions in quality_change:', topLevelDefs.length);
    
    // Find all _0x references (calls)
    const allRefs = new Set((qcScript.match(/_0x[a-f0-9]+/g) || []));
    console.log('Unique _0x references:', allRefs.size);
    
    // Step 7: Now try to extract the ENTIRE script chain: find the script 
    // that defines the decoder functions referenced by quality_change
    // The quality_change script calls _0x24ec (or similar) which must be defined elsewhere
    const firstRef = qcScript.match(/return (_0x[a-f0-9]+)\(/);
    if (firstRef) {
        console.log('\nFirst decoder reference:', firstRef[1]);
        // Check if it's defined in the same script
        const defInScript = qcScript.includes(`function ${firstRef[1]}(`) || 
                           qcScript.includes(`var ${firstRef[1]}`);
        console.log('Defined in same script?', defInScript);
        
        if (!defInScript) {
            // Find which script defines it
            for (let i = 0; i < inlineScripts.length; i++) {
                if (inlineScripts[i].includes(`function ${firstRef[1]}(`)) {
                    console.log(`Defined in script [${i}]`);
                }
            }
        }
    }
    
    // Step 8: Try to run quality_change + decoder scripts together
    // First, we need to understand the dependency chain
    // Find all global _0x refs used in quality_change that are NOT defined in it
    console.log('\n=== Dependency Analysis ===');
    
    // Parse the quality_change script to find external _0x references
    // These are _0x names used but not defined (as function or var) within the script
    const definedInQC = new Set();
    const defMatches = qcScript.matchAll(/(?:function\s+(_0x[a-f0-9]+)|var\s+(_0x[a-f0-9]+))/g);
    for (const m of defMatches) {
        definedInQC.add(m[1] || m[2]);
    }
    
    const externalDeps = new Set();
    for (const ref of allRefs) {
        if (!definedInQC.has(ref)) {
            // Check if it might be a parameter name
            externalDeps.add(ref);
        }
    }
    console.log('Defined in QC script:', definedInQC.size);
    console.log('Potential external deps:', externalDeps.size, [...externalDeps].join(', '));

    // Save the scripts for offline analysis
    require('fs').writeFileSync('/tmp/fasel_qc_script.js', qcScript);
    if (jwScript) require('fs').writeFileSync('/tmp/fasel_jw_script.js', jwScript);
    console.log('\nSaved scripts to /tmp/');

})().catch(e => console.error('Error:', e.message));
