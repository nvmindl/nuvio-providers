/**
 * witanime - Built from src/witanime/
 * Generated: 2026-03-27T04:42:45.156Z
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

// src/witanime/http.js
var SEED_URL = "https://witanime.life";
var FALLBACKS = [
  "https://witanime.com",
  "https://witanime.day",
  "https://witanime.xyz",
  "https://witanime.one",
  "https://witanime.plus"
];
var cachedBase = "";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.8,en;q=0.5"
};
function getBaseUrl() {
  return __async(this, null, function* () {
    if (cachedBase)
      return cachedBase;
    var resolved = yield probeUrl(SEED_URL);
    if (resolved) {
      cachedBase = resolved;
      console.log("[WitAnime] Domain: " + cachedBase);
      return cachedBase;
    }
    for (var i = 0; i < FALLBACKS.length; i++) {
      resolved = yield probeUrl(FALLBACKS[i]);
      if (resolved) {
        cachedBase = resolved;
        console.log("[WitAnime] Domain (fallback): " + cachedBase);
        return cachedBase;
      }
    }
    cachedBase = SEED_URL;
    console.log("[WitAnime] Domain (default): " + cachedBase);
    return cachedBase;
  });
}
function probeUrl(url) {
  return __async(this, null, function* () {
    try {
      var r = yield fetch(url + "/", {
        method: "GET",
        redirect: "manual",
        headers: HEADERS
      });
      if ((r.status === 301 || r.status === 302 || r.status === 307 || r.status === 308) && r.headers.get("location")) {
        var loc = r.headers.get("location");
        var m = loc.match(/^(https?:\/\/[^\/]+)/);
        if (m) {
          var r2 = yield fetch(m[1] + "/", {
            method: "GET",
            redirect: "manual",
            headers: HEADERS
          });
          if ((r2.status === 301 || r2.status === 302) && r2.headers.get("location")) {
            var loc2 = r2.headers.get("location");
            var m2 = loc2.match(/^(https?:\/\/[^\/]+)/);
            if (m2)
              return m2[1];
          }
          return m[1];
        }
      }
      if (r.status > 0) {
        return url;
      }
    } catch (e) {
      console.log("[WitAnime] probe fail " + url + ": " + e.message);
    }
    return null;
  });
}
function fetchText(url, opts) {
  return __async(this, null, function* () {
    opts = opts || {};
    var controller;
    var timeoutId;
    try {
      controller = new AbortController();
      timeoutId = setTimeout(function() {
        controller.abort();
      }, opts.timeout || 15e3);
    } catch (e) {
      controller = null;
    }
    try {
      var hdrs = {};
      for (var k in HEADERS)
        hdrs[k] = HEADERS[k];
      if (opts.headers)
        for (var k2 in opts.headers)
          hdrs[k2] = opts.headers[k2];
      var fetchOpts = {
        method: opts.method || "GET",
        redirect: "follow",
        headers: hdrs
      };
      if (opts.body)
        fetchOpts.body = opts.body;
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
      console.log("[WitAnime] fetch err: " + e.message);
      return "";
    }
  });
}

// src/witanime/extractor.js
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE = "https://api.themoviedb.org/3";
function getTmdbMeta(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var type = mediaType === "movie" ? "movie" : "tv";
    var url = TMDB_BASE + "/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=en-US";
    try {
      var r = yield fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
      });
      if (!r.ok)
        return null;
      var d = yield r.json();
      return {
        title: d.title || d.name || "",
        originalTitle: d.original_title || d.original_name || "",
        year: (d.release_date || d.first_air_date || "").split("-")[0],
        seasons: d.seasons || []
      };
    } catch (e) {
      console.log("[WitAnime] TMDB err: " + e.message);
      return null;
    }
  });
}
function slugify(t) {
  return t.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function buildSearchQueries(meta) {
  var queries = [];
  if (meta.title)
    queries.push(meta.title);
  if (meta.originalTitle && meta.originalTitle !== meta.title) {
    queries.push(meta.originalTitle);
  }
  if (meta.title) {
    var first = meta.title.replace(/[''][s]?\s/g, " ").split(/\s+/)[0];
    if (first && first.length > 1) {
      var dup = false;
      for (var i = 0; i < queries.length; i++) {
        if (queries[i].toLowerCase() === first.toLowerCase()) {
          dup = true;
          break;
        }
      }
      if (!dup)
        queries.push(first);
    }
  }
  return queries;
}
function searchAnime(base, title) {
  return __async(this, null, function* () {
    var url = base + "/?search_param=animes&s=" + encodeURIComponent(title);
    console.log("[WitAnime] Search: " + title);
    var html = yield fetchText(url);
    if (!html)
      return [];
    var results = [];
    var re = /href="(https?:\/\/[^"]+\/anime\/([a-z0-9][a-z0-9-]*[a-z0-9])\/?)"/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
      var slug = m[2];
      var dup = false;
      for (var i = 0; i < results.length; i++) {
        if (results[i].slug === slug) {
          dup = true;
          break;
        }
      }
      if (!dup)
        results.push({ url: m[1], slug });
    }
    if (results.length === 0) {
      var fbRe = /href="(https?:\/\/[^"]+\/([a-z0-9][a-z0-9-]*[a-z0-9])\/?)"/gi;
      while ((m = fbRe.exec(html)) !== null) {
        var url = m[1];
        var slug = m[2];
        if (/^(anime|episode|category|tag|page|search|contact|about|genre|year|series-list|episodes-list)$/.test(slug))
          continue;
        var dup = false;
        for (var i = 0; i < results.length; i++) {
          if (results[i].slug === slug) {
            dup = true;
            break;
          }
        }
        if (!dup)
          results.push({ url, slug });
      }
    }
    console.log("[WitAnime] Results: " + results.length);
    return results;
  });
}
function getSeasonName(meta, seasonNum) {
  if (!meta.seasons)
    return "";
  for (var i = 0; i < meta.seasons.length; i++) {
    if (meta.seasons[i].season_number === seasonNum) {
      return meta.seasons[i].name || "";
    }
  }
  return "";
}
function pickBestWithSeason(results, title, seasonName) {
  var seasonWords = [];
  if (seasonName) {
    seasonWords = slugify(seasonName).split("-").filter(function(w) {
      return w.length > 2 && ["the", "and", "part", "season"].indexOf(w) < 0;
    });
  }
  var ts = slugify(title);
  var titleWords = ts.split("-").filter(function(w) {
    return w.length > 2;
  });
  var best = null;
  var bestScore = -1;
  for (var i = 0; i < results.length; i++) {
    var s = results[i].slug;
    var score = 0;
    for (var j = 0; j < titleWords.length; j++) {
      if (s.indexOf(titleWords[j]) > -1)
        score++;
    }
    var seasonHits = 0;
    for (var k = 0; k < seasonWords.length; k++) {
      if (s.indexOf(seasonWords[k]) > -1) {
        score += 10;
        seasonHits++;
      }
    }
    if (s === ts)
      score += 5;
    if (seasonHits === 0 && seasonWords.length === 0) {
      score += Math.max(0, 50 - s.length) * 0.1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = results[i];
    }
  }
  return best;
}
function findAnime(base, meta, season) {
  return __async(this, null, function* () {
    var queries = buildSearchQueries(meta);
    var results = [];
    for (var i = 0; i < queries.length && results.length === 0; i++) {
      results = yield searchAnime(base, queries[i]);
    }
    if (results.length === 0)
      return null;
    var sn = parseInt(season, 10) || 0;
    var seasonName = sn > 0 ? getSeasonName(meta, sn) : "";
    console.log("[WitAnime] Season name: " + (seasonName || "(none)"));
    var match = pickBestWithSeason(results, meta.title, seasonName);
    if (!match && meta.originalTitle) {
      match = pickBestWithSeason(results, meta.originalTitle, seasonName);
    }
    if (!match)
      match = results[0];
    return match;
  });
}
function extractEmbeds(html) {
  var urls = [];
  var seen = {};
  function add(u) {
    if (!u)
      return;
    var url = u;
    if (url.indexOf("http") !== 0) {
      try {
        url = atob(url.padEnd(url.length + (4 - url.length % 4) % 4, "="));
      } catch (e) {
      }
    }
    if (url.indexOf("http") === 0 && !seen[url] && url.indexOf("witanime") < 0) {
      urls.push(url);
      seen[url] = true;
    }
  }
  var m;
  var attrPatterns = [
    /data-url="([^"]+)"/gi,
    /data-embed-url="([^"]+)"/gi,
    /data-ep-url="([^"]+)"/gi,
    /data-src="([^"]+)"/gi,
    /data-link="([^"]+)"/gi,
    /data-ep="([^"]+)"/gi
  ];
  for (var p = 0; p < attrPatterns.length; p++) {
    while ((m = attrPatterns[p].exec(html)) !== null)
      add(m[1]);
  }
  var ire = /<iframe[^>]+src="([^"]+)"/gi;
  while ((m = ire.exec(html)) !== null)
    add(m[1]);
  var jsRe = /"url"\s*:\s*"([^"]+)"/gi;
  while ((m = jsRe.exec(html)) !== null)
    add(m[1]);
  return urls;
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
function resolveEmbed(embedUrl, referer) {
  return __async(this, null, function* () {
    var html = yield fetchText(embedUrl, {
      headers: { "Referer": referer },
      timeout: 1e4
    });
    if (!html)
      return null;
    var m = html.match(/(?:file|source|src)\s*[:=]\s*["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/i);
    if (m)
      return m[1];
    var sa = html.match(/sources\s*[:=]\s*\[([^\]]+)\]/);
    if (sa) {
      var sm = sa[1].match(/"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
      if (sm)
        return sm[1];
    }
    if (html.indexOf("eval(function(p,a,c,k,e,d)") > -1) {
      var dec = unpackPACK(html);
      if (dec) {
        var pm = dec.match(/(?:file|source)\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
        if (pm)
          return pm[1];
      }
    }
    var am = html.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/);
    if (am)
      return am[0];
    var mp = html.match(/(?:file|source|src)\s*[:=]\s*["'](https?:\/\/[^"']*\.mp4[^"']*)["']/i);
    if (mp)
      return mp[1];
    return null;
  });
}
function getServerName(url) {
  try {
    var h = url.match(/https?:\/\/([^\/]+)/)[1];
    if (h.indexOf("yonaplay") > -1)
      return "YonaPlay";
    if (h.indexOf("streamwish") > -1)
      return "StreamWish";
    if (h.indexOf("filemoon") > -1)
      return "FileMoon";
    if (h.indexOf("videa") > -1)
      return "Videa";
    if (h.indexOf("dailymotion") > -1)
      return "Dailymotion";
    if (h.indexOf("yourupload") > -1)
      return "YourUpload";
    if (h.indexOf("mp4upload") > -1)
      return "MP4Upload";
    return h.split(".")[0];
  } catch (e) {
    return "Server";
  }
}
var EP_SLUG = "%d8%a7%d9%84%d8%ad%d9%84%d9%82%d8%a9";
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var base = yield getBaseUrl();
    var meta = yield getTmdbMeta(tmdbId, mediaType);
    if (!meta || !meta.title) {
      console.log("[WitAnime] No TMDB meta for " + tmdbId);
      return [];
    }
    console.log("[WitAnime] " + meta.title + " (" + meta.year + ")");
    var match = yield findAnime(base, meta, season);
    if (!match) {
      console.log("[WitAnime] Not found");
      return [];
    }
    console.log("[WitAnime] Match: " + match.slug);
    var ep = parseInt(episode, 10) || 1;
    var epUrl = base + "/episode/" + match.slug + "-" + EP_SLUG + "-" + ep + "/";
    console.log("[WitAnime] Episode: " + epUrl);
    var epHtml = yield fetchText(epUrl);
    if ((!epHtml || epHtml.length < 500) && mediaType === "movie") {
      console.log("[WitAnime] Try anime page: " + match.url);
      epHtml = yield fetchText(match.url);
    }
    if (!epHtml || epHtml.length < 500) {
      console.log("[WitAnime] Episode not found");
      return [];
    }
    var embeds = extractEmbeds(epHtml);
    console.log("[WitAnime] Embeds: " + embeds.length);
    if (embeds.length === 0)
      return [];
    var streams = [];
    for (var i = 0; i < embeds.length && streams.length < 5; i++) {
      try {
        var streamUrl = yield resolveEmbed(embeds[i], base + "/");
        if (streamUrl) {
          streams.push({
            name: "WitAnime",
            title: getServerName(embeds[i]),
            url: streamUrl,
            quality: "auto",
            headers: { "Referer": embeds[i] }
          });
        }
      } catch (e) {
        console.log("[WitAnime] Embed err: " + e.message);
      }
    }
    console.log("[WitAnime] Streams: " + streams.length);
    return streams;
  });
}

// src/witanime/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[WitAnime] Request: " + mediaType + " " + tmdbId);
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      console.error("[WitAnime] Error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
