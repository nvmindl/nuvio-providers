// Primary domain — user-confirmed working
var SEED_URL = 'https://witanime.life';

// Fallbacks in case witanime.life rotates
var FALLBACKS = [
    'https://witanime.com',
    'https://witanime.day',
    'https://witanime.xyz',
    'https://witanime.one',
    'https://witanime.plus',
];

var cachedBase = '';

export var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ar,en-US;q=0.8,en;q=0.5',
};

/**
 * Resolve the working base URL.
 * Strategy:
 *  1. Try SEED_URL with a normal GET (Cloudflare blocks HEAD)
 *  2. Follow any redirect chain to find the final domain
 *  3. If SEED_URL fails, probe each fallback the same way
 */
export async function getBaseUrl() {
    if (cachedBase) return cachedBase;

    // Try seed first
    var resolved = await probeUrl(SEED_URL);
    if (resolved) {
        cachedBase = resolved;
        console.log('[WitAnime] Domain: ' + cachedBase);
        return cachedBase;
    }

    // Probe fallbacks
    for (var i = 0; i < FALLBACKS.length; i++) {
        resolved = await probeUrl(FALLBACKS[i]);
        if (resolved) {
            cachedBase = resolved;
            console.log('[WitAnime] Domain (fallback): ' + cachedBase);
            return cachedBase;
        }
    }

    // Last resort — use seed anyway
    cachedBase = SEED_URL;
    console.log('[WitAnime] Domain (default): ' + cachedBase);
    return cachedBase;
}

async function probeUrl(url) {
    try {
        // Use GET with redirect: manual to avoid loading full page but detect redirects
        var r = await fetch(url + '/', {
            method: 'GET',
            redirect: 'manual',
            headers: HEADERS,
        });

        // If we get a redirect, follow the chain
        if ((r.status === 301 || r.status === 302 || r.status === 307 || r.status === 308) && r.headers.get('location')) {
            var loc = r.headers.get('location');
            var m = loc.match(/^(https?:\/\/[^\/]+)/);
            if (m) {
                // Follow one more hop in case of double redirect
                var r2 = await fetch(m[1] + '/', {
                    method: 'GET',
                    redirect: 'manual',
                    headers: HEADERS,
                });
                if ((r2.status === 301 || r2.status === 302) && r2.headers.get('location')) {
                    var loc2 = r2.headers.get('location');
                    var m2 = loc2.match(/^(https?:\/\/[^\/]+)/);
                    if (m2) return m2[1];
                }
                return m[1];
            }
        }

        // 200, 403 (Cloudflare challenge), etc. — domain is alive
        if (r.status > 0) {
            return url;
        }
    } catch (e) {
        console.log('[WitAnime] probe fail ' + url + ': ' + e.message);
    }
    return null;
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
