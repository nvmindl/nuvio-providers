var BASE_URL = 'https://f2h7y.sbs';

export var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ar,en-US;q=0.8,en;q=0.5',
};

export function getBaseUrl() {
    return BASE_URL;
}

export async function fetchText(url, options) {
    options = options || {};
    var controller;
    var timeoutId;
    try {
        controller = new AbortController();
        timeoutId = setTimeout(function() { controller.abort(); }, options.timeout || 15000);
    } catch (e) {
        controller = null;
    }

    try {
        var fetchOpts = {
            method: options.method || 'GET',
            redirect: 'follow',
            headers: {
                ...HEADERS,
                ...(options.headers || {}),
            },
        };
        if (options.body) fetchOpts.body = options.body;
        if (controller) fetchOpts.signal = controller.signal;
        var response = await fetch(url, fetchOpts);
        if (timeoutId) clearTimeout(timeoutId);
        if (!response.ok) return '';
        return await response.text();
    } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        console.log('[EgyDead] fetch error: ' + e.message);
        return '';
    }
}
