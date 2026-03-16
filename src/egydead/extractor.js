import { HEADERS, fetchText, getBaseUrl } from './http.js';

var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB_API_BASE = 'https://api.themoviedb.org/3';

// ─── TMDB helpers ───────────────────────────────────────────────────────────

async function getTmdbMeta(tmdbId, mediaType) {
    var type = mediaType === 'movie' ? 'movie' : 'tv';
    var enUrl = TMDB_API_BASE + '/' + type + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=en-US';
    var fetchOpts = { method: 'GET', headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } };
    try {
        var r = await fetch(enUrl, fetchOpts);
        if (!r.ok) return null;
        var data = await r.json();
        var title = data.title || data.name || '';
        var origTitle = data.original_title || data.original_name || '';
        var year = '';
        if (data.release_date) year = data.release_date.split('-')[0];
        else if (data.first_air_date) year = data.first_air_date.split('-')[0];
        return { title: title, originalTitle: origTitle, year: year };
    } catch (e) {
        console.log('[EgyDead] TMDB error: ' + e.message);
        return null;
    }
}

// ─── Slug / URL builders ────────────────────────────────────────────────────

function slugify(text) {
    return text.toLowerCase()
        .replace(/['']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

// ─── Search EgyDead ─────────────────────────────────────────────────────────

async function searchEgyDead(title, year, mediaType) {
    var base = getBaseUrl();
    var query = encodeURIComponent(title);
    var html = await fetchText(base + '/?s=' + query);
    if (!html) return '';

    // Extract all internal links from search results
    var linkRe = /href="(https?:\/\/f2h7y\.sbs\/[^"]+)"/gi;
    var m;
    var candidates = [];
    while ((m = linkRe.exec(html)) !== null) {
        var url = m[1];
        // Skip navigation/category/tag/feed/wp links
        if (/page\/|type\/|category\/|tag\/|wp-|feed\/|xmlrpc|comments/.test(url)) continue;
        if (candidates.indexOf(url) < 0) candidates.push(url);
    }

    if (candidates.length === 0) return '';

    // For movies: match URL containing the slugified title
    var slug = slugify(title);
    var slugWords = slug.split('-').filter(function(w) { return w.length > 2; });

    // Score each candidate
    var best = '';
    var bestScore = 0;
    for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i].toLowerCase();
        // Skip episode links for movie searches
        if (mediaType === 'movie' && c.indexOf('/episode/') > -1) continue;
        // For TV, prefer episode-style links
        if (mediaType === 'tv' && c.indexOf('/episode/') < 0) continue;

        var score = 0;
        for (var j = 0; j < slugWords.length; j++) {
            if (c.indexOf(slugWords[j]) > -1) score++;
        }
        if (year && c.indexOf(year) > -1) score += 2;
        if (score > bestScore) { bestScore = score; best = candidates[i]; }
    }

    // For TV, we want the series page, not individual episodes
    // If we found an episode link, try to get the series base URL
    if (mediaType === 'tv' && best && best.indexOf('/episode/') > -1) {
        // We'll construct the episode URL ourselves later
        // Just verify the title was found
        return best;
    }

    return best;
}

// ─── Fetch page with View=1 POST ───────────────────────────────────────────

async function fetchWatchPage(pageUrl) {
    var html = await fetchText(pageUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'View=1',
    });
    return html;
}

// ─── Extract embed servers from watch page ──────────────────────────────────

function extractEmbeds(html) {
    var embeds = [];
    var re = /data-link="([^"]+)"/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
        embeds.push(m[1]);
    }
    return embeds;
}

// ─── PACK unpacker (Hermes-safe, no eval) ───────────────────────────────────

function unpackPACK(html) {
    // Find eval(function(p,a,c,k,e,d) block
    var evalIdx = html.indexOf('eval(function(p,a,c,k,e,d)');
    if (evalIdx < 0) return '';

    // Find .split('|') after eval
    var splitIdx = html.indexOf(".split('|')", evalIdx);
    if (splitIdx < 0) return '';

    // Extract dictionary: between last ,' and .split('|')
    var dictQuoteStart = html.lastIndexOf(",'", splitIdx);
    if (dictQuoteStart < 0) return '';
    var dictStr = html.substring(dictQuoteStart + 2, splitIdx);
    if (dictStr[0] === "'") dictStr = dictStr.substring(1);
    if (dictStr[dictStr.length - 1] === "'") dictStr = dictStr.substring(0, dictStr.length - 1);
    var words = dictStr.split('|');

    // Find payload start: after }('
    var bodyStart = html.indexOf("}('", evalIdx);
    if (bodyStart < 0) return '';
    bodyStart += 3;

    // Extract payload and base/count
    var beforeDict = html.substring(bodyStart, dictQuoteStart);
    var match = beforeDict.match(/^([\s\S]*)',\s*(\d+)\s*,\s*(\d+)\s*$/);
    if (!match) return '';

    var p = match[1];
    var base = parseInt(match[2], 10);
    var count = parseInt(match[3], 10);

    // Base conversion helper
    function baseEncode(val) {
        var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (val === 0) return '0';
        var result = '';
        while (val > 0) {
            result = chars[val % base] + result;
            val = Math.floor(val / base);
        }
        return result;
    }

    // Build dictionary
    var dict = {};
    while (count--) {
        var encoded = baseEncode(count);
        dict[encoded] = words[count] || encoded;
    }

    // Replace tokens
    var result = p.replace(/\b(\w+)\b/g, function(m) {
        return dict[m] !== undefined ? dict[m] : m;
    });

    return result;
}

// ─── Extract m3u8 from decoded PACK ─────────────────────────────────────────

function extractM3u8FromDecoded(decoded) {
    // JW Player file: "url.m3u8..."
    var m3u8Match = decoded.match(/file\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
    if (m3u8Match) return m3u8Match[1];

    // Try single quotes
    var m3u8Match2 = decoded.match(/file\s*:\s*'(https?:\/\/[^']*\.m3u8[^']*)'/);
    if (m3u8Match2) return m3u8Match2[1];

    // Fallback: any m3u8 URL
    var fallback = decoded.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/);
    return fallback ? fallback[0] : '';
}

// ─── Extract m3u8 from embed page ───────────────────────────────────────────

async function extractFromEmbed(embedUrl) {
    var html = await fetchText(embedUrl, {
        headers: { 'Referer': getBaseUrl() + '/' },
        timeout: 12000,
    });
    if (!html) return '';

    // 1) Direct m3u8 in the page
    var directM3u8 = html.match(/(?:file|source|src)\s*[:=]\s*["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/i);
    if (directM3u8) return directM3u8[1];

    // 2) PACK-encoded JS (stmruby, forafile pattern)
    if (html.indexOf('eval(function(p,a,c,k,e,d)') > -1) {
        var decoded = unpackPACK(html);
        if (decoded) {
            var m3u8 = extractM3u8FromDecoded(decoded);
            if (m3u8) return m3u8;
        }
    }

    // 3) Any m3u8 URL in the raw page
    var anyM3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/);
    if (anyM3u8) return anyM3u8[0];

    return '';
}

// ─── Identify embed server name ─────────────────────────────────────────────

function getServerName(url) {
    try {
        var hostname = url.match(/https?:\/\/([^\/]+)/)[1];
        if (hostname.indexOf('stmruby') > -1 || hostname.indexOf('streamruby') > -1) return 'StreamRuby';
        if (hostname.indexOf('forafile') > -1) return 'ForaFile';
        if (hostname.indexOf('hgcloud') > -1) return 'HGCloud';
        if (hostname.indexOf('vidara') > -1) return 'Vidara';
        if (hostname.indexOf('dsvplay') > -1) return 'DSVPlay';
        if (hostname.indexOf('mixdrop') > -1) return 'MixDrop';
        if (hostname.indexOf('voe') > -1) return 'VOE';
        return hostname.split('.')[0];
    } catch (e) {
        return 'Unknown';
    }
}

// ─── Build episode URL for TV shows ─────────────────────────────────────────

function buildEpisodeUrl(title, season, episode) {
    // EgyDead pattern: /episode/{slug}-s{SS}e{EE}/
    var slug = slugify(title);
    var se = 's' + String(season).padStart(2, '0') + 'e' + String(episode).padStart(2, '0');
    return getBaseUrl() + '/episode/' + slug + '-' + se + '/';
}

// ─── Main extraction ────────────────────────────────────────────────────────

export async function extractStreams(tmdbId, mediaType, season, episode) {
    var meta = await getTmdbMeta(tmdbId, mediaType);
    if (!meta || !meta.title) {
        console.log('[EgyDead] Could not get TMDB meta for ' + tmdbId);
        return [];
    }
    console.log('[EgyDead] Title: ' + meta.title + ' (' + meta.year + ')');

    var pageUrl = '';

    if (mediaType === 'movie') {
        // Search for the movie
        pageUrl = await searchEgyDead(meta.title, meta.year, 'movie');
        if (!pageUrl && meta.originalTitle && meta.originalTitle !== meta.title) {
            pageUrl = await searchEgyDead(meta.originalTitle, meta.year, 'movie');
        }
        if (!pageUrl) {
            console.log('[EgyDead] Movie not found: ' + meta.title);
            return [];
        }
    } else {
        // TV: Try direct episode URL construction first
        pageUrl = buildEpisodeUrl(meta.title, season, episode);
        // Verify it works
        var testHead = await fetchText(pageUrl, { timeout: 8000 });
        if (!testHead || testHead.length < 1000) {
            // Try with original title
            if (meta.originalTitle && meta.originalTitle !== meta.title) {
                pageUrl = buildEpisodeUrl(meta.originalTitle, season, episode);
                testHead = await fetchText(pageUrl, { timeout: 8000 });
            }
            if (!testHead || testHead.length < 1000) {
                // Search fallback
                var searchResult = await searchEgyDead(meta.title, meta.year, 'tv');
                if (searchResult) {
                    // Try to construct episode URL from the found slug
                    var slugMatch = searchResult.match(/\/episode\/(.+)-s\d+e\d+\/?$/i);
                    if (slugMatch) {
                        var se = 's' + String(season).padStart(2, '0') + 'e' + String(episode).padStart(2, '0');
                        pageUrl = getBaseUrl() + '/episode/' + slugMatch[1] + '-' + se + '/';
                    } else {
                        pageUrl = searchResult;
                    }
                } else {
                    console.log('[EgyDead] Episode not found: ' + meta.title + ' S' + season + 'E' + episode);
                    return [];
                }
            }
        }
    }

    console.log('[EgyDead] Page: ' + pageUrl);

    // POST with View=1 to reveal embed servers
    var watchHtml = await fetchWatchPage(pageUrl);
    if (!watchHtml) {
        console.log('[EgyDead] Empty watch page');
        return [];
    }

    var embeds = extractEmbeds(watchHtml);
    if (embeds.length === 0) {
        console.log('[EgyDead] No embeds found');
        return [];
    }
    console.log('[EgyDead] Found ' + embeds.length + ' embed(s)');

    // Prioritize PACK-decodable servers (stmruby, forafile)
    var prioritized = [];
    var others = [];
    for (var i = 0; i < embeds.length; i++) {
        var url = embeds[i];
        if (/stmruby|streamruby|forafile/.test(url)) {
            prioritized.push(url);
        } else {
            others.push(url);
        }
    }
    var ordered = prioritized.concat(others);

    // Try each embed, collect streams
    var streams = [];
    var tried = 0;
    var MAX_TRIES = 4;

    for (var j = 0; j < ordered.length && tried < MAX_TRIES; j++) {
        var embedUrl = ordered[j];
        var serverName = getServerName(embedUrl);
        tried++;

        try {
            var m3u8 = await extractFromEmbed(embedUrl);
            if (m3u8) {
                console.log('[EgyDead] Got stream from ' + serverName);
                streams.push({
                    url: m3u8,
                    quality: 'auto',
                    provider: 'EgyDead',
                    source: serverName,
                    type: 'm3u8',
                });
                // If we got one from prioritized, try one more for redundancy
                if (streams.length >= 2) break;
            }
        } catch (e) {
            console.log('[EgyDead] Failed ' + serverName + ': ' + e.message);
        }
    }

    if (streams.length === 0) {
        console.log('[EgyDead] No streams extracted from any embed');
    }
    return streams;
}
