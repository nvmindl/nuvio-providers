var DOMAINS = ['https://www.fasel-hd.cam', 'https://www.faselhds.biz'];
var _baseUrl = DOMAINS[0];

export var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8',
};

export function getBaseUrl() { return _baseUrl; }
export function setBaseUrl(u) { _baseUrl = u; }
export function getDomains() { return DOMAINS; }

export async function fetchText(url, options) {
    options = options || {};
    var controller;
    var timeoutId;
    try {
        controller = new AbortController();
        timeoutId = setTimeout(function() { controller.abort(); }, options.timeout || 15000);
    } catch(e) { controller = null; }
    try {
        var fetchOpts = {
            redirect: 'follow',
            headers: Object.assign({}, HEADERS, options.headers || {}),
        };
        if (controller) fetchOpts.signal = controller.signal;
        var response = await fetch(url, fetchOpts);
        if (timeoutId) clearTimeout(timeoutId);
        if (!response.ok) return '';
        return await response.text();
    } catch(e) {
        if (timeoutId) clearTimeout(timeoutId);
        console.log('[FaselHDX] fetch error: ' + e.message);
        return '';
    }
}

export async function fetchPost(url, body, options) {
    options = options || {};
    var controller;
    var timeoutId;
    try {
        controller = new AbortController();
        timeoutId = setTimeout(function() { controller.abort(); }, options.timeout || 15000);
    } catch(e) { controller = null; }
    try {
        var fetchOpts = {
            method: 'POST',
            body: body,
            redirect: 'follow',
            headers: Object.assign({}, HEADERS, {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
            }, options.headers || {}),
        };
        if (controller) fetchOpts.signal = controller.signal;
        var response = await fetch(url, fetchOpts);
        if (timeoutId) clearTimeout(timeoutId);
        if (!response.ok) return '';
        return await response.text();
    } catch(e) {
        if (timeoutId) clearTimeout(timeoutId);
        console.log('[FaselHDX] fetchPost error: ' + e.message);
        return '';
    }
}
