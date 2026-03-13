// The site rotates domains AND TLDs (e.g. .best → .top). We resolve by
// following the redirect chain from stable canonical URLs step-by-step
// (since Cloudflare blocks the final hop, we read Location headers).
var CANONICAL_URLS = ['https://www.faselhd.club', 'https://www.fasel-hd.cam'];
var DOMAIN_RE = /^(https?:\/\/web\d+x\.faselhdx\.\w+)/i;
var _resolvedBase = '';

export const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8',
};

export async function resolveBaseUrl() {
    if (_resolvedBase) return _resolvedBase;
    for (var c = 0; c < CANONICAL_URLS.length; c++) {
        try {
            // Follow up to 5 hops manually so we capture Location even on 403
            var url = CANONICAL_URLS[c];
            for (var i = 0; i < 5; i++) {
                var m = url.match(DOMAIN_RE);
                if (m) {
                    _resolvedBase = m[1];
                    console.log('[FaselHDX] Resolved domain: ' + _resolvedBase);
                    return _resolvedBase;
                }
                var resp = await fetch(url, {
                    method: 'HEAD',
                    redirect: 'manual',
                    headers: HEADERS,
                });
                var location = resp.headers.get('location');
                if (location) {
                    url = location;
                    continue;
                }
                // No redirect — check resp.url in case runtime resolved it
                var finalUrl = resp.url || '';
                var mf = finalUrl.match(DOMAIN_RE);
                if (mf) {
                    _resolvedBase = mf[1];
                    console.log('[FaselHDX] Resolved domain: ' + _resolvedBase);
                    return _resolvedBase;
                }
                break;
            }
            // Check the final url after loop
            var ml = url.match(DOMAIN_RE);
            if (ml) {
                _resolvedBase = ml[1];
                console.log('[FaselHDX] Resolved domain: ' + _resolvedBase);
                return _resolvedBase;
            }
        } catch (e) {
            console.log('[FaselHDX] Domain resolve error (' + CANONICAL_URLS[c] + '): ' + e.message);
        }
    }
    // Fallback — use latest known domain
    _resolvedBase = 'https://web3136x.faselhdx.top';
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
