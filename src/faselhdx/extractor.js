import { HEADERS, apiGet, proxyFetch } from './http.js';

// ── Helpers ──

function m3u8urls(text) {
    var out = [], m;
    var clean = text.replace(/\\\//g, '/');
    var re = /https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/gi;
    while ((m = re.exec(clean)) !== null) out.push(m[0]);
    return out.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

function mp4urls(text) {
    var out = [], m;
    var clean = text.replace(/\\\//g, '/');
    var re = /https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/gi;
    while ((m = re.exec(clean)) !== null) out.push(m[0]);
    return out.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

function iframeUrls(html) {
    var out = [], m;
    var re = /<iframe[^>]*(?:data-src|src)\s*=\s*"(https?:\/\/[^"]+)"/gi;
    while ((m = re.exec(html)) !== null) {
        if (m[1].indexOf('youtube') < 0 && m[1].indexOf('google') < 0) out.push(m[1]);
    }
    return out.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

// Extract direct stream URLs from an embed page HTML
function extractUrlsFromHtml(html) {
    var streams = [];
    var m3 = m3u8urls(html);
    for (var i = 0; i < m3.length; i++) {
        streams.push({ url: m3[i], quality: 'auto', type: 'm3u8' });
    }
    var mp4 = mp4urls(html);
    for (var j = 0; j < mp4.length; j++) {
        var q = 'auto';
        if (/1080/.test(mp4[j])) q = '1080p';
        else if (/720/.test(mp4[j])) q = '720p';
        else if (/480/.test(mp4[j])) q = '480p';
        streams.push({ url: mp4[j], quality: q, type: 'mp4' });
    }
    return streams;
}

// Resolve an embed URL to direct stream URLs
async function resolveEmbed(embedUrl) {
    var html = await proxyFetch(embedUrl);
    if (!html) return [];

    var streams = extractUrlsFromHtml(html);
    if (streams.length) return streams;

    // Try nested iframes (one level deep)
    var nested = iframeUrls(html);
    for (var k = 0; k < nested.length && k < 3; k++) {
        var inner = await proxyFetch(nested[k]);
        if (inner) {
            var innerStreams = extractUrlsFromHtml(inner);
            if (innerStreams.length) return innerStreams;
        }
    }

    return [];
}

// Process video objects from the API into stream results
async function processVideos(videos) {
    if (!videos || !videos.length) return [];
    var results = [];

    for (var i = 0; i < videos.length; i++) {
        var v = videos[i];
        var link = v.link || '';
        if (!link) continue;

        var serverName = (v.server || 'Server ' + (i + 1)).trim();
        var lang = v.lang || '';

        // Build headers for this stream
        var streamHeaders = {};
        streamHeaders['User-Agent'] = v.useragent || HEADERS['User-Agent'];
        if (v.header) streamHeaders['Referer'] = v.header;

        // Direct HLS link from fasel-hd.cam or similar
        if (v.hls === 1 || /\.m3u8/i.test(link)) {
            // fasel-hd.cam links need to be fetched to get the actual m3u8
            if (/fasel-hd|faselhd/i.test(link)) {
                var resolved = await resolveEmbed(link);
                for (var r = 0; r < resolved.length; r++) {
                    results.push({
                        url: resolved[r].url,
                        quality: resolved[r].quality,
                        name: serverName,
                        lang: lang,
                        headers: streamHeaders,
                    });
                }
            } else {
                results.push({
                    url: link,
                    quality: 'auto',
                    name: serverName,
                    lang: lang,
                    headers: streamHeaders,
                });
            }
            continue;
        }

        // Embed URLs (uqload, vidspeed, etc) — resolve to get direct stream
        if (v.supported_hosts === 1 || /embed|uqload|vidspeed|dood|mixdrop|streamtape|upstream|mp4upload/i.test(link)) {
            var embedded = await resolveEmbed(link);
            for (var j = 0; j < embedded.length; j++) {
                results.push({
                    url: embedded[j].url,
                    quality: embedded[j].quality,
                    name: serverName,
                    lang: lang,
                    headers: streamHeaders,
                });
            }
            continue;
        }

        // Direct mp4/m3u8 URL
        if (/\.mp4/i.test(link) || /\.m3u8/i.test(link)) {
            results.push({
                url: link,
                quality: 'auto',
                name: serverName,
                lang: lang,
                headers: streamHeaders,
            });
        }
    }

    return results;
}

// ── Movie extraction ──

async function extractMovie(tmdbId) {
    console.log('[FaselHDX] Movie TMDB: ' + tmdbId);
    var data = await apiGet('media/detail/' + tmdbId + '/0');
    if (!data || typeof data !== 'object' || !data.id) {
        console.log('[FaselHDX] Movie not found for TMDB ' + tmdbId);
        return [];
    }

    console.log('[FaselHDX] Movie: ' + (data.title || 'untitled') + ' | Videos: ' + (data.videos ? data.videos.length : 0));
    return processVideos(data.videos);
}

// ── Series extraction ──

async function extractSeries(tmdbId, season, episode) {
    var seasonNum = parseInt(season, 10);
    var episodeNum = parseInt(episode, 10);
    console.log('[FaselHDX] Series TMDB: ' + tmdbId + ' S' + seasonNum + 'E' + episodeNum);

    // Step 1: Get series info with season list
    var seriesData = await apiGet('series/show/' + tmdbId + '/0');
    if (!seriesData || typeof seriesData !== 'object') {
        console.log('[FaselHDX] Series not found for TMDB ' + tmdbId);
        return [];
    }

    var seasons = seriesData.seasons || [];
    console.log('[FaselHDX] Series: ' + (seriesData.name || 'untitled') + ' | Seasons: ' + seasons.length);

    // Find the matching season
    var targetSeason = null;
    for (var s = 0; s < seasons.length; s++) {
        if (seasons[s].season_number === seasonNum) {
            targetSeason = seasons[s];
            break;
        }
    }
    // Fallback: match by name containing the number
    if (!targetSeason) {
        for (var s2 = 0; s2 < seasons.length; s2++) {
            var nm = (seasons[s2].name || '').match(/\d+/);
            if (nm && parseInt(nm[0], 10) === seasonNum) {
                targetSeason = seasons[s2];
                break;
            }
        }
    }

    if (!targetSeason) {
        console.log('[FaselHDX] Season ' + seasonNum + ' not found');
        return [];
    }

    console.log('[FaselHDX] Season found: id=' + targetSeason.id + ' name=' + (targetSeason.name || '?'));

    // Step 2: Get episodes for this season
    var seasonData = await apiGet('series/season/' + targetSeason.id + '/0');
    if (!seasonData) {
        console.log('[FaselHDX] Failed to load season data');
        return [];
    }

    var episodes = seasonData.episodes || [];
    console.log('[FaselHDX] Episodes: ' + episodes.length);

    // Find the matching episode
    var targetEp = null;
    for (var e = 0; e < episodes.length; e++) {
        if (episodes[e].episode_number === episodeNum) {
            targetEp = episodes[e];
            break;
        }
    }

    if (!targetEp) {
        console.log('[FaselHDX] Episode ' + episodeNum + ' not found');
        return [];
    }

    console.log('[FaselHDX] Episode: ' + (targetEp.name || episodeNum) + ' | Videos: ' + (targetEp.videos ? targetEp.videos.length : 0));
    return processVideos(targetEp.videos);
}

// ── Main export ──

export async function extractStreams(tmdbId, mediaType, season, episode) {
    console.log('[FaselHDX] Starting: ' + mediaType + ' ' + tmdbId);

    var streams = [];
    if (mediaType === 'movie') {
        streams = await extractMovie(tmdbId);
    } else {
        streams = await extractSeries(tmdbId, season, episode);
    }

    if (!streams.length) {
        console.log('[FaselHDX] No streams found');
        return [];
    }

    console.log('[FaselHDX] Got ' + streams.length + ' streams');

    return streams.map(function(s) {
        var label = s.name || 'FaselHDX';
        if (s.lang) label = label + ' [' + s.lang + ']';
        if (s.quality && s.quality !== 'auto') label = label + ' ' + s.quality;
        return {
            name: 'FaselHDX',
            title: label,
            url: s.url,
            quality: s.quality || 'auto',
            headers: s.headers || HEADERS,
        };
    });
}
