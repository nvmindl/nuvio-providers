import { fetchMoviesApi, fetchFlixVideo } from './http.js';

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

// ── Build TikTok CDN URL from video data ──

function buildTiktokUrl(videoData) {
    var path = videoData.hlsVideoTiktok;
    if (!path) return null;
    try {
        var config = typeof videoData.streamingConfig === 'string'
            ? JSON.parse(videoData.streamingConfig)
            : videoData.streamingConfig;
        if (!config || !config.adjust || !config.adjust.Tiktok) return null;
        var tk = config.adjust.Tiktok;
        if (tk.disabled) return null;
        var domain = tk.domain;
        if (!domain) return null;
        var url = 'https://' + domain + path;
        if (tk.params && tk.params.v) url += '?v=' + tk.params.v;
        return url;
    } catch(e) { return null; }
}

// ── Build Cloudflare CDN URL from video data ──

function buildCfUrl(videoData) {
    var cfPath = videoData.cf;
    if (!cfPath) return null;
    try {
        var config = typeof videoData.streamingConfig === 'string'
            ? JSON.parse(videoData.streamingConfig)
            : videoData.streamingConfig;
        if (!config || !config.adjust || !config.adjust.Cloudflare) return null;
        var cf = config.adjust.Cloudflare;
        if (cf.disabled) return null;
        // cf field is already a full URL like https://snq.domain.cfd/v4/k5/code/cf-master.123.txt
        var cfDomain = videoData.metric && videoData.metric.cfDomain;
        var url = cfPath;
        if (url.indexOf('http') !== 0 && cfDomain) {
            url = 'https://snq.' + cfDomain + cfPath;
        }
        if (cf.params) {
            var sep = url.indexOf('?') !== -1 ? '&' : '?';
            if (cf.params.t) url += sep + 't=' + cf.params.t;
            if (cf.params.e) url += '&e=' + cf.params.e;
        }
        return url;
    } catch(e) { return null; }
}

// ── Build streams from flixcdn video data ──

function buildStreams(videoData, subtitles) {
    var headers = {
        'Referer': 'https://flixcdn.cyou/',
        'Origin': 'https://flixcdn.cyou',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };

    var streams = [];

    // Try TikTok CDN first (proper domain, valid SSL)
    var tiktokUrl = buildTiktokUrl(videoData);
    if (tiktokUrl) {
        streams.push({
            name: 'Flex',
            title: 'Flex',
            url: tiktokUrl,
            quality: 'auto',
            headers: headers,
            subtitles: subtitles,
        });
    }

    // Direct source (IP-based, may have cert issues on iOS)
    if (videoData.source) {
        streams.push({
            name: 'Flex',
            title: 'Flex HD',
            url: videoData.source,
            quality: 'auto',
            headers: headers,
            subtitles: subtitles,
        });
    }

    // Cloudflare CDN as backup
    var cfUrl = buildCfUrl(videoData);
    if (cfUrl) {
        streams.push({
            name: 'Flex',
            title: 'Flex CF',
            url: cfUrl,
            quality: 'auto',
            headers: headers,
            subtitles: subtitles,
        });
    }

    return streams;
}

// ── Movie extraction ──

async function extractMovie(tmdbId) {
    console.log('[Flex] Movie TMDB: ' + tmdbId);

    var data = await fetchMoviesApi('movie/' + tmdbId);
    if (!data || !data.video_url) {
        console.log('[Flex] Movie not found on MoviesAPI');
        return [];
    }

    console.log('[Flex] Movie: ' + (data.title || 'untitled'));
    var videoCode = extractVideoCode(data.video_url);
    if (!videoCode) {
        console.log('[Flex] No video code in URL');
        return [];
    }

    console.log('[Flex] Video code: ' + videoCode);
    var videoData = await fetchFlixVideo(videoCode);
    if (!videoData) {
        console.log('[Flex] FlixCDN returned no data');
        return [];
    }

    console.log('[Flex] Source: ' + (videoData.source || 'none').substring(0, 80));
    var subtitles = extractSubtitles(data);
    return buildStreams(videoData, subtitles);
}

// ── Series extraction ──

async function extractSeries(tmdbId, season, episode) {
    var seasonNum = parseInt(season, 10);
    var episodeNum = parseInt(episode, 10);
    console.log('[Flex] Series TMDB: ' + tmdbId + ' S' + seasonNum + 'E' + episodeNum);

    var data = await fetchMoviesApi('tv/' + tmdbId + '/' + seasonNum + '/' + episodeNum);
    if (!data || !data.video_url) {
        console.log('[Flex] Episode not found on MoviesAPI');
        return [];
    }

    console.log('[Flex] Episode: ' + (data.title || 'untitled'));
    var videoCode = extractVideoCode(data.video_url);
    if (!videoCode) {
        console.log('[Flex] No video code in URL');
        return [];
    }

    console.log('[Flex] Video code: ' + videoCode);
    var videoData = await fetchFlixVideo(videoCode);
    if (!videoData) {
        console.log('[Flex] FlixCDN returned no data');
        return [];
    }

    console.log('[Flex] Source: ' + (videoData.source || 'none').substring(0, 80));
    var subtitles = extractSubtitles(data);
    return buildStreams(videoData, subtitles);
}

// ── Main export ──

export async function extractStreams(tmdbId, mediaType, season, episode) {
    console.log('[Flex] Starting: ' + mediaType + ' ' + tmdbId);

    var streams = [];
    if (mediaType === 'movie') {
        streams = await extractMovie(tmdbId);
    } else {
        streams = await extractSeries(tmdbId, season, episode);
    }

    if (!streams.length) {
        console.log('[Flex] No streams found');
    } else {
        console.log('[Flex] Got ' + streams.length + ' streams');
    }

    return streams;
}
