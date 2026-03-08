// The site rotates domains (web376x → web380x → etc). We resolve the current
// one by following redirects from the stable canonical domain.
var CANONICAL_URL = 'https://www.faselhd.club';
var _resolvedBase = '';

export const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8',
};

export async function resolveBaseUrl() {
    if (_resolvedBase) return _resolvedBase;
    try {
        var resp = await fetch(CANONICAL_URL, {
            method: 'HEAD',
            redirect: 'follow',
            headers: HEADERS,
        });
        // The final URL after redirects is the current domain
        var finalUrl = resp.url || '';
        var m = finalUrl.match(/^(https?:\/\/web\d+x\.faselhdx\.best)/i);
        if (m) {
            _resolvedBase = m[1];
            console.log('[FaselHDX] Resolved domain: ' + _resolvedBase);
            return _resolvedBase;
        }
    } catch (e) {
        console.log('[FaselHDX] Domain resolve error: ' + e.message);
    }
    // Fallback
    _resolvedBase = 'https://web380x.faselhdx.best';
    console.log('[FaselHDX] Using fallback domain: ' + _resolvedBase);
    return _resolvedBase;
}

export async function fetchText(url, options) {
    options = options || {};
    var controller;
    var timeoutId;
    try {
        controller = new AbortController();
        timeoutId = setTimeout(function() { controller.abort(); }, 12000);
    } catch(e) {
        // AbortController not available on some runtimes
        controller = null;
    }

    var response;
    try {
        var fetchOpts = {
            redirect: 'follow',
            headers: {
                ...HEADERS,
                ...(options.headers || {}),
            },
        };
        if (controller) fetchOpts.signal = controller.signal;
        response = await fetch(url, fetchOpts);
    } catch (fetchErr) {
        if (timeoutId) clearTimeout(timeoutId);
        throw fetchErr;
    }

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' for ' + url);
    }

    var text = await response.text();
    return text;
}
