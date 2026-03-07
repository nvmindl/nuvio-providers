const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };

async function main() {
    const pageUrl = 'https://web376x.faselhdx.best/movies/1-%d9%81%d9%8a%d9%84%d9%85-source-code-2011-%d9%85%d8%aa%d8%b1%d8%ac%d9%85';
    
    const html = await (await fetch(pageUrl, {headers})).text();
    const m = html.match(/'(https?:\/\/[^']+\/video_player\?player_token=[^']+)'/i);
    if (!m) { console.log('No player URL found'); return; }
    console.log('Player URL:', m[1].substring(0, 80) + '...');
    
    const playerHtml = await (await fetch(m[1], {headers: {...headers, Referer: pageUrl}})).text();
    
    const qcMatch = playerHtml.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
    if (!qcMatch) { console.log('No quality_change div'); return; }
    
    const scriptMatch = qcMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
    if (!scriptMatch) { console.log('No script in quality_change'); return; }
    
    const script = scriptMatch[1];
    console.log('Script length:', script.length);
    console.log('');
    
    // Strategy 1: Find the string array function
    const arrayMatch = script.match(/var\s+(_0x[a-f0-9]+)\s*=\s*function\(\)\s*\{[^}]*return\s*(\[[\s\S]*?\]);/);
    if (arrayMatch) {
        console.log('=== Found string array function:', arrayMatch[1]);
        try {
            const arr = eval(arrayMatch[2]);
            console.log('Array length:', arr.length);
            for (let i = 0; i < arr.length; i++) {
                if (/scdns|m3u8|master|stream|playlist|data-url|http|button|quality|sd|hd|1080|720|360|auto/i.test(arr[i])) {
                    console.log('  [' + i + ']:', arr[i]);
                }
            }
        } catch(e) { console.log('Eval error:', e.message); }
    } else {
        console.log('No simple array match found');
    }
    
    // Strategy 2: Look for ALL string literals in the script
    console.log('');
    console.log('=== All unique string literals containing URL-like content:');
    const stringLiterals = script.match(/'[^']*(?:scdns|m3u8|playlist|http|\.m3u8|stream)[^']*'/gi);
    if (stringLiterals) {
        [...new Set(stringLiterals)].forEach(s => console.log('  ', s));
    } else {
        console.log('  None found');
    }
    
    // Strategy 3: Look for string concatenation patterns that build URLs
    console.log('');
    console.log('=== String concatenation patterns near m3u8/scdns:');
    const concatPatterns = script.match(/['"][^'"]*(?:m3u8|scdns|playlist)[^'"]*['"]\s*[\+\,]/g);
    if (concatPatterns) {
        concatPatterns.forEach(p => console.log('  ', p));
    }
    
    // Strategy 4: Find the structure - what does the beginning look like?
    console.log('');
    console.log('=== Script structure (first 300 chars):');
    console.log(script.substring(0, 300));
    
    // Strategy 5: Look for function that decodes strings
    console.log('');
    console.log('=== Decoder function patterns:');
    const decoderMatches = script.match(/function\s+(_0x[a-f0-9]+)\s*\([^)]*\)\s*\{[^}]*parseInt/g);
    if (decoderMatches) {
        decoderMatches.forEach(m => console.log('  ', m.substring(0, 80)));
    }
    
    // Strategy 6: Try running the ENTIRE script with a mock document
    console.log('');
    console.log('=== Trying full script execution with mock document:');
    let capturedHtml = '';
    const mockDocument = {
        write: function(html) { capturedHtml += html; },
        writeln: function(html) { capturedHtml += html; }
    };
    
    try {
        const fn = new Function('document', script);
        fn(mockDocument);
        console.log('Captured HTML length:', capturedHtml.length);
        if (capturedHtml.length > 0) {
            // Extract data-url from the generated HTML
            const urlMatches = capturedHtml.match(/data-url="([^"]+)"/g);
            if (urlMatches) {
                console.log('Found data-url attributes:');
                urlMatches.forEach(u => console.log('  ', u));
            }
            console.log('');
            console.log('Captured HTML preview:', capturedHtml.substring(0, 500));
        }
    } catch(e) {
        console.log('Execution error:', e.message);
    }
    
    // Strategy 7: Check if there's a literal URL somewhere we're missing
    console.log('');
    console.log('=== Any literal URLs:');
    const urls = script.match(/https?:\/\/[^\s'"<>]+/g);
    if (urls) urls.forEach(u => console.log('  ', u));
    else console.log('  None');
}

main().catch(e => console.error('Fatal:', e.message));
