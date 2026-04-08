/**
 * witanime - Built from src/witanime/
 * Generated: 2026-04-08T17:24:37.330Z
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
var BACKEND_URL = "http://145.241.158.129:3111";
var WITANIME_DOMAIN = "https://witanime.life";
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var EP_SLUG = "%d8%a7%d9%84%d8%ad%d9%84%d9%82%d8%a9";
function fetchText(url, opts) {
  return __async(this, null, function* () {
    opts = opts || {};
    var headers = {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
      "Accept-Language": "ar,en;q=0.5"
    };
    if (opts.referer)
      headers["Referer"] = opts.referer;
    if (opts.headers) {
      var keys = Object.keys(opts.headers);
      for (var i = 0; i < keys.length; i++)
        headers[keys[i]] = opts.headers[keys[i]];
    }
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
      var fetchOpts = { method: "GET", headers, redirect: "follow" };
      if (controller)
        fetchOpts.signal = controller.signal;
      var resp = yield fetch(url, fetchOpts);
      if (timeoutId)
        clearTimeout(timeoutId);
      if (!resp.ok)
        return "";
      return yield resp.text();
    } catch (e) {
      if (timeoutId)
        clearTimeout(timeoutId);
      console.log("[WitAnime] fetchText error: " + e.message + " url=" + url);
      return "";
    }
  });
}
function fetchJson(url, opts) {
  return __async(this, null, function* () {
    opts = opts || {};
    var headers = { "Accept": "application/json", "User-Agent": "NuvioApp/1.0" };
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
      var fetchOpts = { method: "GET", headers };
      if (controller)
        fetchOpts.signal = controller.signal;
      var resp = yield fetch(url, fetchOpts);
      if (timeoutId)
        clearTimeout(timeoutId);
      if (!resp.ok)
        return null;
      return yield resp.json();
    } catch (e) {
      if (timeoutId)
        clearTimeout(timeoutId);
      console.log("[WitAnime] fetchJson error: " + e.message);
      return null;
    }
  });
}
function getTmdbMeta(tmdbId, type) {
  return __async(this, null, function* () {
    var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=en-US&append_to_response=alternative_titles,external_ids";
    var data = yield fetchJson(url);
    if (!data)
      return null;
    var title = data.title || data.name || "";
    var original = data.original_title || data.original_name || "";
    var year = (data.release_date || data.first_air_date || "").substring(0, 4);
    var genres = (data.genres || []).map(function(g) {
      return g.name;
    });
    var isAnime = genres.indexOf("Animation") > -1 || genres.indexOf("Anime") > -1 || data.origin_country && data.origin_country.indexOf("JP") > -1 || data.original_language === "ja";
    var altTitles = [];
    if (original && original !== title)
      altTitles.push(original);
    var atArr = data.alternative_titles || {};
    var atList = atArr.titles || atArr.results || [];
    for (var i = 0; i < atList.length; i++) {
      var at = atList[i].title || atList[i].name || "";
      if (at && altTitles.indexOf(at) < 0 && at !== title)
        altTitles.push(at);
    }
    return { title, originalTitle: original, altTitles, year, isAnime };
  });
}
function witSearch(query) {
  return __async(this, null, function* () {
    var url = WITANIME_DOMAIN + "/?search_param=animes&s=" + encodeURIComponent(query);
    console.log("[WitAnime] Search: " + query);
    var html = yield fetchText(url);
    if (!html)
      return [];
    var results = [];
    var seen = {};
    var re = /href="(https?:\/\/[^"]*\/anime\/([a-z0-9][a-z0-9-]*[a-z0-9])\/?)"/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
      var slug = m[2];
      if (!seen[slug]) {
        seen[slug] = true;
        results.push({ url: m[1], slug });
      }
    }
    console.log("[WitAnime] Search results: " + results.length);
    return results;
  });
}
function buildSearchQueries(meta) {
  var queries = [];
  function add(q) {
    q = (q || "").trim();
    if (q && queries.indexOf(q) < 0)
      queries.push(q);
  }
  add(meta.title);
  add(meta.originalTitle);
  if (meta.altTitles) {
    for (var i = 0; i < Math.min(meta.altTitles.length, 3); i++)
      add(meta.altTitles[i]);
  }
  if (meta.title && meta.title.split(" ").length > 2) {
    add(meta.title.split(" ").slice(0, 2).join(" "));
  }
  return queries;
}
function titleScore(slug, title) {
  var s = slug.toLowerCase().replace(/-/g, " ");
  var t = title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (s === t)
    return 1;
  var sWords = s.split(" ").filter(function(w) {
    return w.length > 1;
  });
  var tWords = t.split(" ").filter(function(w) {
    return w.length > 1;
  });
  var matches = 0;
  for (var i = 0; i < tWords.length; i++) {
    if (sWords.indexOf(tWords[i]) > -1)
      matches++;
  }
  return tWords.length > 0 ? matches / tWords.length : 0;
}
function pickBest(results, title) {
  var best = null;
  var bestScore = 0;
  for (var i = 0; i < results.length; i++) {
    var score = titleScore(results[i].slug, title);
    if (score > bestScore) {
      bestScore = score;
      best = results[i];
    }
  }
  return bestScore >= 0.4 ? best : null;
}
function guessEpisodeSlug(animeSlug) {
  var parts = animeSlug.split("-");
  if (parts.length > 1) {
    var last = parts[parts.length - 1];
    if (last.length >= 2 && last.length <= 5 && /^[a-z]+$/.test(last)) {
      return parts.slice(0, -1).join("-");
    }
  }
  return animeSlug;
}
function fetchEpisodePage(animeSlug, ep) {
  return __async(this, null, function* () {
    var guessed = guessEpisodeSlug(animeSlug);
    var candidates = [guessed];
    if (animeSlug !== guessed)
      candidates.push(animeSlug);
    var promises = candidates.map(function(slug) {
      var url = WITANIME_DOMAIN + "/episode/" + encodeURIComponent(slug) + "-" + EP_SLUG + "-" + ep + "/";
      return fetchText(url).then(function(html) {
        if (html && html.length > 500)
          return html;
        return null;
      }).catch(function() {
        return null;
      });
    });
    var animePagePromise = fetchText(WITANIME_DOMAIN + "/anime/" + animeSlug + "/");
    var results = yield Promise.all(promises);
    for (var i = 0; i < results.length; i++) {
      if (results[i])
        return results[i];
    }
    console.log("[WitAnime] Slug guesses failed, trying anime page");
    var animeHtml = yield animePagePromise;
    if (!animeHtml)
      return null;
    var epSlugMatch = animeHtml.match(/\/episode\/([^\/\"']+?)(?:-%d8%a7%d9%84%d8%ad%d9%84%d9%82%d8%a9|-\u0627\u0644\u062d\u0644\u0642\u0629)/i);
    if (epSlugMatch) {
      var realSlug = decodeURIComponent(epSlugMatch[1]);
      if (candidates.indexOf(realSlug) < 0) {
        var url2 = WITANIME_DOMAIN + "/episode/" + encodeURIComponent(realSlug) + "-" + EP_SLUG + "-" + ep + "/";
        var html2 = yield fetchText(url2);
        if (html2 && html2.length > 500)
          return html2;
      }
    }
    var epLinks = [];
    var epRe = /href="([^"]*\/episode\/[^"]+)"/gi;
    var em;
    while ((em = epRe.exec(animeHtml)) !== null)
      epLinks.push(em[1]);
    var unique = epLinks.filter(function(v, i2, a) {
      return a.indexOf(v) === i2;
    }).reverse();
    var epTarget = EP_SLUG + "-" + ep;
    var found = null;
    for (var j = 0; j < unique.length; j++) {
      if (unique[j].indexOf(epTarget + "/") > -1 || unique[j].indexOf(epTarget + "-") > -1) {
        found = unique[j];
        break;
      }
    }
    if (!found && ep <= unique.length)
      found = unique[ep - 1];
    if (found) {
      var html3 = yield fetchText(found);
      if (html3 && html3.length > 500)
        return html3;
    }
    return null;
  });
}
function extractEmbeds(html) {
  var embeds = [];
  var liRe = /<li[^>]+data-watch="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/li>/gi;
  var m;
  while ((m = liRe.exec(html)) !== null) {
    var url = m[1];
    var inner = m[2];
    var qm = inner.match(/\[(FHD|HD|SD)\]/i);
    var quality = qm ? qm[1].toUpperCase() : "HD";
    var name = inner.replace(/<[^>]+>/g, "").replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
    embeds.push({ url, name: name || "Server", quality });
  }
  console.log("[WitAnime] Extracted " + embeds.length + " embeds");
  return embeds;
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
function resolveMp4upload(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchText(embedUrl, { referer: embedUrl });
    if (!html)
      return null;
    var m = html.match(/src:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
    if (m)
      return { url: m[1], type: "mp4" };
    if (html.indexOf("eval(function(p,a,c,k,e,d)") > -1) {
      var dec = unpackPACK(html);
      if (dec) {
        var pm = dec.match(/src:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
        if (pm)
          return { url: pm[1], type: "mp4" };
      }
    }
    return null;
  });
}
function resolveGeneric(embedUrl) {
  return __async(this, null, function* () {
    var html = yield fetchText(embedUrl, { referer: embedUrl });
    if (!html)
      return null;
    var m = html.match(/(?:file|source)\s*:\s*["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/i);
    if (m)
      return { url: m[1], type: "hls" };
    m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (m)
      return { url: m[0], type: "hls" };
    if (html.indexOf("eval(function(p,a,c,k,e,d)") > -1) {
      var dec = unpackPACK(html);
      if (dec) {
        var pm = dec.match(/(?:file|source)\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
        if (pm)
          return { url: pm[1], type: "hls" };
        var pp = dec.match(/(?:file|source)\s*:\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/);
        if (pp)
          return { url: pp[1], type: "mp4" };
      }
    }
    var mp4 = html.match(/(?:src|file|source)\s*[:=]\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
    if (mp4)
      return { url: mp4[1], type: "mp4" };
    return null;
  });
}
function resolveViaBackend(embeds) {
  return __async(this, null, function* () {
    var controller;
    var timeoutId;
    try {
      controller = new AbortController();
      timeoutId = setTimeout(function() {
        controller.abort();
      }, 3e4);
    } catch (e) {
      controller = null;
    }
    try {
      var body = JSON.stringify({ embeds });
      var fetchOpts = {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "NuvioApp/1.0" },
        body
      };
      if (controller)
        fetchOpts.signal = controller.signal;
      var resp = yield fetch(BACKEND_URL + "/resolve-embeds", fetchOpts);
      if (timeoutId)
        clearTimeout(timeoutId);
      if (!resp.ok)
        return null;
      return yield resp.json();
    } catch (e) {
      if (timeoutId)
        clearTimeout(timeoutId);
      console.log("[WitAnime] Backend resolve error: " + e.message);
      return null;
    }
  });
}
var QUALITY_MAP = { "FHD": "1080p", "HD": "720p", "SD": "480p" };
var PLAY_HEADERS = {
  "User-Agent": UA,
  "Accept": "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "identity"
};
function getHostLabel(url) {
  try {
    var host = new URL(url).hostname;
    var parts = host.split(".");
    var name = parts.length >= 2 ? parts[parts.length - 2] : host;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch (e) {
    return "Server";
  }
}
var SKIP_HOSTS = [
  "mega.nz",
  "solidfiles",
  "4shared",
  "ok.ru",
  "vkvideo",
  "uptostream",
  "videa.hu",
  "vadbam",
  "dsvplay",
  "dood",
  "myvidplay"
];
function shouldSkip(url) {
  try {
    var host = new URL(url).hostname;
    return SKIP_HOSTS.some(function(s) {
      return host.indexOf(s) > -1;
    });
  } catch (e) {
    return true;
  }
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[WitAnime] " + mediaType + " " + tmdbId + " S" + (season || 0) + "E" + (episode || 0));
      var type = mediaType === "movie" ? "movie" : "tv";
      var meta = yield getTmdbMeta(tmdbId, type);
      if (!meta || !meta.title) {
        console.log("[WitAnime] No TMDB meta");
        return [];
      }
      if (!meta.isAnime) {
        console.log("[WitAnime] Not anime: " + meta.title);
        return [];
      }
      console.log("[WitAnime] Title: " + meta.title);
      var queries = buildSearchQueries(meta);
      var searchResults = [];
      for (var qi = 0; qi < queries.length; qi++) {
        searchResults = yield witSearch(queries[qi]);
        if (searchResults.length > 0)
          break;
      }
      if (!searchResults.length) {
        console.log("[WitAnime] No results for any query");
        return [];
      }
      var match = pickBest(searchResults, meta.title);
      if (!match && meta.originalTitle)
        match = pickBest(searchResults, meta.originalTitle);
      if (!match && meta.altTitles) {
        for (var ai = 0; ai < meta.altTitles.length; ai++) {
          match = pickBest(searchResults, meta.altTitles[ai]);
          if (match)
            break;
        }
      }
      if (!match) {
        console.log("[WitAnime] No quality match found");
        return [];
      }
      console.log("[WitAnime] Match: " + match.slug);
      var ep = parseInt(episode, 10) || 1;
      var epHtml;
      if (mediaType === "movie") {
        epHtml = yield fetchText(WITANIME_DOMAIN + "/anime/" + match.slug + "/");
        if (!epHtml) {
          console.log("[WitAnime] Movie page empty");
          return [];
        }
        var testEmbeds = extractEmbeds(epHtml);
        if (!testEmbeds.length) {
          epHtml = yield fetchEpisodePage(match.slug, 1);
        }
      } else {
        epHtml = yield fetchEpisodePage(match.slug, ep);
      }
      if (!epHtml) {
        console.log("[WitAnime] Episode page empty");
        return [];
      }
      var rawEmbeds = extractEmbeds(epHtml);
      if (!rawEmbeds.length) {
        console.log("[WitAnime] No embeds found");
        return [];
      }
      var filtered = rawEmbeds.filter(function(e) {
        return !shouldSkip(e.url);
      });
      console.log("[WitAnime] Filtered embeds: " + filtered.length);
      var backendResult = yield resolveViaBackend(filtered);
      var resolvedEmbeds = backendResult && backendResult.embeds ? backendResult.embeds : null;
      var streams = [];
      var limit = Math.min(filtered.length, 6);
      if (resolvedEmbeds) {
        for (var i = 0; i < Math.min(resolvedEmbeds.length, limit); i++) {
          var embed = resolvedEmbeds[i];
          var qualityLabel = QUALITY_MAP[embed.quality] || "720p";
          var hostLabel = embed.name || getHostLabel(embed.url || "");
          if (embed.resolved && embed.proxyUrl) {
            streams.push({
              name: "WitAnime " + hostLabel + " - " + qualityLabel,
              title: hostLabel + " (Proxy)",
              url: embed.proxyUrl,
              quality: qualityLabel,
              size: "Unknown",
              headers: PLAY_HEADERS,
              subtitles: [],
              provider: "witanime"
            });
          } else if (embed.resolved && embed.url) {
            var hdrs = Object.assign({}, PLAY_HEADERS);
            if (embed.referer)
              hdrs["Referer"] = embed.referer;
            streams.push({
              name: "WitAnime " + hostLabel + " - " + qualityLabel,
              title: hostLabel,
              url: embed.url,
              quality: qualityLabel,
              size: "Unknown",
              headers: hdrs,
              subtitles: [],
              provider: "witanime"
            });
          } else if (!embed.resolved && embed.url) {
            var clientResult = yield resolveGeneric(embed.url);
            if (clientResult) {
              var hdrs2 = Object.assign({}, PLAY_HEADERS);
              hdrs2["Referer"] = embed.url;
              streams.push({
                name: "WitAnime " + hostLabel + " - " + qualityLabel,
                title: hostLabel,
                url: clientResult.url,
                quality: qualityLabel,
                size: "Unknown",
                headers: hdrs2,
                subtitles: [],
                provider: "witanime"
              });
            }
          }
        }
      } else {
        console.log("[WitAnime] Backend unavailable, resolving client-side");
        var clientPromises = [];
        for (var ci = 0; ci < limit; ci++) {
          clientPromises.push(function(embed2) {
            var host = "";
            try {
              host = new URL(embed2.url).hostname;
            } catch (e) {
            }
            var fn = host.indexOf("mp4upload") > -1 ? resolveMp4upload : resolveGeneric;
            return fn(embed2.url).then(function(res) {
              return res ? { embed: embed2, res } : null;
            }).catch(function() {
              return null;
            });
          }(filtered[ci]));
        }
        var clientResults = yield Promise.all(clientPromises);
        for (var cj = 0; cj < clientResults.length; cj++) {
          if (!clientResults[cj])
            continue;
          var e2 = clientResults[cj].embed;
          var r2 = clientResults[cj].res;
          var ql2 = QUALITY_MAP[e2.quality] || "720p";
          var hl2 = e2.name || getHostLabel(e2.url);
          var hdrs3 = Object.assign({}, PLAY_HEADERS);
          hdrs3["Referer"] = e2.url;
          streams.push({
            name: "WitAnime " + hl2 + " - " + ql2,
            title: hl2,
            url: r2.url,
            quality: ql2,
            size: "Unknown",
            headers: hdrs3,
            subtitles: [],
            provider: "witanime"
          });
        }
      }
      console.log("[WitAnime] Returning " + streams.length + " stream(s)");
      return streams;
    } catch (err) {
      console.error("[WitAnime] Error: " + err.message);
      return [];
    }
  });
}
module.exports = { getStreams };
