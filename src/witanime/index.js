// WitAnime Nuvio Provider v5.1 — Client-side embed resolution + server-proxied blocked hosts
// Backend returns raw embed URLs via /embeds endpoint.
// This provider resolves them on-device so IP-locked tokens match the user's IP.
// For ISP-blocked hosts (mp4upload), backend pre-resolves and provides proxy URLs.
// v5.1: Honest quality labels (FHD/HD/SD as-is, no fake resolution mapping)

var BACKEND_URL = 'https://witanime-backend.onrender.com';
var UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

// ── Fetch helper ─────────────────────────────────────────────────────────

async function fetchHtml(url, opts) {
    opts = opts || {};
    var headers = {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,*/*',
    };
    if (opts.referer) headers['Referer'] = opts.referer;
    if (opts.headers) {
        var keys = Object.keys(opts.headers);
        for (var i = 0; i < keys.length; i++) {
            headers[keys[i]] = opts.headers[keys[i]];
        }
    }

    var controller;
    var timeoutId;
    try {
        controller = new AbortController();
        timeoutId = setTimeout(function() { controller.abort(); }, opts.timeout || 12000);
    } catch (e) { controller = null; }

    try {
        var fetchOpts = {
            method: 'GET',
            headers: headers,
            redirect: 'follow',
        };
        if (controller) fetchOpts.signal = controller.signal;

        var response = await fetch(url, fetchOpts);
        if (timeoutId) clearTimeout(timeoutId);
        if (!response.ok) return '';
        return await response.text();
    } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        console.log('[WitAnime] fetchHtml error: ' + e.message);
        return '';
    }
}

// ── PACK Unpacker (for file-upload.org embeds) ──────────────────────────

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

// ── Client-side Embed Resolvers ─────────────────────────────────────────
// Each resolver fetches the embed page HTML and extracts the actual stream URL.
// Since this runs on the user's device, IP-locked tokens will work.

async function resolveUqload(embedUrl) {
    var html = await fetchHtml(embedUrl, { referer: 'https://uqload.is/' });
    if (!html) return null;

    // Pattern: sources: ["https://...mp4..."]
    var m = html.match(/sources\s*:\s*\["(https?:\/\/[^"]+\.mp4[^"]*)"\]/i);
    if (m) {
        return {
            url: m[1],
            type: 'mp4',
            headers: { 'Referer': 'https://uqload.is/' },
        };
    }
    return null;
}

async function resolveLarhu(embedUrl) {
    var html = await fetchHtml(embedUrl, { referer: embedUrl });
    if (!html) return null;

    // HLS stream — m3u8 URL in page
    var m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (m) {
        return {
            url: m[0],
            type: 'hls',
            headers: { 'Referer': embedUrl },
        };
    }
    return null;
}

async function resolveVidmoly(embedUrl) {
    var html = await fetchHtml(embedUrl, { referer: embedUrl });
    if (!html) return null;

    // Try file/source: "...m3u8..." pattern first
    var m = html.match(/(?:file|source)\s*:\s*["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/i);
    if (m) {
        return {
            url: m[1],
            type: 'hls',
            headers: { 'Referer': embedUrl },
        };
    }

    // Fallback: any m3u8 URL
    m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (m) {
        return {
            url: m[0],
            type: 'hls',
            headers: { 'Referer': embedUrl },
        };
    }

    // PACK obfuscated
    if (html.indexOf('eval(function(p,a,c,k,e,d)') > -1) {
        var dec = unpackPACK(html);
        if (dec) {
            var pm = dec.match(/(?:file|source)\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
            if (pm) {
                return {
                    url: pm[1],
                    type: 'hls',
                    headers: { 'Referer': embedUrl },
                };
            }
        }
    }
    return null;
}

async function resolveMp4upload(embedUrl) {
    var html = await fetchHtml(embedUrl, { referer: embedUrl });
    if (!html) return null;

    // Pattern: src: "https://...mp4..."
    var m = html.match(/src:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
    if (m) {
        return {
            url: m[1],
            type: 'mp4',
            headers: { 'Referer': embedUrl },
        };
    }

    // Fallback: PACK obfuscated
    if (html.indexOf('eval(function(p,a,c,k,e,d)') > -1) {
        var dec = unpackPACK(html);
        if (dec) {
            var pm = dec.match(/src:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
            if (pm) {
                return {
                    url: pm[1],
                    type: 'mp4',
                    headers: { 'Referer': embedUrl },
                };
            }
        }
    }
    return null;
}

async function resolveFileUpload(embedUrl) {
    var html = await fetchHtml(embedUrl, { referer: embedUrl });
    if (!html) return null;

    // PACK obfuscated → unpack → extract mp4
    if (html.indexOf('eval(function(p,a,c,k,e,d)') > -1) {
        var dec = unpackPACK(html);
        if (dec) {
            var m = dec.match(/file\s*:\s*"(https?:\/\/[^"]+\.mp4[^"]*)"/i)
                || dec.match(/"(https?:\/\/f\d+\.file-upload\.org[^"]+\.mp4[^"]*)"/i);
            if (m) {
                return {
                    url: m[1],
                    type: 'mp4',
                    headers: { 'Referer': embedUrl },
                };
            }
        }
    }

    // Direct URL match
    var m2 = html.match(/https?:\/\/f\d+\.file-upload\.org[^\s"'<>]+\.mp4/i);
    if (m2) {
        return {
            url: m2[0],
            type: 'mp4',
            headers: { 'Referer': embedUrl },
        };
    }
    return null;
}

async function resolveVoe(embedUrl) {
    var html = await fetchHtml(embedUrl, { referer: embedUrl });
    if (!html) return null;

    // HLS first
    var m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (m) {
        return {
            url: m[0],
            type: 'hls',
            headers: { 'Referer': embedUrl },
        };
    }

    // mp4 fallback
    var mp4 = html.match(/(?:source|src|file)\s*[:=]\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
    if (mp4) {
        return {
            url: mp4[1],
            type: 'mp4',
            headers: { 'Referer': embedUrl },
        };
    }
    return null;
}

// Generic resolver — try common patterns
async function resolveGeneric(embedUrl) {
    var html = await fetchHtml(embedUrl, { referer: embedUrl });
    if (!html) return null;

    // JS redirect
    if (html.length < 1000) {
        var redir = html.match(/window\.location\.replace\(['"]([^'"]+)['"]\)/);
        if (redir) {
            html = await fetchHtml(redir[1], { referer: embedUrl });
            if (!html) return null;
        }
    }

    // m3u8
    var m = html.match(/(?:file|source)\s*:\s*["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/i);
    if (m) return { url: m[1], type: 'hls', headers: { 'Referer': embedUrl } };

    m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (m) return { url: m[0], type: 'hls', headers: { 'Referer': embedUrl } };

    // PACK
    if (html.indexOf('eval(function(p,a,c,k,e,d)') > -1) {
        var dec = unpackPACK(html);
        if (dec) {
            var pm = dec.match(/(?:file|source)\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
            if (pm) return { url: pm[1], type: 'hls', headers: { 'Referer': embedUrl } };
            var pmp4 = dec.match(/(?:file|source)\s*:\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/);
            if (pmp4) return { url: pmp4[1], type: 'mp4', headers: { 'Referer': embedUrl } };
        }
    }

    // mp4
    var mp4 = html.match(/(?:src|file|source)\s*[:=]\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
    if (mp4) return { url: mp4[1], type: 'mp4', headers: { 'Referer': embedUrl } };

    return null;
}

// Route embed to correct resolver based on hostname
async function resolveEmbed(embed) {
    var host = embed.host || '';
    var url = embed.url || '';

    try {
        if (host.indexOf('larhu') > -1) return await resolveLarhu(url);
        if (host.indexOf('uqload') > -1) return await resolveUqload(url);
        if (host.indexOf('vidmoly') > -1) return await resolveVidmoly(url);
        if (host.indexOf('mp4upload') > -1) return await resolveMp4upload(url);
        if (host.indexOf('file-upload') > -1) return await resolveFileUpload(url);
        if (host.indexOf('voe') > -1) return await resolveVoe(url);
        // Generic fallback
        return await resolveGeneric(url);
    } catch (e) {
        console.log('[WitAnime] Resolve error for ' + host + ': ' + e.message);
        return null;
    }
}

// ── Main getStreams ──────────────────────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log('[WitAnime] Request: ' + mediaType + ' ' + tmdbId + ' S' + (season || 0) + 'E' + (episode || 0));

        // Build the request ID (same format as /streams/)
        var id = String(tmdbId);
        if (mediaType !== 'movie' && season && episode) {
            id = tmdbId + ':' + season + ':' + episode;
        }

        var type = mediaType === 'movie' ? 'movie' : 'series';
        var url = BACKEND_URL + '/embeds/' + type + '/' + id + '.json';

        console.log('[WitAnime] Fetching embeds: ' + url);

        // Fetch embed URLs from backend
        var controller;
        var timeoutId;
        try {
            controller = new AbortController();
            timeoutId = setTimeout(function() { controller.abort(); }, 45000);
        } catch (e) { controller = null; }

        var fetchOpts = {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'User-Agent': 'NuvioApp/1.0' },
        };
        if (controller) fetchOpts.signal = controller.signal;

        var response = await fetch(url, fetchOpts);
        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
            console.log('[WitAnime] Backend returned status ' + response.status);
            return [];
        }

        var data = await response.json();
        var embeds = data.embeds || [];
        console.log('[WitAnime] Got ' + embeds.length + ' embed(s) from backend');

        if (embeds.length === 0) return [];

        // Prioritize embeds:
        // 1. Server-resolved proxy embeds (guaranteed to work, no ISP blocks)
        // 2. HLS-capable hosts (no IP-lock issues)
        // 3. MP4 hosts (client-resolved)
        var hlsHosts = ['larhu', 'vidmoly', 'voe'];
        var mp4Hosts = ['uqload', 'file-upload'];

        var sorted = [];
        // Pre-resolved proxy embeds first (highest priority — always work)
        for (var i = 0; i < embeds.length; i++) {
            if (embeds[i].resolved && embeds[i].proxyUrl) sorted.push(embeds[i]);
        }
        // HLS hosts second (FHD, no IP-lock issues with HLS)
        for (var i = 0; i < embeds.length; i++) {
            if (embeds[i].resolved) continue; // already added
            var h = embeds[i].host || '';
            for (var j = 0; j < hlsHosts.length; j++) {
                if (h.indexOf(hlsHosts[j]) > -1) { sorted.push(embeds[i]); break; }
            }
        }
        // Then mp4 hosts
        for (var i = 0; i < embeds.length; i++) {
            if (embeds[i].resolved) continue; // already added
            var h = embeds[i].host || '';
            var isHls = false;
            for (var j = 0; j < hlsHosts.length; j++) {
                if (h.indexOf(hlsHosts[j]) > -1) { isHls = true; break; }
            }
            if (!isHls) sorted.push(embeds[i]);
        }

        // Resolve embeds on-device (max 6 to keep it fast)
        var limit = Math.min(sorted.length, 6);
        var streams = [];

        // Resolve in parallel using Promise.all (much faster than sequential)
        var promises = [];
        for (var i = 0; i < limit; i++) {
            promises.push(resolveWithMeta(sorted[i]));
        }

        var results = await Promise.all(promises);
        for (var i = 0; i < results.length; i++) {
            if (results[i]) streams.push(results[i]);
        }

        console.log('[WitAnime] Resolved ' + streams.length + ' stream(s)');
        return streams;
    } catch (error) {
        console.error('[WitAnime] Error: ' + error.message);
        return [];
    }
}

// Resolve a single embed and wrap with stream metadata
async function resolveWithMeta(embed) {
    try {
        // Quality label: use anime4up's label as-is (FHD/HD/SD) — don't convert to
        // resolution numbers since anime4up labels are often inaccurate
        var qualityLabel = embed.quality || 'HD';

        // If the backend already resolved this (blocked host), use the proxy URL directly
        if (embed.resolved && embed.proxyUrl) {
            var serverName = (embed.name || getHostName(embed.host)) + ' (Proxy)';
            console.log('[WitAnime] Using server-proxied stream: ' + embed.host + ' [' + qualityLabel + ']');
            return {
                name: 'Anime4up',
                title: serverName + ' [' + qualityLabel + ']',
                url: embed.proxyUrl,
                quality: qualityLabel,
                headers: {},
            };
        }

        var result = await resolveEmbed(embed);
        if (!result || !result.url) return null;

        var serverName = embed.name || getHostName(embed.host);

        return {
            name: 'Anime4up',
            title: serverName + ' [' + qualityLabel + ']',
            url: result.url,
            quality: qualityLabel,
            headers: result.headers || {},
        };
    } catch (e) {
        console.log('[WitAnime] resolveWithMeta error: ' + e.message);
        return null;
    }
}

function getHostName(host) {
    if (!host) return 'Server';
    if (host.indexOf('larhu') > -1) return 'Larhu';
    if (host.indexOf('uqload') > -1) return 'Uqload';
    if (host.indexOf('vidmoly') > -1) return 'Vidmoly';
    if (host.indexOf('mp4upload') > -1) return 'MP4Upload';
    if (host.indexOf('file-upload') > -1) return 'FileUpload';
    if (host.indexOf('voe') > -1) return 'Voe';
    // Extract from hostname
    var parts = host.split('.');
    if (parts.length >= 2) return parts[parts.length - 2];
    return 'Server';
}

module.exports = { getStreams };
