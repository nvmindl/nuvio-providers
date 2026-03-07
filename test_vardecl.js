// Test: var-declaration approach with Function added to scope
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

    var scope = {};
    scope.document = mockDoc;
    scope.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };
    scope.location = { href: BASE_URL, hostname: 'web376x.faselhdx.best' };
    scope.console = { log: function(){}, warn: function(){}, error: function(){} };
    scope.parseInt = parseInt;
    scope.parseFloat = parseFloat;
    scope.isNaN = isNaN;
    scope.isFinite = isFinite;
    scope.String = String;
    scope.Number = Number;
    scope.Array = Array;
    scope.Object = Object;
    scope.Boolean = Boolean;
    scope.RegExp = RegExp;
    scope.Function = Function;  // <-- THE MISSING ONE
    scope.Error = Error;
    scope.TypeError = TypeError;
    scope.RangeError = RangeError;
    scope.SyntaxError = SyntaxError;
    scope.encodeURIComponent = encodeURIComponent;
    scope.decodeURIComponent = decodeURIComponent;
    scope.encodeURI = encodeURI;
    scope.decodeURI = decodeURI;
    scope.Math = Math;
    scope.Date = Date;
    scope.JSON = JSON;
    scope.undefined = undefined;
    scope.NaN = NaN;
    scope.Infinity = Infinity;
    scope.setTimeout = function() { return 1; };
    scope.setInterval = function() { return 1; };
    scope.clearTimeout = function() {};
    scope.clearInterval = function() {};
    scope.$ = mock$;
    scope.jQuery = mock$;
    scope.Cookies = { get: function() { return null; }, set: function() {} };
    scope.atob = function(s) { return Buffer.from(s, 'base64').toString('binary'); };
    scope.btoa = function(s) { return Buffer.from(s, 'binary').toString('base64'); };

    // window/self as the scope object (not a Proxy, but contains all needed keys)
    scope.window = scope;
    scope.self = scope;
    scope.globalThis = scope;

    // Build var-declaration preamble
    var names = Object.keys(scope);
    var preamble = 'var ' + names.map(function(n) { return n + '=__scope__.' + n; }).join(', ') + ';\n';

    try {
        var executor = new Function('__scope__', preamble + scriptContent);
        executor(scope);
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
    
    console.log('\n=== var-decl approach (with Function added) ===');
    const result = executeScript(scriptContent);
    console.log('HTML length:', result.length);
    
    if (result.length > 0) {
        const urls = [...result.matchAll(/data-url="([^"]+)"/g)].map(m => m[1]);
        console.log('URLs found:', urls.length);
        urls.forEach(u => console.log('  ', u));
        
        console.log('\n=== Verifying ===');
        for (const url of urls) {
            const resp = await fetch(url, { method: 'HEAD', headers: { ...headers, Referer: BASE_URL + '/' } });
            console.log(`  ${resp.status} ${resp.headers.get('content-type') || '?'} - ...${url.slice(-40)}`);
        }
    } else {
        console.log('FAILED - no output');
    }
}

main().catch(e => console.error('Fatal:', e));
