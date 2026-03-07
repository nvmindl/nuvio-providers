var cheerio = require('cheerio-without-node-native');
import { BASE_URL, HEADERS, fetchText } from './http.js';

function cleanText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/&[^;]+;/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function decodeSlugFromCanonical(canonicalHref) {
    if (!canonicalHref) return '';
    var last = canonicalHref.split('/').filter(Boolean).pop() || '';
    var slug = last.replace(/^\d+-/, '');
    return slug.replace(/-/g, ' ').trim();
}

function parseYearFromTitleTag(titleTag) {
    var match = String(titleTag || '').match(/\((\d{4})\)/);
    return match ? match[1] : '';
}

function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
}

async function resolveTmdbMeta(tmdbId, mediaType) {
    var kind = mediaType === 'movie' ? 'movie' : 'tv';
    var tmdbUrl = 'https://www.themoviedb.org/' + kind + '/' + tmdbId;

    var html = await fetchText(tmdbUrl, {
        headers: {
            ...HEADERS,
            Referer: 'https://www.themoviedb.org/',
        },
    });

    var $ = cheerio.load(html);
    var titleTag = $('title').first().text() || '';
    var canonical = $('link[rel="canonical"]').attr('href') || '';

    var titleFromCanonical = decodeSlugFromCanonical(canonical);
    var year = parseYearFromTitleTag(titleTag);
    var normalizedTitle = cleanText(titleFromCanonical || titleTag);

    return { title: normalizedTitle, year: year };
}

async function searchCandidates(query) {
    if (!query) return [];

    var searchUrl = BASE_URL + '/?s=' + encodeURIComponent(query);
    var html = await fetchText(searchUrl, {
        headers: {
            ...HEADERS,
            Referer: BASE_URL + '/main',
        },
    });

    var $ = cheerio.load(html);
    var urls = [];

    $('a[href]').each(function(_, el) {
        var href = $(el).attr('href');
        if (!href) return;
        if (/^https?:\/\/web\d+x\.faselhdx\.best\//i.test(href)) {
            if (/\/(movies|series|episodes|anime-movies|anime-series)\//i.test(href)) {
                urls.push(href);
            }
        }
    });

    return unique(urls);
}

function scoreCandidate(url, mediaType, season, episode, title, year) {
    var lower = url.toLowerCase();
    var score = 0;

    if (mediaType === 'movie' && /(\/movies\/|\/anime-movies\/)/.test(lower)) score += 8;
    if (mediaType === 'tv' && /\/episodes\//.test(lower)) score += 10;
    if (mediaType === 'tv' && /(\/series\/|\/anime-series\/)/.test(lower)) score += 4;
    if (year && lower.includes(year)) score += 2;

    var normalizedUrl = cleanText(decodeURIComponent(lower));
    var titleWords = unique(title.split(' ').filter(function(w) { return w.length > 2; }));

    var wordHits = 0;
    for (var i = 0; i < titleWords.length; i++) {
        if (normalizedUrl.includes(titleWords[i])) wordHits += 1;
    }
    score += Math.min(wordHits, 5);

    if (mediaType === 'tv') {
        if (season && new RegExp('(?:season|الموسم)\\s*' + season, 'i').test(normalizedUrl)) score += 3;
        if (episode && new RegExp('(?:episode|الحلقة)\\s*' + episode, 'i').test(normalizedUrl)) score += 4;
    }

    return score;
}

async function resolvePageUrl(tmdbId, mediaType, season, episode) {
    if (typeof tmdbId === 'string' && /^https?:\/\//i.test(tmdbId)) return tmdbId;

    var tmdbMeta = await resolveTmdbMeta(tmdbId, mediaType);

    var queries = [];
    if (tmdbMeta.title && tmdbMeta.year) queries.push(tmdbMeta.title + ' ' + tmdbMeta.year);
    if (tmdbMeta.title) queries.push(tmdbMeta.title);

    if (mediaType === 'tv' && tmdbMeta.title && season && episode) {
        queries.unshift(tmdbMeta.title + ' season ' + season + ' episode ' + episode);
        queries.unshift(tmdbMeta.title + ' الموسم ' + season + ' الحلقة ' + episode);
    }

    var allCandidates = [];
    var uq = unique(queries);
    for (var i = 0; i < uq.length; i++) {
        var urls = await searchCandidates(uq[i]);
        allCandidates.push.apply(allCandidates, urls);
        if (allCandidates.length >= 6) break;
    }

    var candidates = unique(allCandidates);
    if (candidates.length === 0) return '';

    var ranked = candidates
        .map(function(url) {
            return { url: url, score: scoreCandidate(url, mediaType, season, episode, tmdbMeta.title || '', tmdbMeta.year || '') };
        })
        .sort(function(a, b) { return b.score - a.score; });

    return ranked[0] ? ranked[0].url : '';
}

function extractPlayerUrls($) {
    var urls = [];

    $('ul.tabs-ul li').each(function(_, li) {
        var onclick = $(li).attr('onclick') || '';
        var match = onclick.match(/'(https?:\/\/[^']+\/video_player\?player_token=[^']+)'/i);
        if (match && match[1]) urls.push(match[1]);
    });

    var iframeUrl = $('iframe[name="player_iframe"]').attr('data-src')
        || $('iframe[name="player_iframe"]').attr('src');
    if (iframeUrl && /video_player\?player_token=/i.test(iframeUrl)) urls.push(iframeUrl);

    $('iframe[data-src*="video_player"]').each(function(_, el) {
        var ds = $(el).attr('data-src');
        if (ds) urls.push(ds);
    });

    return unique(urls);
}

/**
 * Execute the quality_change inline script in a sandboxed scope
 * to extract stream URLs from its document.write() output.
 *
 * Uses Function() with named parameters to shadow all globals —
 * compatible with Hermes (which does not support with()).
 */
function executeQualityScript(scriptContent) {
    var captured = '';

    var mockDoc = {
        write: function(s) { captured += s; },
        createElement: function() { return {}; },
        querySelector: function() { return {}; },
        querySelectorAll: function() { return []; },
        getElementById: function() { return null; },
    };

    // jQuery/Cookies stubs
    var mock$ = function() {
        var r = {};
        r.on = function() { return r; };
        r.html = function() { return r; };
        r.addClass = function() { return r; };
        r.removeClass = function() { return r; };
        r.attr = function() { return null; };
        r.fadeIn = function() { return r; };
        r.fadeOut = function() { return r; };
        r.click = function() { return r; };
        r.find = function() { return r; };
        r.each = function() { return r; };
        r.text = function() { return ''; };
        return r;
    };

    // atob polyfill (standard base64)
    var polyfillAtob = function(s) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var o = '', i = 0;
        s = String(s).replace(/[^A-Za-z0-9+/=]/g, '');
        while (i < s.length) {
            var e1 = chars.indexOf(s[i++]), e2 = chars.indexOf(s[i++]);
            var e3 = chars.indexOf(s[i++]), e4 = chars.indexOf(s[i++]);
            var n = (e1 << 18) | (e2 << 12) | (e3 << 6) | e4;
            o += String.fromCharCode((n >> 16) & 255);
            if (e3 !== 64) o += String.fromCharCode((n >> 8) & 255);
            if (e4 !== 64) o += String.fromCharCode(n & 255);
        }
        return o;
    };
    var polyfillBtoa = function(s) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var r = '', i = 0;
        while (i < s.length) {
            var a = s.charCodeAt(i++);
            var b = i < s.length ? s.charCodeAt(i++) : NaN;
            var c = i < s.length ? s.charCodeAt(i++) : NaN;
            r += chars[a >> 2];
            r += chars[((a & 3) << 4) | (b >> 4)];
            r += isNaN(b) ? '=' : chars[((b & 15) << 2) | (c >> 6)];
            r += isNaN(c) ? '=' : chars[c & 63];
        }
        return r;
    };

    // All global names the script may reference, passed as function parameters.
    // Function is set to undefined so anti-debug constructor checks fail safely.
    var scopeEntries = [
        ['document', mockDoc],
        ['navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }],
        ['location', { href: BASE_URL, hostname: 'web376x.faselhdx.best' }],
        ['console', { log: function(){}, warn: function(){}, error: function(){} }],
        ['parseInt', parseInt],
        ['parseFloat', parseFloat],
        ['isNaN', isNaN],
        ['isFinite', isFinite],
        ['String', String],
        ['Number', Number],
        ['Array', Array],
        ['Object', Object],
        ['Boolean', Boolean],
        ['RegExp', RegExp],
        ['Function', undefined],
        ['Error', Error],
        ['TypeError', TypeError],
        ['RangeError', RangeError],
        ['SyntaxError', SyntaxError],
        ['encodeURIComponent', encodeURIComponent],
        ['decodeURIComponent', decodeURIComponent],
        ['encodeURI', encodeURI],
        ['decodeURI', decodeURI],
        ['Math', Math],
        ['Date', Date],
        ['JSON', JSON],
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['undefined', undefined],
        ['setTimeout', function() { return 1; }],
        ['setInterval', function() { return 1; }],
        ['clearTimeout', function() {}],
        ['clearInterval', function() {}],
        ['$', mock$],
        ['jQuery', mock$],
        ['Cookies', { get: function() { return null; }, set: function() {} }],
        ['atob', polyfillAtob],
        ['btoa', polyfillBtoa],
    ];

    // Build a scope object for window/self/globalThis to reference
    var scopeObj = {};
    for (var i = 0; i < scopeEntries.length; i++) {
        scopeObj[scopeEntries[i][0]] = scopeEntries[i][1];
    }
    scopeObj.window = scopeObj;
    scopeObj.self = scopeObj;
    scopeObj.globalThis = scopeObj;

    scopeEntries.push(['window', scopeObj]);
    scopeEntries.push(['self', scopeObj]);
    scopeEntries.push(['globalThis', scopeObj]);

    var paramNames = scopeEntries.map(function(e) { return e[0]; }).join(', ');
    var paramValues = scopeEntries.map(function(e) { return e[1]; });

    try {
        var executor = new Function(paramNames, scriptContent);
        executor.apply(null, paramValues);
    } catch (e) {
        // Script execution failed silently
    }

    return captured;
}

/**
 * Extract stream URLs from the quality_change div's inline script.
 */
function extractQualityScriptUrls(playerHtml) {
    var qcMatch = playerHtml.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
    if (!qcMatch) return [];

    var scriptMatch = qcMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
    if (!scriptMatch) return [];

    var scriptContent = scriptMatch[1].trim();
    if (scriptContent.length < 500) return [];

    var htmlOutput = executeQualityScript(scriptContent);
    if (!htmlOutput) return [];

    var urls = [];
    var re = /data-url="([^"]+)"/g;
    var m;
    while ((m = re.exec(htmlOutput)) !== null) {
        if (m[1] && /^https?:\/\//i.test(m[1])) urls.push(m[1]);
    }

    return urls;
}

/**
 * Fallback: extract literal m3u8 URLs from HTML
 */
function extractLiteralUrls(playerHtml) {
    var urls = [];
    var normalized = String(playerHtml || '').replace(/\\\//g, '/');
    var re = /https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/gi;
    var m;
    while ((m = re.exec(normalized)) !== null) {
        if (m[0]) urls.push(m[0]);
    }
    return urls;
}

async function resolveDirectFromPlayer(playerUrl, pageUrl) {
    try {
        var html = await fetchText(playerUrl, {
            headers: {
                ...HEADERS,
                Referer: pageUrl,
                Origin: BASE_URL,
            },
        });

        // Primary: execute quality_change script to get URLs
        var qcUrls = extractQualityScriptUrls(html);
        if (qcUrls.length > 0) {
            return qcUrls.map(function(url) {
                var quality = 'auto';
                if (/hd1080/i.test(url)) quality = '1080p';
                else if (/hd720/i.test(url)) quality = '720p';
                else if (/sd480/i.test(url)) quality = '480p';
                else if (/sd360/i.test(url)) quality = '360p';

                return {
                    url: url,
                    quality: quality,
                    headers: {
                        ...HEADERS,
                        Referer: BASE_URL + '/',
                        Origin: BASE_URL,
                    },
                };
            });
        }

        // Fallback: literal m3u8 URLs in HTML
        var literalUrls = extractLiteralUrls(html);
        return literalUrls.map(function(url) {
            return {
                url: url,
                quality: 'auto',
                headers: {
                    ...HEADERS,
                    Referer: BASE_URL + '/',
                    Origin: BASE_URL,
                },
            };
        });
    } catch (e) {
        return [];
    }
}

function buildStreams(directStreams) {
    var qualityOrder = { '1080p': 0, '720p': 1, '480p': 2, '360p': 3, 'auto': 4 };

    var sorted = directStreams.slice().sort(function(a, b) {
        return (qualityOrder[a.quality] || 99) - (qualityOrder[b.quality] || 99);
    });

    var streams = [];
    for (var i = 0; i < sorted.length; i++) {
        var s = sorted[i];
        var label = s.quality === 'auto' ? 'Auto' : s.quality;
        streams.push({
            name: 'FaselHDX',
            title: label,
            url: s.url,
            quality: s.quality === 'auto' ? 'WEB' : s.quality,
            headers: s.headers,
        });
    }

    return streams;
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    console.log('[FaselHDX] Resolving source for ' + mediaType + ':' + tmdbId + ' s=' + (season || '-') + ' e=' + (episode || '-'));

    var pageUrl = await resolvePageUrl(tmdbId, mediaType, season, episode);
    if (!pageUrl) {
        console.log('[FaselHDX] No matching page found');
        return [];
    }

    console.log('[FaselHDX] Selected page: ' + pageUrl);

    var html = await fetchText(pageUrl, {
        headers: {
            ...HEADERS,
            Referer: BASE_URL + '/main',
        },
    });

    var $ = cheerio.load(html);
    var playerUrls = extractPlayerUrls($);

    console.log('[FaselHDX] Found ' + playerUrls.length + ' player URLs');

    var allStreams = [];
    for (var i = 0; i < playerUrls.length; i++) {
        var streams = await resolveDirectFromPlayer(playerUrls[i], pageUrl);
        allStreams.push.apply(allStreams, streams);
        if (allStreams.length > 0) break;
    }

    var result = buildStreams(allStreams);

    var seen = {};
    var deduped = [];
    for (var j = 0; j < result.length; j++) {
        if (!result[j].url || seen[result[j].url]) continue;
        seen[result[j].url] = true;
        deduped.push(result[j]);
    }

    console.log('[FaselHDX] Found ' + deduped.length + ' stream candidates');
    return deduped;
}
