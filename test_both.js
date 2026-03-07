// Test: Replace with(scope) sandbox with var-declaration approach
// Then verify both approaches produce identical output
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };
const BASE_URL = 'https://web376x.faselhdx.best';

function createMockScope() {
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

    return { scope, getCaptured: () => captured };
}

// OLD approach: with(proxy) - BROKEN in Hermes
function executeWithProxy(scriptContent) {
    var { scope, getCaptured } = createMockScope();
    
    var proxyScope = new Proxy(scope, {
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
        var executor = new Function('scope', 'with(scope){\n' + scriptContent + '\n}');
        executor(proxyScope);
    } catch (e) {
        console.log('  [with] Error:', e.message);
    }
    return getCaptured();
}

// NEW approach: var-declaration wrapper - compatible with Hermes
function executeWithVarDecls(scriptContent) {
    var { scope, getCaptured } = createMockScope();
    
    // window/self/globalThis should reference the scope object itself
    scope.window = scope;
    scope.self = scope;
    scope.globalThis = scope;

    // Build var declaration preamble
    var names = Object.keys(scope);
    var preamble = 'var ' + names.map(function(n) { return n + '=__scope__.' + n; }).join(', ') + ';\n';

    try {
        var executor = new Function('__scope__', preamble + scriptContent);
        executor(scope);
    } catch (e) {
        console.log('  [var-decl] Error:', e.message);
    }
    return getCaptured();
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
    
    // Test OLD approach
    console.log('\n=== OLD approach (with+Proxy) ===');
    const oldResult = executeWithProxy(scriptContent);
    console.log('HTML length:', oldResult.length);
    const oldUrls = [...oldResult.matchAll(/data-url="([^"]+)"/g)].map(m => m[1]);
    console.log('URLs found:', oldUrls.length);
    oldUrls.forEach(u => console.log('  ', u));
    
    // Test NEW approach
    console.log('\n=== NEW approach (var-decl) ===');
    const newResult = executeWithVarDecls(scriptContent);
    console.log('HTML length:', newResult.length);
    const newUrls = [...newResult.matchAll(/data-url="([^"]+)"/g)].map(m => m[1]);
    console.log('URLs found:', newUrls.length);
    newUrls.forEach(u => console.log('  ', u));
    
    // Compare
    console.log('\n=== Comparison ===');
    console.log('Results match:', oldResult === newResult);
    if (oldResult !== newResult) {
        console.log('Old length:', oldResult.length, 'New length:', newResult.length);
        // Show diff
        if (newResult.length === 0) {
            console.log('NEW APPROACH PRODUCED NO OUTPUT!');
        }
    }
}

main().catch(e => console.error('Fatal:', e));
