// Try to run the quality_change script with DOM stubs
const fs = require('fs');
const qcScript = fs.readFileSync('/tmp/fasel_qc_only.js', 'utf8');

console.log('QC Script length:', qcScript.length);

// Minimal DOM stubs
const capturedHTML = [];
const mockElement = {
    innerHTML: '',
    style: {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: () => {},
    insertBefore: () => {},
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {},
    parentNode: null,
};

const mockDoc = {
    createElement: (tag) => {
        const el = { ...mockElement, tagName: tag, children: [] };
        return el;
    },
    querySelector: (sel) => {
        if (sel === '.quality_change') {
            return new Proxy(mockElement, {
                set: (target, prop, value) => {
                    if (prop === 'innerHTML') {
                        capturedHTML.push(value);
                        console.log('[innerHTML set]', typeof value === 'string' ? value.slice(0, 200) : value);
                    }
                    target[prop] = value;
                    return true;
                }
            });
        }
        return mockElement;
    },
    querySelectorAll: () => [],
    getElementById: () => mockElement,
    body: mockElement,
    write: (s) => { console.log('[document.write]', s?.slice?.(0, 100)); },
};

// jQuery stub
const jQueryResult = {
    on: () => jQueryResult,
    click: () => jQueryResult,
    addClass: () => jQueryResult,
    removeClass: () => jQueryResult,
    attr: () => null,
    fadeIn: () => jQueryResult,
    fadeOut: () => jQueryResult,
    html: function(val) { 
        if (val) capturedHTML.push(val);
        return jQueryResult; 
    },
    append: function(val) {
        if (typeof val === 'string') capturedHTML.push(val);
        return jQueryResult;
    },
    prepend: function(val) {
        if (typeof val === 'string') capturedHTML.push(val);
        return jQueryResult;
    },
};

function $(sel) {
    if (typeof sel === 'string' && sel.includes('<')) {
        // Creating HTML elements  
        capturedHTML.push(sel);
        console.log('[$ HTML]', sel.slice(0, 200));
    }
    return jQueryResult;
}
$.fn = {};

// Globals
global.document = mockDoc;
global.window = global;
global.$ = $;
global.jQuery = $;
global.navigator = { userAgent: 'Mozilla/5.0' };
global.location = { href: 'https://web376x.faselhdx.best/video_player', hostname: 'web376x.faselhdx.best' };
global.jwplayer = () => ({
    setup: (config) => { 
        console.log('[jwplayer.setup]', JSON.stringify(config)?.slice(0, 300));
    },
    on: () => ({}),
    getPosition: () => 0,
    getState: () => 'idle',
    play: () => {},
    seek: () => {},
    load: () => {},
    getPlaylistItem: () => ({}),
});
global.jwplayer.key = '';
global.Cookies = { set: () => {}, get: () => null };
global.mainPlayer = global.jwplayer();

// Set a timeout for the script execution
const timeout = setTimeout(() => {
    console.log('\n=== TIMEOUT (10s) - Script hanged ===');
    console.log('Captured HTML pieces:', capturedHTML.length);
    capturedHTML.forEach((h, i) => console.log(`  [${i}]: ${h.slice(0, 300)}`));
    process.exit(1);
}, 10000);

try {
    console.log('Executing QC script...');
    const fn = new Function(qcScript);
    fn();
    clearTimeout(timeout);
    console.log('\n=== Script completed successfully! ===');
    console.log('Captured HTML pieces:', capturedHTML.length);
    capturedHTML.forEach((h, i) => console.log(`  [${i}]: ${h.slice(0, 500)}`));
    
    // Search for scdns URLs
    const allHTML = capturedHTML.join('\n');
    const urls = allHTML.match(/https?:\/\/[^\s"'<>]+scdns[^\s"'<>]+/g) || [];
    console.log('\nscdns URLs found:', urls.length);
    urls.forEach(u => console.log('  ', u));
} catch(e) {
    clearTimeout(timeout);
    console.error('Script error:', e.message);
    console.log('Captured HTML so far:', capturedHTML.length);
    capturedHTML.forEach((h, i) => console.log(`  [${i}]: ${h.slice(0, 300)}`));
}
