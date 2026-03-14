import { HEADERS, apiGet, extractSources, resolveId } from './http.js';

// ── Helpers ──

// Working hosts from Render: egybestvid, uqload.cx/net, vidspeed.org, vidoba, aflam, reviewrate, anafast
// CDN URLs on cdnz.quest / egybestvid / uqload.is are direct-playable
var PREFERRED_HOST_RE = /aflam\.news|mp4plus\.org|anafast\.org|reviewrate\.net|egybestvid\.com|vidspeed\.org|uqload\.cx|uqload\.net|vidoba\.org/i;
var BLOCKED_HOST_RE = /fasel-hd\.cam|faselhd\.cam|faselhd\.center|faselhdx\.best|vidtube\.|1vid\.xyz|vidspeed\.cc|anafast\.online|vidspeeds\.com|dw\.uns|liiivideo\.com|dingtezuni\.com|videoland\.|lulustream\.com|luluvdo\.com|luluvid\.com/i;

// Sort videos: preferred hosts first, blocked hosts removed
function sortVideos(videos) {
    var preferred = [];
    var others = [];
    for (var i = 0; i < videos.length; i++) {
        var link = videos[i].link || '';
        if (!link) continue;
        if (BLOCKED_HOST_RE.test(link)) continue;
        if (PREFERRED_HOST_RE.test(link)) {
            preferred.push(videos[i]);
        } else {
            others.push(videos[i]);
        }
    }
    return preferred.concat(others);
}

// Process video objects from the API into stream results
async function processVideos(videos) {
    if (!videos || !videos.length) return [];
    var sorted = sortVideos(videos);
    var results = [];

    for (var i = 0; i < sorted.length; i++) {
        var v = sorted[i];
        var link = v.link || '';
        if (!link) continue;

        var serverName = (v.server || 'Server ' + (i + 1)).trim();
        var lang = v.lang || '';

        // Use /extract endpoint — server-side fetches embed page and returns sources
        var data = await extractSources(link);
        var sources = data && data.sources ? data.sources : [];

        for (var j = 0; j < sources.length; j++) {
            var s = sources[j];
            results.push({
                url: s.url,
                quality: s.quality || 'auto',
                type: s.type || 'mp4',
                name: serverName,
                lang: lang,
            });
        }

        // Stop after getting enough results (prefer quality over quantity)
        if (results.length >= 6) break;
    }

    return results;
}

// ── Movie extraction ──

async function extractMovie(tmdbId) {
    console.log('[FaselHDX] Movie TMDB: ' + tmdbId);

    // Resolve TMDB ID → internal ID via proxy
    var resolved = await resolveId(tmdbId, 'movie');
    if (!resolved || !resolved.id) {
        console.log('[FaselHDX] Could not resolve TMDB ' + tmdbId);
        return [];
    }
    console.log('[FaselHDX] Resolved: internal=' + resolved.id + ' title=' + (resolved.title || '?'));

    // Fetch full detail with videos
    var data = await apiGet('media/detail/' + resolved.id + '/0');
    if (!data || typeof data !== 'object' || !data.id) {
        console.log('[FaselHDX] Movie detail failed for internal ID ' + resolved.id);
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

    // Resolve TMDB ID → internal ID via proxy
    var resolved = await resolveId(tmdbId, 'tv');
    if (!resolved || !resolved.id) {
        console.log('[FaselHDX] Could not resolve series TMDB ' + tmdbId);
        return [];
    }
    console.log('[FaselHDX] Resolved: internal=' + resolved.id + ' title=' + (resolved.title || '?'));

    // Step 1: Get series info with season list
    var seriesData = await apiGet('series/show/' + resolved.id + '/0');
    if (!seriesData || typeof seriesData === 'string') {
        console.log('[FaselHDX] Series not found for internal ID ' + resolved.id);
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
        };
    });
}
