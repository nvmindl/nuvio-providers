// Local test: run the existing sandbox approach in Node.js and capture ALL intermediate outputs
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };
const BASE_URL = 'https://web376x.faselhdx.best';

async function fetchText(url, opts) {
    const resp = await fetch(url, opts);
    return resp.text();
}

async function main() {
    // Step 1: Get movie page
    const pageUrl = BASE_URL + '/movies/1-%d9%81%d9%8a%d9%84%d9%85-source-code-2011-%d9%85%d8%aa%d8%b1%d8%ac%d9%85';
    console.log('=== Step 1: Fetch movie page ===');
    const html = await fetchText(pageUrl, { headers: { ...headers, Referer: BASE_URL + '/main' } });
    console.log('Page HTML length:', html.length);

    // Step 2: Extract player URLs  
    console.log('\n=== Step 2: Extract player URLs ===');
    const playerMatches = [];
    const ulRegex = /onclick="[^"]*'(https?:\/\/[^']+\/video_player\?player_token=[^']+)'/gi;
    let pm;
    while ((pm = ulRegex.exec(html)) !== null) {
        playerMatches.push(pm[1]);
    }
    // Also iframe
    const iframeMatch = html.match(/iframe[^>]+(?:data-src|src)="([^"]+video_player[^"]+)"/i);
    if (iframeMatch) playerMatches.push(iframeMatch[1]);
    
    const playerUrls = [...new Set(playerMatches)];
    console.log('Player URLs found:', playerUrls.length);
    playerUrls.forEach(u => console.log('  ', u.substring(0, 100) + '...'));

    if (playerUrls.length === 0) {
        console.log('No player URLs found!');
        return;
    }

    // Step 3: Fetch player page
    console.log('\n=== Step 3: Fetch player page ===');
    const playerHtml = await fetchText(playerUrls[0], {
        headers: { ...headers, Referer: pageUrl, Origin: BASE_URL }
    });
    console.log('Player HTML length:', playerHtml.length);

    // Step 4: Extract quality_change script
    console.log('\n=== Step 4: Extract quality_change script ===');
    const qcMatch = playerHtml.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
    if (!qcMatch) { console.log('No quality_change div!'); return; }
    console.log('quality_change div content length:', qcMatch[1].length);
    
    const scriptMatch = qcMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
    if (!scriptMatch) { console.log('No script tag!'); return; }
    const scriptContent = scriptMatch[1].trim();
    console.log('Script content length:', scriptContent.length);

    // Step 5: Execute with sandbox (the working Node.js approach)
    console.log('\n=== Step 5: Execute quality script with sandbox ===');
    
    let captured = '';
    const mockDoc = {
        write: function(s) { captured += s; },
        createElement: function() { return {}; },
        querySelector: function() { return {}; },
        querySelectorAll: function() { return []; },
        getElementById: function() { return null; },
    };

    const mock$ = function() {
        const r = {};
        r.on = function() { return r; };
        r.html = function() { return r; };
        r.addClass = function() { return r; };
        r.removeClass = function() { return r; };
        r.attr = function() { return null; };
        r.fadeIn = function() { return r; };
        r.fadeOut = function() { return r; };
        r.click = function() { return r; };
        r.find = function() { return r; };
        r.each = function() { return r; };
        r.text = function() { return ''; };
        return r;
    };

    const scope = {
        document: mockDoc,
        navigator: { userAgent: 'Mozilla/5.0' },
        location: { href: BASE_URL, hostname: 'web376x.faselhdx.best' },
        console: { log: function(){}, warn: function(){}, error: function(){} },
        parseInt, parseFloat, isNaN, isFinite,
        String, Number, Array, Object, Boolean, RegExp, Error, TypeError, RangeError, SyntaxError,
        encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
        Math, Date, JSON,
        undefined, NaN, Infinity,
        setTimeout: function() { return 1; },
        setInterval: function() { return 1; },
        clearTimeout: function() {},
        clearInterval: function() {},
        $: mock$, jQuery: mock$,
        Cookies: { get: function() { return null; }, set: function() {} },
        atob: function(s) {
            return Buffer.from(s, 'base64').toString('binary');
        },
        btoa: function(s) {
            return Buffer.from(s, 'binary').toString('base64');
        },
    };

    const proxyScope = new Proxy(scope, {
        has: function(target, key) {
            if (key === Symbol.unscopables) return false;
            return true;
        },
        get: function(target, key) {
            if (key === Symbol.unscopables) return undefined;
            if (key in target) return target[key];
            return undefined;
        },
        set: function(target, key, value) {
            target[key] = value;
            return true;
        },
    });

    scope.window = proxyScope;
    scope.self = proxyScope;
    scope.globalThis = proxyScope;

    try {
        const executor = new Function('scope', 'with(scope){\n' + scriptContent + '\n}');
        executor(proxyScope);
        console.log('Script executed successfully!');
    } catch (e) {
        console.log('Script execution error:', e.message);
    }

    console.log('Captured HTML length:', captured.length);
    console.log('\n=== Step 6: Captured HTML output ===');
    console.log(captured);

    // Step 7: Extract URLs from captured HTML
    console.log('\n=== Step 7: Extracted data-url values ===');
    const urls = [];
    const re = /data-url="([^"]+)"/g;
    let m;
    while ((m = re.exec(captured)) !== null) {
        if (m[1] && /^https?:\/\//i.test(m[1])) {
            urls.push(m[1]);
            console.log('  ', m[1]);
        }
    }

    // Step 8: Verify URLs are reachable
    console.log('\n=== Step 8: Verify stream URLs ===');
    for (const url of urls) {
        try {
            const resp = await fetch(url, { method: 'HEAD', headers: { ...headers, Referer: BASE_URL + '/' } });
            const ct = resp.headers.get('content-type') || 'unknown';
            console.log(`  ${resp.status} ${ct} - ${url.substring(0, 80)}...`);
        } catch(e) {
            console.log(`  ERROR: ${e.message} - ${url.substring(0, 80)}...`);
        }
    }

    // Step 9: KEY INSIGHT - Look at the URL patterns 
    console.log('\n=== Step 9: URL pattern analysis ===');
    for (const url of urls) {
        const parsed = new URL(url);
        console.log('  Host:', parsed.hostname);
        console.log('  Path:', parsed.pathname);
        console.log('  Params:', [...parsed.searchParams.entries()].map(([k,v]) => k+'='+v.substring(0, 30)).join('&'));
        console.log('');
    }
}

main().catch(e => console.error('Fatal:', e));
