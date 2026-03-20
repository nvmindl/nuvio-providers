import { HEADERS, fetchText, getBaseUrl } from './http.js';

var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB_API_BASE = 'https://api.themoviedb.org/3';
var ALBA_BASE = 'https://w.shadwo.pro/albaplayer';
var T123_BASE = 'https://turkish123.ac';

// ─── TMDB helpers ───────────────────────────────────────────────────────────

async function resolveTmdbMeta(tmdbId) {
    var arUrl = TMDB_API_BASE + '/tv/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=ar-SA';
    var enUrl = TMDB_API_BASE + '/tv/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=en-US';
    var fetchOpts = { method: 'GET', headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } };
    var results = await Promise.all([
        fetch(arUrl, fetchOpts).then(function(r) { return r.ok ? r.json() : {}; }),
        fetch(enUrl, fetchOpts).then(function(r) { return r.ok ? r.json() : {}; }),
    ]);
    var arData = results[0];
    var enData = results[1];
    var year = '';
    if (enData.first_air_date) year = enData.first_air_date.split('-')[0];
    return {
        arabicTitle: arData.name || '',
        englishTitle: enData.name || '',
        originalTitle: enData.original_name || '',
        year: year,
    };
}

// ─── Turkish romanization & albaplayer slug builder ────────────────────────

var TURKISH_MAP = {
    '\u015f': 's', '\u015e': 's',  // ş Ş
    '\u00fc': 'u', '\u00dc': 'u',  // ü Ü
    '\u00f6': 'o', '\u00d6': 'o',  // ö Ö
    '\u00e7': 'c', '\u00c7': 'c',  // ç Ç
    '\u0131': 'i', '\u0130': 'i',  // ı İ
    '\u011f': 'g', '\u011e': 'g',  // ğ Ğ
};
var TURKISH_RE = /[\u015f\u015e\u00fc\u00dc\u00f6\u00d6\u00e7\u00c7\u0131\u0130\u011f\u011e]/g;

function romanizeToSlug(name) {
    var romanized = name.replace(TURKISH_RE, function(c) { return TURKISH_MAP[c] || c; });
    return romanized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildAlbaSlugs(meta, season, episode) {
    var ep = 's' + String(season).padStart(2, '0') + 'e' + String(episode).padStart(2, '0');
    var seen = {};
    var slugs = [];
    function add(base) {
        if (!base || seen[base]) return;
        seen[base] = true;
        if (meta.year) slugs.push(base + '-' + meta.year + '-' + ep);
        slugs.push(base + '-' + ep);
    }
    // Try original name (before colon subtitle) first, then full, then english
    if (meta.originalTitle) {
        add(romanizeToSlug(meta.originalTitle.split(':')[0].trim()));
        add(romanizeToSlug(meta.originalTitle));
        // Also try without "ve" → "and" swap and vice versa
        add(romanizeToSlug(meta.originalTitle.replace(/\bve\b/gi, 'and')));
        add(romanizeToSlug(meta.originalTitle.replace(/\band\b/gi, 've')));
    }
    if (meta.englishTitle) {
        add(romanizeToSlug(meta.englishTitle.split(':')[0].trim()));
        add(romanizeToSlug(meta.englishTitle));
        // Try without "the" prefix
        var noThe = meta.englishTitle.replace(/^the\s+/i, '');
        if (noThe !== meta.englishTitle) add(romanizeToSlug(noThe));
    }
    return slugs;
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

// ─── Try multiple embed servers ─────────────────────────────────────────────

async function tryExtractFromAlba(albaUrl) {
    var html = await fetchText(albaUrl);
    if (!html) return null;

    var data = extractEmbedUrls(html);
    if (data.embedUrls.length === 0) return null;

    // Try the primary embed first (usually CDNPlus / serv=1)
    for (var i = 0; i < data.embedUrls.length; i++) {
        var result = await tryExtractFromEmbed(data.embedUrls[i]);
        if (result) return result;
    }

    // Collect fallback server URLs in parallel instead of sequentially
    var servUrls = data.servers.filter(function(s) { return /serv=[2-5]/.test(s); });
    if (servUrls.length === 0) return null;

    // Fetch all server pages in parallel
    var servPages = await Promise.all(servUrls.map(function(s) { return fetchText(s); }));

    // Collect all embed URLs from server pages
    var fallbackEmbeds = [];
    for (var j = 0; j < servPages.length; j++) {
        if (!servPages[j]) continue;
        var servEmbed = extractEmbedUrls(servPages[j]);
        for (var k = 0; k < servEmbed.embedUrls.length; k++) {
            fallbackEmbeds.push(servEmbed.embedUrls[k]);
        }
    }
    if (fallbackEmbeds.length === 0) return null;

    // Race all fallback embeds — first one with a valid m3u8 wins
    var embedResults = await Promise.all(fallbackEmbeds.map(function(u) {
        return tryExtractFromEmbed(u).catch(function() { return null; });
    }));
    for (var m = 0; m < embedResults.length; m++) {
        if (embedResults[m]) return embedResults[m];
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

    return { m3u8: m3u8, embedUrl: embedUrl };
}

// ─── Build streams ──────────────────────────────────────────────────────────

// CDN suffix → quality mapping (derived from observed master playlists)
var SUFFIX_QUALITY = { x: '1080p', h: '720p', n: '480p', l: '360p' };
var QUALITY_ORDER = { '1080p': 0, '720p': 1, '480p': 2, '360p': 3 };

// Parse the master m3u8 URL to derive individual variant URLs without fetching.
// Master URL pattern: .../fileId_,l,n,h,x,.urlset/master.m3u8?token
// Variant pattern:    .../fileId_{suffix}/index-v1-a1.m3u8?token
function deriveVariantUrls(masterUrl) {
    var m = masterUrl.match(/^(.+_),([a-zA-Z]+(?:,[a-zA-Z]+)*),\.urlset\/master\.m3u8(\?.+)?$/);
    if (!m) return [];
    var base = m[1];          // e.g. https://host/path/fileId_
    var suffixes = m[2].split(','); // e.g. ['l','n','h','x']
    var query = m[3] || '';   // e.g. ?t=...&s=...

    var variants = [];
    for (var i = 0; i < suffixes.length; i++) {
        var s = suffixes[i];
        var quality = SUFFIX_QUALITY[s] || null;
        if (!quality) continue;
        variants.push({
            url: base + s + '/index-v1-a1.m3u8' + query,
            quality: quality,
        });
    }
    // Sort highest quality first
    variants.sort(function(a, b) {
        var oa = QUALITY_ORDER[a.quality] !== undefined ? QUALITY_ORDER[a.quality] : 99;
        var ob = QUALITY_ORDER[b.quality] !== undefined ? QUALITY_ORDER[b.quality] : 99;
        return oa - ob;
    });
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

function buildStreams(result) {
    if (!result || !result.m3u8) return [];

    var headers = buildStreamHeaders(result.embedUrl);

    // Derive variant URLs directly from the master URL pattern (no extra fetch)
    var variants = deriveVariantUrls(result.m3u8);
    if (variants.length > 0) {
        var streams = [];
        for (var i = 0; i < variants.length; i++) {
            var v = variants[i];
            streams.push({
                name: 'Kirmzi - ' + v.quality,
                title: v.quality,
                url: v.url,
                quality: v.quality,
                headers: headers,
            });
        }
        return streams;
    }

    // Fallback: return the master URL if pattern doesn't match
    return [{
        name: 'Kirmzi - Auto',
        title: 'Auto',
        url: result.m3u8,
        quality: 'auto',
        headers: headers,
    }];
}

function buildT123Streams(result) {
    if (!result || !result.m3u8) return [];
    var headers = buildStreamHeaders(result.embedUrl);
    // turkish123 embeds give a single m3u8, not a master playlist
    // Try deriving variants first (some CDNs use the same pattern)
    var variants = deriveVariantUrls(result.m3u8);
    if (variants.length > 0) {
        var streams = [];
        for (var i = 0; i < variants.length; i++) {
            streams.push({
                name: 'Kirmzi - ' + variants[i].quality,
                title: variants[i].quality,
                url: variants[i].url,
                quality: variants[i].quality,
                headers: headers,
            });
        }
        return streams;
    }
    return [{
        name: 'Kirmzi - Auto',
        title: 'Auto',
        url: result.m3u8,
        quality: 'auto',
        headers: headers,
    }];
}

// ─── Search-based episode discovery ─────────────────────────────────────────

function extractSeriesUrls(html) {
    var urls = [];
    var re = /href="(https?:\/\/[^"]*\/series\/[^"]*)"/gi;
    var m;
    var seen = {};
    while ((m = re.exec(html)) !== null) {
        if (!seen[m[1]]) { seen[m[1]] = true; urls.push(m[1]); }
    }
    return urls;
}

function extractEpisodeUrls(html) {
    var urls = [];
    var re = /href="(https?:\/\/[^"]*\/episode\/[^"]*)"/gi;
    var m;
    var seen = {};
    while ((m = re.exec(html)) !== null) {
        if (!seen[m[1]]) { seen[m[1]] = true; urls.push(m[1]); }
    }
    return urls;
}

function findEpisodeUrl(episodeUrls, episode) {
    var epNum = parseInt(episode, 10);
    // Try matching الحلقة-{N} in the URL
    for (var i = 0; i < episodeUrls.length; i++) {
        var decoded = decodeURIComponent(episodeUrls[i]);
        var epMatch = decoded.match(/\u0627\u0644\u062d\u0644\u0642\u0629-(\d+)/);
        if (epMatch && parseInt(epMatch[1], 10) === epNum) return episodeUrls[i];
    }
    return '';
}

async function searchForEpisode(meta, episode) {
    // Build unique search terms from available titles
    var terms = [];
    if (meta.arabicTitle) terms.push(meta.arabicTitle);
    if (meta.englishTitle && terms.indexOf(meta.englishTitle) < 0) terms.push(meta.englishTitle);
    if (meta.originalTitle && terms.indexOf(meta.originalTitle) < 0) terms.push(meta.originalTitle);

    for (var t = 0; t < terms.length; t++) {
        var result = await searchSiteForEpisode(terms[t], episode);
        if (result) return result;
    }
    return '';
}

async function searchSiteForEpisode(query, episode) {
    var base = getBaseUrl();
    var searchUrl = base + '/?s=' + encodeURIComponent(query);
    console.log('[Kirmzi] Searching: ' + decodeURIComponent(searchUrl).substring(0, 80));

    var searchHtml = await fetchText(searchUrl);
    if (!searchHtml) return '';

    // Check if search results contain direct episode links
    var episodeUrls = extractEpisodeUrls(searchHtml);
    var directMatch = findEpisodeUrl(episodeUrls, episode);
    if (directMatch) {
        console.log('[Kirmzi] Found episode directly in search results');
        return directMatch;
    }

    // Otherwise, find series pages and look for episodes there
    var seriesUrls = extractSeriesUrls(searchHtml);
    for (var i = 0; i < seriesUrls.length; i++) {
        console.log('[Kirmzi] Checking series: ' + decodeURIComponent(seriesUrls[i]).substring(0, 80));
        var seriesHtml = await fetchText(seriesUrls[i]);
        if (!seriesHtml) continue;

        var epUrls = extractEpisodeUrls(seriesHtml);
        var match = findEpisodeUrl(epUrls, episode);
        if (match) {
            console.log('[Kirmzi] Found episode from series page');
            return match;
        }
    }

    return '';
}

// ─── Fast albaplayer slug race ──────────────────────────────────────────────

async function raceAlbaSlugs(slugs) {
    // Fire all slug fetches in parallel — first one with a valid m3u8 wins
    if (slugs.length === 0) return null;
    console.log('[Kirmzi] Racing ' + slugs.length + ' alba slugs...');

    var results = await Promise.all(slugs.map(function(s) {
        var url = ALBA_BASE + '/' + s + '/';
        return tryExtractFromAlba(url).then(function(r) {
            if (r) r.slug = s;
            return r;
        }).catch(function() { return null; });
    }));

    for (var i = 0; i < results.length; i++) {
        if (results[i]) {
            console.log('[Kirmzi] Won with slug: ' + results[i].slug);
            return results[i];
        }
    }
    return null;
}

// ─── turkish123 backup ──────────────────────────────────────────────────────

function buildT123Slugs(meta) {
    var seen = {};
    var slugs = [];
    function add(base) {
        if (!base || seen[base]) return;
        seen[base] = true;
        slugs.push(base);
    }
    if (meta.originalTitle) {
        add(romanizeToSlug(meta.originalTitle));
        add(romanizeToSlug(meta.originalTitle.split(':')[0].trim()));
    }
    if (meta.englishTitle) {
        add(meta.englishTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
        var noThe = meta.englishTitle.replace(/^the\s+/i, '');
        if (noThe !== meta.englishTitle) add(noThe.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
    return slugs;
}

async function computeAbsoluteEpisode(tmdbId, season, episode) {
    var s = parseInt(season, 10);
    var e = parseInt(episode, 10);
    if (s <= 1) return e;
    // Fetch season details from TMDB to sum prior episodes
    var total = 0;
    for (var i = 1; i < s; i++) {
        var url = TMDB_API_BASE + '/tv/' + tmdbId + '/season/' + i + '?api_key=' + TMDB_API_KEY;
        try {
            var r = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
            if (r.ok) {
                var data = await r.json();
                total += (data.episodes ? data.episodes.length : 0);
            }
        } catch(err) { /* skip */ }
    }
    return total + e;
}

async function findT123Slug(meta) {
    var slugs = buildT123Slugs(meta);
    // Try direct slug access in parallel
    var checks = await Promise.all(slugs.map(function(s) {
        var url = T123_BASE + '/' + s + '/';
        return fetchText(url, { timeout: 8000 }).then(function(html) {
            if (html && html.indexOf('episodi') > -1) return s;
            return null;
        }).catch(function() { return null; });
    }));
    for (var i = 0; i < checks.length; i++) {
        if (checks[i]) return checks[i];
    }
    // Fallback: search
    var terms = [];
    if (meta.originalTitle && terms.indexOf(meta.originalTitle) < 0) terms.push(meta.originalTitle);
    if (meta.englishTitle && terms.indexOf(meta.englishTitle) < 0) terms.push(meta.englishTitle);
    for (var t = 0; t < terms.length; t++) {
        var searchUrl = T123_BASE + '/?s=' + encodeURIComponent(terms[t]);
        var searchHtml = await fetchText(searchUrl, { timeout: 8000 });
        if (!searchHtml) continue;
        var re = /href="https:\/\/turkish123\.ac\/([a-z0-9-]+)\/"/g;
        var m;
        while ((m = re.exec(searchHtml)) !== null) {
            var slug = m[1];
            if (!/genre|year|series-list|episodes-list|calendar|contact|home|page|wp-|tag|category|sitemap|about|ryh6/.test(slug)) {
                return slug;
            }
        }
    }
    return null;
}

function extractT123Embeds(html) {
    var embeds = [];
    var re = /iframe[^>]*src="(https?:\/\/(?:tukipasti|kitraskimisi|engifuosi|rufiiguta|lajkema)[^"]+)"/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
        embeds.push(m[1]);
    }
    return embeds;
}

async function extractM3u8FromT123Embed(embedUrl) {
    var html = await fetchText(embedUrl, { timeout: 8000 });
    if (!html) return null;
    var m3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    if (m3u8) return m3u8[0];
    // Try PACK method if direct m3u8 not found
    var packed = extractPackedBlock(html);
    if (packed) {
        var unpacked = unpackPACK(packed);
        if (unpacked) {
            var m3u8b = extractM3u8FromUnpacked(unpacked);
            if (m3u8b) return m3u8b;
        }
    }
    return null;
}

async function extractFromT123(meta, tmdbId, season, episode) {
    console.log('[Kirmzi] Trying turkish123 backup...');
    var slug = await findT123Slug(meta);
    if (!slug) {
        console.log('[Kirmzi] turkish123: show not found');
        return null;
    }
    console.log('[Kirmzi] turkish123: found slug "' + slug + '"');

    var absEp = await computeAbsoluteEpisode(tmdbId, season, episode);
    var epUrl = T123_BASE + '/' + slug + '-episode-' + absEp + '/';
    console.log('[Kirmzi] turkish123: fetching episode ' + absEp);
    var epHtml = await fetchText(epUrl, { timeout: 8000 });
    if (!epHtml || epHtml.indexOf('iframe') < 0) {
        console.log('[Kirmzi] turkish123: episode page empty or no embeds');
        return null;
    }

    var embeds = extractT123Embeds(epHtml);
    if (embeds.length === 0) {
        console.log('[Kirmzi] turkish123: no embed iframes found');
        return null;
    }
    console.log('[Kirmzi] turkish123: found ' + embeds.length + ' embeds');

    // Try all embeds in parallel — first m3u8 wins
    var results = await Promise.all(embeds.map(function(u) {
        return extractM3u8FromT123Embed(u).catch(function() { return null; });
    }));
    for (var i = 0; i < results.length; i++) {
        if (results[i]) {
            console.log('[Kirmzi] turkish123: got m3u8 from ' + embeds[i].match(/\/\/([^\/]+)/)[1]);
            return { m3u8: results[i], embedUrl: embeds[i] };
        }
    }
    console.log('[Kirmzi] turkish123: no m3u8 extracted from embeds');
    return null;
}

// ─── Main entry point ───────────────────────────────────────────────────────

export async function extractStreams(tmdbId, mediaType, season, episode) {
    if (mediaType !== 'tv') {
        console.log('[Kirmzi] Only TV series supported');
        return [];
    }

    if (!season) season = '1';
    if (!episode) return [];

    console.log('[Kirmzi] Resolving TMDB meta for ID ' + tmdbId);
    var meta = await resolveTmdbMeta(tmdbId);
    if (!meta.arabicTitle && !meta.englishTitle && !meta.originalTitle) {
        console.log('[Kirmzi] No title found from TMDB');
        return [];
    }
    console.log('[Kirmzi] Titles: AR=' + meta.arabicTitle + ' EN=' + meta.englishTitle + ' ORIG=' + meta.originalTitle);

    // ── FAST PATH: direct albaplayer slugs (primary) ──
    var candidateSlugs = buildAlbaSlugs(meta, season, episode);
    var result = await raceAlbaSlugs(candidateSlugs);
    if (result) return buildStreams(result);

    // ── BACKUP: turkish123 ──
    var t123Result = await extractFromT123(meta, tmdbId, season, episode);
    if (t123Result) {
        var t123Streams = buildT123Streams(t123Result);
        if (t123Streams.length > 0) return t123Streams;
    }

    // ── LAST RESORT: try kirmzi.space (5s timeout) ──
    console.log('[Kirmzi] Backup failed, trying kirmzi site...');
    var albaUrl = '';
    if (meta.arabicTitle) {
        var episodeUrl = buildEpisodeUrl(meta.arabicTitle, episode);
        var episodeHtml = await fetchText(episodeUrl, { timeout: 5000 });
        albaUrl = episodeHtml ? extractAlbaplayerUrl(episodeHtml) : '';

        if (!albaUrl) {
            var searchedUrl = await searchForEpisode(meta, episode);
            if (searchedUrl) {
                episodeHtml = await fetchText(searchedUrl, { timeout: 5000 });
                albaUrl = episodeHtml ? extractAlbaplayerUrl(episodeHtml) : '';
            }
        }
    }

    if (!albaUrl) {
        console.log('[Kirmzi] No streams found');
        return [];
    }

    result = await tryExtractFromAlba(albaUrl);
    if (!result) return [];
    console.log('[Kirmzi] Found m3u8: ' + result.m3u8.substring(0, 80) + '...');
    return buildStreams(result);
}
