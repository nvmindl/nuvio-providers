// FaselHD v13.0.0 — Hybrid client+backend scraper
// Arabic Hard Sub streams from FaselHD CDN (scdns.io)
// Client: TMDB → EasyPlex → FaselHD page → player page HTML
// Backend: VM sandbox extraction of obfuscated JS → scdns.io m3u8 URLs
// Streams are IP-locked to fetching device — no proxy needed.

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB_BASE = 'https://api.themoviedb.org/3';
var EXTRACT_URL = 'http://145.241.158.129:3112/extract';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
var FETCH_TIMEOUT = 12000;
var GLOBAL_TIMEOUT = 25000;

// EasyPlex API backends (map TMDB ID → fasel-hd.cam page URL)
var EASYPLEX_BASES = [
    { host: 'fashd.com', path: '/faselhd15/public/api' },
    { host: 'flech.tn', path: '/egybestantoo/public/api' },
    { host: 'hrrejgh.com', path: '/wecima15/public/api' },
    { host: 'www.hrrejhp.com', path: '/egybestanto/public/api' },
];

// ── Fetch helpers ──────────────────────────────────────────────────────

function safeFetch(url, options, timeout) {
    var ms = timeout || FETCH_TIMEOUT;
    var controller;
    var tid;
    try {
        controller = new AbortController();
        tid = setTimeout(function() { controller.abort(); }, ms);
    } catch (e) { controller = null; }
    var opts = options || {};
    if (controller) opts.signal = controller.signal;
    if (!opts.headers) opts.headers = {};
    if (!opts.headers['User-Agent']) opts.headers['User-Agent'] = UA;
    return fetch(url, opts)
        .then(function(r) { if (tid) clearTimeout(tid); return r; })
        .catch(function(e) { if (tid) clearTimeout(tid); throw e; });
}

function fetchJSON(url, headers) {
    return safeFetch(url, { headers: headers || {} })
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function() { return null; });
}

function fetchText(url, headers) {
    return safeFetch(url, { headers: headers || {} })
        .then(function(r) { return r.ok ? r.text() : null; })
        .catch(function() { return null; });
}

// ── EasyPlex API with fallback backends ────────────────────────────────

function easyplexFetch(endpoint) {
    var idx = 0;
    function tryNext() {
        if (idx >= EASYPLEX_BASES.length) return Promise.resolve(null);
        var base = EASYPLEX_BASES[idx];
        idx++;
        var url = 'https://' + base.host + base.path + '/' + endpoint;
        return fetchJSON(url).then(function(data) {
            if (data) {
                if (typeof data === 'string') {
                    var s = data.trim();
                    if (s === 'Non autoris\u00e9' || s === 'Merci' || s === 'Non autorise\u0301') {
                        return tryNext();
                    }
                }
                return data;
            }
            return tryNext();
        }).catch(function() { return tryNext(); });
    }
    return tryNext();
}

// ── Resolve TMDB ID → FaselHD page URL via EasyPlex ───────────────────

async function resolveFaselPageUrl(tmdbId, mediaType, season, episode) {
    var tmdbType = mediaType === 'movie' ? 'movie' : 'tv';
    var tmdbUrl = TMDB_BASE + '/' + tmdbType + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=en';
    var tmdbData = await fetchJSON(tmdbUrl);
    if (!tmdbData) return null;

    var title = tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name || '';
    if (!title) return null;
    console.log('[FaselHD] TMDB: ' + title);

    async function searchByTitle(searchTitle) {
        var data = await easyplexFetch('search/' + encodeURIComponent(searchTitle) + '/0');
        if (!data) return null;
        var items = data.search || data.data || [];
        if (Array.isArray(data)) items = data;
        for (var i = 0; i < items.length; i++) {
            if (String(items[i].tmdb_id) === String(tmdbId)) return items[i];
        }
        return null;
    }

    var match = await searchByTitle(title);
    if (!match) {
        var origTitle = tmdbData.original_title || tmdbData.original_name || '';
        if (origTitle && origTitle !== title) {
            match = await searchByTitle(origTitle);
        }
    }
    if (!match) { console.log('[FaselHD] No EasyPlex match'); return null; }
    console.log('[FaselHD] Match id=' + match.id);

    var videos = [];
    if (mediaType === 'movie') {
        var detail = await easyplexFetch('media/detail/' + match.id + '/0');
        if (detail) videos = detail.videos || [];
    } else {
        var show = await easyplexFetch('series/show/' + match.id + '/0');
        if (!show) return null;
        var seasons = show.seasons || [];
        var targetSeason = null;
        for (var i = 0; i < seasons.length; i++) {
            if (String(seasons[i].season_number) === String(season)) { targetSeason = seasons[i]; break; }
        }
        if (!targetSeason) { console.log('[FaselHD] Season ' + season + ' not found'); return null; }

        var seasonData = await easyplexFetch('series/season/' + targetSeason.id + '/0');
        if (!seasonData) return null;
        var episodes = seasonData.episodes || [];
        var targetEp = null;
        for (var j = 0; j < episodes.length; j++) {
            if (String(episodes[j].episode_number) === String(episode)) { targetEp = episodes[j]; break; }
        }
        if (!targetEp) { console.log('[FaselHD] Episode ' + episode + ' not found'); return null; }
        videos = targetEp.videos || [];
    }

    for (var v = 0; v < videos.length; v++) {
        var link = videos[v].link || '';
        if (link.indexOf('fasel-hd') !== -1 || link.indexOf('faselhd') !== -1) {
            console.log('[FaselHD] Page: ' + link.substring(0, 80));
            return link;
        }
    }
    console.log('[FaselHD] No fasel link in ' + videos.length + ' videos');
    return null;
}

// ── Extract player tokens from FaselHD page ───────────────────────────

async function extractPlayerTokens(faselUrl) {
    var html = await fetchText(faselUrl, {
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'ar,en;q=0.8',
        'Referer': 'https://fasel-hd.cam/',
    });
    if (!html) return null;

    var tokenMatches = html.match(/player_token=([A-Za-z0-9+/=%]+)/g);
    if (!tokenMatches || !tokenMatches.length) {
        console.log('[FaselHD] No player_token in page');
        return null;
    }

    var seen = {};
    var tokens = [];
    for (var i = 0; i < tokenMatches.length; i++) {
        var m = tokenMatches[i].match(/player_token=([A-Za-z0-9+/=%]+)/);
        if (m && !seen[m[1]]) { seen[m[1]] = true; tokens.push(m[1]); }
    }

    var hostMatch = html.match(/https?:\/\/(web[0-9]+x?\.[a-z0-9.-]+)/i);
    var hostname = hostMatch ? hostMatch[1] : null;
    if (!hostname) {
        var fhMatch = html.match(/https?:\/\/([a-z0-9.-]*faselhdx[a-z0-9.-]*)/i);
        hostname = fhMatch ? fhMatch[1] : null;
    }

    console.log('[FaselHD] ' + tokens.length + ' token(s), host=' + hostname);
    return { tokens: tokens, hostname: hostname };
}

// ── Parse master m3u8 for individual quality variant URLs ─────────────

function detectQuality(variantUrl, height, width) {
    // First check filename hints (most reliable for FaselHD)
    var urlLower = variantUrl.toLowerCase();
    if (urlLower.indexOf('1080') !== -1 || urlLower.indexOf('hd1080') !== -1) return '1080p';
    if (urlLower.indexOf('720') !== -1 || urlLower.indexOf('hd720') !== -1) return '720p';
    if (urlLower.indexOf('480') !== -1 || urlLower.indexOf('sd480') !== -1) return '480p';
    if (urlLower.indexOf('360') !== -1 || urlLower.indexOf('sd360') !== -1) return '360p';

    // Fall back to resolution (use width for widescreen content)
    if (width >= 1920 || height >= 1080) return '1080p';
    if (width >= 1280 || height >= 720) return '720p';
    if (width >= 854 || height >= 480) return '480p';
    if (width > 0 || height > 0) return '360p';

    return 'auto';
}

function parseM3u8Qualities(masterUrl, m3u8Text) {
    var lines = m3u8Text.split('\n');
    var variants = [];
    var baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf('#EXT-X-STREAM-INF') === 0) {
            // Parse resolution
            var resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
            var bwMatch = line.match(/BANDWIDTH=(\d+)/);
            var width = resMatch ? parseInt(resMatch[1], 10) : 0;
            var height = resMatch ? parseInt(resMatch[2], 10) : 0;
            var bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;

            // Next non-comment line is the variant URL
            var variantUrl = '';
            for (var j = i + 1; j < lines.length; j++) {
                var nextLine = lines[j].trim();
                if (nextLine && nextLine.charAt(0) !== '#') {
                    variantUrl = nextLine;
                    break;
                }
            }
            if (!variantUrl) continue;

            // Make absolute
            if (variantUrl.indexOf('http') !== 0) {
                variantUrl = baseUrl + variantUrl;
            }

            var quality = detectQuality(variantUrl, height, width);
            variants.push({ url: variantUrl, quality: quality, height: height, bandwidth: bw });
        }
    }

    return variants;
}

// ── Extract streams from a single player token ────────────────────────

async function extractStreamsFromToken(token, hostname) {
    var playerUrl = 'https://' + hostname + '/video_player?player_token=' + encodeURIComponent(token);
    console.log('[FaselHD] Fetching player: ' + playerUrl.substring(0, 80) + '...');

    var html = await fetchText(playerUrl, {
        'Referer': 'https://' + hostname + '/',
        'Accept': 'text/html,application/xhtml+xml,*/*',
    });
    if (!html) { console.log('[FaselHD] Player page empty'); return []; }
    console.log('[FaselHD] Player HTML: ' + html.length + ' chars');

    // POST the HTML to the backend for VM sandbox extraction
    var extractResponse;
    try {
        extractResponse = await safeFetch(EXTRACT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/html',
            },
            body: html,
        }, 15000);
    } catch (e) {
        console.log('[FaselHD] Extract POST failed: ' + e.message);
        return [];
    }

    if (!extractResponse.ok) {
        console.log('[FaselHD] Extract returned ' + extractResponse.status);
        return [];
    }

    var extractData;
    try {
        extractData = await extractResponse.json();
    } catch (e) {
        console.log('[FaselHD] Extract JSON parse failed');
        return [];
    }

    if (!extractData.streams || !extractData.streams.length) {
        console.log('[FaselHD] No streams from extract: ' + (extractData.error || 'unknown'));
        return [];
    }

    console.log('[FaselHD] Backend returned ' + extractData.streams.length + ' stream(s)');

    // For each returned stream, check if it's a master m3u8 and try to parse quality variants
    var results = [];
    for (var i = 0; i < extractData.streams.length; i++) {
        var stream = extractData.streams[i];
        if (!stream.url) continue;

        // If it's a master m3u8, fetch it and parse quality variants
        if (stream.url.indexOf('master.m3u8') !== -1 || stream.url.indexOf('master.') !== -1) {
            console.log('[FaselHD] Fetching master m3u8 for qualities...');
            var m3u8Text = await fetchText(stream.url, {
                'Referer': 'https://' + hostname + '/',
                'Origin': 'https://' + hostname,
            });

            if (m3u8Text && m3u8Text.indexOf('#EXTM3U') !== -1 && m3u8Text.indexOf('#EXT-X-STREAM-INF') !== -1) {
                var variants = parseM3u8Qualities(stream.url, m3u8Text);
                if (variants.length > 0) {
                    console.log('[FaselHD] Found ' + variants.length + ' quality variants');
                    // Sort by height descending
                    variants.sort(function(a, b) { return b.height - a.height; });
                    for (var v = 0; v < variants.length; v++) {
                        results.push({ url: variants[v].url, quality: variants[v].quality });
                    }
                    continue;
                }
            }
            // If master m3u8 parsing failed, just use master URL as-is
            console.log('[FaselHD] Using master m3u8 directly');
        }

        results.push({ url: stream.url, quality: stream.quality || 'auto' });
    }

    return results;
}

// ── Main resolver ─────────────────────────────────────────────────────

async function resolveStreams(mediaType, tmdbId, season, episode) {
    var t0 = Date.now();

    var faselUrl = await resolveFaselPageUrl(tmdbId, mediaType, season, episode);
    if (!faselUrl) return [];
    console.log('[FaselHD] Resolve in ' + (Date.now() - t0) + 'ms');

    var tokenResult = await extractPlayerTokens(faselUrl);
    if (!tokenResult || !tokenResult.tokens.length || !tokenResult.hostname) return [];
    console.log('[FaselHD] Tokens in ' + (Date.now() - t0) + 'ms');

    var rawStreams = [];
    for (var i = 0; i < Math.min(tokenResult.tokens.length, 2); i++) {
        var streams = await extractStreamsFromToken(tokenResult.tokens[i], tokenResult.hostname);
        if (streams.length > 0) {
            rawStreams = rawStreams.concat(streams);
            break; // Got streams from first working token
        }
    }
    console.log('[FaselHD] Extract in ' + (Date.now() - t0) + 'ms');

    if (!rawStreams.length) {
        console.log('[FaselHD] No streams');
        return [];
    }

    var seen = {};
    var result = [];
    var faselHeaders = {
        'User-Agent': UA,
        'Referer': 'https://' + tokenResult.hostname + '/',
        'Origin': 'https://' + tokenResult.hostname,
    };

    for (var j = 0; j < rawStreams.length; j++) {
        var raw = rawStreams[j];
        if (seen[raw.url]) continue;
        seen[raw.url] = true;

        result.push({
            name: 'FaselHD',
            title: 'FaselHD - ' + raw.quality + ' (Arabic Hard Sub)',
            url: raw.url,
            quality: raw.quality,
            size: 'Unknown',
            headers: faselHeaders,
            subtitles: [],
            provider: 'faselhd',
        });
    }

    console.log('[FaselHD] ' + result.length + ' streams in ' + (Date.now() - t0) + 'ms');
    return result;
}

// ── Entry point ───────────────────────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
    var t0 = Date.now();
    console.log('[FaselHD] === ' + mediaType + '/' + tmdbId + (mediaType !== 'movie' ? ' S' + season + 'E' + episode : '') + ' ===');

    try {
        var timeoutP = new Promise(function(resolve) {
            setTimeout(function() { resolve([]); }, GLOBAL_TIMEOUT);
        });

        var mainP = resolveStreams(
            mediaType, tmdbId,
            season ? parseInt(season, 10) : undefined,
            episode ? parseInt(episode, 10) : undefined
        ).catch(function(e) { console.log('[FaselHD] Error: ' + e.message); return []; });

        var streams = await Promise.race([mainP, timeoutP]);
        console.log('[FaselHD] === Done: ' + streams.length + ' streams in ' + (Date.now() - t0) + 'ms ===');
        return streams;
    } catch (error) {
        console.error('[FaselHD] Fatal: ' + error.message);
        return [];
    }
}

module.exports = { getStreams };
