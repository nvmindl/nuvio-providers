// WitAnime Nuvio Provider — thin API client
// All scraping + CF bypass is handled by the witanime-backend on Render.com
// This provider just calls the backend API and returns the streams.

var BACKEND_URL = 'https://witanime-backend.onrender.com';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log('[WitAnime] Request: ' + mediaType + ' ' + tmdbId);

        // Build the ID string: "tmdbId" for movies, "tmdbId:season:episode" for TV
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

        // Ensure each stream has the expected shape for Nuvio
        var result = [];
        for (var i = 0; i < streams.length; i++) {
            var s = streams[i];
            result.push({
                name: s.name || 'WitAnime',
                title: s.title || 'Server',
                url: s.url || '',
                quality: s.quality || 'auto',
                headers: s.headers || {},
            });
        }

        return result;
    } catch (error) {
        console.error('[WitAnime] Error: ' + error.message);
        return [];
    }
}

module.exports = { getStreams };
