// FaselHDX v5.0.0 — EasyPlex API client
var PROXY_BASE = 'https://faselhdx-proxy.onrender.com';

export var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Accept': 'application/json, text/html, */*',
    'Accept-Language': 'ar,en;q=0.8',
};

function safeFetch(url, opts) {
    opts = opts || {};
    var ms = opts.timeout || 25000;
    var controller;
    var tid;
    try {
        controller = new AbortController();
        tid = setTimeout(function() { controller.abort(); }, ms);
    } catch(e) { controller = null; }
    var fetchOpts = { method: 'GET', headers: opts.headers || HEADERS };
    if (controller) fetchOpts.signal = controller.signal;
    return fetch(url, fetchOpts)
        .then(function(r) { if (tid) clearTimeout(tid); return r; })
        .catch(function(e) { if (tid) clearTimeout(tid); throw e; });
}

// Fetch JSON from EasyPlex API via proxy
// path examples: "media/detail/550/0", "series/show/1396/0", "series/season/123/0"
export function apiGet(path) {
    var url = PROXY_BASE + '/api/' + path;
    console.log('[FaselHDX] API: ' + url.substring(0, 120));
    return safeFetch(url, { headers: HEADERS })
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function(e) {
            console.log('[FaselHDX] API error: ' + e.message);
            return null;
        });
}

// Fetch embed page HTML via proxy
export function proxyFetch(embedUrl) {
    var url = PROXY_BASE + '/embed?url=' + encodeURIComponent(embedUrl);
    console.log('[FaselHDX] Embed: ' + embedUrl.substring(0, 80));
    return safeFetch(url, { headers: HEADERS })
        .then(function(r) { return r.ok ? r.text() : ''; })
        .catch(function(e) {
            console.log('[FaselHDX] Embed error: ' + e.message);
            return '';
        });
}

// Resolve TMDB ID to internal EasyPlex ID via proxy
// type: "movie" or "tv"
export function resolveId(tmdbId, type) {
    var url = PROXY_BASE + '/resolve/' + type + '/' + tmdbId;
    console.log('[FaselHDX] Resolve: ' + type + ' ' + tmdbId);
    return safeFetch(url, { headers: HEADERS })
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function(e) {
            console.log('[FaselHDX] Resolve error: ' + e.message);
            return null;
        });
}
