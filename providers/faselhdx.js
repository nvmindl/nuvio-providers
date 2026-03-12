/**
 * faselhdx - Built from src/faselhdx/
 * Generated: 2026-03-12T18:30:55.263Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
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
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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

// src/faselhdx/http.js
var CANONICAL_URL = "https://www.faselhd.club";
var _resolvedBase = "";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.8"
};
function resolveBaseUrl() {
  return __async(this, null, function* () {
    if (_resolvedBase)
      return _resolvedBase;
    try {
      var resp = yield fetch(CANONICAL_URL, {
        method: "HEAD",
        redirect: "follow",
        headers: HEADERS
      });
      var finalUrl = resp.url || "";
      var m = finalUrl.match(/^(https?:\/\/web\d+x\.faselhdx\.best)/i);
      if (m) {
        _resolvedBase = m[1];
        console.log("[FaselHDX] Resolved domain: " + _resolvedBase);
        return _resolvedBase;
      }
    } catch (e) {
      console.log("[FaselHDX] Domain resolve error: " + e.message);
    }
    _resolvedBase = "https://web380x.faselhdx.best";
    console.log("[FaselHDX] Using fallback domain: " + _resolvedBase);
    return _resolvedBase;
  });
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
      }, 12e3);
    } catch (e) {
      controller = null;
    }
    var response;
    try {
      var fetchOpts = {
        redirect: "follow",
        headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
      };
      if (controller)
        fetchOpts.signal = controller.signal;
      response = yield fetch(url, fetchOpts);
    } catch (fetchErr) {
      if (timeoutId)
        clearTimeout(timeoutId);
      throw fetchErr;
    }
    if (timeoutId)
      clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error("HTTP " + response.status + " for " + url);
    }
    var text = yield response.text();
    return text;
  });
}

// src/faselhdx/extractor.js
function cleanText(value) {
  return String(value || "").toLowerCase().replace(/&[^;]+;/g, " ").replace(/[^a-z0-9\s\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g, " ").replace(/\s+/g, " ").trim();
}
function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_API_BASE = "https://api.themoviedb.org/3";
var _episodeCache = {};
var _tmdbCache = {};
var _searchCache = {};
function resolveTmdbMeta(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var cacheKey = tmdbId + "_" + mediaType;
    if (_tmdbCache[cacheKey])
      return _tmdbCache[cacheKey];
    var endpoint = mediaType === "movie" ? "movie" : "tv";
    var url = TMDB_API_BASE + "/" + endpoint + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
    var response = yield fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok)
      throw new Error("TMDB " + response.status);
    var data = yield response.json();
    var title = mediaType === "tv" ? data.name || "" : data.title || "";
    var releaseDate = mediaType === "tv" ? data.first_air_date || "" : data.release_date || "";
    var year = releaseDate ? releaseDate.split("-")[0] : "";
    var result = { title: cleanText(title), year };
    _tmdbCache[cacheKey] = result;
    return result;
  });
}
function extractSearchUrls(html) {
  var urls = [];
  var re = /href="(https?:\/\/web\d+x\.faselhdx\.best\/(movies|series|seasons|episodes|anime|anime-movies|anime-series|anime-episodes)\/[^"]+)"/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    if (m[1])
      urls.push(m[1]);
  }
  return unique(urls);
}
function searchCandidates(query, baseUrl) {
  return __async(this, null, function* () {
    if (!query)
      return [];
    var ajaxUrl = baseUrl + "/wp-admin/admin-ajax.php";
    var response = yield fetch(ajaxUrl, {
      method: "POST",
      headers: __spreadProps(__spreadValues({}, HEADERS), {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        Referer: baseUrl + "/main"
      }),
      body: "action=dtc_live&trsearch=" + encodeURIComponent(query)
    });
    if (!response.ok)
      return [];
    var html = yield response.text();
    return extractSearchUrls(html);
  });
}
function scoreCandidate(url, mediaType, season, episode, title, year) {
  var lower = url.toLowerCase();
  var score = 0;
  if (mediaType === "movie" && /(\/movies\/|\/anime-movies\/)/.test(lower))
    score += 8;
  if (mediaType === "tv" && /\/(episodes|anime-episodes)\//.test(lower))
    score += 10;
  if (mediaType === "tv" && /\/(seasons|anime)\//.test(lower))
    score += 8;
  if (mediaType === "tv" && /(\/series\/|\/anime-series\/)/.test(lower))
    score += 4;
  if (year && lower.includes(year))
    score += 2;
  var normalizedUrl = cleanText(decodeURIComponent(lower));
  var titleWords = unique(title.split(" ").filter(function(w) {
    return w.length > 2;
  }));
  var wordHits = 0;
  for (var i = 0; i < titleWords.length; i++) {
    if (normalizedUrl.includes(titleWords[i]))
      wordHits += 1;
  }
  score += Math.min(wordHits, 5);
  if (mediaType === "tv") {
    if (season && new RegExp("(?:season|\u0627\u0644\u0645\u0648\u0633\u0645)\\s*" + season, "i").test(normalizedUrl))
      score += 3;
    if (episode && new RegExp("(?:episode|\u0627\u0644\u062D\u0644\u0642\u0629)\\s*" + episode, "i").test(normalizedUrl))
      score += 4;
  }
  return score;
}
function extractEpisodeLinks(html) {
  var links = [];
  var re = /href="([^"]*\/(?:episodes|anime-episodes)\/[^"]*)"/gi;
  var m;
  while ((m = re.exec(html)) !== null)
    links.push(m[1]);
  return links;
}
function extractOnclickUrl(tag, baseUrl) {
  var onclickMatch = tag.match(/onclick="([^"]*)"/i);
  if (!onclickMatch)
    return "";
  var onclick = onclickMatch[1];
  var pMatch = onclick.match(/['"]([^'"]*\?p=\d+)['"]/) || onclick.match(/href\s*=\s*'([^']+)'/);
  if (!pMatch || !pMatch[1])
    return "";
  var url = pMatch[1];
  if (!/^https?:\/\//i.test(url))
    url = baseUrl + url;
  return url;
}
function findEpisodeInLinks(episodeLinks, episode) {
  var epNum = parseInt(episode, 10);
  for (var i = 0; i < episodeLinks.length; i++) {
    var decoded = decodeURIComponent(episodeLinks[i]);
    var numMatch = decoded.match(/-(\d+)(?:-[^/]*)?\/?$/);
    if (numMatch && parseInt(numMatch[1], 10) === epNum)
      return episodeLinks[i];
  }
  if (epNum >= 1 && epNum <= episodeLinks.length)
    return episodeLinks[epNum - 1];
  return "";
}
function resolveEpisodeFromSeasons(seasonsPageUrl, season, episode, baseUrl, cacheId) {
  return __async(this, null, function* () {
    var cacheKey = (cacheId || seasonsPageUrl) + "_s" + season;
    if (_episodeCache[cacheKey]) {
      console.log("[FaselHDX] Cache hit for " + cacheKey);
      return findEpisodeInLinks(_episodeCache[cacheKey], episode);
    }
    var html = yield fetchText(seasonsPageUrl, {
      headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: baseUrl + "/main" })
    });
    var divRe = /<div[^>]*class="[^"]*\bseasonDiv\b[^"]*"[^>]*>/gi;
    var divTags = [];
    var dm;
    while ((dm = divRe.exec(html)) !== null) {
      divTags.push({ index: dm.index, tag: dm[0] });
    }
    if (divTags.length === 0)
      return "";
    var seasonIdx = Math.max(0, Math.min(parseInt(season, 10) - 1, divTags.length - 1));
    var startIdx = divTags[seasonIdx].index;
    var endIdx = seasonIdx + 1 < divTags.length ? divTags[seasonIdx + 1].index : html.length;
    var seasonBlock = html.substring(startIdx, endIdx);
    var episodeLinks = extractEpisodeLinks(seasonBlock);
    if (episodeLinks.length === 0) {
      var seasonUrl = extractOnclickUrl(divTags[seasonIdx].tag, baseUrl);
      if (seasonUrl) {
        var sHtml = yield fetchText(seasonUrl, {
          headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: seasonsPageUrl })
        });
        if (sHtml)
          episodeLinks = extractEpisodeLinks(sHtml);
      }
    }
    if (episodeLinks.length === 0)
      episodeLinks = extractEpisodeLinks(html);
    episodeLinks = unique(episodeLinks);
    if (episodeLinks.length === 0)
      return "";
    _episodeCache[cacheKey] = episodeLinks;
    console.log("[FaselHDX] Cached " + episodeLinks.length + " episodes for " + cacheKey);
    return findEpisodeInLinks(episodeLinks, episode);
  });
}
function resolvePageUrl(tmdbMeta, mediaType, season, episode, baseUrl) {
  return __async(this, null, function* () {
    var searchKey = tmdbMeta.title + "_" + (tmdbMeta.year || "");
    var candidates;
    if (_searchCache[searchKey]) {
      candidates = _searchCache[searchKey];
    } else {
      candidates = yield searchCandidates(tmdbMeta.title, baseUrl);
      if (candidates.length === 0 && tmdbMeta.year) {
        candidates = yield searchCandidates(tmdbMeta.title + " " + tmdbMeta.year, baseUrl);
      }
      candidates = unique(candidates);
      _searchCache[searchKey] = candidates;
    }
    if (candidates.length === 0)
      return "";
    var ranked = candidates.map(function(url) {
      return { url, score: scoreCandidate(url, mediaType, season, episode, tmdbMeta.title || "", tmdbMeta.year || "") };
    }).sort(function(a, b) {
      return b.score - a.score;
    });
    var bestUrl = ranked[0] ? ranked[0].url : "";
    if (mediaType === "tv" && season && episode && bestUrl && /\/(seasons|anime)\//.test(bestUrl)) {
      var episodeUrl = yield resolveEpisodeFromSeasons(bestUrl, season, episode, baseUrl, tmdbMeta.title);
      if (episodeUrl)
        return episodeUrl;
    }
    return bestUrl;
  });
}
function extractPlayerUrls(html) {
  var urls = [];
  var re1 = /'(https?:\/\/[^']+\/video_player\?player_token=[^']+)'/gi;
  var m;
  while ((m = re1.exec(html)) !== null)
    urls.push(m[1]);
  var re2 = /<iframe[^>]*(?:data-src|src)="(https?:\/\/[^"]*video_player\?player_token=[^"]*)"/gi;
  while ((m = re2.exec(html)) !== null)
    urls.push(m[1]);
  return unique(urls);
}
function executeQualityScript(scriptContent, baseUrl) {
  var captured = "";
  scriptContent = scriptContent.replace(
    /\['test'\]\(this\['[^']+'\]\['toString'\]\(\)\)/g,
    `['test']("function (){return'newState';}")`
  );
  var lc = 0;
  scriptContent = scriptContent.replace(/while\s*\(\s*!!\s*\[\s*\]\s*\)\s*\{/g, function() {
    lc++;
    return "var __lc" + lc + "=0;while(++__lc" + lc + "<500){";
  });
  scriptContent = scriptContent.replace(/\bdebugger\b/g, "void 0");
  var mockDoc = {
    write: function(s) {
      captured += s;
    },
    createElement: function() {
      return {};
    },
    querySelector: function() {
      return {};
    },
    querySelectorAll: function() {
      return [];
    },
    getElementById: function() {
      return null;
    }
  };
  var mock$ = function() {
    var r = {};
    r.on = function() {
      return r;
    };
    r.html = function() {
      return r;
    };
    r.addClass = function() {
      return r;
    };
    r.removeClass = function() {
      return r;
    };
    r.attr = function() {
      return null;
    };
    r.fadeIn = function() {
      return r;
    };
    r.fadeOut = function() {
      return r;
    };
    r.click = function() {
      return r;
    };
    r.find = function() {
      return r;
    };
    r.each = function() {
      return r;
    };
    r.text = function() {
      return "";
    };
    return r;
  };
  var polyfillAtob = function(s) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var o = "", i2 = 0;
    s = String(s).replace(/[^A-Za-z0-9+/=]/g, "");
    while (i2 < s.length) {
      var e1 = chars.indexOf(s[i2++]), e2 = chars.indexOf(s[i2++]);
      var e3 = chars.indexOf(s[i2++]), e4 = chars.indexOf(s[i2++]);
      var n = e1 << 18 | e2 << 12 | e3 << 6 | e4;
      o += String.fromCharCode(n >> 16 & 255);
      if (e3 !== 64)
        o += String.fromCharCode(n >> 8 & 255);
      if (e4 !== 64)
        o += String.fromCharCode(n & 255);
    }
    return o;
  };
  var polyfillBtoa = function(s) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var r = "", i2 = 0;
    while (i2 < s.length) {
      var a = s.charCodeAt(i2++);
      var b = i2 < s.length ? s.charCodeAt(i2++) : NaN;
      var c = i2 < s.length ? s.charCodeAt(i2++) : NaN;
      r += chars[a >> 2];
      r += chars[(a & 3) << 4 | b >> 4];
      r += isNaN(b) ? "=" : chars[(b & 15) << 2 | c >> 6];
      r += isNaN(c) ? "=" : chars[c & 63];
    }
    return r;
  };
  var hostname = "web380x.faselhdx.best";
  try {
    hostname = baseUrl.replace(/^https?:\/\//, "");
  } catch (e) {
  }
  var scopeEntries = [
    ["document", mockDoc],
    ["navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36" }],
    ["location", { href: baseUrl, hostname }],
    ["console", { log: function() {
    }, warn: function() {
    }, error: function() {
    } }],
    ["parseInt", parseInt],
    ["parseFloat", parseFloat],
    ["isNaN", isNaN],
    ["isFinite", isFinite],
    ["String", String],
    ["Number", Number],
    ["Array", Array],
    ["Object", Object],
    ["Boolean", Boolean],
    ["RegExp", RegExp],
    ["Function", void 0],
    ["Error", Error],
    ["TypeError", TypeError],
    ["RangeError", RangeError],
    ["SyntaxError", SyntaxError],
    ["encodeURIComponent", encodeURIComponent],
    ["decodeURIComponent", decodeURIComponent],
    ["encodeURI", encodeURI],
    ["decodeURI", decodeURI],
    ["Math", Math],
    ["Date", Date],
    ["JSON", JSON],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["undefined", void 0],
    ["setTimeout", function() {
      return 1;
    }],
    ["setInterval", function() {
      return 1;
    }],
    ["clearTimeout", function() {
    }],
    ["clearInterval", function() {
    }],
    ["$", mock$],
    ["jQuery", mock$],
    ["Cookies", { get: function() {
      return null;
    }, set: function() {
    } }],
    ["atob", polyfillAtob],
    ["btoa", polyfillBtoa]
  ];
  var scopeObj = {};
  for (var i = 0; i < scopeEntries.length; i++) {
    scopeObj[scopeEntries[i][0]] = scopeEntries[i][1];
  }
  scopeObj.window = scopeObj;
  scopeObj.self = scopeObj;
  scopeObj.globalThis = scopeObj;
  scopeEntries.push(["window", scopeObj], ["self", scopeObj], ["globalThis", scopeObj]);
  var paramNames = scopeEntries.map(function(e) {
    return e[0];
  }).join(", ");
  var paramValues = scopeEntries.map(function(e) {
    return e[1];
  });
  try {
    var executor = new Function(paramNames, scriptContent);
    executor.apply(null, paramValues);
  } catch (e) {
    console.error("[FaselHDX] sandbox error: " + (e && e.message || e));
  }
  return captured;
}
function extractQualityScriptUrls(playerHtml, baseUrl) {
  var qcMatch = playerHtml.match(/<div\s+class="quality_change">([\s\S]*?)<\/div>/i);
  if (!qcMatch)
    return [];
  var scriptMatch = qcMatch[1].match(/<script[^>]*>([\s\S]+?)<\/script>/i);
  if (!scriptMatch || scriptMatch[1].trim().length < 500)
    return [];
  var htmlOutput = executeQualityScript(scriptMatch[1].trim(), baseUrl);
  if (!htmlOutput)
    return [];
  var urls = [];
  var re = /data-url="([^"]+)"/g;
  var m;
  while ((m = re.exec(htmlOutput)) !== null) {
    if (m[1] && /^https?:\/\//i.test(m[1]))
      urls.push(m[1]);
  }
  return urls;
}
function extractLiteralUrls(html) {
  var urls = [];
  var normalized = String(html || "").replace(/\\\//g, "/");
  var re = /https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/gi;
  var m;
  while ((m = re.exec(normalized)) !== null) {
    if (m[0])
      urls.push(m[0]);
  }
  return urls;
}
function resolveDirectFromPlayer(playerUrl, pageUrl, baseUrl) {
  return __async(this, null, function* () {
    try {
      var html = yield fetchText(playerUrl, {
        headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: pageUrl, Origin: baseUrl })
      });
      var qcUrls = extractQualityScriptUrls(html, baseUrl);
      if (qcUrls.length > 0) {
        return qcUrls.map(function(url) {
          var quality = "auto";
          if (/hd1080/i.test(url))
            quality = "1080p";
          else if (/hd720/i.test(url))
            quality = "720p";
          else if (/sd480/i.test(url))
            quality = "480p";
          else if (/sd360/i.test(url))
            quality = "360p";
          return {
            url,
            quality,
            headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: baseUrl + "/", Origin: baseUrl })
          };
        });
      }
      var literalUrls = extractLiteralUrls(html);
      return literalUrls.map(function(url) {
        return {
          url,
          quality: "auto",
          headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: baseUrl + "/", Origin: baseUrl })
        };
      });
    } catch (e) {
      return [];
    }
  });
}
function buildStreams(directStreams) {
  var qualityOrder = { "1080p": 0, "720p": 1, "480p": 2, "360p": 3, "auto": 4 };
  var sorted = directStreams.slice().sort(function(a, b) {
    var oa = a.quality in qualityOrder ? qualityOrder[a.quality] : 99;
    var ob = b.quality in qualityOrder ? qualityOrder[b.quality] : 99;
    return oa - ob;
  });
  var streams = [];
  for (var i = 0; i < sorted.length; i++) {
    var s = sorted[i];
    var label = s.quality === "auto" ? "Auto" : s.quality;
    streams.push({
      name: "FaselHDX - " + label,
      title: label,
      url: s.url,
      quality: label,
      headers: s.headers
    });
  }
  return streams;
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (typeof tmdbId === "string" && /^https?:\/\//i.test(tmdbId)) {
      var baseUrl = yield resolveBaseUrl();
      return yield extractFromPage(tmdbId, baseUrl);
    }
    var parallel = yield Promise.all([resolveBaseUrl(), resolveTmdbMeta(tmdbId, mediaType)]);
    var baseUrl = parallel[0];
    var tmdbMeta = parallel[1];
    var pageUrl = yield resolvePageUrl(tmdbMeta, mediaType, season, episode, baseUrl);
    if (!pageUrl)
      return [];
    return yield extractFromPage(pageUrl, baseUrl);
  });
}
function extractFromPage(pageUrl, baseUrl) {
  return __async(this, null, function* () {
    var html = yield fetchText(pageUrl, {
      headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: baseUrl + "/main" })
    });
    var playerUrls = extractPlayerUrls(html);
    var allStreams = [];
    for (var i = 0; i < playerUrls.length; i++) {
      var streams = yield resolveDirectFromPlayer(playerUrls[i], pageUrl, baseUrl);
      allStreams.push.apply(allStreams, streams);
      if (allStreams.length > 0)
        break;
    }
    var result = buildStreams(allStreams);
    var seen = {};
    var deduped = [];
    for (var j = 0; j < result.length; j++) {
      if (!result[j].url || seen[result[j].url])
        continue;
      seen[result[j].url] = true;
      deduped.push(result[j]);
    }
    return deduped;
  });
}

// src/faselhdx/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[FaselHDX] Request: ${mediaType} ${tmdbId}`);
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      console.error(`[FaselHDX] Error: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
