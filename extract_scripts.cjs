const https = require('https');
const fs = require('fs');
const BASE = 'https://web376x.faselhdx.best';
const MOVIE = BASE + '/anime-movies/%D9%81%D9%8A%D9%84%D9%85-jujutsu-kaisen-0';

function fetch(url, hdrs = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 'Accept': 'text/html', ...hdrs }, timeout: 15000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetch(res.headers.location, hdrs).then(resolve).catch(reject);
            }
            const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
            let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({body: d, cookies, status: res.statusCode}));
        }).on('error', reject);
    });
}

(async () => {
    const movie = await fetch(MOVIE);
    const tokenMatch = movie.body.match(/player_token=([^"'&<>\s]+)/);
    if (!tokenMatch) { console.log('No token'); return; }
    
    const playerUrl = BASE + '/video_player?player_token=' + tokenMatch[1];
    const player = await fetch(playerUrl, { Referer: MOVIE, Cookie: movie.cookies });
    const html = player.body;
    
    console.log('Player HTML:', html.length, 'bytes');
    
    // Extract ALL scripts in order (including those inside divs)
    // Use a more robust approach - find ALL <script> tags
    const allScripts = [];
    const re = /<script(?:\s+[^>]*)?>([^]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const tag = m[0];
        const content = m[1];
        const srcMatch = tag.match(/src=["']([^"']+)["']/);
        if (srcMatch) {
            allScripts.push({ type: 'external', src: srcMatch[1], idx: allScripts.length });
        } else if (content.trim().length > 50) {
            allScripts.push({ type: 'inline', content: content.trim(), idx: allScripts.length, len: content.trim().length });
        }
    }
    
    console.log('\nAll scripts in order:');
    allScripts.forEach((s, i) => {
        if (s.type === 'external') {
            console.log(`  [${i}] EXTERNAL: ${s.src.slice(0, 80)}`);
        } else {
            console.log(`  [${i}] INLINE ${s.len} chars: ${s.content.slice(0, 60)}...`);
        }
    });
    
    // Find the _0x decoder script (starts with _0x functions, has shuffle)
    const decoderScript = allScripts.find(s => 
        s.type === 'inline' && 
        s.content.startsWith('(function(_0x') &&
        s.content.includes("while(!![])") &&
        !s.content.includes('hd_btn')
    );
    
    // Find the quality_change script (also starts with _0x but has hd_btn or button building)
    // It's inside the quality_change div
    const qcDivMatch = html.match(/<div class="quality_change">([\s\S]*?)<\/div>/);
    let qcScript = null;
    if (qcDivMatch) {
        const innerScript = qcDivMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/);
        if (innerScript) qcScript = innerScript[1].trim();
    }
    
    // Find the jwplayer.key script
    const jwScript = allScripts.find(s => 
        s.type === 'inline' && 
        s.content.includes('jwplayer.key')
    );
    
    console.log('\nDecoder script:', decoderScript ? `FOUND (${decoderScript.len} chars)` : 'NOT FOUND');
    console.log('QC script:', qcScript ? `FOUND (${qcScript.length} chars)` : 'NOT FOUND');
    console.log('JW script:', jwScript ? `FOUND (${jwScript.len} chars)` : 'NOT FOUND');
    
    if (decoderScript) {
        console.log('\nDecoder start:', decoderScript.content.slice(0, 100));
        console.log('Decoder end:', decoderScript.content.slice(-200));
        
        // Check if decoder ends with document.write
        console.log('Has document.write:', decoderScript.content.includes("document['write']") || decoderScript.content.includes("document.write"));
    }
    
    if (qcScript) {
        console.log('\nQC start:', qcScript.slice(0, 100));
        console.log('QC end:', qcScript.slice(-200));
        
        // Check what decoder function the QC script references
        const firstCallMatch = qcScript.match(/return\s+(_0x[a-f0-9]+)\(/);
        if (firstCallMatch) {
            const decoderName = firstCallMatch[1];
            console.log('QC references decoder:', decoderName);
            console.log('Defined in decoder script:', decoderScript?.content.includes('function ' + decoderName));
            console.log('Defined in QC script:', qcScript.includes('function ' + decoderName));
        }
    }
    
    // Save both scripts
    if (decoderScript) fs.writeFileSync('/tmp/fasel_decoder.js', decoderScript.content);
    if (qcScript) fs.writeFileSync('/tmp/fasel_qc_only.js', qcScript);
    if (jwScript) fs.writeFileSync('/tmp/fasel_jw.js', jwScript.content);
    console.log('\nSaved scripts to /tmp/');
    
})().catch(e => console.error(e.message));
