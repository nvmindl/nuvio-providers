var BASE = 'https://www.faselhds.biz';

export var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8',
};

export function getBaseUrl() { return BASE; }

function makeSignal(ms) {
    try {
        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms);
    } catch(e) {}
    try {
        var c = new AbortController();
        setTimeout(function() { c.abort(); }, ms);
        return c.signal;
    } catch(e) {}
    return undefined;
}

export async function fetchText(url, extra) {
    var h = Object.assign({}, HEADERS, extra || {});
    var opts = { headers: h, redirect: 'follow' };
    var sig = makeSignal(12000);
    if (sig) opts.signal = sig;
    var r = await fetch(url, opts);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
}

export async function fetchPost(url, body, extra) {
    var h = Object.assign({}, HEADERS, {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
    }, extra || {});
    var opts = { method: 'POST', headers: h, body: body, redirect: 'follow' };
    var sig = makeSignal(12000);
    if (sig) opts.signal = sig;
    var r = await fetch(url, opts);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
}
