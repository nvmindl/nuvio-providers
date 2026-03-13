// ── FlareSolverr proxy on Render.com ──
var PROXY_BASE = 'https://faselhdx-proxy.onrender.com';

var FASEL_DOMAIN = 'https://web31312x.faselhdx.top';
var _baseUrl = FASEL_DOMAIN;

export var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8',
};

// CF cookie + UA cache from FlareSolverr
var _cfCookies = '';
var _cfUA = '';
var _cfAge = 0;
var CF_TTL = 8 * 60 * 1000; // 8 minutes

export function getBaseUrl() { return _baseUrl; }
export function setBaseUrl(u) { _baseUrl = u; }

// ── Call FlareSolverr API ──
async function flareSolverr(cmd, url, postData) {
    console.log('[FaselHDX] FlareSolverr ' + cmd + ': ' + url.substring(0, 80));
    try {
        var controller = new AbortController();
        var tid = setTimeout(function() { controller.abort(); }, 65000);
        var body = { cmd: cmd, url: url, maxTimeout: 60000 };
        if (postData) body.postData = postData;
        var resp = await fetch(PROXY_BASE + '/v1', {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(body),
        });
        clearTimeout(tid);
        if (!resp.ok) {
            console.log('[FaselHDX] FlareSolverr HTTP ' + resp.status);
            return null;
        }
        var data = await resp.json();
        if (data.status !== 'ok' || !data.solution) {
            console.log('[FaselHDX] FlareSolverr status: ' + (data.status || 'unknown') + ' msg: ' + (data.message || ''));
            return null;
        }
        // Cache cookies and UA for potential direct requests
        if (data.solution.cookies && data.solution.cookies.length) {
            _cfCookies = data.solution.cookies.map(function(c) { return c.name + '=' + c.value; }).join('; ');
            _cfAge = Date.now();
        }
        if (data.solution.userAgent) _cfUA = data.solution.userAgent;
        return data.solution;
    } catch(e) {
        console.log('[FaselHDX] FlareSolverr error: ' + e.message);
        return null;
    }
}

// ── Direct fetch with cached CF cookies (fast path) ──
async function directFetch(url, options) {
    if (!_cfCookies || (Date.now() - _cfAge) >= CF_TTL) return '';
    options = options || {};
    var controller;
    var timeoutId;
    try {
        controller = new AbortController();
        timeoutId = setTimeout(function() { controller.abort(); }, options.timeout || 12000);
    } catch(e) { controller = null; }
    try {
        var hdrs = Object.assign({}, HEADERS, options.headers || {});
        hdrs['Cookie'] = _cfCookies;
        if (_cfUA) hdrs['User-Agent'] = _cfUA;
        var fetchOpts = {
            method: options.method || 'GET',
            redirect: 'follow',
            headers: hdrs,
        };
        if (options.body) fetchOpts.body = options.body;
        if (controller) fetchOpts.signal = controller.signal;
        var response = await fetch(url, fetchOpts);
        if (timeoutId) clearTimeout(timeoutId);
        if (!response.ok) return '';
        return await response.text();
    } catch(e) {
        if (timeoutId) clearTimeout(timeoutId);
        return '';
    }
}

// ── Public API ──

export async function fetchText(url, options) {
    // Try direct fetch with cached CF cookies first (fast)
    var result = await directFetch(url, options);
    if (result && result.length > 500) return result;
    // Fallback to FlareSolverr (slow but solves CF)
    var sol = await flareSolverr('request.get', url);
    return (sol && sol.response) ? sol.response : '';
}

export async function fetchPost(url, body, options) {
    options = options || {};
    // Try direct with CF cookies
    var result = await directFetch(url, Object.assign({}, options, {
        method: 'POST',
        body: body,
        headers: Object.assign({}, options.headers || {}, {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
        }),
    }));
    if (result && result.length > 100) return result;
    // Fallback to FlareSolverr
    var sol = await flareSolverr('request.post', url, body);
    return (sol && sol.response) ? sol.response : '';
}
