// Test with() + Proxy approach for custom scope (works like vm.runInContext)
const fs = require('fs');
const qc = fs.readFileSync('/tmp/fasel_qc_only.js', 'utf8');

let captured = '';

const mockDoc = {
    write: function(s) { captured += s; },
    createElement: function() { return {}; },
    querySelector: function() { return {}; },
    querySelectorAll: function() { return []; },
    getElementById: function() { return null; },
};

const mock$ = function() { return { on: function(){return this;}, html: function(){return this;}, addClass: function(){return this;}, attr: function(){return null;} }; };

const scope = {
    document: mockDoc,
    navigator: { userAgent: 'Mozilla/5.0' },
    location: { href: '', hostname: '' },
    $: mock$,
    jQuery: mock$,
    Cookies: { get: function(){return null;}, set: function(){} },
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
    undefined: undefined,
    NaN: NaN,
    Infinity: Infinity,
    Map: Map,
    Set: Set,
    WeakMap: WeakMap,
    WeakSet: WeakSet,
    Promise: Promise,
    Symbol: Symbol,
    Proxy: Proxy,
    Reflect: Reflect,
    setTimeout: function(fn) { return 1; },
    setInterval: function() { return 1; },
    clearTimeout: function() {},
    clearInterval: function() {},
    atob: function(s) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var o = '', i = 0;
        s = String(s).replace(/[^A-Za-z0-9+/=]/g, '');
        while (i < s.length) {
            var e1 = chars.indexOf(s[i++]), e2 = chars.indexOf(s[i++]);
            var e3 = chars.indexOf(s[i++]), e4 = chars.indexOf(s[i++]);
            var n = (e1 << 18) | (e2 << 12) | (e3 << 6) | e4;
            o += String.fromCharCode((n >> 16) & 255);
            if (e3 !== 64) o += String.fromCharCode((n >> 8) & 255);
            if (e4 !== 64) o += String.fromCharCode(n & 255);
        }
        return o;
    },
    btoa: function(s) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var r = '', i = 0;
        while (i < s.length) {
            var a = s.charCodeAt(i++);
            var b = i < s.length ? s.charCodeAt(i++) : NaN;
            var c = i < s.length ? s.charCodeAt(i++) : NaN;
            r += chars[a >> 2];
            r += chars[((a & 3) << 4) | (b >> 4)];
            r += isNaN(b) ? '=' : chars[((b & 15) << 2) | (c >> 6)];
            r += isNaN(c) ? '=' : chars[c & 63];
        }
        return r;
    },
};

// Make window/self/globalThis all reference the scope proxy
const proxyScope = new Proxy(scope, {
    has: function(target, key) {
        // Return true for ALL keys so 'with' intercepts ALL lookups
        return true;
    },
    get: function(target, key) {
        if (key === Symbol.unscopables) return undefined;
        if (key in target) return target[key];
        // For unknown keys, return undefined (prevents ReferenceError)
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
    console.log('Executing QC script with Proxy scope...');
    // Compile the QC script directly inside a with() block
    const executor = new Function('scope', 'with(scope){\n' + qc + '\n}');
    executor(proxyScope);
    
    console.log('Captured length:', captured.length);
    console.log('Output:', captured.slice(0, 1000));
    
    const urls = [];
    const re = /data-url="([^"]+)"/g;
    let m;
    while ((m = re.exec(captured)) !== null) urls.push(m[1]);
    console.log('\n=== URLs ===');
    urls.forEach(u => console.log(u));
} catch(e) {
    console.error('Error:', e.message);
    console.error(e.stack?.split('\n').slice(0, 5).join('\n'));
}
