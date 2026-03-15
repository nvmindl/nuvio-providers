import { fetchMoviesApi, fetchFlixVideo, fetchM3U8 } from './http.js';

// ── Parse m3u8 master playlist for quality variants ──

function parseQualities(masterText, masterUrl) {
    var streams = [];
    var lines = masterText.split('\n');
    var baseUrl = masterUrl.replace(/\/[^/]*$/, '/');

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf('#EXT-X-STREAM-INF') !== 0) continue;

        // Extract resolution
        var resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
        var width = resMatch ? parseInt(resMatch[1], 10) : 0;
        var height = resMatch ? parseInt(resMatch[2], 10) : 0;

        // Next non-empty line is the variant URL
        var variantUrl = '';
        for (var j = i + 1; j < lines.length; j++) {
            var next = lines[j].trim();
            if (next && next.charAt(0) !== '#') {
                variantUrl = next;
                break;
            }
        }
        if (!variantUrl) continue;

        // Resolve relative URLs
        if (variantUrl.indexOf('http') !== 0) {
            variantUrl = baseUrl + variantUrl;
        }

        var quality = 'auto';
        if (width >= 1920 || height >= 1080) quality = '1080p';
        else if (width >= 1280 || height >= 720) quality = '720p';
        else if (width >= 854 || height >= 480) quality = '480p';
        else if (width > 0 || height > 0) quality = '360p';

        streams.push({ url: variantUrl, quality: quality, height: height });
    }

    // Sort highest quality first
    streams.sort(function(a, b) { return b.height - a.height; });
    return streams;
}

// ── Extract video code from moviesapi.to video_url ──

function extractVideoCode(videoUrl) {
    // video_url: "https://flixcdn.cyou/#uywmde&poster=..."
    var hashIdx = videoUrl.indexOf('#');
    if (hashIdx === -1) return null;
    var fragment = videoUrl.substring(hashIdx + 1);
    var ampIdx = fragment.indexOf('&');
    if (ampIdx !== -1) fragment = fragment.substring(0, ampIdx);
    return fragment || null;
}

// ── Extract subtitles from moviesapi.to response ──

function extractSubtitles(data) {
    var subs = data.subtitles;
    if (!subs || !subs.length) return [];
    var results = [];
    for (var i = 0; i < subs.length; i++) {
        var s = subs[i];
        if (s.url) {
            results.push({
                language: s.language || s.label || 'Unknown',
                url: s.url,
            });
        }
    }
    return results;
}

// ── Build streams from flixcdn video data ──

async function buildStreams(videoData, masterUrl, subtitles) {
    var headers = {
        'Referer': 'https://flixcdn.cyou/',
        'Origin': 'https://flixcdn.cyou',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };

    // Try to fetch and parse the master m3u8 for quality variants
    var masterText = await fetchM3U8(masterUrl);
    var variants = parseQualities(masterText, masterUrl);

    if (variants.length > 0) {
        return variants.map(function(v) {
            return {
                name: 'FaselHDX',
                title: 'FaselHDX ' + v.quality,
                url: v.url,
                quality: v.quality,
                headers: headers,
                subtitles: subtitles,
            };
        });
    }

    // Fallback: return the master URL directly
    return [{
        name: 'FaselHDX',
        title: 'FaselHDX Auto',
        url: masterUrl,
        quality: 'auto',
        headers: headers,
        subtitles: subtitles,
    }];
}

// ── Movie extraction ──

async function extractMovie(tmdbId) {
    console.log('[FaselHDX] Movie TMDB: ' + tmdbId);

    var data = await fetchMoviesApi('movie/' + tmdbId);
    if (!data || !data.video_url) {
        console.log('[FaselHDX] Movie not found on MoviesAPI');
        return [];
    }

    console.log('[FaselHDX] Movie: ' + (data.title || 'untitled'));
    var videoCode = extractVideoCode(data.video_url);
    if (!videoCode) {
        console.log('[FaselHDX] No video code in URL');
        return [];
    }

    console.log('[FaselHDX] Video code: ' + videoCode);
    var videoData = await fetchFlixVideo(videoCode);
    if (!videoData || !videoData.source) {
        console.log('[FaselHDX] FlixCDN returned no source');
        return [];
    }

    console.log('[FaselHDX] Source: ' + videoData.source.substring(0, 80));
    var subtitles = extractSubtitles(data);
    return buildStreams(videoData, videoData.source, subtitles);
}

// ── Series extraction ──

async function extractSeries(tmdbId, season, episode) {
    var seasonNum = parseInt(season, 10);
    var episodeNum = parseInt(episode, 10);
    console.log('[FaselHDX] Series TMDB: ' + tmdbId + ' S' + seasonNum + 'E' + episodeNum);

    var data = await fetchMoviesApi('tv/' + tmdbId + '/' + seasonNum + '/' + episodeNum);
    if (!data || !data.video_url) {
        console.log('[FaselHDX] Episode not found on MoviesAPI');
        return [];
    }

    console.log('[FaselHDX] Episode: ' + (data.title || 'untitled'));
    var videoCode = extractVideoCode(data.video_url);
    if (!videoCode) {
        console.log('[FaselHDX] No video code in URL');
        return [];
    }

    console.log('[FaselHDX] Video code: ' + videoCode);
    var videoData = await fetchFlixVideo(videoCode);
    if (!videoData || !videoData.source) {
        console.log('[FaselHDX] FlixCDN returned no source');
        return [];
    }

    console.log('[FaselHDX] Source: ' + videoData.source.substring(0, 80));
    var subtitles = extractSubtitles(data);
    return buildStreams(videoData, videoData.source, subtitles);
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
    } else {
        console.log('[FaselHDX] Got ' + streams.length + ' streams');
    }

    return streams;
}
