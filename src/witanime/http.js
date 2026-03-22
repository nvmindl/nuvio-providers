var SEED_URL = 'https://witanime.com';
var FALLBACKS = [
    'https://witanime.life',
    'https://witanime.day',
    'https://witanime.xyz',
];

var cachedBase = '';

export var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ar,en-US;q=0.8,en;q=0.5',
};

export async function getBaseUrl() {
    if (cachedBase) return cachedBase;

    // Follow 301 redirect chain from seed domain to discover current domain
    var url = SEED_URL;
    for (var hop = 0; hop < 6; hop++) {
        try {
            var r = await fetch(url + '/', {
                method: 'HEAD',
                redirect: 'manual',
                headers: HEADERS,
            });
            var loc = r.headers.get('location');
            if ((r.status === 301 || r.status === 302) && loc) {
                var m = loc.match(/^(https?:\/\/[^\/]+)/);
                if (m) { url = m[1]; continue; }
            }
            break;
        } catch (e) { break; }
    }

    if (url !== SEED_URL) {
        cachedBase = url;
        console.log('[WitAnime] Domain: ' + cachedBase);
        return cachedBase;
    }

    // Seed redirect failed — probe fallback domains
    for (var i = 0; i < FALLBACKS.length; i++) {
        try {
            var r2 = await fetch(FALLBACKS[i] + '/', {
                method: 'HEAD',
                redirect: 'manual',
                headers: HEADERS,
            });
            // 301 means this domain is alive (redirecting further)
            // 200/403/503 means this is the current domain (possibly Cloudflare)
            if (r2.status > 0) {
                if (r2.status === 301 || r2.status === 302) {
                    // Follow one more hop
                    var loc2 = r2.headers.get('location');
                    if (loc2) {
                        var m2 = loc2.match(/^(https?:\/\/[^\/]+)/);
                        if (m2) { cachedBase = m2[1]; return cachedBase; }
                    }
                }
                cachedBase = FALLBACKS[i];
                console.log('[WitAnime] Domain (fallback): ' + cachedBase);
                return cachedBase;
            }
        } catch (e) { continue; }
    }

    cachedBase = FALLBACKS[0];
    return cachedBase;
}

export async function fetchText(url, opts) {
    opts = opts || {};
    var controller;
    var timeoutId;
    try {
        controller = new AbortController();
        timeoutId = setTimeout(function() { controller.abort(); }, opts.timeout || 15000);
    } catch (e) { controller = null; }

    try {
        var hdrs = {};
        for (var k in HEADERS) hdrs[k] = HEADERS[k];
        if (opts.headers) for (var k2 in opts.headers) hdrs[k2] = opts.headers[k2];

        var fetchOpts = {
            method: opts.method || 'GET',
            redirect: 'follow',
            headers: hdrs,
        };
        if (opts.body) fetchOpts.body = opts.body;
        if (controller) fetchOpts.signal = controller.signal;

        var response = await fetch(url, fetchOpts);
        if (timeoutId) clearTimeout(timeoutId);
        if (!response.ok) return '';
        return await response.text();
    } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        console.log('[WitAnime] fetch err: ' + e.message);
        return '';
    }
}
