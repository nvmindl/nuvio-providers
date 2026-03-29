// WitAnime Nuvio Provider v3.0 — Dual Source (anime4up + WitAnime backend)
// Backend: anime4up primary (free) with ScraperAPI fallback

var BACKEND_URL = 'https://witanime-backend.onrender.com';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log('[WitAnime] Request: ' + mediaType + ' ' + tmdbId);

        var id = String(tmdbId);
        if (mediaType !== 'movie' && season && episode) {
            id = tmdbId + ':' + season + ':' + episode;
        }

        var type = mediaType === 'movie' ? 'movie' : 'series';
        var url = BACKEND_URL + '/streams/' + type + '/' + id + '.json';

        console.log('[WitAnime] Calling backend: ' + url);

        var controller;
        var timeoutId;
        try {
            controller = new AbortController();
            timeoutId = setTimeout(function() { controller.abort(); }, 60000);
        } catch (e) { controller = null; }

        var fetchOpts = {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'NuvioApp/1.0',
            },
        };
        if (controller) fetchOpts.signal = controller.signal;

        var response = await fetch(url, fetchOpts);
        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
            console.log('[WitAnime] Backend returned status ' + response.status);
            return [];
        }

        var data = await response.json();
        var streams = data.streams || [];
        console.log('[WitAnime] Got ' + streams.length + ' stream(s) from backend');

        var result = [];
        for (var i = 0; i < streams.length; i++) {
            var s = streams[i];
            var rawUrl = s.url || '';
            var proxyUrl = s.proxyUrl || '';
            var streamHeaders = s.headers || {};

            if (!rawUrl && !proxyUrl) continue; // skip streams with no URL at all

            // Primary: raw URL with headers (direct .m3u8 or .mp4 — player can detect type)
            if (rawUrl) {
                result.push({
                    name: s.name || 'WitAnime',
                    title: s.title || 'Server',
                    url: rawUrl,
                    quality: s.quality || 'auto',
                    headers: streamHeaders,
                });
            }

            // Fallback: proxy URL (handles CORS/referer internally, no headers needed)
            // Only add if we have a proxy URL and it differs from the raw URL
            if (proxyUrl && proxyUrl !== rawUrl) {
                result.push({
                    name: s.name || 'WitAnime',
                    title: (s.title || 'Server') + ' (Proxy)',
                    url: proxyUrl,
                    quality: s.quality || 'auto',
                });
            }
        }

        return result;
    } catch (error) {
        console.error('[WitAnime] Error: ' + error.message);
        return [];
    }
}

async function searchAnime(query) {
    try {
        console.log('[WitAnime] Search: ' + query);

        var url = BACKEND_URL + '/search?q=' + encodeURIComponent(query);

        var response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            console.log('[WitAnime] Search returned status ' + response.status);
            return [];
        }

        var data = await response.json();
        var results = data.results || [];
        console.log('[WitAnime] Search found ' + results.length + ' result(s)');

        return results.map(function(r) {
            return {
                slug: r.slug,
                title: r.title,
                url: r.url,
                thumbnail: r.thumbnail || '',
                type: r.type || '',
                status: r.status || '',
            };
        });
    } catch (error) {
        console.error('[WitAnime] Search error: ' + error.message);
        return [];
    }
}

module.exports = { getStreams, searchAnime };
