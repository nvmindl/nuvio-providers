/**
 * kirmzi - Built from src/kirmzi/
 * Generated: 2026-03-12T04:20:41.771Z
 */
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
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

// src/kirmzi/http.js
var BASE_URL = "https://v3.kirmzi.space";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.8,en;q=0.5"
};
function getBaseUrl() {
  return BASE_URL;
}
function fetchText(url, options) {
  return __async(this, null, function* () {
    options = options || {};
    var controller;
    var timeoutId;
    try {
      controller = new AbortController();
      timeoutId = setTimeout(function() {
        controller.abort();
      }, options.timeout || 15e3);
    } catch (e) {
      controller = null;
    }
    try {
      var fetchOpts = {
        redirect: "follow",
        headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
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
      console.log("[Kirmzi] fetch error: " + e.message);
      return "";
    }
  });
}

// src/kirmzi/extractor.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_API_BASE = "https://api.themoviedb.org/3";
var ALBA_BASE = "https://w.shadwo.pro/albaplayer";
function resolveTmdbMeta(tmdbId) {
  return __async(this, null, function* () {
    var url = TMDB_API_BASE + "/tv/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=ar-SA";
    var response = yield fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok)
      throw new Error("TMDB " + response.status);
    var data = yield response.json();
    return { arabicTitle: data.name || "" };
  });
}
function buildEpisodeSlug(arabicTitle, episode) {
  var slug = "\u0645\u0633\u0644\u0633\u0644-" + arabicTitle.replace(/\s+/g, "-") + "-\u0627\u0644\u062D\u0644\u0642\u0629-" + episode;
  return slug;
}
function buildEpisodeUrl(arabicTitle, episode) {
  var base = getBaseUrl();
  var slug = buildEpisodeSlug(arabicTitle, episode);
  return base + "/episode/" + encodeURIComponent(slug) + "/";
}
function extractAlbaplayerUrl(html) {
  var match = html.match(/iframe[^>]*src="([^"]*albaplayer\/[^"]*)"/i);
  if (!match)
    return "";
  var raw = match[1];
  var parts = raw.split("albaplayer/");
  var slug = parts[parts.length - 1].replace(/\/$/, "");
  if (!slug)
    return "";
  return ALBA_BASE + "/" + slug + "/";
}
function extractEmbedUrls(html) {
  var servers = [];
  var re = /href="([^"]*\?serv=\d+)"/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    servers.push(m[1]);
  }
  var embedUrls = [];
  var iframeMatch = html.match(/iframe[^>]*src="(https?:\/\/[^"]*embed[^"]*)"/i);
  if (iframeMatch) {
    embedUrls.push(iframeMatch[1]);
  }
  return { servers, embedUrls };
}
function unpackPACK(packed) {
  var match = packed.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:[^'\\]|\\.)*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:[^'\\]|\\.)*)'\.split\('\|'\)/);
  if (!match)
    return "";
  var p = match[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  var a = parseInt(match[2], 10);
  var c = parseInt(match[3], 10);
  var k = match[4].split("|");
  function baseEncode(val, base) {
    var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (val === 0)
      return "0";
    var result2 = "";
    while (val > 0) {
      result2 = chars[val % base] + result2;
      val = Math.floor(val / base);
    }
    return result2;
  }
  var dict = {};
  while (c--) {
    var encoded = baseEncode(c, a);
    dict[encoded] = k[c] || encoded;
  }
  var result = p.replace(/\b(\w+)\b/g, function(m) {
    return dict[m] !== void 0 ? dict[m] : m;
  });
  return result;
}
function extractM3u8FromUnpacked(unpacked) {
  var m3u8Match = unpacked.match(/(?:file|src)\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
  if (m3u8Match)
    return m3u8Match[1];
  var fallback = unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/);
  return fallback ? fallback[0] : "";
}
function tryExtractFromAlba(albaUrl) {
  return __async(this, null, function* () {
    var html = yield fetchText(albaUrl);
    if (!html)
      return null;
    var data = extractEmbedUrls(html);
    if (data.embedUrls.length === 0)
      return null;
    for (var i = 0; i < data.embedUrls.length; i++) {
      var result = yield tryExtractFromEmbed(data.embedUrls[i]);
      if (result)
        return result;
    }
    var servUrls = data.servers.filter(function(s) {
      return /serv=[2-5]/.test(s);
    });
    if (servUrls.length === 0)
      return null;
    var servPages = yield Promise.all(servUrls.map(function(s) {
      return fetchText(s);
    }));
    var fallbackEmbeds = [];
    for (var j = 0; j < servPages.length; j++) {
      if (!servPages[j])
        continue;
      var servEmbed = extractEmbedUrls(servPages[j]);
      for (var k = 0; k < servEmbed.embedUrls.length; k++) {
        fallbackEmbeds.push(servEmbed.embedUrls[k]);
      }
    }
    if (fallbackEmbeds.length === 0)
      return null;
    var embedResults = yield Promise.all(fallbackEmbeds.map(function(u) {
      return tryExtractFromEmbed(u).catch(function() {
        return null;
      });
    }));
    for (var m = 0; m < embedResults.length; m++) {
      if (embedResults[m])
        return embedResults[m];
    }
    return null;
  });
}
function extractPackedBlock(html) {
  var start = html.indexOf("eval(function(p,a,c,k,e,d)");
  if (start < 0)
    return "";
  var depth = 0;
  for (var i = start; i < html.length; i++) {
    if (html[i] === "(")
      depth++;
    else if (html[i] === ")") {
      depth--;
      if (depth === 0)
        return html.substring(start, i + 1);
    }
  }
  return "";
}
function tryExtractFromEmbed(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchText(embedUrl);
    if (!html)
      return null;
    var packed = extractPackedBlock(html);
    if (!packed)
      return null;
    var unpacked = unpackPACK(packed);
    if (!unpacked)
      return null;
    var m3u8 = extractM3u8FromUnpacked(unpacked);
    if (!m3u8)
      return null;
    return { m3u8, embedUrl };
  });
}
var SUFFIX_QUALITY = { x: "1080p", h: "720p", n: "480p", l: "360p" };
var QUALITY_ORDER = { "1080p": 0, "720p": 1, "480p": 2, "360p": 3 };
function deriveVariantUrls(masterUrl) {
  var m = masterUrl.match(/^(.+_),([a-zA-Z]+(?:,[a-zA-Z]+)*),\.urlset\/master\.m3u8(\?.+)?$/);
  if (!m)
    return [];
  var base = m[1];
  var suffixes = m[2].split(",");
  var query = m[3] || "";
  var variants = [];
  for (var i = 0; i < suffixes.length; i++) {
    var s = suffixes[i];
    var quality = SUFFIX_QUALITY[s] || null;
    if (!quality)
      continue;
    variants.push({
      url: base + s + "/index-v1-a1.m3u8" + query,
      quality
    });
  }
  variants.sort(function(a, b) {
    var oa = QUALITY_ORDER[a.quality] !== void 0 ? QUALITY_ORDER[a.quality] : 99;
    var ob = QUALITY_ORDER[b.quality] !== void 0 ? QUALITY_ORDER[b.quality] : 99;
    return oa - ob;
  });
  return variants;
}
function buildStreamHeaders(embedUrl) {
  var referer = "";
  try {
    var embedDomain = embedUrl.match(/^(https?:\/\/[^/]+)/);
    referer = embedDomain ? embedDomain[1] + "/" : "";
  } catch (e) {
  }
  return {
    "Referer": referer,
    "Origin": referer.replace(/\/$/, ""),
    "User-Agent": HEADERS["User-Agent"]
  };
}
function buildStreams(result) {
  if (!result || !result.m3u8)
    return [];
  var headers = buildStreamHeaders(result.embedUrl);
  var variants = deriveVariantUrls(result.m3u8);
  if (variants.length > 0) {
    var streams = [];
    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      streams.push({
        name: "Kirmzi - " + v.quality,
        title: v.quality,
        url: v.url,
        quality: v.quality,
        headers
      });
    }
    return streams;
  }
  return [{
    name: "Kirmzi - Auto",
    title: "Auto",
    url: result.m3u8,
    quality: "auto",
    headers
  }];
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (mediaType !== "tv") {
      console.log("[Kirmzi] Only TV series supported");
      return [];
    }
    if (!season)
      season = "1";
    if (!episode)
      return [];
    console.log("[Kirmzi] Resolving TMDB meta for ID " + tmdbId);
    var meta = yield resolveTmdbMeta(tmdbId);
    if (!meta.arabicTitle) {
      console.log("[Kirmzi] No Arabic title found");
      return [];
    }
    console.log("[Kirmzi] Arabic title: " + meta.arabicTitle);
    var episodeUrl = buildEpisodeUrl(meta.arabicTitle, episode);
    console.log("[Kirmzi] Episode URL: " + episodeUrl);
    var episodeHtml = yield fetchText(episodeUrl);
    if (!episodeHtml || episodeHtml.length < 1e3) {
      console.log("[Kirmzi] Episode page not found or empty");
      return [];
    }
    var albaUrl = extractAlbaplayerUrl(episodeHtml);
    if (!albaUrl) {
      console.log("[Kirmzi] No albaplayer iframe found");
      return [];
    }
    console.log("[Kirmzi] Albaplayer URL: " + albaUrl);
    var result = yield tryExtractFromAlba(albaUrl);
    if (!result) {
      console.log("[Kirmzi] No streams found from embed servers");
      return [];
    }
    console.log("[Kirmzi] Found m3u8: " + result.m3u8.substring(0, 80) + "...");
    return buildStreams(result);
  });
}

// src/kirmzi/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[Kirmzi] Request: " + mediaType + " " + tmdbId);
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      console.error("[Kirmzi] Error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
