import { HEADERS, fetchText, fetchPost, getBaseUrl } from './http.js';

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB = 'https://api.themoviedb.org/3';
var _cache = {};

// ── TMDB title lookup ────────────────────────────────────────────────────

async function tmdbTitle(tmdbId, mediaType) {
    var k = tmdbId + mediaType;
    if (_cache[k]) return _cache[k];
    var path = mediaType === 'movie' ? 'movie' : 'tv';
    var r = await fetch(TMDB + '/' + path + '/' + tmdbId + '?api_key=' + TMDB_KEY, {
        headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error('TMDB ' + r.status);
    var d = await r.json();
    var title = mediaType === 'tv' ? (d.name || '') : (d.title || '');
    var year = (mediaType === 'tv' ? d.first_air_date : d.release_date || '').split('-')[0] || '';
    var res = { title: title, year: year };
    _cache[k] = res;
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
    try {
        var html = await fetchPost(
            base + '/wp-admin/admin-ajax.php',
            'action=dtc_live&trsearch=' + encodeURIComponent(query),
            { Referer: base + '/' }
        );
        var urls = extractHrefs(html);
        if (urls.length) return urls;
    } catch(e) { /* ignore */ }

    // Standard search
    try {
        var html2 = await fetchText(base + '/?s=' + encodeURIComponent(query), { Referer: base + '/' });
        return extractHrefs(html2);
    } catch(e) { /* ignore */ }

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
    var html = await fetchText(pageUrl, { Referer: base + '/' });

    // Find season divs
    var divRe = /<div[^>]*class="[^"]*\bseasonDiv\b[^"]*"[^>]*>/gi;
    var divs = [], dm;
    while ((dm = divRe.exec(html)) !== null) divs.push({ idx: dm.index, tag: dm[0] });

    if (divs.length === 0) {
        // Maybe direct episode listing
        var links = epLinks(html);
        return pickEpisode(links, episode);
    }

    var si = Math.max(0, Math.min(parseInt(season, 10) - 1, divs.length - 1));
    var start = divs[si].idx;
    var end = si + 1 < divs.length ? divs[si + 1].idx : html.length;
    var block = html.substring(start, end);
    var links = epLinks(block);

    // If no episodes in block, check onclick for season sub-page
    if (!links.length) {
        var pm = divs[si].tag.match(/onclick="[^"]*['"]([^'"]*\?p=\d+)['"]/i);
        if (pm) {
            var sUrl = pm[1];
            if (!/^https?:/.test(sUrl)) sUrl = base + sUrl;
            try {
                var sHtml = await fetchText(sUrl, { Referer: pageUrl });
                links = epLinks(sHtml);
            } catch(e) { /* ignore */ }
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
    script = script.replace(/\['test'\]\(this\['[^']+'\]\['toString'\]\(\)\)/g, "['test'](\"function(){return'x'}\")");
    // Cap infinite loops
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
    } catch(e) { /* sandbox error */ }
    return captured;
}

async function extractFromPlayer(playerUrl, referer, base) {
    var html = await fetchText(playerUrl, { Referer: referer, Origin: base });
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
    var base = getBaseUrl();
    var meta = await tmdbTitle(tmdbId, mediaType);
    if (!meta.title) return [];

    // Search
    var urls = await search(meta.title, base);
    if (!urls.length && meta.year) urls = await search(meta.title + ' ' + meta.year, base);
    if (!urls.length) return [];

    var pageUrl = pickBest(urls, mediaType, meta.title);
    if (!pageUrl) return [];

    // For TV: resolve to specific episode
    if (mediaType === 'tv' && season && episode && /\/(series|seasons|anime)\//.test(pageUrl)) {
        var epUrl = await resolveEpisode(pageUrl, season, episode, base);
        if (epUrl) pageUrl = epUrl;
    }

    // Fetch the content page and find player iframes
    var html = await fetchText(pageUrl, { Referer: base + '/' });
    var players = playerUrls(html);
    if (!players.length) return [];

    // Extract streams from first working player
    for (var i = 0; i < players.length; i++) {
        try {
            var streams = await extractFromPlayer(players[i], pageUrl, base);
            if (streams.length) {
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
        } catch(e) { /* try next */ }
    }

    return [];
}
