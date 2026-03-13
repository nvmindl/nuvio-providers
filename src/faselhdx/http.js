// ── PROXY_BASE: set this to your Vercel deployment URL ──
var PROXY_BASE = 'https://faselhdx-proxy.vercel.app';

var FASEL_DOMAIN = 'https://web31312x.faselhdx.top';
var _baseUrl = FASEL_DOMAIN;

export var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8',
};

// CF cookie cache
var _cfCookies = '';
var _cfAge = 0;
var CF_TTL = 8 * 60 * 1000; // 8 minutes

export function getBaseUrl() { return _baseUrl; }
export function setBaseUrl(u) { _baseUrl = u; }
export function getProxyBase() { return PROXY_BASE; }

// ── Get CF clearance cookies via the proxy ──
async function ensureCfCookies() {
    if (_cfCookies && (Date.now() - _cfAge) < CF_TTL) return _cfCookies;
    console.log('[FaselHDX] Fetching CF cookies via proxy...');
    try {
        var controller = new AbortController();
        var tid = setTimeout(function() { controller.abort(); }, 25000);
        var resp = await fetch(PROXY_BASE + '/api/cookies?domain=web31312x.faselhdx.top', {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });
        clearTimeout(tid);
        if (!resp.ok) {
            console.log('[FaselHDX] Cookie proxy returned ' + resp.status);
            return '';
        }
        var data = await resp.json();
        if (data.cookies && data.cookies.length) {
            _cfCookies = data.cookies.map(function(c) { return c.name + '=' + c.value; }).join('; ');
            _cfAge = Date.now();
            console.log('[FaselHDX] Got CF cookies (cached=' + (data.cached || false) + ')');
            return _cfCookies;
        }
    } catch(e) {
        console.log('[FaselHDX] Cookie proxy error: ' + e.message);
    }
    return '';
}

// ── Direct fetch with CF cookies ──
async function directFetch(url, options) {
    options = options || {};
    var cookies = await ensureCfCookies();
    var controller;
    var timeoutId;
    try {
        controller = new AbortController();
        timeoutId = setTimeout(function() { controller.abort(); }, options.timeout || 15000);
    } catch(e) { controller = null; }
    try {
        var hdrs = Object.assign({}, HEADERS, options.headers || {});
        if (cookies) hdrs['Cookie'] = cookies;
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

// ── Proxy-based fetch (fallback: Puppeteer renders the page) ──
async function proxyFetch(url, method, body) {
    console.log('[FaselHDX] Proxy fetch: ' + url.substring(0, 80));
    try {
        var controller = new AbortController();
        var tid = setTimeout(function() { controller.abort(); }, 30000);
        var proxyUrl = PROXY_BASE + '/api/fetch?url=' + encodeURIComponent(url);
        if (method === 'POST') proxyUrl += '&method=POST';
        if (body) proxyUrl += '&body=' + encodeURIComponent(body);
        var resp = await fetch(proxyUrl, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });
        clearTimeout(tid);
        if (!resp.ok) return '';
        var data = await resp.json();
        // Update cached cookies from proxy response
        if (data.cookies && data.cookies.length) {
            _cfCookies = data.cookies.join('; ');
            _cfAge = Date.now();
        }
        return data.html || '';
    } catch(e) {
        console.log('[FaselHDX] Proxy error: ' + e.message);
        return '';
    }
}

// ── Public API ──

export async function fetchText(url, options) {
    // Try direct fetch with CF cookies first (fast)
    var result = await directFetch(url, options);
    if (result && result.length > 500) return result;
    // Fallback to full proxy fetch (slow but reliable)
    return await proxyFetch(url, 'GET', null);
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
    // Fallback to proxy
    return await proxyFetch(url, 'POST', body);
}
