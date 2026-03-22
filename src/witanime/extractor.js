import { HEADERS, getBaseUrl, fetchText } from './http.js';

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB_BASE = 'https://api.themoviedb.org/3';

// ── TMDB ────────────────────────────────────────────────────────────────────

async function getTmdbMeta(tmdbId, mediaType) {
    var type = mediaType === 'movie' ? 'movie' : 'tv';
    var url = TMDB_BASE + '/' + type + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=en-US';
    try {
        var r = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        });
        if (!r.ok) return null;
        var d = await r.json();
        return {
            title: d.title || d.name || '',
            originalTitle: d.original_title || d.original_name || '',
            year: (d.release_date || d.first_air_date || '').split('-')[0],
            seasons: d.seasons || [],
        };
    } catch (e) {
        console.log('[WitAnime] TMDB err: ' + e.message);
        return null;
    }
}

function calcAbsoluteEp(seasons, seasonNum, episode) {
    if (!seasons || !seasons.length || seasonNum <= 1) return episode;
    var total = 0;
    for (var i = 0; i < seasons.length; i++) {
        if (seasons[i].season_number > 0 && seasons[i].season_number < seasonNum) {
            total += seasons[i].episode_count || 0;
        }
    }
    return total + episode;
}

// ── Search ──────────────────────────────────────────────────────────────────

function slugify(t) {
    return t.toLowerCase()
        .replace(/['']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

async function searchAnime(base, title) {
    var url = base + '/?search_param=animes&s=' + encodeURIComponent(title);
    console.log('[WitAnime] Search: ' + title);
    var html = await fetchText(url);
    if (!html) return [];

    var results = [];
    // Match /anime/{slug}/ links (excludes /anime-type/, /anime-status/, etc.)
    var re = /href="(https?:\/\/[^"]+\/anime\/([a-z0-9][a-z0-9-]*[a-z0-9])\/)"/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
        var slug = m[2];
        var dup = false;
        for (var i = 0; i < results.length; i++) {
            if (results[i].slug === slug) { dup = true; break; }
        }
        if (!dup) results.push({ url: m[1], slug: slug });
    }
    console.log('[WitAnime] Results: ' + results.length);
    return results;
}

function pickBest(results, title) {
    var ts = slugify(title);
    var words = ts.split('-').filter(function(w) { return w.length > 2; });
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < results.length; i++) {
        var s = results[i].slug;
        var score = 0;
        for (var j = 0; j < words.length; j++) {
            if (s.indexOf(words[j]) > -1) score++;
        }
        if (s === ts) score += 5;
        if (score > bestScore) { bestScore = score; best = results[i]; }
    }
    return best;
}

// ── Embed extraction ────────────────────────────────────────────────────────

function extractEmbeds(html) {
    var urls = [];
    var seen = {};
    function add(u) {
        if (u && u.indexOf('http') === 0 && !seen[u] && u.indexOf('witanime') < 0) {
            urls.push(u);
            seen[u] = true;
        }
    }

    var m;
    // data-url, data-embed-url, data-ep-url, data-src, data-link attributes
    var attrPatterns = [
        /data-url="([^"]+)"/gi,
        /data-embed-url="([^"]+)"/gi,
        /data-ep-url="([^"]+)"/gi,
        /data-src="([^"]+)"/gi,
        /data-link="([^"]+)"/gi,
    ];
    for (var p = 0; p < attrPatterns.length; p++) {
        while ((m = attrPatterns[p].exec(html)) !== null) add(m[1]);
    }

    // iframes with external src
    var ire = /<iframe[^>]+src="([^"]+)"/gi;
    while ((m = ire.exec(html)) !== null) add(m[1]);

    // data-ep="..." (may be base64)
    var epRe = /data-ep="([^"]+)"/gi;
    while ((m = epRe.exec(html)) !== null) {
        var val = m[1];
        if (val.indexOf('http') === 0) { add(val); continue; }
        try {
            var dec = atob(val);
            if (dec.indexOf('http') === 0) add(dec);
        } catch (e) {}
    }

    return urls;
}

// ── PACK unpacker (for streamwish / filemoon embeds) ────────────────────────

function unpackPACK(html) {
    var evalIdx = html.indexOf('eval(function(p,a,c,k,e,d)');
    if (evalIdx < 0) return '';
    var splitIdx = html.indexOf(".split('|')", evalIdx);
    if (splitIdx < 0) return '';
    var dqs = html.lastIndexOf(",'", splitIdx);
    if (dqs < 0) return '';
    var dict = html.substring(dqs + 2, splitIdx);
    if (dict[0] === "'") dict = dict.substring(1);
    if (dict[dict.length - 1] === "'") dict = dict.substring(0, dict.length - 1);
    var words = dict.split('|');
    var bs = html.indexOf("}('", evalIdx);
    if (bs < 0) return '';
    bs += 3;
    var bd = html.substring(bs, dqs);
    var mt = bd.match(/^([\s\S]*)',\s*(\d+)\s*,\s*(\d+)\s*$/);
    if (!mt) return '';
    var payload = mt[1];
    var base = parseInt(mt[2], 10);
    var count = parseInt(mt[3], 10);
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    function enc(v) {
        if (v === 0) return '0';
        var r = '';
        while (v > 0) { r = chars[v % base] + r; v = Math.floor(v / base); }
        return r;
    }
    var d = {};
    while (count--) { var e = enc(count); d[e] = words[count] || e; }
    return payload.replace(/\b(\w+)\b/g, function(w) {
        return d[w] !== undefined ? d[w] : w;
    });
}

// ── Resolve embed page to stream URL ────────────────────────────────────────

async function resolveEmbed(embedUrl, referer) {
    var html = await fetchText(embedUrl, {
        headers: { 'Referer': referer },
        timeout: 10000,
    });
    if (!html) return null;

    // 1. Direct m3u8 in file/source/src attribute
    var m = html.match(/(?:file|source|src)\s*[:=]\s*["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/i);
    if (m) return m[1];

    // 2. sources array: [{file:"...m3u8",...}]
    var sa = html.match(/sources\s*[:=]\s*\[([^\]]+)\]/);
    if (sa) {
        var sm = sa[1].match(/"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
        if (sm) return sm[1];
    }

    // 3. Packed JS (streamwish, filemoon, etc.)
    if (html.indexOf('eval(function(p,a,c,k,e,d)') > -1) {
        var dec = unpackPACK(html);
        if (dec) {
            var pm = dec.match(/(?:file|source)\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
            if (pm) return pm[1];
        }
    }

    // 4. Any m3u8 URL in page
    var am = html.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/);
    if (am) return am[0];

    // 5. mp4 fallback
    var mp = html.match(/(?:file|source|src)\s*[:=]\s*["'](https?:\/\/[^"']*\.mp4[^"']*)["']/i);
    if (mp) return mp[1];

    return null;
}

function getServerName(url) {
    try {
        var h = url.match(/https?:\/\/([^\/]+)/)[1];
        if (h.indexOf('yonaplay') > -1) return 'YonaPlay';
        if (h.indexOf('streamwish') > -1) return 'StreamWish';
        if (h.indexOf('filemoon') > -1) return 'FileMoon';
        if (h.indexOf('videa') > -1) return 'Videa';
        if (h.indexOf('dailymotion') > -1) return 'Dailymotion';
        if (h.indexOf('yourupload') > -1) return 'YourUpload';
        if (h.indexOf('mp4upload') > -1) return 'MP4Upload';
        return h.split('.')[0];
    } catch (e) { return 'Server'; }
}

// ── Main extraction ─────────────────────────────────────────────────────────

// URL-encoded "الحلقة" (Arabic for "episode")
var EP_SLUG = '%d8%a7%d9%84%d8%ad%d9%84%d9%82%d8%a9';

export async function extractStreams(tmdbId, mediaType, season, episode) {
    var base = await getBaseUrl();

    var meta = await getTmdbMeta(tmdbId, mediaType);
    if (!meta || !meta.title) {
        console.log('[WitAnime] No TMDB meta for ' + tmdbId);
        return [];
    }
    console.log('[WitAnime] ' + meta.title + ' (' + meta.year + ')');

    // Search WitAnime
    var results = await searchAnime(base, meta.title);
    if (results.length === 0 && meta.originalTitle && meta.originalTitle !== meta.title) {
        results = await searchAnime(base, meta.originalTitle);
    }
    if (results.length === 0) {
        console.log('[WitAnime] Not found');
        return [];
    }

    // Pick best matching anime
    var match = pickBest(results, meta.title);
    if (!match && meta.originalTitle) match = pickBest(results, meta.originalTitle);
    if (!match) match = results[0];
    console.log('[WitAnime] Match: ' + match.slug);

    // Calculate episode number
    var ep = parseInt(episode, 10) || 1;
    var sn = parseInt(season, 10) || 1;
    if (mediaType !== 'movie' && sn > 1) {
        ep = calcAbsoluteEp(meta.seasons, sn, ep);
        console.log('[WitAnime] Absolute ep: ' + ep);
    }

    // Build episode URL: /episode/{slug}-الحلقة-{num}/
    var epUrl = base + '/episode/' + match.slug + '-' + EP_SLUG + '-' + ep + '/';
    console.log('[WitAnime] Episode: ' + epUrl);
    var epHtml = await fetchText(epUrl);

    // Fallback: try raw episode number if absolute calculation didn't work
    if ((!epHtml || epHtml.length < 500) && sn > 1 && ep !== parseInt(episode, 10)) {
        var rawEp = parseInt(episode, 10);
        epUrl = base + '/episode/' + match.slug + '-' + EP_SLUG + '-' + rawEp + '/';
        console.log('[WitAnime] Retry raw ep: ' + epUrl);
        epHtml = await fetchText(epUrl);
    }

    // Fallback for movies: try anime page directly
    if ((!epHtml || epHtml.length < 500) && mediaType === 'movie') {
        console.log('[WitAnime] Try anime page: ' + match.url);
        epHtml = await fetchText(match.url);
    }

    if (!epHtml || epHtml.length < 500) {
        console.log('[WitAnime] Episode not found');
        return [];
    }

    // Extract embed URLs from episode page
    var embeds = extractEmbeds(epHtml);
    console.log('[WitAnime] Embeds: ' + embeds.length);
    if (embeds.length === 0) return [];

    // Resolve each embed to get playable stream URLs
    var streams = [];
    for (var i = 0; i < embeds.length && streams.length < 5; i++) {
        try {
            var streamUrl = await resolveEmbed(embeds[i], base + '/');
            if (streamUrl) {
                streams.push({
                    name: 'WitAnime',
                    title: getServerName(embeds[i]),
                    url: streamUrl,
                    quality: 'auto',
                    headers: { 'Referer': embeds[i] },
                });
            }
        } catch (e) {
            console.log('[WitAnime] Embed err: ' + e.message);
        }
    }

    console.log('[WitAnime] Streams: ' + streams.length);
    return streams;
}
