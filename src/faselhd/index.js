// FaselHD v12.0.0 — Full client-side scraper, NO backend dependency
// Arabic Hard Sub streams from FaselHD CDN (scdns.io)
// EasyPlex API → fasel-hd.cam → player_token → obfuscated JS → scdns.io m3u8
// Streams are IP-locked to fetching device — no proxy needed.

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB_BASE = 'https://api.themoviedb.org/3';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
var FETCH_TIMEOUT = 12000;
var GLOBAL_TIMEOUT = 20000;

// EasyPlex API backends (map TMDB ID → fasel-hd.cam page URL)
var EASYPLEX_BASES = [
    { host: 'fashd.com', path: '/faselhd15/public/api' },
    { host: 'flech.tn', path: '/egybestantoo/public/api' },
    { host: 'hrrejgh.com', path: '/wecima15/public/api' },
    { host: 'www.hrrejhp.com', path: '/egybestanto/public/api' },
];

// ── Fetch helpers ──────────────────────────────────────────────────────

function safeFetch(url, options, timeout) {
    var ms = timeout || FETCH_TIMEOUT;
    var controller;
    var tid;
    try {
        controller = new AbortController();
        tid = setTimeout(function() { controller.abort(); }, ms);
    } catch (e) { controller = null; }
    var opts = options || {};
    if (controller) opts.signal = controller.signal;
    if (!opts.headers) opts.headers = {};
    if (!opts.headers['User-Agent']) opts.headers['User-Agent'] = UA;
    return fetch(url, opts)
        .then(function(r) { if (tid) clearTimeout(tid); return r; })
        .catch(function(e) { if (tid) clearTimeout(tid); throw e; });
}

function fetchJSON(url, headers) {
    return safeFetch(url, { headers: headers || {} })
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function() { return null; });
}

function fetchText(url, headers) {
    return safeFetch(url, { headers: headers || {} })
        .then(function(r) { return r.ok ? r.text() : null; })
        .catch(function() { return null; });
}

// ── EasyPlex API with fallback backends ────────────────────────────────

function easyplexFetch(endpoint) {
    var idx = 0;
    function tryNext() {
        if (idx >= EASYPLEX_BASES.length) return Promise.resolve(null);
        var base = EASYPLEX_BASES[idx];
        idx++;
        var url = 'https://' + base.host + base.path + '/' + endpoint;
        return fetchJSON(url).then(function(data) {
            if (data) {
                if (typeof data === 'string') {
                    var s = data.trim();
                    if (s === 'Non autoris\u00e9' || s === 'Merci' || s === 'Non autorise\u0301') {
                        return tryNext();
                    }
                }
                return data;
            }
            return tryNext();
        }).catch(function() { return tryNext(); });
    }
    return tryNext();
}

// ── Resolve TMDB ID → FaselHD page URL via EasyPlex ───────────────────

async function resolveFaselPageUrl(tmdbId, mediaType, season, episode) {
    var tmdbType = mediaType === 'movie' ? 'movie' : 'tv';
    var tmdbUrl = TMDB_BASE + '/' + tmdbType + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=en';
    var tmdbData = await fetchJSON(tmdbUrl);
    if (!tmdbData) return null;

    var title = tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name || '';
    if (!title) return null;
    console.log('[FaselHD] TMDB: ' + title);

    async function searchByTitle(searchTitle) {
        var data = await easyplexFetch('search/' + encodeURIComponent(searchTitle) + '/0');
        if (!data) return null;
        var items = data.search || data.data || [];
        if (Array.isArray(data)) items = data;
        for (var i = 0; i < items.length; i++) {
            if (String(items[i].tmdb_id) === String(tmdbId)) return items[i];
        }
        return null;
    }

    var match = await searchByTitle(title);
    if (!match) {
        var origTitle = tmdbData.original_title || tmdbData.original_name || '';
        if (origTitle && origTitle !== title) {
            match = await searchByTitle(origTitle);
        }
    }
    if (!match) { console.log('[FaselHD] No EasyPlex match'); return null; }
    console.log('[FaselHD] Match id=' + match.id);

    var videos = [];
    if (mediaType === 'movie') {
        var detail = await easyplexFetch('media/detail/' + match.id + '/0');
        if (detail) videos = detail.videos || [];
    } else {
        var show = await easyplexFetch('series/show/' + match.id + '/0');
        if (!show) return null;
        var seasons = show.seasons || [];
        var targetSeason = null;
        for (var i = 0; i < seasons.length; i++) {
            if (String(seasons[i].season_number) === String(season)) { targetSeason = seasons[i]; break; }
        }
        if (!targetSeason) { console.log('[FaselHD] Season ' + season + ' not found'); return null; }

        var seasonData = await easyplexFetch('series/season/' + targetSeason.id + '/0');
        if (!seasonData) return null;
        var episodes = seasonData.episodes || [];
        var targetEp = null;
        for (var j = 0; j < episodes.length; j++) {
            if (String(episodes[j].episode_number) === String(episode)) { targetEp = episodes[j]; break; }
        }
        if (!targetEp) { console.log('[FaselHD] Episode ' + episode + ' not found'); return null; }
        videos = targetEp.videos || [];
    }

    for (var v = 0; v < videos.length; v++) {
        var link = videos[v].link || '';
        if (link.indexOf('fasel-hd') !== -1 || link.indexOf('faselhd') !== -1) {
            console.log('[FaselHD] Page: ' + link.substring(0, 80));
            return link;
        }
    }
    console.log('[FaselHD] No fasel link in ' + videos.length + ' videos');
    return null;
}

// ── Extract player tokens from FaselHD page ───────────────────────────

async function extractPlayerTokens(faselUrl) {
    var html = await fetchText(faselUrl, {
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'ar,en;q=0.8',
        'Referer': 'https://fasel-hd.cam/',
    });
    if (!html) return null;

    var tokenMatches = html.match(/player_token=([A-Za-z0-9+/=%]+)/g);
    if (!tokenMatches || !tokenMatches.length) {
        console.log('[FaselHD] No player_token in page');
        return null;
    }

    var seen = {};
    var tokens = [];
    for (var i = 0; i < tokenMatches.length; i++) {
        var m = tokenMatches[i].match(/player_token=([A-Za-z0-9+/=%]+)/);
        if (m && !seen[m[1]]) { seen[m[1]] = true; tokens.push(m[1]); }
    }

    var hostMatch = html.match(/https?:\/\/(web[0-9]+x?\.[a-z0-9.-]+)/i);
    var hostname = hostMatch ? hostMatch[1] : null;
    if (!hostname) {
        var fhMatch = html.match(/https?:\/\/([a-z0-9.-]*faselhdx[a-z0-9.-]*)/i);
        hostname = fhMatch ? fhMatch[1] : null;
    }

    console.log('[FaselHD] ' + tokens.length + ' token(s), host=' + hostname);
    return { tokens: tokens, hostname: hostname };
}

// ── Execute obfuscated player script to capture stream URLs ───────────
// Temporarily injects stub globals onto globalThis, runs via indirect eval,
// then restores originals. The obfuscated code uses (function(x){...})(this)
// where 'this' must resolve to the global object.

function executePlayerScript(scriptContent) {
    var g = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : {}));

    var saved = {};
    var STUB_KEYS = ['document', 'jwplayer', 'Hls', 'navigator', 'location', 'screen',
        'jQuery', '$', 'XMLHttpRequest'];

    for (var k = 0; k < STUB_KEYS.length; k++) {
        var key = STUB_KEYS[k];
        if (key in g) saved[key] = g[key];
    }

    var capturedUrl = null;
    var capturedConfig = null;

    var fakeVideo = {
        canPlayType: function(t) { return /mpegurl|mp4/i.test(t) ? 'probably' : ''; },
    };
    Object.defineProperty(fakeVideo, 'src', {
        set: function(v) { capturedUrl = v; },
        get: function() { return capturedUrl || ''; },
        configurable: true,
    });

    var elStub = {
        style: {}, innerHTML: '', setAttribute: function() {}, getAttribute: function() { return ''; },
        appendChild: function() { return this; }, removeChild: function() {},
        addEventListener: function() {}, removeEventListener: function() {},
        classList: { add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() {} },
        canPlayType: function(t) { return /mpegurl|mp4/i.test(t) ? 'probably' : ''; },
        src: '', querySelector: function() { return null; }, querySelectorAll: function() { return []; },
        children: [], childNodes: [], insertBefore: function() {},
        getBoundingClientRect: function() { return { top: 0, left: 0, width: 1920, height: 1080 }; },
        offsetWidth: 1920, offsetHeight: 1080, cloneNode: function() { return elStub; },
        play: function() { return Promise.resolve(); }, pause: function() {}, load: function() {},
        focus: function() {}, blur: function() {}, click: function() {}, dispatchEvent: function() {},
        getContext: function() { return { fillRect: function() {}, clearRect: function() {}, drawImage: function() {} }; },
        toDataURL: function() { return ''; }, width: 0, height: 0,
    };

    g.document = {
        getElementById: function() { return fakeVideo; },
        createElement: function(t) { var e = {}; for (var k in elStub) e[k] = elStub[k]; e.tagName = (t || '').toUpperCase(); return e; },
        createDocumentFragment: function() { return elStub; },
        querySelectorAll: function() { return [{ children: [null, null, null], insertBefore: function() {} }]; },
        querySelector: function() { return null; },
        getElementsByTagName: function(t) { return t === 'head' ? [{ appendChild: function() {} }] : []; },
        getElementsByClassName: function() { return []; },
        createTextNode: function() { return { textContent: '' }; },
        createEvent: function() { return { initEvent: function() {} }; },
        createElementNS: function(ns, t) { return g.document.createElement(t); },
        cookie: '', body: elStub, head: { appendChild: function() {}, removeChild: function() {} },
        documentElement: elStub, addEventListener: function() {}, removeEventListener: function() {},
        readyState: 'complete', title: '', domain: '', referrer: '', URL: '', baseURI: '',
        implementation: { hasFeature: function() { return false; } },
    };

    var fakePlayer = {
        setup: function(cfg) { capturedConfig = cfg; return fakePlayer; },
        on: function() { return fakePlayer; }, load: function() { return fakePlayer; },
        play: function() { return fakePlayer; }, seek: function() { return fakePlayer; },
        pause: function() { return fakePlayer; }, stop: function() { return fakePlayer; },
        getPosition: function() { return 0; }, getState: function() { return 'idle'; },
        getDuration: function() { return 0; }, getFullscreen: function() { return false; },
        setCurrentQuality: function() { return fakePlayer; },
        getQualityLevels: function() { return []; }, addButton: function() { return fakePlayer; },
        getBuffer: function() { return 0; }, getMute: function() { return false; },
        setMute: function() { return fakePlayer; }, getVolume: function() { return 100; },
        setVolume: function() { return fakePlayer; }, resize: function() { return fakePlayer; },
        remove: function() { return fakePlayer; },
    };
    g.jwplayer = function() { return fakePlayer; };
    g.jwplayer.key = '';

    g.Hls = function() {};
    g.Hls.isSupported = function() { return true; };
    g.Hls.prototype = { loadSource: function(s) { capturedUrl = s; }, attachMedia: function() {} };

    g.navigator = { userAgent: UA, platform: 'Win32' };
    g.location = { href: 'https://x/', hostname: 'x', protocol: 'https:', origin: 'https://x', host: 'x', pathname: '/', search: '', hash: '' };
    g.screen = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080 };

    var jqMethods = ['on', 'off', 'fadeOut', 'fadeIn', 'removeClass', 'addClass', 'attr', 'css', 'html', 'text', 'val', 'show', 'hide', 'find', 'each', 'append', 'prepend', 'remove', 'click', 'ready', 'insertBefore'];
    function jqFactory() {
        var o = { length: 0 };
        for (var i = 0; i < jqMethods.length; i++) {
            (function(m) {
                o[m] = function(fn) {
                    if (typeof fn === 'function' && m === 'ready') try { fn(); } catch (e) {}
                    return o;
                };
            })(jqMethods[i]);
        }
        return o;
    }
    g.$ = jqFactory;
    g.jQuery = jqFactory;
    g.XMLHttpRequest = function() {
        return { open: function() {}, send: function() {}, setRequestHeader: function() {}, addEventListener: function() {}, readyState: 4, status: 200, responseText: '{}' };
    };

    try {
        (0, eval)(scriptContent);
    } catch (e) {
        console.log('[FaselHD] Script exec error: ' + e.message);
    }

    for (var k2 = 0; k2 < STUB_KEYS.length; k2++) {
        var key2 = STUB_KEYS[k2];
        if (key2 in saved) {
            g[key2] = saved[key2];
        } else {
            delete g[key2];
        }
    }

    return { url: capturedUrl, config: capturedConfig };
}

// ── Extract streams from a single player token ────────────────────────

async function extractStreamsFromToken(token, hostname) {
    var playerUrl = 'https://' + hostname + '/video_player?player_token=' + encodeURIComponent(token);
    var html = await fetchText(playerUrl, {
        'Referer': 'https://' + hostname + '/',
        'Accept': 'text/html,application/xhtml+xml,*/*',
    });
    if (!html) return [];

    var scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    var sm;
    var results = [];

    while ((sm = scriptRe.exec(html)) !== null) {
        var sc = sm[1].trim();
        if (sc.length < 1000 || sc.indexOf('_0x') === -1) continue;

        var result = executePlayerScript(sc);

        if (result.url && result.url.indexOf('scdns') !== -1) {
            console.log('[FaselHD] Captured: ' + result.url.substring(0, 100));
            var quality = 'auto';
            if (/1080/.test(result.url)) quality = '1080p';
            else if (/720/.test(result.url)) quality = '720p';
            else if (/480/.test(result.url)) quality = '480p';
            else if (/360/.test(result.url)) quality = '480p';
            results.push({ url: result.url, quality: quality });
        }

        if (result.config) {
            var sources = result.config.sources || [];
            if (result.config.playlist) {
                for (var p = 0; p < result.config.playlist.length; p++) {
                    var pl = result.config.playlist[p];
                    if (pl.sources) sources = sources.concat(pl.sources);
                    if (pl.file) sources.push({ file: pl.file, label: pl.label || 'auto' });
                }
            }
            for (var s = 0; s < sources.length; s++) {
                var fileUrl = sources[s].file || sources[s].src || '';
                if (!fileUrl) continue;
                console.log('[FaselHD] JWP: ' + fileUrl.substring(0, 100));
                results.push({ url: fileUrl, quality: 'auto', isMaster: true });
            }
        }
    }

    return results;
}

// ── Main resolver ─────────────────────────────────────────────────────

async function resolveStreams(mediaType, tmdbId, season, episode) {
    var t0 = Date.now();

    var faselUrl = await resolveFaselPageUrl(tmdbId, mediaType, season, episode);
    if (!faselUrl) return [];
    console.log('[FaselHD] Resolve in ' + (Date.now() - t0) + 'ms');

    var tokenResult = await extractPlayerTokens(faselUrl);
    if (!tokenResult || !tokenResult.tokens.length || !tokenResult.hostname) return [];
    console.log('[FaselHD] Tokens in ' + (Date.now() - t0) + 'ms');

    var rawStreams = [];
    for (var i = 0; i < Math.min(tokenResult.tokens.length, 2); i++) {
        var streams = await extractStreamsFromToken(tokenResult.tokens[i], tokenResult.hostname);
        if (streams.length > 0) {
            rawStreams = rawStreams.concat(streams);
            if (streams.some(function(s) { return s.isMaster; })) break;
        }
    }
    console.log('[FaselHD] Extract in ' + (Date.now() - t0) + 'ms');

    if (!rawStreams.length) {
        console.log('[FaselHD] No streams');
        return [];
    }

    var seen = {};
    var result = [];
    var faselHeaders = {
        'User-Agent': UA,
        'Referer': 'https://' + tokenResult.hostname + '/',
        'Origin': 'https://' + tokenResult.hostname,
    };

    for (var j = 0; j < rawStreams.length; j++) {
        var raw = rawStreams[j];
        if (seen[raw.url]) continue;
        seen[raw.url] = true;

        result.push({
            name: 'FaselHD',
            title: 'FaselHD - ' + raw.quality + ' (Arabic Hard Sub)',
            url: raw.url,
            quality: raw.quality,
            size: 'Unknown',
            headers: faselHeaders,
            subtitles: [],
            provider: 'faselhd',
        });
    }

    console.log('[FaselHD] ' + result.length + ' streams in ' + (Date.now() - t0) + 'ms');
    return result;
}

// ── Entry point ───────────────────────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
    var t0 = Date.now();
    console.log('[FaselHD] === ' + mediaType + '/' + tmdbId + (mediaType !== 'movie' ? ' S' + season + 'E' + episode : '') + ' ===');

    try {
        var timeoutP = new Promise(function(resolve) {
            setTimeout(function() { resolve([]); }, GLOBAL_TIMEOUT);
        });

        var mainP = resolveStreams(
            mediaType, tmdbId,
            season ? parseInt(season, 10) : undefined,
            episode ? parseInt(episode, 10) : undefined
        ).catch(function(e) { console.log('[FaselHD] Error: ' + e.message); return []; });

        var streams = await Promise.race([mainP, timeoutP]);
        console.log('[FaselHD] === Done: ' + streams.length + ' streams in ' + (Date.now() - t0) + 'ms ===');
        return streams;
    } catch (error) {
        console.error('[FaselHD] Fatal: ' + error.message);
        return [];
    }
}

module.exports = { getStreams };
