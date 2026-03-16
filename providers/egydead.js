/**
 * egydead - Built from src/egydead/
 * Generated: 2026-03-16T03:11:10.463Z
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

// src/egydead/http.js
var BASE_URL = "https://f2h7y.sbs";
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
        method: options.method || "GET",
        redirect: "follow",
        headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
      };
      if (options.body)
        fetchOpts.body = options.body;
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
      console.log("[EgyDead] fetch error: " + e.message);
      return "";
    }
  });
}

// src/egydead/extractor.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_API_BASE = "https://api.themoviedb.org/3";
function getTmdbMeta(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var type = mediaType === "movie" ? "movie" : "tv";
    var enUrl = TMDB_API_BASE + "/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=en-US";
    var fetchOpts = { method: "GET", headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } };
    try {
      var r = yield fetch(enUrl, fetchOpts);
      if (!r.ok)
        return null;
      var data = yield r.json();
      var title = data.title || data.name || "";
      var origTitle = data.original_title || data.original_name || "";
      var year = "";
      if (data.release_date)
        year = data.release_date.split("-")[0];
      else if (data.first_air_date)
        year = data.first_air_date.split("-")[0];
      return { title, originalTitle: origTitle, year };
    } catch (e) {
      console.log("[EgyDead] TMDB error: " + e.message);
      return null;
    }
  });
}
function slugify(text) {
  return text.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function searchEgyDead(title, year, mediaType) {
  return __async(this, null, function* () {
    var base = getBaseUrl();
    var query = encodeURIComponent(title);
    var html = yield fetchText(base + "/?s=" + query);
    if (!html)
      return "";
    var linkRe = /href="(https?:\/\/f2h7y\.sbs\/[^"]+)"/gi;
    var m;
    var candidates = [];
    while ((m = linkRe.exec(html)) !== null) {
      var url = m[1];
      if (/page\/|type\/|category\/|tag\/|wp-|feed\/|xmlrpc|comments/.test(url))
        continue;
      if (candidates.indexOf(url) < 0)
        candidates.push(url);
    }
    if (candidates.length === 0)
      return "";
    var slug = slugify(title);
    var slugWords = slug.split("-").filter(function(w) {
      return w.length > 2;
    });
    var best = "";
    var bestScore = 0;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i].toLowerCase();
      if (mediaType === "movie" && c.indexOf("/episode/") > -1)
        continue;
      if (mediaType === "tv" && c.indexOf("/episode/") < 0)
        continue;
      var score = 0;
      for (var j = 0; j < slugWords.length; j++) {
        if (c.indexOf(slugWords[j]) > -1)
          score++;
      }
      if (year && c.indexOf(year) > -1)
        score += 2;
      if (score > bestScore) {
        bestScore = score;
        best = candidates[i];
      }
    }
    if (mediaType === "tv" && best && best.indexOf("/episode/") > -1) {
      return best;
    }
    return best;
  });
}
function fetchWatchPage(pageUrl) {
  return __async(this, null, function* () {
    var html = yield fetchText(pageUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "View=1"
    });
    return html;
  });
}
function extractEmbeds(html) {
  var embeds = [];
  var re = /data-link="([^"]+)"/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    embeds.push(m[1]);
  }
  return embeds;
}
function unpackPACK(html) {
  var evalIdx = html.indexOf("eval(function(p,a,c,k,e,d)");
  if (evalIdx < 0)
    return "";
  var splitIdx = html.indexOf(".split('|')", evalIdx);
  if (splitIdx < 0)
    return "";
  var dictQuoteStart = html.lastIndexOf(",'", splitIdx);
  if (dictQuoteStart < 0)
    return "";
  var dictStr = html.substring(dictQuoteStart + 2, splitIdx);
  if (dictStr[0] === "'")
    dictStr = dictStr.substring(1);
  if (dictStr[dictStr.length - 1] === "'")
    dictStr = dictStr.substring(0, dictStr.length - 1);
  var words = dictStr.split("|");
  var bodyStart = html.indexOf("}('", evalIdx);
  if (bodyStart < 0)
    return "";
  bodyStart += 3;
  var beforeDict = html.substring(bodyStart, dictQuoteStart);
  var match = beforeDict.match(/^([\s\S]*)',\s*(\d+)\s*,\s*(\d+)\s*$/);
  if (!match)
    return "";
  var p = match[1];
  var base = parseInt(match[2], 10);
  var count = parseInt(match[3], 10);
  function baseEncode(val) {
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
  while (count--) {
    var encoded = baseEncode(count);
    dict[encoded] = words[count] || encoded;
  }
  var result = p.replace(/\b(\w+)\b/g, function(m) {
    return dict[m] !== void 0 ? dict[m] : m;
  });
  return result;
}
function extractM3u8FromDecoded(decoded) {
  var m3u8Match = decoded.match(/file\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
  if (m3u8Match)
    return m3u8Match[1];
  var m3u8Match2 = decoded.match(/file\s*:\s*'(https?:\/\/[^']*\.m3u8[^']*)'/);
  if (m3u8Match2)
    return m3u8Match2[1];
  var fallback = decoded.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/);
  return fallback ? fallback[0] : "";
}
function extractFromEmbed(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchText(embedUrl, {
      headers: { "Referer": getBaseUrl() + "/" },
      timeout: 12e3
    });
    if (!html)
      return "";
    var directM3u8 = html.match(/(?:file|source|src)\s*[:=]\s*["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/i);
    if (directM3u8)
      return directM3u8[1];
    if (html.indexOf("eval(function(p,a,c,k,e,d)") > -1) {
      var decoded = unpackPACK(html);
      if (decoded) {
        var m3u8 = extractM3u8FromDecoded(decoded);
        if (m3u8)
          return m3u8;
      }
    }
    var anyM3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/);
    if (anyM3u8)
      return anyM3u8[0];
    return "";
  });
}
function getServerName(url) {
  try {
    var hostname = url.match(/https?:\/\/([^\/]+)/)[1];
    if (hostname.indexOf("stmruby") > -1 || hostname.indexOf("streamruby") > -1)
      return "StreamRuby";
    if (hostname.indexOf("forafile") > -1)
      return "ForaFile";
    if (hostname.indexOf("hgcloud") > -1)
      return "HGCloud";
    if (hostname.indexOf("vidara") > -1)
      return "Vidara";
    if (hostname.indexOf("dsvplay") > -1)
      return "DSVPlay";
    if (hostname.indexOf("mixdrop") > -1)
      return "MixDrop";
    if (hostname.indexOf("voe") > -1)
      return "VOE";
    return hostname.split(".")[0];
  } catch (e) {
    return "Unknown";
  }
}
function buildEpisodeUrl(title, season, episode) {
  var slug = slugify(title);
  var se = "s" + String(season).padStart(2, "0") + "e" + String(episode).padStart(2, "0");
  return getBaseUrl() + "/episode/" + slug + "-" + se + "/";
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var meta = yield getTmdbMeta(tmdbId, mediaType);
    if (!meta || !meta.title) {
      console.log("[EgyDead] Could not get TMDB meta for " + tmdbId);
      return [];
    }
    console.log("[EgyDead] Title: " + meta.title + " (" + meta.year + ")");
    var pageUrl = "";
    if (mediaType === "movie") {
      pageUrl = yield searchEgyDead(meta.title, meta.year, "movie");
      if (!pageUrl && meta.originalTitle && meta.originalTitle !== meta.title) {
        pageUrl = yield searchEgyDead(meta.originalTitle, meta.year, "movie");
      }
      if (!pageUrl) {
        console.log("[EgyDead] Movie not found: " + meta.title);
        return [];
      }
    } else {
      pageUrl = buildEpisodeUrl(meta.title, season, episode);
      var testHead = yield fetchText(pageUrl, { timeout: 8e3 });
      if (!testHead || testHead.length < 1e3) {
        if (meta.originalTitle && meta.originalTitle !== meta.title) {
          pageUrl = buildEpisodeUrl(meta.originalTitle, season, episode);
          testHead = yield fetchText(pageUrl, { timeout: 8e3 });
        }
        if (!testHead || testHead.length < 1e3) {
          var searchResult = yield searchEgyDead(meta.title, meta.year, "tv");
          if (searchResult) {
            var slugMatch = searchResult.match(/\/episode\/(.+)-s\d+e\d+\/?$/i);
            if (slugMatch) {
              var se = "s" + String(season).padStart(2, "0") + "e" + String(episode).padStart(2, "0");
              pageUrl = getBaseUrl() + "/episode/" + slugMatch[1] + "-" + se + "/";
            } else {
              pageUrl = searchResult;
            }
          } else {
            console.log("[EgyDead] Episode not found: " + meta.title + " S" + season + "E" + episode);
            return [];
          }
        }
      }
    }
    console.log("[EgyDead] Page: " + pageUrl);
    var watchHtml = yield fetchWatchPage(pageUrl);
    if (!watchHtml) {
      console.log("[EgyDead] Empty watch page");
      return [];
    }
    var embeds = extractEmbeds(watchHtml);
    if (embeds.length === 0) {
      console.log("[EgyDead] No embeds found");
      return [];
    }
    console.log("[EgyDead] Found " + embeds.length + " embed(s)");
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
    var streams = [];
    var tried = 0;
    var MAX_TRIES = 4;
    for (var j = 0; j < ordered.length && tried < MAX_TRIES; j++) {
      var embedUrl = ordered[j];
      var serverName = getServerName(embedUrl);
      tried++;
      try {
        var m3u8 = yield extractFromEmbed(embedUrl);
        if (m3u8) {
          console.log("[EgyDead] Got stream from " + serverName);
          streams.push({
            url: m3u8,
            quality: "auto",
            provider: "EgyDead",
            source: serverName,
            type: "m3u8"
          });
          if (streams.length >= 2)
            break;
        }
      } catch (e) {
        console.log("[EgyDead] Failed " + serverName + ": " + e.message);
      }
    }
    if (streams.length === 0) {
      console.log("[EgyDead] No streams extracted from any embed");
    }
    return streams;
  });
}

// src/egydead/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[EgyDead] Request: " + mediaType + " " + tmdbId);
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      console.error("[EgyDead] Error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
