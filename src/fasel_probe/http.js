export const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.8",
};

function resolveUrl(base, next) {
    try {
        return new URL(next, base).toString();
    } catch {
        return next;
    }
}

export async function traceRedirects(startUrl, maxHops = 8) {
    const hops = [];
    let currentUrl = startUrl;

    for (let i = 0; i < maxHops; i += 1) {
        const response = await fetch(currentUrl, {
            method: 'GET',
            redirect: 'manual',
            headers: HEADERS,
        });

        const location = response.headers.get('location');
        const status = response.status;

        hops.push({
            step: i + 1,
            url: currentUrl,
            status,
            location: location || null,
        });

        if (location && [301, 302, 303, 307, 308].includes(status)) {
            const nextUrl = resolveUrl(currentUrl, location);
            if (nextUrl === currentUrl) {
                break;
            }
            currentUrl = nextUrl;
            continue;
        }

        let body = '';
        try {
            body = await response.text();
        } catch {
            body = '';
        }

        return {
            startUrl,
            finalUrl: currentUrl,
            status,
            body,
            hops,
        };
    }

    return {
        startUrl,
        finalUrl: currentUrl,
        status: 0,
        body: '',
        hops,
    };
}

export async function fetchText(url, options = {}) {
    console.log(`[FaselProbe] Fetching: ${url}`);

    const response = await fetch(url, {
        headers: {
            ...HEADERS,
            ...options.headers
        },
        ...options
    });

    if (!response.ok) {
        throw new Error(`HTTP error ${response.status} for ${url}`);
    }

    return await response.text();
}

/**
 * Fetch JSON content from a URL
 * @param {string} url 
 * @param {object} options 
 */
export async function fetchJson(url, options = {}) {
    const raw = await fetchText(url, options);
    return JSON.parse(raw);
}
