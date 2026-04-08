// WitAnime Nuvio Provider v7.0
// v7.0: Backend-first architecture using AniTaku EasyPlex API (anitakuapp.hasalaty.com).
//       All stream resolution handled server-side — provider is a thin client.
//       Backend: Oracle VM port 3111 (witanime service, server.js v8.0.0)
//       API: Reverse-engineered from AniTaku APK v0.1 via mitmproxy + jadx.

var BACKEND_URL = 'http://145.241.158.129:3111';

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function fetchJson(url, timeoutMs) {
    timeoutMs = timeoutMs || 20000;
    var controller;
    var timeoutId;
    try {
        controller = new AbortController();
        timeoutId = setTimeout(function() { controller.abort(); }, timeoutMs);
    } catch (e) { controller = null; }

    try {
        var opts = { method: 'GET', headers: { 'Accept': 'application/json', 'User-Agent': 'NuvioApp/1.0' } };
        if (controller) opts.signal = controller.signal;
        var resp = await fetch(url, opts);
        if (timeoutId) clearTimeout(timeoutId);
        if (!resp.ok) return null;
        return await resp.json();
    } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        console.log('[WitAnime] Fetch error: ' + e.message + ' url=' + url);
        return null;
    }
}

// ── Main getStreams ────────────────────────────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log('[WitAnime] ' + mediaType + ' ' + tmdbId + ' S' + (season || 0) + 'E' + (episode || 0));

        // Build backend URL
        var id = String(tmdbId);
        if (mediaType !== 'movie' && season && episode) {
            id = tmdbId + ':' + season + ':' + episode;
        }
        var type = mediaType === 'movie' ? 'movie' : 'tv';
        var url = BACKEND_URL + '/streams/' + type + '/' + id + '.json';

        console.log('[WitAnime] Backend: ' + url);
        var data = await fetchJson(url, 25000);

        if (!data || !data.streams || !data.streams.length) {
            console.log('[WitAnime] No streams from backend');
            return [];
        }

        console.log('[WitAnime] Got ' + data.streams.length + ' stream(s) from backend');
        return data.streams;
    } catch (err) {
        console.error('[WitAnime] Error: ' + err.message);
        return [];
    }
}

module.exports = { getStreams };
