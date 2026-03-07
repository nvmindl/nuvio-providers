// Run QC script using Function() (compatible with Hermes) and capture document.write output
const fs = require('fs');
const qc = fs.readFileSync('/tmp/fasel_qc_only.js', 'utf8');

let capturedOutput = '';

// Wrap the script to inject stubs and capture document.write
const wrapped = `
var __captured = '';
var document = {
    write: function(s) { __captured += s; },
    createElement: function() { return {}; },
    querySelector: function() { return {}; },
    querySelectorAll: function() { return []; },
    getElementById: function() { return null; },
};
var window = {};
var navigator = { userAgent: 'Mozilla/5.0' };
var location = { href: '', hostname: '' };
var $ = function() { return { on: function(){return this;}, html: function(){return this;}, addClass: function(){return this;}, attr: function(){return null;} }; };
var jQuery = $;
var Cookies = { get: function(){return null;}, set: function(){} };
var atob = function(s) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var o = '';
    for (var i = 0; i < s.length;) {
        var e1 = chars.indexOf(s[i++]);
        var e2 = chars.indexOf(s[i++]);
        var e3 = chars.indexOf(s[i++]);
        var e4 = chars.indexOf(s[i++]);
        var n = (e1 << 18) | (e2 << 12) | (e3 << 6) | e4;
        o += String.fromCharCode((n >> 16) & 255);
        if (e3 !== 64) o += String.fromCharCode((n >> 8) & 255);
        if (e4 !== 64) o += String.fromCharCode(n & 255);
    }
    return o;
};
var btoa = function(s) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var r = '';
    for (var i = 0; i < s.length;) {
        var a = s.charCodeAt(i++);
        var b = i < s.length ? s.charCodeAt(i++) : NaN;
        var c = i < s.length ? s.charCodeAt(i++) : NaN;
        r += chars[a >> 2];
        r += chars[((a & 3) << 4) | (b >> 4)];
        r += isNaN(b) ? '=' : chars[((b & 15) << 2) | (c >> 6)];
        r += isNaN(c) ? '=' : chars[c & 63];
    }
    return r;
};

${qc}

return __captured;
`;

try {
    console.log('Executing QC script via Function()...');
    const fn = new Function(wrapped);
    const result = fn();
    
    console.log('Output length:', result.length);
    console.log('Output:', result.slice(0, 2000));
    
    // Extract URLs from data-url attributes
    const urlRegex = /data-url="([^"]+)"/g;
    const urls = [];
    let match;
    while ((match = urlRegex.exec(result)) !== null) {
        urls.push(match[1]);
    }
    
    console.log('\n=== Extracted URLs ===');
    urls.forEach(u => console.log(u));
    
    // Also extract from href or src
    const srcRegex = /(?:src|href)="(https?:\/\/[^"]+)"/g;
    while ((match = srcRegex.exec(result)) !== null) {
        if (!urls.includes(match[1])) {
            console.log('Additional:', match[1]);
        }
    }
} catch(e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack?.split('\n').slice(0, 5).join('\n'));
}
