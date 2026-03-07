export const BASE_URL = 'https://web376x.faselhdx.best';

export const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8',
};

export async function fetchText(url, options = {}) {
    console.log('[FaselHDX] fetch: ' + url.substring(0, 120));
    var response;
    try {
        response = await fetch(url, {
            redirect: 'follow',
            headers: {
                ...HEADERS,
                ...(options.headers || {}),
            },
            ...options,
        });
    } catch (fetchErr) {
        console.error('[FaselHDX] fetch threw: ' + fetchErr.message);
        throw fetchErr;
    }

    console.log('[FaselHDX] fetch status: ' + response.status + ' for ' + url.substring(0, 80));

    if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' for ' + url);
    }

    var text = await response.text();
    console.log('[FaselHDX] fetch got ' + text.length + ' chars from ' + url.substring(0, 80));
    return text;
}
