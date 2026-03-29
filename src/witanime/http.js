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

// External fetch override — when set, this function is used instead of native fetch.
// Signature: async function(url) => string (HTML)
// This allows a WebView-based fetcher to bypass Cloudflare.
var _fetchOverride = null;

export function setFetchOverride(fn) {
    _fetchOverride = fn;
}

export var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ar,en-US;q=0.8,en;q=0.5',
};

/**
 * Resolve the working base URL.
 */
export async function getBaseUrl() {
    return SEED_URL;
}

export async function fetchText(url, opts) {
    opts = opts || {};

    // If an external fetch override is set, use it for witanime pages
    if (_fetchOverride && url.indexOf('witanime') > -1) {
        console.log('[WitAnime] Using fetch override for: ' + url);
        try {
            var result = await _fetchOverride(url);
            if (result && result.length > 0) return result;
            console.log('[WitAnime] Fetch override returned empty, falling through...');
        } catch (oe) {
            console.log('[WitAnime] Fetch override err: ' + oe.message);
        }
    }

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
        if (!response.ok) throw new Error('Status ' + response.status);
        return await response.text();
    } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        console.log('[WitAnime] Native fetch err (' + e.message + '), trying proxy...');
        
        try {
            // Strip headers that might confuse the proxy
            var proxyOpts = { method: fetchOpts.method, redirect: 'follow' };
            var proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
            var pr = await fetch(proxyUrl, proxyOpts);
            if (pr.ok) {
                var json = await pr.json();
                if (json && json.contents) return json.contents;
            }
        } catch (pe) {
            console.log('[WitAnime] Proxy fetch err: ' + pe.message);
        }
        
        return '';
    }
}
