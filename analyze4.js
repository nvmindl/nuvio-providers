const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };

async function main() {
    const pageUrl = 'https://web376x.faselhdx.best/movies/1-%d9%81%d9%8a%d9%84%d9%85-source-code-2011-%d9%85%d8%aa%d8%b1%d8%ac%d9%85';
    
    const html = await (await fetch(pageUrl, {headers})).text();
    const m = html.match(/'(https?:\/\/[^']+\/video_player\?player_token=[^']+)'/i);
    const playerUrl = m[1];
    console.log('Player URL:', playerUrl);
    
    const playerHtml = await (await fetch(playerUrl, {headers: {...headers, Referer: pageUrl}})).text();
    
    // ========= APPROACH 1: Extract and execute the string array + decoder =========
    console.log('\n=== APPROACH 1: Decode the string array ===');
    
    const qcMatch = playerHtml.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
    const scriptMatch = qcMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
    const script = scriptMatch[1].trim();
    
    // The script structure is:
    // 1. IIFE that creates and shuffles the array: (function(_0x..., _0x...){ ... var _0x... = _0x...(); while(!![]){...} }(arr_fn, target_hash))
    // 2. function _0x2a38(_0x..., _0x...){...} - the decoder
    // 3. Main body that uses wrapper functions calling _0x2a38
    
    // Let's find where the IIFE ends and the decoder starts
    // The IIFE pattern: (function(...){...}(fn, num))
    // Then: function _0x2a38(...){...}
    
    const decoderIdx = script.indexOf('function _0x2a38');
    console.log('Decoder function at position:', decoderIdx);
    
    // Find the end of the decoder function
    let braceCount = 0;
    let decoderEnd = -1;
    let inDecoder = false;
    for (let i = decoderIdx; i < script.length; i++) {
        if (script[i] === '{') { braceCount++; inDecoder = true; }
        if (script[i] === '}') { braceCount--; }
        if (inDecoder && braceCount === 0) { decoderEnd = i + 1; break; }
    }
    console.log('Decoder function ends at:', decoderEnd);
    
    // Extract: everything from start of script to end of decoder function
    const setupCode = script.substring(0, decoderEnd);
    console.log('Setup code length:', setupCode.length);
    
    // Execute setup code to get the decoder function
    try {
        // We need to capture _0x2a38 after execution  
        const evalCode = setupCode + '\n; _0x2a38;';
        const decoder = new Function(evalCode)();
        console.log('Decoder function extracted:', typeof decoder);
        
        // Now brute force decode all possible indices
        console.log('\n--- Decoded strings containing URL parts: ---');
        const urlStrings = [];
        for (let i = -1000; i < 2000; i++) {
            try {
                const s = decoder(i, 'a');
                if (typeof s === 'string' && /https?:|scdns|m3u8|playlist|master|stream|\.m3u8|quality|1080|720|360|auto|button|data-url/i.test(s)) {
                    console.log(`  decoder(${i},'a'):`, s);
                    urlStrings.push(s);
                }
            } catch(e) {}
        }
        
        // The decoder has 2 args, second is a string key. Try different keys
        for (const key of ['', 'a', 'b', 'c', 'd', 'e', 'f']) {
            for (let i = -500; i < 1500; i++) {
                try {
                    const s = decoder(i, key);
                    if (typeof s === 'string' && s.length > 10 && /https?:\/\//i.test(s)) {
                        console.log(`  decoder(${i},'${key}'):`, s);
                        urlStrings.push(s);
                    }
                } catch(e) {}
            }
        }
        
        if (urlStrings.length === 0) {
            console.log('  No URL strings found with single decoder. The wrapper functions add offsets.');
            console.log('  Looking for wrapper function patterns...');
            
            // The wrapper functions are like:
            // function _0x2dcd25(a,b,c,d){return _0x2a38(d+0x36c, c);}
            const wrappers = script.match(/function\s+(_0x[a-f0-9]+)\([^)]+\)\{return\s+_0x2a38\(([^,]+),([^)]+)\);\}/g);
            if (wrappers) {
                console.log('  Found wrapper patterns:');
                wrappers.forEach(w => console.log('    ', w));
            }
        }
    } catch(e) {
        console.log('Setup execution error:', e.message);
    }
    
    // ========= APPROACH 2: Look for alternative API endpoints =========
    console.log('\n\n=== APPROACH 2: Check for API endpoints ===');
    
    // Look for AJAX/fetch/XMLHttpRequest calls in the main page HTML
    const ajaxCalls = html.match(/(?:ajax|fetch|XMLHttpRequest|\.get|\.post)\s*\([^)]*\)/g);
    if (ajaxCalls) {
        console.log('AJAX calls in main page:');
        ajaxCalls.forEach(a => console.log('  ', a));
    }
    
    // Look for any API endpoints
    const apiEndpoints = html.match(/['"]\/api\/[^'"]+['"]/g);
    if (apiEndpoints) {
        console.log('API endpoints:', apiEndpoints);
    }
    
    // Look for URLs in the player HTML that might be stream-related  
    console.log('\nPlayer HTML URLs:');
    const playerUrls = playerHtml.match(/https?:\/\/[^\s'"<>]+/g);
    if (playerUrls) {
        const unique = [...new Set(playerUrls)].filter(u => 
            /stream|m3u8|scdns|video|play|embed|cdn/i.test(u)
        );
        unique.forEach(u => console.log('  ', u));
    }
    
    // ========= APPROACH 3: Look for JWPlayer setup in the player page =========
    console.log('\n\n=== APPROACH 3: JWPlayer setup ===');
    const jwSetup = playerHtml.match(/jwplayer\s*\([^)]*\)\s*\.\s*setup\s*\(\s*\{([\s\S]*?)\}\s*\)/);
    if (jwSetup) {
        console.log('JWPlayer setup found:');
        console.log(jwSetup[0].substring(0, 500));
    } else {
        console.log('No JWPlayer setup found');
        
        // Check for file: null or file: some url
        const fileMatch = playerHtml.match(/['"]?file['"]?\s*:\s*['"]?([^'"}\s,]+)/);
        if (fileMatch) console.log('File:', fileMatch[1]);
        
        // Check for sources array
        const sourcesMatch = playerHtml.match(/['"]?sources['"]?\s*:\s*\[([\s\S]*?)\]/);
        if (sourcesMatch) console.log('Sources:', sourcesMatch[1].substring(0, 200));
    }
    
    // Look for the player token and try to get stream info differently
    const tokenMatch = playerUrl.match(/player_token=([^&]+)/);
    if (tokenMatch) {
        console.log('\nPlayer token:', tokenMatch[1]);
        
        // Try common API patterns
        const base = 'https://web376x.faselhdx.best';
        const tryUrls = [
            `${base}/api/video/${tokenMatch[1]}`,
            `${base}/ajax/video/${tokenMatch[1]}`,
            `${base}/embed/${tokenMatch[1]}`,
            `${base}/api/player/${tokenMatch[1]}`,
        ];
        
        for (const url of tryUrls) {
            try {
                const resp = await fetch(url, {headers: {...headers, Referer: pageUrl}});
                console.log(`  ${url} -> ${resp.status}`);
                if (resp.ok) {
                    const text = await resp.text();
                    console.log('    ', text.substring(0, 200));
                }
            } catch(e) {
                console.log(`  ${url} -> Error: ${e.message}`);
            }
        }
    }
}

main().catch(e => console.error('Fatal:', e.message));
