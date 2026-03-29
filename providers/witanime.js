/**
 * witanime - Built from src/witanime/
 * Generated: 2026-03-29T17:37:25.070Z
 */
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/witanime/index.js
var BACKEND_URL = "https://witanime-backend.onrender.com";
var UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
function fetchHtml(url, opts) {
  return __async(this, null, function* () {
    opts = opts || {};
    var headers = {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,*/*"
    };
    if (opts.referer)
      headers["Referer"] = opts.referer;
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
      timeoutId = setTimeout(function() {
        controller.abort();
      }, opts.timeout || 12e3);
    } catch (e) {
      controller = null;
    }
    try {
      var fetchOpts = {
        method: "GET",
        headers,
        redirect: "follow"
      };
      if (controller)
        fetchOpts.signal = controller.signal;
      var response = yield fetch(url, fetchOpts);
      if (timeoutId)
        clearTimeout(timeoutId);
      if (!response.ok)
        return "";
      return yield response.text();
    } catch (e) {
      if (timeoutId)
        clearTimeout(timeoutId);
      console.log("[WitAnime] fetchHtml error: " + e.message);
      return "";
    }
  });
}
function unpackPACK(html) {
  var evalIdx = html.indexOf("eval(function(p,a,c,k,e,d)");
  if (evalIdx < 0)
    return "";
  var splitIdx = html.indexOf(".split('|')", evalIdx);
  if (splitIdx < 0)
    return "";
  var dqs = html.lastIndexOf(",'", splitIdx);
  if (dqs < 0)
    return "";
  var dict = html.substring(dqs + 2, splitIdx);
  if (dict[0] === "'")
    dict = dict.substring(1);
  if (dict[dict.length - 1] === "'")
    dict = dict.substring(0, dict.length - 1);
  var words = dict.split("|");
  var bs = html.indexOf("}('", evalIdx);
  if (bs < 0)
    return "";
  bs += 3;
  var bd = html.substring(bs, dqs);
  var mt = bd.match(/^([\s\S]*)',\s*(\d+)\s*,\s*(\d+)\s*$/);
  if (!mt)
    return "";
  var payload = mt[1];
  var base = parseInt(mt[2], 10);
  var count = parseInt(mt[3], 10);
  var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function enc(v) {
    if (v === 0)
      return "0";
    var r = "";
    while (v > 0) {
      r = chars[v % base] + r;
      v = Math.floor(v / base);
    }
    return r;
  }
  var d = {};
  while (count--) {
    var e = enc(count);
    d[e] = words[count] || e;
  }
  return payload.replace(/\b(\w+)\b/g, function(w) {
    return d[w] !== void 0 ? d[w] : w;
  });
}
function resolveUqload(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchHtml(embedUrl, { referer: "https://uqload.is/" });
    if (!html)
      return null;
    var m = html.match(/sources\s*:\s*\["(https?:\/\/[^"]+\.mp4[^"]*)"\]/i);
    if (m) {
      return {
        url: m[1],
        type: "mp4",
        headers: { "Referer": "https://uqload.is/" }
      };
    }
    return null;
  });
}
function resolveLarhu(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchHtml(embedUrl, { referer: embedUrl });
    if (!html)
      return null;
    var m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (m) {
      return {
        url: m[0],
        type: "hls",
        headers: { "Referer": embedUrl }
      };
    }
    return null;
  });
}
function resolveVidmoly(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchHtml(embedUrl, { referer: embedUrl });
    if (!html)
      return null;
    var m = html.match(/(?:file|source)\s*:\s*["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/i);
    if (m) {
      return {
        url: m[1],
        type: "hls",
        headers: { "Referer": embedUrl }
      };
    }
    m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (m) {
      return {
        url: m[0],
        type: "hls",
        headers: { "Referer": embedUrl }
      };
    }
    if (html.indexOf("eval(function(p,a,c,k,e,d)") > -1) {
      var dec = unpackPACK(html);
      if (dec) {
        var pm = dec.match(/(?:file|source)\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
        if (pm) {
          return {
            url: pm[1],
            type: "hls",
            headers: { "Referer": embedUrl }
          };
        }
      }
    }
    return null;
  });
}
function resolveMp4upload(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchHtml(embedUrl, { referer: embedUrl });
    if (!html)
      return null;
    var m = html.match(/src:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
    if (m) {
      return {
        url: m[1],
        type: "mp4",
        headers: { "Referer": embedUrl }
      };
    }
    if (html.indexOf("eval(function(p,a,c,k,e,d)") > -1) {
      var dec = unpackPACK(html);
      if (dec) {
        var pm = dec.match(/src:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
        if (pm) {
          return {
            url: pm[1],
            type: "mp4",
            headers: { "Referer": embedUrl }
          };
        }
      }
    }
    return null;
  });
}
function resolveFileUpload(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchHtml(embedUrl, { referer: embedUrl });
    if (!html)
      return null;
    if (html.indexOf("eval(function(p,a,c,k,e,d)") > -1) {
      var dec = unpackPACK(html);
      if (dec) {
        var m = dec.match(/file\s*:\s*"(https?:\/\/[^"]+\.mp4[^"]*)"/i) || dec.match(/"(https?:\/\/f\d+\.file-upload\.org[^"]+\.mp4[^"]*)"/i);
        if (m) {
          return {
            url: m[1],
            type: "mp4",
            headers: { "Referer": embedUrl }
          };
        }
      }
    }
    var m2 = html.match(/https?:\/\/f\d+\.file-upload\.org[^\s"'<>]+\.mp4/i);
    if (m2) {
      return {
        url: m2[0],
        type: "mp4",
        headers: { "Referer": embedUrl }
      };
    }
    return null;
  });
}
function resolveVoe(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchHtml(embedUrl, { referer: embedUrl });
    if (!html)
      return null;
    var m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (m) {
      return {
        url: m[0],
        type: "hls",
        headers: { "Referer": embedUrl }
      };
    }
    var mp4 = html.match(/(?:source|src|file)\s*[:=]\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
    if (mp4) {
      return {
        url: mp4[1],
        type: "mp4",
        headers: { "Referer": embedUrl }
      };
    }
    return null;
  });
}
function resolveGeneric(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchHtml(embedUrl, { referer: embedUrl });
    if (!html)
      return null;
    if (html.length < 1e3) {
      var redir = html.match(/window\.location\.replace\(['"]([^'"]+)['"]\)/);
      if (redir) {
        html = yield fetchHtml(redir[1], { referer: embedUrl });
        if (!html)
          return null;
      }
    }
    var m = html.match(/(?:file|source)\s*:\s*["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/i);
    if (m)
      return { url: m[1], type: "hls", headers: { "Referer": embedUrl } };
    m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (m)
      return { url: m[0], type: "hls", headers: { "Referer": embedUrl } };
    if (html.indexOf("eval(function(p,a,c,k,e,d)") > -1) {
      var dec = unpackPACK(html);
      if (dec) {
        var pm = dec.match(/(?:file|source)\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
        if (pm)
          return { url: pm[1], type: "hls", headers: { "Referer": embedUrl } };
        var pmp4 = dec.match(/(?:file|source)\s*:\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/);
        if (pmp4)
          return { url: pmp4[1], type: "mp4", headers: { "Referer": embedUrl } };
      }
    }
    var mp4 = html.match(/(?:src|file|source)\s*[:=]\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
    if (mp4)
      return { url: mp4[1], type: "mp4", headers: { "Referer": embedUrl } };
    return null;
  });
}
function resolveEmbed(embed) {
  return __async(this, null, function* () {
    var host = embed.host || "";
    var url = embed.url || "";
    try {
      if (host.indexOf("larhu") > -1)
        return yield resolveLarhu(url);
      if (host.indexOf("uqload") > -1)
        return yield resolveUqload(url);
      if (host.indexOf("vidmoly") > -1)
        return yield resolveVidmoly(url);
      if (host.indexOf("mp4upload") > -1)
        return yield resolveMp4upload(url);
      if (host.indexOf("file-upload") > -1)
        return yield resolveFileUpload(url);
      if (host.indexOf("voe") > -1)
        return yield resolveVoe(url);
      return yield resolveGeneric(url);
    } catch (e) {
      console.log("[WitAnime] Resolve error for " + host + ": " + e.message);
      return null;
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[WitAnime] Request: " + mediaType + " " + tmdbId + " S" + (season || 0) + "E" + (episode || 0));
      var id = String(tmdbId);
      if (mediaType !== "movie" && season && episode) {
        id = tmdbId + ":" + season + ":" + episode;
      }
      var type = mediaType === "movie" ? "movie" : "series";
      var url = BACKEND_URL + "/embeds/" + type + "/" + id + ".json";
      console.log("[WitAnime] Fetching embeds: " + url);
      var controller;
      var timeoutId;
      try {
        controller = new AbortController();
        timeoutId = setTimeout(function() {
          controller.abort();
        }, 45e3);
      } catch (e) {
        controller = null;
      }
      var fetchOpts = {
        method: "GET",
        headers: { "Accept": "application/json", "User-Agent": "NuvioApp/1.0" }
      };
      if (controller)
        fetchOpts.signal = controller.signal;
      var response = yield fetch(url, fetchOpts);
      if (timeoutId)
        clearTimeout(timeoutId);
      if (!response.ok) {
        console.log("[WitAnime] Backend returned status " + response.status);
        return [];
      }
      var data = yield response.json();
      var embeds = data.embeds || [];
      console.log("[WitAnime] Got " + embeds.length + " embed(s) from backend");
      if (embeds.length === 0)
        return [];
      var hlsHosts = ["larhu", "vidmoly", "voe"];
      var mp4Hosts = ["uqload", "file-upload"];
      var sorted = [];
      for (var i = 0; i < embeds.length; i++) {
        if (embeds[i].resolved && embeds[i].proxyUrl)
          sorted.push(embeds[i]);
      }
      for (var i = 0; i < embeds.length; i++) {
        if (embeds[i].resolved)
          continue;
        var h = embeds[i].host || "";
        for (var j = 0; j < hlsHosts.length; j++) {
          if (h.indexOf(hlsHosts[j]) > -1) {
            sorted.push(embeds[i]);
            break;
          }
        }
      }
      for (var i = 0; i < embeds.length; i++) {
        if (embeds[i].resolved)
          continue;
        var h = embeds[i].host || "";
        var isHls = false;
        for (var j = 0; j < hlsHosts.length; j++) {
          if (h.indexOf(hlsHosts[j]) > -1) {
            isHls = true;
            break;
          }
        }
        if (!isHls)
          sorted.push(embeds[i]);
      }
      var limit = Math.min(sorted.length, 6);
      var streams = [];
      var promises = [];
      for (var i = 0; i < limit; i++) {
        promises.push(resolveWithMeta(sorted[i]));
      }
      var results = yield Promise.all(promises);
      for (var i = 0; i < results.length; i++) {
        if (results[i])
          streams.push(results[i]);
      }
      console.log("[WitAnime] Resolved " + streams.length + " stream(s)");
      return streams;
    } catch (error) {
      console.error("[WitAnime] Error: " + error.message);
      return [];
    }
  });
}
function resolveWithMeta(embed) {
  return __async(this, null, function* () {
    try {
      if (embed.resolved && embed.proxyUrl) {
        var qualityLabel = embed.quality === "FHD" ? "1080p" : embed.quality === "SD" ? "480p" : "720p";
        var serverName = (embed.name || getHostName(embed.host)) + " (Proxy)";
        console.log("[WitAnime] Using server-proxied stream: " + embed.host + " [" + qualityLabel + "]");
        return {
          name: "Anime4up",
          title: serverName + " [" + qualityLabel + "]",
          url: embed.proxyUrl,
          quality: qualityLabel,
          headers: {}
        };
      }
      var result = yield resolveEmbed(embed);
      if (!result || !result.url)
        return null;
      var qualityLabel = embed.quality === "FHD" ? "1080p" : embed.quality === "SD" ? "480p" : "720p";
      var serverName = embed.name || getHostName(embed.host);
      return {
        name: "Anime4up",
        title: serverName + " [" + qualityLabel + "]",
        url: result.url,
        quality: qualityLabel,
        headers: result.headers || {}
      };
    } catch (e) {
      console.log("[WitAnime] resolveWithMeta error: " + e.message);
      return null;
    }
  });
}
function getHostName(host) {
  if (!host)
    return "Server";
  if (host.indexOf("larhu") > -1)
    return "Larhu";
  if (host.indexOf("uqload") > -1)
    return "Uqload";
  if (host.indexOf("vidmoly") > -1)
    return "Vidmoly";
  if (host.indexOf("mp4upload") > -1)
    return "MP4Upload";
  if (host.indexOf("file-upload") > -1)
    return "FileUpload";
  if (host.indexOf("voe") > -1)
    return "Voe";
  var parts = host.split(".");
  if (parts.length >= 2)
    return parts[parts.length - 2];
  return "Server";
}
module.exports = { getStreams };
