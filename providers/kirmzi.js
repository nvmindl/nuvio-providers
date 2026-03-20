/**
 * kirmzi - Built from src/kirmzi/
 * Generated: 2026-03-20T21:53:15.127Z
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
var T123_BASE = "https://turkish123.ac";
function resolveTmdbMeta(tmdbId) {
  return __async(this, null, function* () {
    var arUrl = TMDB_API_BASE + "/tv/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=ar-SA";
    var enUrl = TMDB_API_BASE + "/tv/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=en-US";
    var fetchOpts = { method: "GET", headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } };
    var results = yield Promise.all([
      fetch(arUrl, fetchOpts).then(function(r) {
        return r.ok ? r.json() : {};
      }),
      fetch(enUrl, fetchOpts).then(function(r) {
        return r.ok ? r.json() : {};
      })
    ]);
    var arData = results[0];
    var enData = results[1];
    var year = "";
    if (enData.first_air_date)
      year = enData.first_air_date.split("-")[0];
    return {
      arabicTitle: arData.name || "",
      englishTitle: enData.name || "",
      originalTitle: enData.original_name || "",
      year
    };
  });
}
var TURKISH_MAP = {
  "\u015F": "s",
  "\u015E": "s",
  // ş Ş
  "\xFC": "u",
  "\xDC": "u",
  // ü Ü
  "\xF6": "o",
  "\xD6": "o",
  // ö Ö
  "\xE7": "c",
  "\xC7": "c",
  // ç Ç
  "\u0131": "i",
  "\u0130": "i",
  // ı İ
  "\u011F": "g",
  "\u011E": "g"
  // ğ Ğ
};
var TURKISH_RE = /[\u015f\u015e\u00fc\u00dc\u00f6\u00d6\u00e7\u00c7\u0131\u0130\u011f\u011e]/g;
function romanizeToSlug(name) {
  var romanized = name.replace(TURKISH_RE, function(c) {
    return TURKISH_MAP[c] || c;
  });
  return romanized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function buildAlbaSlugs(meta, season, episode) {
  var ep = "s" + String(season).padStart(2, "0") + "e" + String(episode).padStart(2, "0");
  var seen = {};
  var slugs = [];
  function add(base) {
    if (!base || seen[base])
      return;
    seen[base] = true;
    if (meta.year)
      slugs.push(base + "-" + meta.year + "-" + ep);
    slugs.push(base + "-" + ep);
  }
  if (meta.originalTitle) {
    add(romanizeToSlug(meta.originalTitle.split(":")[0].trim()));
    add(romanizeToSlug(meta.originalTitle));
    add(romanizeToSlug(meta.originalTitle.replace(/\bve\b/gi, "and")));
    add(romanizeToSlug(meta.originalTitle.replace(/\band\b/gi, "ve")));
  }
  if (meta.englishTitle) {
    add(romanizeToSlug(meta.englishTitle.split(":")[0].trim()));
    add(romanizeToSlug(meta.englishTitle));
    var noThe = meta.englishTitle.replace(/^the\s+/i, "");
    if (noThe !== meta.englishTitle)
      add(romanizeToSlug(noThe));
  }
  return slugs;
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
function extractMp4FromUnpacked(unpacked) {
  var mp4Match = unpacked.match(/(?:file|src|download)\s*:\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/);
  if (mp4Match)
    return mp4Match[1];
  var fallback = unpacked.match(/https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/);
  return fallback ? fallback[0] : "";
}
function extractMp4FromHtml(html) {
  var mp4Match = html.match(/(?:href|src)=["'](https?:\/\/[^"']*\.mp4[^"']*)["']/i);
  if (mp4Match)
    return mp4Match[1];
  return "";
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
    var mp4 = extractMp4FromHtml(html);
    var packed = extractPackedBlock(html);
    if (!packed && !mp4)
      return null;
    var m3u8 = "";
    if (packed) {
      var unpacked = unpackPACK(packed);
      if (unpacked) {
        m3u8 = extractM3u8FromUnpacked(unpacked);
        if (!mp4)
          mp4 = extractMp4FromUnpacked(unpacked);
      }
    }
    if (!m3u8 && !mp4)
      return null;
    return { m3u8, mp4, embedUrl };
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
  if (!result || !result.m3u8 && !result.mp4)
    return [];
  var headers = buildStreamHeaders(result.embedUrl);
  var streams = [];
  if (result.m3u8) {
    var variants = deriveVariantUrls(result.m3u8);
    if (variants.length > 0) {
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
    } else {
      streams.push({
        name: "Kirmzi - Auto",
        title: "Auto",
        url: result.m3u8,
        quality: "auto",
        headers
      });
    }
  }
  if (result.mp4) {
    streams.push({
      name: "Kirmzi - Download",
      title: "MP4 Download",
      url: result.mp4,
      quality: "auto",
      headers
    });
  }
  return streams;
}
function buildT123Streams(result) {
  if (!result || !result.m3u8 && !result.mp4)
    return [];
  var headers = buildStreamHeaders(result.embedUrl);
  var streams = [];
  if (result.m3u8) {
    var variants = deriveVariantUrls(result.m3u8);
    if (variants.length > 0) {
      for (var i = 0; i < variants.length; i++) {
        streams.push({
          name: "Kirmzi - " + variants[i].quality,
          title: variants[i].quality,
          url: variants[i].url,
          quality: variants[i].quality,
          headers
        });
      }
    } else {
      streams.push({
        name: "Kirmzi - Auto",
        title: "Auto",
        url: result.m3u8,
        quality: "auto",
        headers
      });
    }
  }
  if (result.mp4) {
    streams.push({
      name: "Kirmzi - Download",
      title: "MP4 Download",
      url: result.mp4,
      quality: "auto",
      headers
    });
  }
  return streams;
}
function extractSeriesUrls(html) {
  var urls = [];
  var re = /href="(https?:\/\/[^"]*\/series\/[^"]*)"/gi;
  var m;
  var seen = {};
  while ((m = re.exec(html)) !== null) {
    if (!seen[m[1]]) {
      seen[m[1]] = true;
      urls.push(m[1]);
    }
  }
  return urls;
}
function extractEpisodeUrls(html) {
  var urls = [];
  var re = /href="(https?:\/\/[^"]*\/episode\/[^"]*)"/gi;
  var m;
  var seen = {};
  while ((m = re.exec(html)) !== null) {
    if (!seen[m[1]]) {
      seen[m[1]] = true;
      urls.push(m[1]);
    }
  }
  return urls;
}
function findEpisodeUrl(episodeUrls, episode) {
  var epNum = parseInt(episode, 10);
  for (var i = 0; i < episodeUrls.length; i++) {
    var decoded = decodeURIComponent(episodeUrls[i]);
    var epMatch = decoded.match(/\u0627\u0644\u062d\u0644\u0642\u0629-(\d+)/);
    if (epMatch && parseInt(epMatch[1], 10) === epNum)
      return episodeUrls[i];
  }
  return "";
}
function searchForEpisode(meta, episode) {
  return __async(this, null, function* () {
    var terms = [];
    if (meta.arabicTitle)
      terms.push(meta.arabicTitle);
    if (meta.englishTitle && terms.indexOf(meta.englishTitle) < 0)
      terms.push(meta.englishTitle);
    if (meta.originalTitle && terms.indexOf(meta.originalTitle) < 0)
      terms.push(meta.originalTitle);
    for (var t = 0; t < terms.length; t++) {
      var result = yield searchSiteForEpisode(terms[t], episode);
      if (result)
        return result;
    }
    return "";
  });
}
function searchSiteForEpisode(query, episode) {
  return __async(this, null, function* () {
    var base = getBaseUrl();
    var searchUrl = base + "/?s=" + encodeURIComponent(query);
    console.log("[Kirmzi] Searching: " + decodeURIComponent(searchUrl).substring(0, 80));
    var searchHtml = yield fetchText(searchUrl);
    if (!searchHtml)
      return "";
    var episodeUrls = extractEpisodeUrls(searchHtml);
    var directMatch = findEpisodeUrl(episodeUrls, episode);
    if (directMatch) {
      console.log("[Kirmzi] Found episode directly in search results");
      return directMatch;
    }
    var seriesUrls = extractSeriesUrls(searchHtml);
    for (var i = 0; i < seriesUrls.length; i++) {
      console.log("[Kirmzi] Checking series: " + decodeURIComponent(seriesUrls[i]).substring(0, 80));
      var seriesHtml = yield fetchText(seriesUrls[i]);
      if (!seriesHtml)
        continue;
      var epUrls = extractEpisodeUrls(seriesHtml);
      var match = findEpisodeUrl(epUrls, episode);
      if (match) {
        console.log("[Kirmzi] Found episode from series page");
        return match;
      }
    }
    return "";
  });
}
function raceAlbaSlugs(slugs) {
  return __async(this, null, function* () {
    if (slugs.length === 0)
      return null;
    console.log("[Kirmzi] Racing " + slugs.length + " alba slugs...");
    var results = yield Promise.all(slugs.map(function(s) {
      var url = ALBA_BASE + "/" + s + "/";
      return tryExtractFromAlba(url).then(function(r) {
        if (r)
          r.slug = s;
        return r;
      }).catch(function() {
        return null;
      });
    }));
    for (var i = 0; i < results.length; i++) {
      if (results[i]) {
        console.log("[Kirmzi] Won with slug: " + results[i].slug);
        return results[i];
      }
    }
    return null;
  });
}
function buildT123Slugs(meta) {
  var seen = {};
  var slugs = [];
  function add(base) {
    if (!base || seen[base])
      return;
    seen[base] = true;
    slugs.push(base);
  }
  if (meta.originalTitle) {
    add(romanizeToSlug(meta.originalTitle));
    add(romanizeToSlug(meta.originalTitle.split(":")[0].trim()));
  }
  if (meta.englishTitle) {
    add(meta.englishTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    var noThe = meta.englishTitle.replace(/^the\s+/i, "");
    if (noThe !== meta.englishTitle)
      add(noThe.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  }
  return slugs;
}
function computeAbsoluteEpisode(tmdbId, season, episode) {
  return __async(this, null, function* () {
    var s = parseInt(season, 10);
    var e = parseInt(episode, 10);
    if (s <= 1)
      return e;
    var total = 0;
    for (var i = 1; i < s; i++) {
      var url = TMDB_API_BASE + "/tv/" + tmdbId + "/season/" + i + "?api_key=" + TMDB_API_KEY;
      try {
        var r = yield fetch(url, { method: "GET", headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } });
        if (r.ok) {
          var data = yield r.json();
          total += data.episodes ? data.episodes.length : 0;
        }
      } catch (err) {
      }
    }
    return total + e;
  });
}
function findT123Slug(meta) {
  return __async(this, null, function* () {
    var slugs = buildT123Slugs(meta);
    var checks = yield Promise.all(slugs.map(function(s) {
      var url = T123_BASE + "/" + s + "/";
      return fetchText(url, { timeout: 8e3 }).then(function(html) {
        if (html && html.indexOf("episodi") > -1)
          return s;
        return null;
      }).catch(function() {
        return null;
      });
    }));
    for (var i = 0; i < checks.length; i++) {
      if (checks[i])
        return checks[i];
    }
    var terms = [];
    if (meta.originalTitle && terms.indexOf(meta.originalTitle) < 0)
      terms.push(meta.originalTitle);
    if (meta.englishTitle && terms.indexOf(meta.englishTitle) < 0)
      terms.push(meta.englishTitle);
    for (var t = 0; t < terms.length; t++) {
      var searchUrl = T123_BASE + "/?s=" + encodeURIComponent(terms[t]);
      var searchHtml = yield fetchText(searchUrl, { timeout: 8e3 });
      if (!searchHtml)
        continue;
      var re = /href="https:\/\/turkish123\.ac\/([a-z0-9-]+)\/"/g;
      var m;
      while ((m = re.exec(searchHtml)) !== null) {
        var slug = m[1];
        if (!/genre|year|series-list|episodes-list|calendar|contact|home|page|wp-|tag|category|sitemap|about|ryh6/.test(slug)) {
          return slug;
        }
      }
    }
    return null;
  });
}
function extractT123Embeds(html) {
  var embeds = [];
  var re = /iframe[^>]*src="(https?:\/\/(?:tukipasti|kitraskimisi|engifuosi|rufiiguta|lajkema)[^"]+)"/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    embeds.push(m[1]);
  }
  return embeds;
}
function extractM3u8FromT123Embed(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchText(embedUrl, { timeout: 8e3 });
    if (!html)
      return null;
    var m3u8 = "";
    var mp4 = "";
    var m3u8Direct = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    if (m3u8Direct)
      m3u8 = m3u8Direct[0];
    var mp4Direct = extractMp4FromHtml(html);
    if (mp4Direct)
      mp4 = mp4Direct;
    var packed = extractPackedBlock(html);
    if (packed) {
      var unpacked = unpackPACK(packed);
      if (unpacked) {
        if (!m3u8)
          m3u8 = extractM3u8FromUnpacked(unpacked);
        if (!mp4)
          mp4 = extractMp4FromUnpacked(unpacked);
      }
    }
    if (!m3u8 && !mp4)
      return null;
    return { m3u8, mp4 };
  });
}
function extractFromT123(meta, tmdbId, season, episode) {
  return __async(this, null, function* () {
    console.log("[Kirmzi] Trying turkish123 backup...");
    var slug = yield findT123Slug(meta);
    if (!slug) {
      console.log("[Kirmzi] turkish123: show not found");
      return null;
    }
    console.log('[Kirmzi] turkish123: found slug "' + slug + '"');
    var absEp = yield computeAbsoluteEpisode(tmdbId, season, episode);
    var epUrl = T123_BASE + "/" + slug + "-episode-" + absEp + "/";
    console.log("[Kirmzi] turkish123: fetching episode " + absEp);
    var epHtml = yield fetchText(epUrl, { timeout: 8e3 });
    if (!epHtml || epHtml.indexOf("iframe") < 0) {
      console.log("[Kirmzi] turkish123: episode page empty or no embeds");
      return null;
    }
    var embeds = extractT123Embeds(epHtml);
    if (embeds.length === 0) {
      console.log("[Kirmzi] turkish123: no embed iframes found");
      return null;
    }
    console.log("[Kirmzi] turkish123: found " + embeds.length + " embeds");
    var results = yield Promise.all(embeds.map(function(u) {
      return extractM3u8FromT123Embed(u).catch(function() {
        return null;
      });
    }));
    for (var i = 0; i < results.length; i++) {
      if (results[i]) {
        console.log("[Kirmzi] turkish123: got stream from " + embeds[i].match(/\/\/([^\/]+)/)[1]);
        return { m3u8: results[i].m3u8 || "", mp4: results[i].mp4 || "", embedUrl: embeds[i] };
      }
    }
    console.log("[Kirmzi] turkish123: no m3u8 extracted from embeds");
    return null;
  });
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
    if (!meta.arabicTitle && !meta.englishTitle && !meta.originalTitle) {
      console.log("[Kirmzi] No title found from TMDB");
      return [];
    }
    console.log("[Kirmzi] Titles: AR=" + meta.arabicTitle + " EN=" + meta.englishTitle + " ORIG=" + meta.originalTitle);
    var candidateSlugs = buildAlbaSlugs(meta, season, episode);
    var result = yield raceAlbaSlugs(candidateSlugs);
    if (result)
      return buildStreams(result);
    var t123Result = yield extractFromT123(meta, tmdbId, season, episode);
    if (t123Result) {
      var t123Streams = buildT123Streams(t123Result);
      if (t123Streams.length > 0)
        return t123Streams;
    }
    console.log("[Kirmzi] Backup failed, trying kirmzi site...");
    var albaUrl = "";
    if (meta.arabicTitle) {
      var episodeUrl = buildEpisodeUrl(meta.arabicTitle, episode);
      var episodeHtml = yield fetchText(episodeUrl, { timeout: 5e3 });
      albaUrl = episodeHtml ? extractAlbaplayerUrl(episodeHtml) : "";
      if (!albaUrl) {
        var searchedUrl = yield searchForEpisode(meta, episode);
        if (searchedUrl) {
          episodeHtml = yield fetchText(searchedUrl, { timeout: 5e3 });
          albaUrl = episodeHtml ? extractAlbaplayerUrl(episodeHtml) : "";
        }
      }
    }
    if (!albaUrl) {
      console.log("[Kirmzi] No streams found");
      return [];
    }
    result = yield tryExtractFromAlba(albaUrl);
    if (!result)
      return [];
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
