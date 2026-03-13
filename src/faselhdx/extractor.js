import { HEADERS, fetchText, fetchPost, getBaseUrl, setBaseUrl, getDomains } from './http.js';

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB = 'https://api.themoviedb.org/3';
var _cache = {};

// ── TMDB title lookup (matches Kirmzi pattern: plain fetch, no AbortSignal) ──

async function tmdbTitle(tmdbId, mediaType) {
    var k = tmdbId + mediaType;
    if (_cache[k]) return _cache[k];
    var path = mediaType === 'movie' ? 'movie' : 'tv';
    var fetchOpts = { method: 'GET', headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } };
    var r = await fetch(TMDB + '/' + path + '/' + tmdbId + '?api_key=' + TMDB_KEY, fetchOpts)
        .then(function(resp) { return resp.ok ? resp.json() : {}; })
        .catch(function() { return {}; });
    var title = mediaType === 'tv' ? (r.name || '') : (r.title || '');
    var year = (mediaType === 'tv' ? r.first_air_date : r.release_date || '').split('-')[0] || '';
    var res = { title: title, year: year };
    if (title) _cache[k] = res;
    return res;
}

// ── Search ───────────────────────────────────────────────────────────────

function extractHrefs(html) {
    var out = [], m, re = /href="(https?:\/\/[^"]+\/(movies|series|seasons|episodes|anime[^"]*?)\/[^"]+)"/gi;
    while ((m = re.exec(html)) !== null) out.push(m[1]);
    return out.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

async function search(query, base) {
    // AJAX live search
    var html = await fetchPost(
        base + '/wp-admin/admin-ajax.php',
        'action=dtc_live&trsearch=' + encodeURIComponent(query),
        { headers: { Referer: base + '/' } }
    );
    if (html) {
        var urls = extractHrefs(html);
        if (urls.length) {
            console.log('[FaselHDX] AJAX search found ' + urls.length + ' results');
            return urls;
        }
    }

    // Standard search
    var html2 = await fetchText(base + '/?s=' + encodeURIComponent(query), { headers: { Referer: base + '/' } });
    if (html2) {
        var urls2 = extractHrefs(html2);
        if (urls2.length) {
            console.log('[FaselHDX] Standard search found ' + urls2.length + ' results');
            return urls2;
        }
    }

    return [];
}

function pickBest(urls, mediaType, title) {
    var lower = title.toLowerCase();
    var words = lower.split(/\s+/).filter(function(w) { return w.length > 2; });
    var best = '', bestScore = -1;
    for (var i = 0; i < urls.length; i++) {
        var u = decodeURIComponent(urls[i]).toLowerCase();
        var s = 0;
        if (mediaType === 'movie' && /\/movies\//.test(u)) s += 5;
        if (mediaType === 'tv' && /\/(series|seasons|episodes)\//.test(u)) s += 5;
        for (var w = 0; w < words.length; w++) if (u.indexOf(words[w]) >= 0) s++;
        if (s > bestScore) { bestScore = s; best = urls[i]; }
    }
    return best;
}

// ── Episode resolution ───────────────────────────────────────────────────

function epLinks(html) {
    var out = [], m, re = /href="([^"]*\/(?:episodes|anime-episodes)\/[^"]*)"/gi;
    while ((m = re.exec(html)) !== null) out.push(m[1]);
    return out.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

function pickEpisode(links, ep) {
    var n = parseInt(ep, 10);
    for (var i = 0; i < links.length; i++) {
        var m = decodeURIComponent(links[i]).match(/-(\d+)\/?$/);
        if (m && parseInt(m[1], 10) === n) return links[i];
    }
    return n >= 1 && n <= links.length ? links[n - 1] : '';
}

async function resolveEpisode(pageUrl, season, episode, base) {
    var html = await fetchText(pageUrl, { headers: { Referer: base + '/' } });
    if (!html) return '';

    // Find season divs
    var divRe = /<div[^>]*class="[^"]*\bseasonDiv\b[^"]*"[^>]*>/gi;
    var divs = [], dm;
    while ((dm = divRe.exec(html)) !== null) divs.push({ idx: dm.index, tag: dm[0] });

    if (divs.length === 0) {
        var links = epLinks(html);
        return pickEpisode(links, episode);
    }

    var si = Math.max(0, Math.min(parseInt(season, 10) - 1, divs.length - 1));
    var start = divs[si].idx;
    var end = si + 1 < divs.length ? divs[si + 1].idx : html.length;
    var block = html.substring(start, end);
    var links = epLinks(block);

    if (!links.length) {
        var pm = divs[si].tag.match(/onclick="[^"]*['"]([^'"]*\?p=\d+)['"]/i);
        if (pm) {
            var sUrl = pm[1];
            if (!/^https?:/.test(sUrl)) sUrl = base + sUrl;
            var sHtml = await fetchText(sUrl, { headers: { Referer: pageUrl } });
            if (sHtml) links = epLinks(sHtml);
        }
    }

    if (!links.length) links = epLinks(html);
    return pickEpisode(links, episode);
}

// ── Player extraction ────────────────────────────────────────────────────

function playerUrls(html) {
    var out = [], m;
    var re1 = /'(https?:\/\/[^']+\/video_player\?[^']+)'/gi;
    while ((m = re1.exec(html)) !== null) out.push(m[1]);
    var re2 = /<iframe[^>]*(?:data-src|src)="(https?:\/\/[^"]*video_player\?[^"]*)"/gi;
    while ((m = re2.exec(html)) !== null) out.push(m[1]);
    return out.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

function m3u8urls(text) {
    var out = [], m, re = /https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/gi;
    text = text.replace(/\\\//g, '/');
    while ((m = re.exec(text)) !== null) out.push(m[0]);
    return out.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

function runQualityScript(script, base) {
    var captured = '';
    // Neutralize anti-debug
    var antiDebugRepl = String.fromCharCode(91) + String.fromCharCode(39) + 'test' + String.fromCharCode(39) + '](\"function(){return' + String.fromCharCode(39) + 'x' + String.fromCharCode(39) + '}\")';
    script = script.replace(/\['test'\]\(this\['[^']+'\]\['toString'\]\(\)\)/g, antiDebugRepl);    // Cap infinite loops
    var n = 0;
    script = script.replace(/while\s*\(\s*!!\s*\[\s*\]\s*\)\s*\{/g, function() { n++; return 'var __c'+n+'=0;while(++__c'+n+'<500){'; });
    script = script.replace(/\bdebugger\b/g, 'void 0');

    var host = base.replace(/^https?:\/\//, '');
    var noop = function() {};
    var mock$ = function() { var r = {}; r.on=r.html=r.addClass=r.removeClass=r.fadeIn=r.fadeOut=r.click=r.find=r.each=function(){return r;}; r.attr=function(){return null;}; r.text=function(){return '';}; return r; };
    var atob = function(s) {
        var t = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=', o = '', i = 0;
        s = String(s).replace(/[^A-Za-z0-9+/=]/g, '');
        while (i < s.length) { var a=t.indexOf(s[i++]),b=t.indexOf(s[i++]),c=t.indexOf(s[i++]),d=t.indexOf(s[i++]),x=(a<<18)|(b<<12)|(c<<6)|d; o+=String.fromCharCode((x>>16)&255); if(c!==64)o+=String.fromCharCode((x>>8)&255); if(d!==64)o+=String.fromCharCode(x&255); }
        return o;
    };
    var doc = { write: function(s) { captured += s; }, createElement: function() { return {}; }, querySelector: function() { return {}; }, querySelectorAll: function() { return []; }, getElementById: function() { return null; } };

    try {
        var fn = new Function('document','navigator','location','console','$','jQuery','Cookies','atob','btoa','setTimeout','setInterval','clearTimeout','clearInterval','parseInt','parseFloat','isNaN','String','Number','Array','Object','Boolean','RegExp','Error','Math','Date','JSON','encodeURIComponent','decodeURIComponent','window','self','globalThis','Function', script);
        var w = {};
        fn.call(w, doc, {userAgent:'Mozilla/5.0'}, {href:base,hostname:host}, {log:noop,warn:noop,error:noop}, mock$, mock$, {get:function(){return null;},set:noop}, atob, function(){return '';}, noop, noop, noop, noop, parseInt, parseFloat, isNaN, String, Number, Array, Object, Boolean, RegExp, Error, Math, Date, JSON, encodeURIComponent, decodeURIComponent, w, w, w, undefined);
    } catch(e) {
        // new Function() may be blocked on iOS — try eval as fallback
        try {
            var w2 = {};
            var evalCode = '(function(document,navigator,location,console,$,jQuery,Cookies,atob,btoa,setTimeout,setInterval,clearTimeout,clearInterval){' + script + '})';
            var evalFn = (0, eval)(evalCode);
            evalFn(doc, {userAgent:'Mozilla/5.0'}, {href:base,hostname:host}, {log:noop,warn:noop,error:noop}, mock$, mock$, {get:function(){return null;},set:noop}, atob, function(){return '';}, noop, noop, noop, noop);
        } catch(e2) { /* both sandbox methods failed */ }
    }
    return captured;
}

async function extractFromPlayer(playerUrl, referer, base) {
    var html = await fetchText(playerUrl, { headers: { Referer: referer, Origin: base } });
    if (!html) return [];
    var streams = [];

    // Try quality_change script first
    var qc = html.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
    if (qc) {
        var sc = qc[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
        if (sc && sc[1].length > 200) {
            var out = runQualityScript(sc[1], base);
            var dm, dre = /data-url="([^"]+)"/g;
            while ((dm = dre.exec(out)) !== null) {
                if (/^https?:/.test(dm[1])) {
                    var q = /hd1080/.test(dm[1]) ? '1080p' : /hd720/.test(dm[1]) ? '720p' : /sd480/.test(dm[1]) ? '480p' : /sd360/.test(dm[1]) ? '360p' : 'auto';
                    streams.push({ url: dm[1], quality: q });
                }
            }
        }
    }

    // Fallback: any m3u8 URLs directly in the page
    if (!streams.length) {
        m3u8urls(html).forEach(function(u) { streams.push({ url: u, quality: 'auto' }); });
    }

    return streams;
}

// ── Main export ──────────────────────────────────────────────────────────

export async function extractStreams(tmdbId, mediaType, season, episode) {
    console.log('[FaselHDX] Starting: ' + mediaType + ' ' + tmdbId);
    var meta = await tmdbTitle(tmdbId, mediaType);
    if (!meta.title) {
        console.log('[FaselHDX] No title from TMDB');
        return [];
    }
    console.log('[FaselHDX] Title: ' + meta.title + ' (' + meta.year + ')');

    // Try each domain until we find results
    var domains = getDomains();
    for (var d = 0; d < domains.length; d++) {
        var base = domains[d];
        setBaseUrl(base);
        console.log('[FaselHDX] Trying domain: ' + base);

        var urls = await search(meta.title, base);
        if (!urls.length && meta.year) urls = await search(meta.title + ' ' + meta.year, base);
        if (!urls.length) {
            console.log('[FaselHDX] No search results from ' + base);
            continue;
        }

        var pageUrl = pickBest(urls, mediaType, meta.title);
        if (!pageUrl) {
            console.log('[FaselHDX] No matching page');
            continue;
        }
        console.log('[FaselHDX] Page: ' + pageUrl);

        // For TV: resolve to specific episode
        if (mediaType === 'tv' && season && episode && /\/(series|seasons|anime)\//.test(pageUrl)) {
            var epUrl = await resolveEpisode(pageUrl, season, episode, base);
            if (epUrl) pageUrl = epUrl;
            console.log('[FaselHDX] Episode URL: ' + pageUrl);
        }

        // Fetch the content page and find player iframes
        var html = await fetchText(pageUrl, { headers: { Referer: base + '/' } });
        if (!html) {
            console.log('[FaselHDX] Empty page response');
            continue;
        }
        var players = playerUrls(html);
        console.log('[FaselHDX] Found ' + players.length + ' players');
        if (!players.length) continue;

        // Extract streams from first working player
        for (var i = 0; i < players.length; i++) {
            var streams = await extractFromPlayer(players[i], pageUrl, base);
            if (streams.length) {
                console.log('[FaselHDX] Got ' + streams.length + ' streams');
                var ref = { Referer: base + '/', Origin: base };
                return streams.map(function(s) {
                    return {
                        name: 'FaselHDX - ' + (s.quality === 'auto' ? 'Auto' : s.quality),
                        title: s.quality === 'auto' ? 'Auto' : s.quality,
                        url: s.url,
                        quality: s.quality === 'auto' ? 'Auto' : s.quality,
                        headers: Object.assign({}, HEADERS, ref),
                    };
                });
            }
        }
    }

    console.log('[FaselHDX] No streams found from any domain');
    return [];
}
