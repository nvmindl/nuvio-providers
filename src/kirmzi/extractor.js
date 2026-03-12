var cheerio = require('cheerio-without-node-native');
import { HEADERS, fetchText, getBaseUrl } from './http.js';

var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB_API_BASE = 'https://api.themoviedb.org/3';
var ALBA_BASE = 'https://w.shadwo.pro/albaplayer';

// ─── TMDB helpers ───────────────────────────────────────────────────────────

async function resolveTmdbMeta(tmdbId, mediaType) {
    // Get Arabic title
    var url = TMDB_API_BASE + '/tv/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=ar-SA';
    var response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) throw new Error('TMDB ' + response.status);
    var data = await response.json();
    var arabicTitle = data.name || '';

    // Also get English details for year
    var enUrl = TMDB_API_BASE + '/tv/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=en-US';
    var enResp = await fetch(enUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    });
    var enData = enResp.ok ? await enResp.json() : {};
    var year = (enData.first_air_date || '').split('-')[0] || '';

    return { arabicTitle: arabicTitle, year: year };
}

// ─── URL construction ───────────────────────────────────────────────────────

function buildEpisodeSlug(arabicTitle, episode) {
    // Pattern: مسلسل-{arabic-title-with-dashes}-الحلقة-{episode}
    var slug = '\u0645\u0633\u0644\u0633\u0644-' + arabicTitle.replace(/\s+/g, '-') + '-\u0627\u0644\u062d\u0644\u0642\u0629-' + episode;
    return slug;
}

function buildEpisodeUrl(arabicTitle, episode) {
    var base = getBaseUrl();
    var slug = buildEpisodeSlug(arabicTitle, episode);
    return base + '/episode/' + encodeURIComponent(slug) + '/';
}

// ─── Episode page parsing ───────────────────────────────────────────────────

function extractAlbaplayerUrl(html) {
    // Look for iframe src containing albaplayer
    var match = html.match(/iframe[^>]*src="([^"]*albaplayer\/[^"]*)"/i);
    if (!match) return '';

    var raw = match[1];
    // The proxy sometimes doubles the URL: https://w.shadwo.pro/albaplayer/https://w.shadwo.pro/albaplayer/slug/
    // Fix by taking only the last albaplayer occurrence
    var parts = raw.split('albaplayer/');
    var slug = parts[parts.length - 1].replace(/\/$/, '');
    if (!slug) return '';
    return ALBA_BASE + '/' + slug + '/';
}

function extractEpisodeList(html) {
    // Extract all episode links from the page
    var episodes = [];
    var re = /href="([^"]*\/episode\/[^"]*)"/g;
    var m;
    var seen = {};
    while ((m = re.exec(html)) !== null) {
        var url = m[1];
        if (seen[url]) continue;
        seen[url] = true;
        // Extract episode number from URL
        var decoded = decodeURIComponent(url);
        var epMatch = decoded.match(/\u0627\u0644\u062d\u0644\u0642\u0629-(\d+)/);
        if (epMatch) {
            episodes.push({ url: url, number: parseInt(epMatch[1], 10) });
        }
    }
    return episodes;
}

// ─── Albaplayer page parsing ────────────────────────────────────────────────

function extractEmbedUrls(html) {
    // Find all server links with serv parameter
    var servers = [];
    var re = /href="([^"]*\?serv=\d+)"/g;
    var m;
    while ((m = re.exec(html)) !== null) {
        servers.push(m[1]);
    }

    // Find the actual embed iframe
    var embedUrls = [];
    var iframeMatch = html.match(/iframe[^>]*src="(https?:\/\/[^"]*embed[^"]*)"/i);
    if (iframeMatch) {
        embedUrls.push(iframeMatch[1]);
    }

    return { servers: servers, embedUrls: embedUrls };
}

// ─── PACK unpacker (p,a,c,k,e,d) ───────────────────────────────────────────
// This unpacks eval(function(p,a,c,k,e,d){...}) packed JavaScript
// Without using eval or new Function (Hermes-safe)

function unpackPACK(packed) {
    // Extract the function arguments: p, a, c, k, e, d
    var match = packed.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:[^'\\]|\\.)*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:[^'\\]|\\.)*)'\.split\('\|'\)/);
    if (!match) return '';

    var p = match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    var a = parseInt(match[2], 10);
    var c = parseInt(match[3], 10);
    var k = match[4].split('|');

    // Base conversion helper
    function baseEncode(val, base) {
        var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (val === 0) return '0';
        var result = '';
        while (val > 0) {
            result = chars[val % base] + result;
            val = Math.floor(val / base);
        }
        return result;
    }

    // Build dictionary: map encoded index to keyword
    var dict = {};
    while (c--) {
        var encoded = baseEncode(c, a);
        dict[encoded] = k[c] || encoded;
    }

    // Replace all word-boundary tokens with dictionary values
    var result = p.replace(/\b(\w+)\b/g, function(m) {
        return dict[m] !== undefined ? dict[m] : m;
    });

    return result;
}

// ─── Stream extraction from embed page ──────────────────────────────────────

function extractM3u8FromUnpacked(unpacked) {
    // Look for m3u8 URL in the unpacked JWPlayer setup
    var m3u8Match = unpacked.match(/(?:file|src)\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
    if (m3u8Match) return m3u8Match[1];

    // Fallback: any m3u8 URL
    var fallback = unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/);
    return fallback ? fallback[0] : '';
}

function extractQualityLabels(unpacked) {
    // Look for qualityLabels in JWPlayer config
    // Can be either qualityLabels:{...} or 'qualityLabels':{...}
    var match = unpacked.match(/['"]?qualityLabels['"]?\s*:\s*\{([^}]+)\}/);
    if (!match) return {};
    var labels = {};
    var re = /"(\d+)"\s*:\s*"([^"]+)"/g;
    var m;
    while ((m = re.exec(match[1])) !== null) {
        labels[m[1]] = m[2];
    }
    return labels;
}

// ─── Try multiple embed servers ─────────────────────────────────────────────

async function tryExtractFromAlba(albaUrl) {
    // Fetch the albaplayer page (no Cloudflare, plain HTTP works)
    var html = await fetchText(albaUrl);
    if (!html) return null;

    // Extract primary embed iframe
    var data = extractEmbedUrls(html);
    if (data.embedUrls.length === 0) return null;

    // Try the primary embed (usually CDNPlus / serv=1)
    for (var i = 0; i < data.embedUrls.length; i++) {
        var result = await tryExtractFromEmbed(data.embedUrls[i]);
        if (result) return result;
    }

    // Try other servers if primary failed
    // Only try servers that use .cyou domains (cdnplus, mp4plus, anafast, vidoba, vidspeed)
    for (var j = 0; j < data.servers.length; j++) {
        var servUrl = data.servers[j];
        if (!/serv=[2-5]/.test(servUrl)) continue;

        var servHtml = await fetchText(servUrl);
        if (!servHtml) continue;

        var servEmbed = extractEmbedUrls(servHtml);
        for (var k = 0; k < servEmbed.embedUrls.length; k++) {
            var servResult = await tryExtractFromEmbed(servEmbed.embedUrls[k]);
            if (servResult) return servResult;
        }
    }

    return null;
}

function extractPackedBlock(html) {
    var start = html.indexOf('eval(function(p,a,c,k,e,d)');
    if (start < 0) return '';
    // Balance parentheses to find the end
    var depth = 0;
    for (var i = start; i < html.length; i++) {
        if (html[i] === '(') depth++;
        else if (html[i] === ')') {
            depth--;
            if (depth === 0) return html.substring(start, i + 1);
        }
    }
    return '';
}

async function tryExtractFromEmbed(embedUrl) {
    var html = await fetchText(embedUrl);
    if (!html) return null;

    // Find packed JS using paren balancing
    var packed = extractPackedBlock(html);
    if (!packed) return null;

    var unpacked = unpackPACK(packed);
    if (!unpacked) return null;

    var m3u8 = extractM3u8FromUnpacked(unpacked);
    if (!m3u8) return null;

    var labels = extractQualityLabels(unpacked);

    return { m3u8: m3u8, labels: labels, embedUrl: embedUrl };
}

// ─── Build streams ──────────────────────────────────────────────────────────

function resolutionToLabel(res) {
    if (!res) return 'auto';
    var h = parseInt(res.split('x')[1], 10) || 0;
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 480) return '480p';
    if (h >= 360) return '360p';
    return h ? h + 'p' : 'auto';
}

function parseMasterPlaylist(m3u8Text) {
    var variants = [];
    var lines = m3u8Text.split('\n');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf('#EXT-X-STREAM-INF') !== 0) continue;
        var resMatch = line.match(/RESOLUTION=([0-9]+x[0-9]+)/);
        var bwMatch = line.match(/BANDWIDTH=(\d+)/);
        var url = '';
        for (var j = i + 1; j < lines.length; j++) {
            var next = lines[j].trim();
            if (next && next[0] !== '#') { url = next; break; }
        }
        if (url) {
            variants.push({
                url: url,
                resolution: resMatch ? resMatch[1] : '',
                bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : 0,
            });
        }
    }
    // Sort by bandwidth descending (highest quality first)
    variants.sort(function(a, b) { return b.bandwidth - a.bandwidth; });
    return variants;
}

function buildStreamHeaders(embedUrl) {
    var referer = '';
    try {
        var embedDomain = embedUrl.match(/^(https?:\/\/[^/]+)/);
        referer = embedDomain ? embedDomain[1] + '/' : '';
    } catch(e) {}
    return {
        'Referer': referer,
        'Origin': referer.replace(/\/$/, ''),
        'User-Agent': HEADERS['User-Agent'],
    };
}

async function buildStreams(result) {
    if (!result || !result.m3u8) return [];

    var headers = buildStreamHeaders(result.embedUrl);

    // Fetch the master playlist to extract individual quality variants
    var masterText = await fetchText(result.m3u8, { headers: headers });
    if (!masterText || masterText.indexOf('#EXTM3U') !== 0) {
        // Fallback: return master URL as single auto stream
        return [{
            name: 'Kirmzi - Auto',
            title: 'Auto',
            url: result.m3u8,
            quality: 'auto',
            headers: headers,
        }];
    }

    var variants = parseMasterPlaylist(masterText);
    if (variants.length === 0) {
        return [{
            name: 'Kirmzi - Auto',
            title: 'Auto',
            url: result.m3u8,
            quality: 'auto',
            headers: headers,
        }];
    }

    var streams = [];
    for (var i = 0; i < variants.length; i++) {
        var v = variants[i];
        var quality = resolutionToLabel(v.resolution);
        streams.push({
            name: 'Kirmzi - ' + quality,
            title: quality,
            url: v.url,
            quality: quality,
            headers: headers,
        });
    }
    return streams;
}

// ─── Main entry point ───────────────────────────────────────────────────────

export async function extractStreams(tmdbId, mediaType, season, episode) {
    // Only TV/series supported (this site is Turkish drama only)
    if (mediaType !== 'tv') {
        console.log('[Kirmzi] Only TV series supported');
        return [];
    }

    if (!season) season = '1';
    if (!episode) return [];

    console.log('[Kirmzi] Resolving TMDB meta for ID ' + tmdbId);
    var meta = await resolveTmdbMeta(tmdbId, mediaType);
    if (!meta.arabicTitle) {
        console.log('[Kirmzi] No Arabic title found');
        return [];
    }
    console.log('[Kirmzi] Arabic title: ' + meta.arabicTitle);

    // Construct the episode URL
    var episodeUrl = buildEpisodeUrl(meta.arabicTitle, episode);
    console.log('[Kirmzi] Episode URL: ' + episodeUrl);

    // Fetch the episode page
    var episodeHtml = await fetchText(episodeUrl);
    if (!episodeHtml || episodeHtml.length < 1000) {
        console.log('[Kirmzi] Episode page not found or empty');
        return [];
    }

    // Extract albaplayer iframe URL
    var albaUrl = extractAlbaplayerUrl(episodeHtml);
    if (!albaUrl) {
        console.log('[Kirmzi] No albaplayer iframe found');
        return [];
    }
    console.log('[Kirmzi] Albaplayer URL: ' + albaUrl);

    // Fetch albaplayer and extract embed streams
    var result = await tryExtractFromAlba(albaUrl);
    if (!result) {
        console.log('[Kirmzi] No streams found from embed servers');
        return [];
    }
    console.log('[Kirmzi] Found m3u8: ' + result.m3u8.substring(0, 80) + '...');

    return await buildStreams(result);
}
