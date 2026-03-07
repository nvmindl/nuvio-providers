// Debug: find exactly what access causes the error
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };
const BASE_URL = 'https://web376x.faselhdx.best';

async function main() {
    const pageUrl = BASE_URL + '/movies/1-%d9%81%d9%8a%d9%84%d9%85-source-code-2011-%d9%85%d8%aa%d8%b1%d8%ac%d9%85';
    const html = await (await fetch(pageUrl, { headers })).text();
    const m = html.match(/'(https?:\/\/[^']+\/video_player\?player_token=[^']+)'/i);
    const playerHtml = await (await fetch(m[1], { headers: { ...headers, Referer: pageUrl } })).text();
    
    const qcMatch = playerHtml.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
    const scriptMatch = qcMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
    const scriptContent = scriptMatch[1].trim();
    
    // Use the OLD working approach but LOG what properties are accessed via the Proxy
    var captured = '';
    var accessLog = [];

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
    scope.navigator = { userAgent: 'Mozilla/5.0' };
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

    var proxyScope = new Proxy(scope, {
        has: function(target, key) {
            if (key === Symbol.unscopables) return false;
            return true;  // This makes with() intercept ALL names
        },
        get: function(target, key) {
            if (key === Symbol.unscopables) return undefined;
            if (key in target) return target[key];
            // Log what the script looks up that we DON'T have
            if (typeof key === 'string' && !key.startsWith('_0x')) {
                accessLog.push('GET(missing): ' + key);
            }
            return undefined;
        },
        set: function(target, key, value) {
            if (typeof key === 'string' && !key.startsWith('_0x') && !(key in target)) {
                accessLog.push('SET(new): ' + key);
            }
            target[key] = value;
            return true;
        },
    });

    scope.window = proxyScope;
    scope.self = proxyScope;
    scope.globalThis = proxyScope;

    try {
        var executor = new Function('scope', 'with(scope){\n' + scriptContent + '\n}');
        executor(proxyScope);
    } catch (e) {
        console.log('Error:', e.message);
    }

    console.log('Captured HTML length:', captured.length);
    console.log('URLs found:', [...captured.matchAll(/data-url="([^"]+)"/g)].length);
    
    console.log('\n=== Properties accessed that we DON\'T have in scope ===');
    const unique = [...new Set(accessLog)];
    unique.forEach(l => console.log('  ', l));
    
    console.log('\n=== All SET operations (new vars assigned to scope) ===');
    const sets = unique.filter(l => l.startsWith('SET'));
    sets.forEach(l => console.log('  ', l));
}

main().catch(e => console.error('Fatal:', e));
