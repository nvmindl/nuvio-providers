// Test Function()-based execution (Hermes compatible, no vm module)
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

// Use Function() with parameters to inject the stubs
// The QC script accesses 'document' as a global name
// By passing it as a parameter with the same name, it shadows the global
const paramNames = [
    'document', 'window', 'self', 'globalThis', 'navigator', 'location',
    '$', 'jQuery', 'Cookies',
];

const mockWindow = {};
const mock$ = function() { return { on: function(){return this;}, html: function(){return this;}, addClass: function(){return this;}, attr: function(){return null;} }; };

const paramValues = [
    mockDoc,
    mockWindow,
    mockWindow,
    mockWindow,
    { userAgent: 'Mozilla/5.0' },
    { href: '', hostname: '' },
    mock$,
    mock$,
    { get: function(){return null;}, set: function(){} },
];

// The QC script also needs polyfills that exist in browser
// Wrap the script to provide them
const wrappedScript = `
// Polyfill atob for environments that don't have it natively
if (typeof atob === 'undefined') {
    atob = function(s) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var o = '', i = 0;
        s = s.replace(/[^A-Za-z0-9+/=]/g, '');
        while (i < s.length) {
            var e1 = chars.indexOf(s[i++]), e2 = chars.indexOf(s[i++]);
            var e3 = chars.indexOf(s[i++]), e4 = chars.indexOf(s[i++]);
            var n = (e1 << 18) | (e2 << 12) | (e3 << 6) | e4;
            o += String.fromCharCode((n >> 16) & 255);
            if (e3 !== 64) o += String.fromCharCode((n >> 8) & 255);
            if (e4 !== 64) o += String.fromCharCode(n & 255);
        }
        return o;
    };
}
window.document = document;
window.navigator = navigator;
window.location = location;
window.$ = $;
window.jQuery = jQuery;
window.Cookies = Cookies;
${qc}
`;

try {
    console.log('Executing via Function() with params...');
    const fn = new Function(...paramNames, wrappedScript);
    fn(...paramValues);
    
    console.log('Captured length:', captured.length);
    console.log('Output:', captured.slice(0, 500));
    
    const urls = [];
    const re = /data-url="([^"]+)"/g;
    let m;
    while ((m = re.exec(captured)) !== null) urls.push(m[1]);
    console.log('\n=== URLs ===');
    urls.forEach(u => console.log(u));
} catch(e) {
    console.error('Error:', e.message);
    
    // Try eval() approach instead
    console.log('\n--- Trying eval() approach ---');
    captured = '';
    try {
        (function() {
            var document = mockDoc;
            var window = mockWindow;
            var self = mockWindow;
            var globalThis = mockWindow;
            var navigator = { userAgent: 'Mozilla/5.0' };
            var location = { href: '', hostname: '' };
            var $ = mock$;
            var jQuery = mock$;
            var Cookies = { get: function(){return null;}, set: function(){} };
            window.document = document;
            window.navigator = navigator;
            window.location = location;
            window.$ = $;
            window.jQuery = jQuery;
            window.Cookies = Cookies;
            eval(qc);
        })();
        
        console.log('eval() Captured length:', captured.length);
        console.log('Output:', captured.slice(0, 500));
        
        const urls = [];
        const re = /data-url="([^"]+)"/g;
        let m;
        while ((m = re.exec(captured)) !== null) urls.push(m[1]);
        console.log('\n=== URLs ===');
        urls.forEach(u => console.log(u));
    } catch(e2) {
        console.error('eval() Error:', e2.message);
    }
}
