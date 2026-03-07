// Run QC script with minimal stubs and 15-second timeout
const fs = require('fs');
const vm = require('vm');

const qcScript = fs.readFileSync('/tmp/fasel_qc_only.js', 'utf8');
console.log('QC Script:', qcScript.length, 'chars');

const capturedHTML = [];

// Create sandbox context
const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    document: {
        createElement: (tag) => ({
            tagName: tag,
            innerHTML: '',
            style: {},
            className: '',
            setAttribute: function(n, v) { this[n] = v; },
            getAttribute: function(n) { return this[n]; },
            appendChild: () => {},
            insertBefore: function(a, b) {},
            children: [],
            childNodes: [],
            parentNode: null,
            firstChild: null,
        }),
        querySelector: (sel) => {
            const el = {
                innerHTML: '',
                style: {},
                appendChild: () => {},
                insertBefore: () => {},
            };
            return new Proxy(el, {
                set: (t, p, v) => {
                    if (p === 'innerHTML') capturedHTML.push({ sel, html: v });
                    t[p] = v;
                    return true;
                }
            });
        },
        querySelectorAll: () => [],
        getElementById: () => null,
        body: { innerHTML: '', appendChild: () => {} },
        write: () => {},
    },
    window: {},
    navigator: { userAgent: 'Mozilla/5.0' },
    location: { href: '', hostname: '' },
    setTimeout: (fn, ms) => { setTimeout(fn, ms); return 1; },
    setInterval: (fn, ms) => { return 1; },
    clearTimeout: () => {},
    clearInterval: () => {},
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
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    Math: Math,
    Date: Date,
    JSON: JSON,
    $: function(sel) {
        const r = {
            on: () => r,
            html: (v) => { if (v) capturedHTML.push({ sel, html: v }); return r; },
            append: (v) => { if (typeof v === 'string') capturedHTML.push({ sel, html: v }); return r; },
            prepend: (v) => { if (typeof v === 'string') capturedHTML.push({ sel, html: v }); return r; },
            addClass: () => r,
            removeClass: () => r,
            attr: () => null,
            fadeIn: () => r,
            fadeOut: () => r,
            find: () => r,
            each: () => r,
            click: () => r,
            text: () => '',
        };
        if (typeof sel === 'string' && sel.includes('<')) {
            capturedHTML.push({ sel: '$create', html: sel });
        }
        return r;
    },
    Cookies: { get: () => null, set: () => {} },
};

sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
sandbox.jQuery = sandbox.$;

const timer = setTimeout(() => {
    console.log('\n=== TIMEOUT 15s ===');
    console.log('Captured:', capturedHTML.length);
    capturedHTML.forEach((h, i) => console.log(`[${i}] sel=${h.sel}:`, String(h.html).slice(0, 300)));
    process.exit(1);
}, 15000);

try {
    console.log('Running QC script...');
    const ctx = vm.createContext(sandbox);
    vm.runInContext(qcScript, ctx, { timeout: 12000 });
    clearTimeout(timer);
    console.log('\n=== SUCCESS ===');
    console.log('Captured:', capturedHTML.length);
    capturedHTML.forEach((h, i) => console.log(`[${i}] sel=${h.sel}:`, String(h.html).slice(0, 500)));
    
    const allHTML = capturedHTML.map(h => h.html).join('\n');
    const urls = allHTML.match(/https?:\/\/[^\s"'<>]+/g) || [];
    console.log('\nURLs found:', urls.length);
    urls.forEach(u => console.log(' ', u));
} catch(e) {
    clearTimeout(timer);
    console.error('Error:', e.message);
    console.log('Captured so far:', capturedHTML.length);
    capturedHTML.forEach((h, i) => console.log(`[${i}] sel=${h.sel}:`, String(h.html).slice(0, 300)));
}
