const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };

async function main() {
    const pageUrl = 'https://web376x.faselhdx.best/movies/1-%d9%81%d9%8a%d9%84%d9%85-source-code-2011-%d9%85%d8%aa%d8%b1%d8%ac%d9%85';
    
    const html = await (await fetch(pageUrl, {headers})).text();
    const m = html.match(/'(https?:\/\/[^']+\/video_player\?player_token=[^']+)'/i);
    if (!m) { console.log('No player URL found'); return; }
    
    const playerHtml = await (await fetch(m[1], {headers: {...headers, Referer: pageUrl}})).text();
    
    const qcMatch = playerHtml.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
    if (!qcMatch) { console.log('No quality_change div'); return; }
    
    const scriptMatch = qcMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
    if (!scriptMatch) { console.log('No script in quality_change'); return; }
    
    const script = scriptMatch[1];
    console.log('Script length:', script.length);
    
    // First, let's see what _0x577c is and what the array looks like
    console.log('\n=== Looking for _0x577c and array setup:');
    const arr577c = script.match(/function\s+_0x577c\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
    if (arr577c) {
        console.log('_0x577c function body (first 200):', arr577c[1].substring(0, 200));
    }
    
    // Find the array function
    const arrFn = script.match(/var\s+(_0x[a-f0-9]+)\s*=\s*_0x[a-f0-9]+\(\)/);
    if (arrFn) {
        console.log('Array var:', arrFn[1]);
    }
    
    // Look at what globals the script references
    console.log('\n=== Looking for global references:');
    const globals = new Set();
    const globalRefs = script.matchAll(/(?<![._$a-zA-Z0-9])(?:window|self|globalThis|navigator|location|jQuery|\$)\b/g);
    for (const gr of globalRefs) {
        globals.add(gr[0]);
    }
    console.log('Global refs found:', [...globals]);
    
    // Try executing with a richer mock
    console.log('\n=== Execution attempt with richer mock:');
    let capturedHtml = '';
    
    // Build a scope with all needed mocks
    const mockScope = `
        var capturedHtml = '';
        var document = {
            write: function(h) { capturedHtml += h; },
            writeln: function(h) { capturedHtml += h; },
            getElementById: function() { return null; },
            querySelector: function() { return null; },
            createElement: function() { return { style: {} }; }
        };
        var window = { document: document };
        var navigator = { userAgent: 'Mozilla/5.0' };
        var location = { href: '', hostname: '' };
        var self = window;
        var jQuery = function() { return { on: function(){}, click: function(){}, html: function(){} }; };
        var $ = jQuery;
    `;
    
    try {
        const wrappedScript = mockScope + '\n' + script + '\n; capturedHtml;';
        const fn = new Function(wrappedScript);
        const result = fn();
        console.log('Success! Captured HTML length:', (result || '').length);
        if (result && result.length > 0) {
            console.log('\nCaptured HTML:');
            console.log(result);
            
            const urlMatches = [...result.matchAll(/data-url="([^"]+)"/g)];
            if (urlMatches.length > 0) {
                console.log('\n=== Extracted URLs:');
                urlMatches.forEach(u => console.log('  ', u[1]));
            }
        }
    } catch(e) {
        console.log('Error:', e.message);
        console.log('Stack:', e.stack.split('\n').slice(0, 5).join('\n'));
        
        // Try to find what property it's looking for
        console.log('\n=== Trying with Proxy to find missing properties:');
        try {
            const handler = {
                get(target, prop) {
                    if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag || prop === 'toString' || prop === 'valueOf') return undefined;
                    if (!(prop in target)) {
                        console.log('  Accessed missing prop:', String(prop));
                        target[prop] = new Proxy({}, handler);
                    }
                    return target[prop];
                },
                apply(target, thisArg, args) {
                    return new Proxy({}, handler);
                }
            };
            
            const mockDoc2 = {
                write: function(h) { capturedHtml += h; },
                writeln: function(h) { capturedHtml += h; }
            };
            
            const proxyEnv = new Proxy({ document: mockDoc2 }, handler);
            const fn2 = new Function('env', 'with(env) {\n' + script + '\n}');
            fn2(proxyEnv);
            console.log('Proxy success! HTML:', capturedHtml.length);
        } catch(e2) {
            console.log('Proxy error:', e2.message);
        }
    }
}

main().catch(e => console.error('Fatal:', e.message));
