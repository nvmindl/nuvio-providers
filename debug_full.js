// Full trace: exactly what happens for Sherlock Holmes TMDB 58574
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };
const BASE_URL = 'https://web376x.faselhdx.best';

async function main() {
    console.log('STEP 1: TMDB resolution');
    console.time('tmdb');
    const tmdbResp = await fetch('https://www.themoviedb.org/movie/58574', { 
        headers: { ...headers, Referer: 'https://www.themoviedb.org/' },
        signal: AbortSignal.timeout(15000)
    });
    const tmdbHtml = await tmdbResp.text();
    console.timeEnd('tmdb');
    
    // The cleanText function from our extractor (with the \p{L} regex)
    function cleanText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/&[^;]+;/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    const canonical = (tmdbHtml.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) || [])[1] || '';
    const titleTag = (tmdbHtml.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '';
    const last = canonical.split('/').filter(Boolean).pop() || '';
    const slug = last.replace(/^\d+-/, '');
    const titleFromCanonical = slug.replace(/-/g, ' ').trim();
    const year = (titleTag.match(/\((\d{4})\)/) || [])[1] || '';
    const title = cleanText(titleFromCanonical || titleTag);
    
    console.log('Canonical:', canonical);
    console.log('Title tag:', titleTag);
    console.log('Slug:', slug);
    console.log('Cleaned title:', title);
    console.log('Year:', year);
    
    console.log('\nSTEP 2: Search queries');
    const queries = [];
    if (title && year) queries.push(title + ' ' + year);
    if (title) queries.push(title);
    console.log('Queries:', queries);
    
    console.log('\nSTEP 3: Search candidates');
    console.time('search');
    const allCandidates = [];
    for (const q of queries) {
        console.log('  Searching:', q);
        const searchUrl = BASE_URL + '/?s=' + encodeURIComponent(q);
        const searchResp = await fetch(searchUrl, { 
            headers: { ...headers, Referer: BASE_URL + '/main' },
            signal: AbortSignal.timeout(15000)
        });
        const searchHtml = await searchResp.text();
        
        const links = [...searchHtml.matchAll(/href="(https?:\/\/web\d+x\.faselhdx\.best\/(?:movies|series|episodes|anime-movies|anime-series)\/[^"]+)"/gi)]
            .map(m => m[1]);
        const unique = [...new Set(links)];
        console.log('  Found:', unique.length, 'links');
        unique.forEach(u => console.log('    ', decodeURIComponent(u).substring(0, 100)));
        allCandidates.push(...unique);
        if (allCandidates.length >= 6) break;
    }
    console.timeEnd('search');
    
    if (allCandidates.length === 0) {
        console.log('\nNO CANDIDATES FOUND! This is where it fails.');
        return;
    }
    
    console.log('\nSTEP 4: Score candidates');
    const candidates = [...new Set(allCandidates)];
    for (const url of candidates) {
        const lower = url.toLowerCase();
        let score = 0;
        if (/(\/movies\/|\/anime-movies\/)/.test(lower)) score += 8;
        if (year && lower.includes(year)) score += 2;
        
        const normalizedUrl = cleanText(decodeURIComponent(lower));
        const titleWords = [...new Set(title.split(' ').filter(w => w.length > 2))];
        let wordHits = 0;
        for (const w of titleWords) {
            if (normalizedUrl.includes(w)) wordHits++;
        }
        score += Math.min(wordHits, 5);
        console.log(`  Score=${score} ${decodeURIComponent(url).substring(0, 100)}`);
    }
    
    const best = candidates[0]; // simplified, our code sorts by score
    console.log('\nBest:', decodeURIComponent(best));
    
    console.log('\nSTEP 5: Fetch movie page');
    console.time('page');
    const pageResp = await fetch(best, { headers: { ...headers, Referer: BASE_URL + '/main' }, signal: AbortSignal.timeout(15000) });
    const pageHtml = await pageResp.text();
    console.timeEnd('page');
    console.log('Page HTML length:', pageHtml.length);
    
    console.log('\nSTEP 6: Extract player URLs');
    const playerMatches = [...pageHtml.matchAll(/onclick="[^"]*'(https?:\/\/[^']+\/video_player\?player_token=[^']+)'/gi)];
    const playerUrls = [...new Set(playerMatches.map(m => m[1]))];
    console.log('Player URLs:', playerUrls.length);
    
    if (playerUrls.length === 0) {
        // Check iframe
        const iframeMatch = pageHtml.match(/iframe[^>]+(?:data-src|src)="([^"]+video_player[^"]+)"/i);
        if (iframeMatch) {
            playerUrls.push(iframeMatch[1]);
            console.log('Found iframe player URL');
        } else {
            console.log('NO PLAYER URLs!');
            // Debug: look for any player-related content
            const hasPlayer = pageHtml.includes('video_player') || pageHtml.includes('player_token');
            console.log('Has video_player reference:', hasPlayer);
            const playerIframe = pageHtml.match(/<iframe[^>]+>/gi);
            if (playerIframe) playerIframe.forEach(f => console.log('  iframe:', f.substring(0, 100)));
            return;
        }
    }
    
    console.log('\nSTEP 7: Fetch player');
    console.time('player');
    const playerResp = await fetch(playerUrls[0], { headers: { ...headers, Referer: best, Origin: BASE_URL }, signal: AbortSignal.timeout(15000) });
    const playerHtml = await playerResp.text();
    console.timeEnd('player');
    console.log('Player HTML length:', playerHtml.length);
    
    console.log('\nSTEP 8: Extract quality script');
    const qcMatch = playerHtml.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
    if (!qcMatch) { console.log('NO quality_change div!'); return; }
    const scriptMatch = qcMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
    if (!scriptMatch) { console.log('NO script in quality_change!'); return; }
    console.log('Script length:', scriptMatch[1].trim().length);
    
    console.log('\nSTEP 9: Execute script');
    // Use the SAME approach as our updated extractor
    const scriptContent = scriptMatch[1].trim();
    let captured = '';
    const mockDoc = { write: function(s) { captured += s; } };
    const mock$ = function() { var r = {}; r.on=function(){return r;}; r.html=function(){return r;}; r.addClass=function(){return r;}; r.removeClass=function(){return r;}; r.attr=function(){return null;}; r.fadeIn=function(){return r;}; r.fadeOut=function(){return r;}; r.click=function(){return r;}; r.find=function(){return r;}; r.each=function(){return r;}; r.text=function(){return '';}; return r; };
    
    const scopeEntries = [
        ['document', mockDoc],
        ['navigator', { userAgent: 'Mozilla/5.0' }],
        ['location', { href: BASE_URL, hostname: 'web376x.faselhdx.best' }],
        ['console', { log:function(){}, warn:function(){}, error:function(){} }],
        ['parseInt', parseInt], ['parseFloat', parseFloat], ['isNaN', isNaN], ['isFinite', isFinite],
        ['String', String], ['Number', Number], ['Array', Array], ['Object', Object],
        ['Boolean', Boolean], ['RegExp', RegExp], ['Function', undefined],
        ['Error', Error], ['TypeError', TypeError], ['RangeError', RangeError], ['SyntaxError', SyntaxError],
        ['encodeURIComponent', encodeURIComponent], ['decodeURIComponent', decodeURIComponent],
        ['encodeURI', encodeURI], ['decodeURI', decodeURI],
        ['Math', Math], ['Date', Date], ['JSON', JSON],
        ['NaN', NaN], ['Infinity', Infinity], ['undefined', undefined],
        ['setTimeout', function(){return 1;}], ['setInterval', function(){return 1;}],
        ['clearTimeout', function(){}], ['clearInterval', function(){}],
        ['$', mock$], ['jQuery', mock$],
        ['Cookies', { get:function(){return null;}, set:function(){} }],
        ['atob', function(s){return Buffer.from(s,'base64').toString('binary');}],
        ['btoa', function(s){return Buffer.from(s,'binary').toString('base64');}],
    ];
    
    const scopeObj = {};
    for (const [k,v] of scopeEntries) scopeObj[k] = v;
    scopeObj.window = scopeObj;
    scopeObj.self = scopeObj;
    scopeObj.globalThis = scopeObj;
    scopeEntries.push(['window', scopeObj], ['self', scopeObj], ['globalThis', scopeObj]);
    
    const paramNames = scopeEntries.map(e => e[0]).join(', ');
    const paramValues = scopeEntries.map(e => e[1]);
    
    try {
        const executor = new Function(paramNames, scriptContent);
        executor.apply(null, paramValues);
        console.log('Script executed OK');
    } catch(e) {
        console.log('Script ERROR:', e.message);
    }
    
    console.log('Captured HTML length:', captured.length);
    const urls = [...captured.matchAll(/data-url="([^"]+)"/g)].map(m => m[1]);
    console.log('Stream URLs:', urls.length);
    urls.forEach(u => console.log('  ', u));
    
    if (urls.length > 0) {
        console.log('\nSTEP 10: Verify URLs');
        for (const url of urls) {
            const r = await fetch(url, { method: 'HEAD', headers: { ...headers, Referer: BASE_URL + '/' }, signal: AbortSignal.timeout(10000) });
            console.log(`  ${r.status} ${r.headers.get('content-type')} - ...${url.slice(-50)}`);
        }
    }
    
    console.log('\nTOTAL: All steps completed successfully!');
}

main().catch(e => console.error('Fatal:', e));
