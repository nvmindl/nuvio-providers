const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };

async function main() {
    const pageUrl = 'https://web376x.faselhdx.best/movies/1-%d9%81%d9%8a%d9%84%d9%85-source-code-2011-%d9%85%d8%aa%d8%b1%d8%ac%d9%85';
    
    const html = await (await fetch(pageUrl, {headers})).text();
    const m = html.match(/'(https?:\/\/[^']+\/video_player\?player_token=[^']+)'/i);
    const playerHtml = await (await fetch(m[1], {headers: {...headers, Referer: pageUrl}})).text();
    
    const qcMatch = playerHtml.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
    const scriptMatch = qcMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
    const script = scriptMatch[1].trim();
    
    console.log('Script length:', script.length);
    
    // Look around position 21956 where the error occurs
    console.log('\n=== Around position 21900-22100:');
    console.log(script.substring(21900, 22100));
    
    // Look around position 10435
    console.log('\n=== Around position 10400-10600:');
    console.log(script.substring(10400, 10600));
    
    // Look at the first 1000 chars to understand structure
    console.log('\n=== First 1000 chars:');
    console.log(script.substring(0, 1000));
    
    // Find all top-level function names
    console.log('\n=== All _0x function declarations:');
    const fnDecls = script.match(/function\s+(_0x[a-f0-9]+)/g);
    if (fnDecls) console.log(fnDecls.join(', '));
    
    // Find the decoder function pattern
    console.log('\n=== Looking for _0x577c or similar decoder:');
    const decoderPattern = script.match(/function\s+(_0x[a-f0-9]+)\s*\((_0x[a-f0-9]+),\s*(_0x[a-f0-9]+)\)\s*\{/g);
    if (decoderPattern) decoderPattern.forEach(d => console.log(' ', d));
    
    // Find what _0x577c is
    const idx577c = script.indexOf('_0x577c');
    if (idx577c >= 0) {
        console.log('\n=== _0x577c context:');
        console.log(script.substring(idx577c, idx577c + 200));
    }
    
    // Find "window" usage
    console.log('\n=== window usage:');
    const windowIdx = [];
    let si = 0;
    while ((si = script.indexOf('window', si)) !== -1) {
        console.log(`  pos ${si}:`, script.substring(si, si + 50));
        windowIdx.push(si);
        si += 6;
    }
    
    // Check what the generated HTML should look like by examining button patterns
    console.log('\n=== Button/quality patterns:');
    const btnPatterns = script.match(/'[^']*(?:button|quality|data-url|active|onclick)[^']*'/gi);
    if (btnPatterns) [...new Set(btnPatterns)].slice(0, 20).forEach(b => console.log(' ', b));
}

main().catch(e => console.error('Fatal:', e.message));
