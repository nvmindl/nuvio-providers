// Primary domain (current as of 2026).  Falls back to redirect-chain
// resolution via older canonical URLs if the primary is unreachable.
var PRIMARY_URL = 'https://www.faselhds.biz';
var CANONICAL_URLS = ['https://www.faselhd.club', 'https://www.fasel-hd.cam'];
var LEGACY_DOMAIN_RE = /^(https?:\/\/web\d+x\.faselhdx\.\w+)/i;
var _resolvedBase = '';

export const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8',
};

export async function resolveBaseUrl() {
    if (_resolvedBase) return _resolvedBase;

    // 1) Try primary domain first — lightweight HEAD check
    try {
        var pr = await fetch(PRIMARY_URL + '/', {
            method: 'HEAD',
            redirect: 'follow',
            headers: HEADERS,
            signal: AbortSignal.timeout(10000),
        });
        if (pr.status < 500) {
            _resolvedBase = PRIMARY_URL;
            console.log('[FaselHDX] Using primary domain: ' + _resolvedBase);
            return _resolvedBase;
        }
    } catch (e) {
        console.log('[FaselHDX] Primary domain unreachable: ' + (e.cause && e.cause.code || e.message));
    }

    // 2) Follow redirect chain from older canonical URLs
    for (var c = 0; c < CANONICAL_URLS.length; c++) {
        try {
            var url = CANONICAL_URLS[c];
            for (var i = 0; i < 5; i++) {
                var m = url.match(LEGACY_DOMAIN_RE);
                if (m) { _resolvedBase = m[1]; break; }
                var resp = await fetch(url, {
                    method: 'HEAD',
                    redirect: 'manual',
                    headers: HEADERS,
                    signal: AbortSignal.timeout(8000),
                });
                var location = resp.headers.get('location');
                if (location) { url = location; continue; }
                var mf = (resp.url || '').match(LEGACY_DOMAIN_RE);
                if (mf) { _resolvedBase = mf[1]; break; }
                break;
            }
            if (!_resolvedBase) {
                var ml = url.match(LEGACY_DOMAIN_RE);
                if (ml) _resolvedBase = ml[1];
            }
            if (_resolvedBase) {
                console.log('[FaselHDX] Resolved via redirect: ' + _resolvedBase);
                return _resolvedBase;
            }
        } catch (e) {
            console.log('[FaselHDX] Redirect resolve error (' + CANONICAL_URLS[c] + '): ' + e.message);
        }
    }

    // 3) Fallback
    _resolvedBase = PRIMARY_URL;
    console.log('[FaselHDX] Using fallback domain: ' + _resolvedBase);
    return _resolvedBase;
}

export async function fetchText(url, options) {
    options = options || {};
    var fetchOpts = {
        redirect: 'follow',
        headers: {
            ...HEADERS,
            ...(options.headers || {}),
        },
    };

    try { fetchOpts.signal = AbortSignal.timeout(15000); } catch(e) { /* noop */ }

    var response = await fetch(url, fetchOpts);

    if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' for ' + url);
    }

    var text = await response.text();

    // Detect Cloudflare challenge page — treat as error so callers can retry
    if (text.includes('Just a moment') && text.includes('challenge-platform')) {
        throw new Error('CF challenge for ' + url);
    }

    return text;
}
