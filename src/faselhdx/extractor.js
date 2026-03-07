var cheerio = require('cheerio-without-node-native');
import { BASE_URL, HEADERS, fetchText } from './http.js';

function cleanText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/&[^;]+;/g, ' ')
        .replace(/[^a-z0-9\s\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
}

var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB_API_BASE = 'https://api.themoviedb.org/3';

async function resolveTmdbMeta(tmdbId, mediaType) {
    console.log('[FaselHDX] resolveTmdbMeta: id=' + tmdbId + ' type=' + mediaType);
    var endpoint = mediaType === 'movie' ? 'movie' : 'tv';
    var url = TMDB_API_BASE + '/' + endpoint + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

    var response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
    });

    if (!response.ok) {
        throw new Error('TMDB API error: ' + response.status);
    }

    var data = await response.json();
    var title = mediaType === 'tv' ? (data.name || '') : (data.title || '');
    var releaseDate = mediaType === 'tv' ? (data.first_air_date || '') : (data.release_date || '');
    var year = releaseDate ? releaseDate.split('-')[0] : '';
    var normalizedTitle = cleanText(title);
    console.log('[FaselHDX] TMDB resolved: title="' + normalizedTitle + '" year=' + year);

    return { title: normalizedTitle, year: year };
}

async function searchCandidates(query) {
    console.log('[FaselHDX] searchCandidates: "' + query + '"');
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
            if (/\/(movies|series|seasons|episodes|anime-movies|anime-series)\//i.test(href)) {
                urls.push(href);
            }
        }
    });

    console.log('[FaselHDX] searchCandidates found ' + urls.length + ' URLs');
    return unique(urls);
}

function scoreCandidate(url, mediaType, season, episode, title, year) {
    var lower = url.toLowerCase();
    var score = 0;

    if (mediaType === 'movie' && /(\/movies\/|\/anime-movies\/)/.test(lower)) score += 8;
    if (mediaType === 'tv' && /\/episodes\//.test(lower)) score += 10;
    if (mediaType === 'tv' && /\/seasons\//.test(lower)) score += 8;
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

/**
 * For TV shows on FaselHDX, the navigation is:
 *   search -> /seasons/show-all-seasons -> seasonDiv onclick /?p=XXX -> /episodes/...
 * We need to drill from the seasons page to the correct episode page.
 */
async function resolveEpisodeFromSeasons(seasonsPageUrl, season, episode) {
    console.log('[FaselHDX] resolveEpisodeFromSeasons: s=' + season + ' e=' + episode);
    var html = await fetchText(seasonsPageUrl, {
        headers: { ...HEADERS, Referer: BASE_URL + '/main' },
    });
    var $ = cheerio.load(html);

    // seasonDiv elements correspond to seasons (1-indexed)
    var seasonDivs = $('.seasonDiv');
    console.log('[FaselHDX] Found ' + seasonDivs.length + ' season divs');
    if (seasonDivs.length === 0) return '';

    var seasonIdx = Math.max(0, Math.min(parseInt(season, 10) - 1, seasonDivs.length - 1));
    var targetDiv = seasonDivs.eq(seasonIdx);
    var onclick = targetDiv.attr('onclick') || '';

    // Check if this season div already has episode links (active season)
    var episodeLinks = [];
    targetDiv.find('a[href*="/episodes/"]').each(function(_, el) {
        episodeLinks.push($(el).attr('href'));
    });

    // If no episode links in this div, it's not the active season
    // Navigate to the season page via the onclick /?p=XXX URL
    if (episodeLinks.length === 0 && onclick) {
        var pMatch = onclick.match(/['"]([^'"]*\?p=\d+)['"]/) || onclick.match(/href\s*=\s*'([^']+)'/);
        if (pMatch && pMatch[1]) {
            var seasonUrl = pMatch[1];
            if (!/^https?:\/\//i.test(seasonUrl)) {
                seasonUrl = BASE_URL + seasonUrl;
            }
            console.log('[FaselHDX] Navigating to season page: ' + seasonUrl);
            var sHtml = await fetchText(seasonUrl, {
                headers: { ...HEADERS, Referer: seasonsPageUrl },
            });
            var $s = cheerio.load(sHtml);
            $s('a[href*="/episodes/"]').each(function(_, el) {
                episodeLinks.push($s(el).attr('href'));
            });
        }
    }

    // Also check the main page's episode links (for the active season)
    if (episodeLinks.length === 0) {
        $('a[href*="/episodes/"]').each(function(_, el) {
            episodeLinks.push($(el).attr('href'));
        });
    }

    episodeLinks = unique(episodeLinks);
    console.log('[FaselHDX] Found ' + episodeLinks.length + ' episode links for season ' + season);
    if (episodeLinks.length === 0) return '';

    // Find the episode by its trailing number
    var epNum = parseInt(episode, 10);
    var match = '';
    for (var i = 0; i < episodeLinks.length; i++) {
        var decoded = decodeURIComponent(episodeLinks[i]);
        // Match URLs ending with -N or -N-الأخير etc
        var numMatch = decoded.match(/-(\d+)(?:-[^/]*)?\/?$/);
        if (numMatch && parseInt(numMatch[1], 10) === epNum) {
            match = episodeLinks[i];
            break;
        }
    }

    // Fallback: if episode number matches array index
    if (!match && epNum >= 1 && epNum <= episodeLinks.length) {
        match = episodeLinks[epNum - 1];
    }

    if (match) console.log('[FaselHDX] Matched episode: ' + match.substring(0, 100));
    return match;
}

async function resolvePageUrl(tmdbId, mediaType, season, episode) {
    if (typeof tmdbId === 'string' && /^https?:\/\//i.test(tmdbId)) return tmdbId;

    var tmdbMeta = await resolveTmdbMeta(tmdbId, mediaType);

    var queries = [];
    if (tmdbMeta.title && tmdbMeta.year) queries.push(tmdbMeta.title + ' ' + tmdbMeta.year);
    if (tmdbMeta.title) queries.push(tmdbMeta.title);

    var allCandidates = [];
    var uq = unique(queries);
    for (var i = 0; i < uq.length; i++) {
        var urls = await searchCandidates(uq[i]);
        allCandidates.push.apply(allCandidates, urls);
        if (allCandidates.length >= 6) break;
    }

    var candidates = unique(allCandidates);
    console.log('[FaselHDX] resolvePageUrl: ' + candidates.length + ' unique candidates from ' + allCandidates.length + ' total');
    if (candidates.length === 0) return '';

    var ranked = candidates
        .map(function(url) {
            return { url: url, score: scoreCandidate(url, mediaType, season, episode, tmdbMeta.title || '', tmdbMeta.year || '') };
        })
        .sort(function(a, b) { return b.score - a.score; });

    var bestUrl = ranked[0] ? ranked[0].url : '';

    // For TV shows: if we found a /seasons/ page, drill into it
    if (mediaType === 'tv' && season && episode && bestUrl && /\/seasons\//.test(bestUrl)) {
        var episodeUrl = await resolveEpisodeFromSeasons(bestUrl, season, episode);
        if (episodeUrl) return episodeUrl;
        console.log('[FaselHDX] Could not resolve episode from seasons page, using best URL');
    }

    return bestUrl;
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
 * Hermes compiles JS to bytecode, so Function.prototype.toString() returns
 * "[bytecode]" instead of source. The obfuscator's anti-debugging checks
 * fn.toString() for patterns — when it gets "[bytecode]", it thinks a
 * debugger is attached and enters an infinite loop.
 *
 * Fix: Pre-process the script to neutralize anti-debug patterns before
 * execution, and cap all while(true) loops with iteration limits.
 */
function executeQualityScript(scriptContent) {
    var captured = '';

    // --- Hermes fix: neutralize anti-debug code patterns ---
    // The obfuscator has an anti-debug class that tests fn.toString() against
    // a regex like /\w+ *\(\) *{\w+ *['|"].+['|"];? *}/. In V8, functions
    // return source code from toString(), so the test passes. In Hermes,
    // toString() returns "[bytecode]" which fails the test, triggering
    // infinite recursive calls (nPFMJC -> mNJyyv -> ajuSPv -> ...).
    //
    // Fix: Replace the ['test'](this[...]['toString']()) anti-debug check
    // with a hardcoded string that matches the expected regex pattern.
    var antiDebugFixes = 0;
    scriptContent = scriptContent.replace(
        /\['test'\]\(this\['[^']+'\]\['toString'\]\(\)\)/g,
        function() { antiDebugFixes++; return "['test'](\"function (){return'newState';}\")"; }
    );

    // Also cap while(!![]) loops as a safety net
    var loopCounter = 0;
    scriptContent = scriptContent.replace(/while\s*\(\s*!!\s*\[\s*\]\s*\)\s*\{/g, function() {
        loopCounter++;
        return 'var __lc' + loopCounter + '=0;while(++__lc' + loopCounter + '<5000){';
    });

    // Replace debugger statements
    scriptContent = scriptContent.replace(/\bdebugger\b/g, 'void 0');

    console.log('[FaselHDX] sandbox: patched ' + antiDebugFixes + ' anti-debug checks, ' + loopCounter + ' while-loops');

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
        console.log('[FaselHDX] sandbox: creating Function with ' + scopeEntries.length + ' params, script len=' + scriptContent.length);
        var executor = new Function(paramNames, scriptContent);
        console.log('[FaselHDX] sandbox: Function created OK, executing...');
        executor.apply(null, paramValues);
        console.log('[FaselHDX] sandbox: execution done, captured ' + captured.length + ' chars');
    } catch (e) {
        console.error('[FaselHDX] sandbox exec error: ' + (e && e.message ? e.message : String(e)));
        console.error('[FaselHDX] sandbox exec stack: ' + (e && e.stack ? e.stack.substring(0, 200) : 'none'));
    }

    return captured;
}

/**
 * Extract stream URLs from the quality_change div's inline script.
 */
function extractQualityScriptUrls(playerHtml) {
    console.log('[FaselHDX] extractQualityScriptUrls: html len=' + playerHtml.length);
    var qcMatch = playerHtml.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
    if (!qcMatch) {
        console.log('[FaselHDX] extractQualityScriptUrls: no quality_change div found');
        return [];
    }
    console.log('[FaselHDX] extractQualityScriptUrls: quality_change div len=' + qcMatch[1].length);

    var scriptMatch = qcMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
    if (!scriptMatch) {
        console.log('[FaselHDX] extractQualityScriptUrls: no script tag in quality_change');
        return [];
    }

    var scriptContent = scriptMatch[1].trim();
    console.log('[FaselHDX] extractQualityScriptUrls: script len=' + scriptContent.length);
    if (scriptContent.length < 500) {
        console.log('[FaselHDX] extractQualityScriptUrls: script too short, skipping');
        return [];
    }

    console.log('[FaselHDX] extractQualityScriptUrls: about to execute sandbox...');
    var htmlOutput = executeQualityScript(scriptContent);
    console.log('[FaselHDX] extractQualityScriptUrls: sandbox returned ' + (htmlOutput ? htmlOutput.length : 0) + ' chars');
    if (!htmlOutput) return [];

    var urls = [];
    var re = /data-url="([^"]+)"/g;
    var m;
    while ((m = re.exec(htmlOutput)) !== null) {
        if (m[1] && /^https?:\/\//i.test(m[1])) urls.push(m[1]);
    }
    console.log('[FaselHDX] extractQualityScriptUrls: found ' + urls.length + ' data-url entries');

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
        console.error('[FaselHDX] resolveDirectFromPlayer error: ' + e.message);
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
