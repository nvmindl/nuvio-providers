// FaselHD v10.0.0 — Thin client, backend does all heavy lifting
// Backend: Oracle Cloud ARM VM at 145.241.158.129:3112
// Dual pipeline: moviesapi (No Hard Sub) + EasyPlex (Arabic Hard Sub)

var BACKEND = 'http://145.241.158.129:3112';

var DEFAULT_HEADERS = {
    'Referer': 'https://flixcdn.cyou/',
    'Origin': 'https://flixcdn.cyou',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

function safeFetch(url, ms) {
    ms = ms || 30000;
    var controller;
    var tid;
    try {
        controller = new AbortController();
        tid = setTimeout(function() { controller.abort(); }, ms);
    } catch(e) { controller = null; }
    var opts = { method: 'GET' };
    if (controller) opts.signal = controller.signal;
    return fetch(url, opts)
        .then(function(r) { if (tid) clearTimeout(tid); return r; })
        .catch(function(e) { if (tid) clearTimeout(tid); throw e; });
}

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        var url;
        if (mediaType === 'movie') {
            url = BACKEND + '/streams/movie/' + tmdbId + '.json';
        } else {
            var s = parseInt(season, 10);
            var e = parseInt(episode, 10);
            url = BACKEND + '/streams/series/' + tmdbId + ':' + s + ':' + e + '.json';
        }

        console.log('[FaselHD] Backend: ' + url);
        var resp = await safeFetch(url);
        if (!resp.ok) {
            console.log('[FaselHD] Backend returned ' + resp.status);
            return [];
        }

        var data = await resp.json();
        var streams = data.streams || [];

        if (!streams.length) {
            console.log('[FaselHD] No streams from backend');
            return [];
        }

        // Add Nuvio-required fields (headers, size, provider)
        // Backend now returns per-stream headers (different for hardsub vs no-hardsub)
        var result = [];
        for (var i = 0; i < streams.length; i++) {
            var st = streams[i];
            var hdrs = st.headers || DEFAULT_HEADERS;
            // Ensure User-Agent is always present
            if (!hdrs['User-Agent']) {
                hdrs['User-Agent'] = DEFAULT_HEADERS['User-Agent'];
            }
            result.push({
                name: st.name || 'FaselHD',
                title: st.title || 'FaselHD',
                url: st.url,
                quality: st.quality || 'auto',
                size: 'Unknown',
                headers: hdrs,
                subtitles: st.subtitles || [],
                provider: 'faselhdx',
            });
        }

        console.log('[FaselHD] Got ' + result.length + ' streams');
        return result;
    } catch (error) {
        console.error('[FaselHD] Error: ' + error.message);
        return [];
    }
}

module.exports = { getStreams };
