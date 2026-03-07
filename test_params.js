// Test: Use IIFE parameter approach instead of var declarations
// (function(document, window, Function, ...) { SCRIPT })(mock.document, mock.window, undefined, ...)
// Also make window a safe Proxy for property chains
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };
const BASE_URL = 'https://web376x.faselhdx.best';

function executeScript(scriptContent) {
    var captured = '';

    var mockDoc = {
        write: function(s) { captured += s; },
        createElement: function() { return {}; },
        querySelector: function() { return {}; },
        querySelectorAll: function() { return []; },
        getElementById: function() { return null; },
    };

    var mock$ = function() {
        var r = {};
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

    // Scope values
    var scopeValues = {
        document: mockDoc,
        navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
        location: { href: BASE_URL, hostname: 'web376x.faselhdx.best' },
        console: { log: function(){}, warn: function(){}, error: function(){} },
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        isFinite: isFinite,
        String: String,
        Number: Number,
        Array: Array,
        Object: Object,
        Boolean: Boolean,
        RegExp: RegExp,
        Function: undefined,  // Script gets undefined for Function (like with Proxy)
        Error: Error,
        TypeError: TypeError,
        RangeError: RangeError,
        SyntaxError: SyntaxError,
        encodeURIComponent: encodeURIComponent,
        decodeURIComponent: decodeURIComponent,
        encodeURI: encodeURI,
        decodeURI: decodeURI,
        Math: Math,
        Date: Date,
        JSON: JSON,
        NaN: NaN,
        Infinity: Infinity,
        setTimeout: function() { return 1; },
        setInterval: function() { return 1; },
        clearTimeout: function() {},
        clearInterval: function() {},
        $: mock$,
        jQuery: mock$,
        Cookies: { get: function() { return null; }, set: function() {} },
        atob: function(s) { return Buffer.from(s, 'base64').toString('binary'); },
        btoa: function(s) { return Buffer.from(s, 'binary').toString('base64'); },
    };

    // window/self/globalThis should be the scope + safe access for unknown props
    scopeValues.window = scopeValues;
    scopeValues.self = scopeValues;
    scopeValues.globalThis = scopeValues;

    // Build parameter list and values array
    var names = Object.keys(scopeValues);
    var paramList = names.join(', ');
    var values = names.map(function(n) { return scopeValues[n]; });

    try {
        var executor = new Function(paramList, scriptContent);
        executor.apply(null, values);
    } catch (e) {
        console.log('  Error:', e.message);
    }
    return captured;
}

async function main() {
    const pageUrl = BASE_URL + '/movies/1-%d9%81%d9%8a%d9%84%d9%85-source-code-2011-%d9%85%d8%aa%d8%b1%d8%ac%d9%85';
    const html = await (await fetch(pageUrl, { headers })).text();
    const m = html.match(/'(https?:\/\/[^']+\/video_player\?player_token=[^']+)'/i);
    const playerHtml = await (await fetch(m[1], { headers: { ...headers, Referer: pageUrl } })).text();
    
    const qcMatch = playerHtml.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
    const scriptMatch = qcMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
    const scriptContent = scriptMatch[1].trim();
    
    console.log('Script length:', scriptContent.length);
    
    console.log('\n=== Function-params approach ===');
    const result = executeScript(scriptContent);
    console.log('HTML length:', result.length);
    
    if (result.length > 0) {
        const urls = [...result.matchAll(/data-url="([^"]+)"/g)].map(m => m[1]);
        console.log('URLs found:', urls.length);
        urls.forEach(u => console.log('  ', u));
        
        console.log('\nVerifying...');
        for (const url of urls) {
            const resp = await fetch(url, { method: 'HEAD', headers: { ...headers, Referer: BASE_URL + '/' } });
            console.log(`  ${resp.status} - ...${url.slice(-40)}`);
        }
    } else {
        console.log('FAILED - trying with Function=Function...');
        
        // Maybe Function should be the real Function, and the error is elsewhere
        // Let me try a different approach: pass everything + trace the error
    }
}

main().catch(e => console.error('Fatal:', e));
