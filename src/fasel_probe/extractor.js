import { HEADERS, traceRedirects } from './http.js';

const PROBE_URL = 'https://web370x.faselhdx.top/movies/%D9%81%D9%8A%D9%84%D9%85-moana-2-2024-%D9%85%D8%AA%D8%B1%D8%AC%D9%85';
const HOME_URL = 'https://web370x.faselhdx.xyz/main';

function isHttpUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function pickProbeUrl(tmdbId, mediaType) {
    if (isHttpUrl(tmdbId)) {
        return tmdbId;
    }

    if (mediaType === 'home') {
        return HOME_URL;
    }

    return PROBE_URL;
}

function summarizeBody(html) {
    if (!html) {
        return { movieLinks: 0, seriesLinks: 0, hasArabicUi: false };
    }

    const movieLinks = (html.match(/href=["'][^"']*\/movies\//gi) || []).length;
    const seriesLinks = (html.match(/href=["'][^"']*\/series\//gi) || []).length;
    const hasArabicUi = /(فاصل|الأفلام|المسلسلات)/i.test(html);

    return { movieLinks, seriesLinks, hasArabicUi };
}

function classifyTrace(trace) {
    const joined = JSON.stringify(trace.hops).toLowerCase();
    const body = (trace.body || '').toLowerCase();
    const finalUrl = (trace.finalUrl || '').toLowerCase();

    const adRedirect = /(coosync\.com|doubleclick|adservice|popunder|clickadu)/i.test(joined + finalUrl);
    const challenge = /(captcha|verify you are human|checking your browser|cloudflare|javascript required|ddos)/i.test(body);
    const hasPlayableMarkers = /(\.m3u8|\.mp4|<video|source\s+src=|application\/vnd\.apple\.mpegurl)/i.test(body);

    if (adRedirect) return 'ad_redirect_chain';
    if (challenge) return 'challenge_page';
    if (hasPlayableMarkers) return 'media_markers_found';
    return 'unknown_or_empty';
}

function printTrace(trace, classification) {
    console.log(`[FaselProbe] Classification: ${classification}`);
    for (const hop of trace.hops) {
        const location = hop.location ? ` -> ${hop.location}` : '';
        console.log(`[FaselProbe] Hop ${hop.step}: ${hop.status} ${hop.url}${location}`);
    }
    console.log(`[FaselProbe] Final: ${trace.finalUrl} (status ${trace.status})`);

    const summary = summarizeBody(trace.body);
    console.log(
        `[FaselProbe] Body summary: movieLinks=${summary.movieLinks}, seriesLinks=${summary.seriesLinks}, hasArabicUi=${summary.hasArabicUi}`
    );
}

function buildNuvioResults(trace, classification, targetUrl) {
    const results = [];
    const summary = summarizeBody(trace.body || '');

    // Always return at least one entry so provider integration can show source status in UI.
    results.push({
        name: 'FaselProbe',
        title: `Source Page (${classification})`,
        url: trace.finalUrl || targetUrl,
        quality: 'INFO',
        headers: {
            ...HEADERS,
            Referer: trace.finalUrl || targetUrl,
            'X-Nuvio-Status': classification,
            'X-Nuvio-Movie-Links': String(summary.movieLinks),
            'X-Nuvio-Series-Links': String(summary.seriesLinks),
        },
    });

    // If media markers are visible, expose the originally requested page too.
    if (classification === 'media_markers_found' && targetUrl !== (trace.finalUrl || targetUrl)) {
        results.push({
            name: 'FaselProbe',
            title: 'Requested Source Page',
            url: targetUrl,
            quality: 'INFO',
            headers: {
                ...HEADERS,
                Referer: targetUrl,
            },
        });
    }

    return results;
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    console.log(
        `[FaselProbe] Probe only for ${mediaType}:${tmdbId} s=${season || '-'} e=${episode || '-'}`
    );

    // Intentionally diagnostics-only: do not extract or return protected stream URLs.
    const targetUrl = pickProbeUrl(tmdbId, mediaType);
    console.log(`[FaselProbe] Target: ${targetUrl}`);

    try {
        const trace = await traceRedirects(targetUrl, 10);
        const classification = classifyTrace(trace);
        printTrace(trace, classification);

        return buildNuvioResults(trace, classification, targetUrl);
    } catch (error) {
        console.log(`[FaselProbe] Probe failed: ${error.message}`);
        return [{
            name: 'FaselProbe',
            title: 'Source Page (network_error)',
            url: targetUrl,
            quality: 'INFO',
            headers: {
                ...HEADERS,
                Referer: targetUrl,
                'X-Nuvio-Status': 'network_error',
                'X-Nuvio-Error': String(error.message || 'unknown_error'),
            },
        }];
    }
}
