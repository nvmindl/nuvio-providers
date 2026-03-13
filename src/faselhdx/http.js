var BASE = 'https://www.faselhds.biz';

export var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8',
};

export function getBaseUrl() { return BASE; }

export async function fetchText(url, extra) {
    var h = Object.assign({}, HEADERS, extra || {});
    var r = await fetch(url, { headers: h, redirect: 'follow', signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
}

export async function fetchPost(url, body, extra) {
    var h = Object.assign({}, HEADERS, {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
    }, extra || {});
    var r = await fetch(url, { method: 'POST', headers: h, body: body, redirect: 'follow', signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
}
