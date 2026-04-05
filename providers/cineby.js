/**
 * cineby - Built from src/cineby/
 * Generated: 2026-04-05T15:02:10.798Z
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

// src/cineby/index.js
var BACKEND = "http://145.241.158.129:3113";
var VIDEASY_API = "https://api.videasy.net";
var VIDEASY_DB = "https://db.videasy.net/3";
var ANIME_DB = "https://anime-db.videasy.net/api/v2/hianime";
var SERVERS = [
  { name: "Oxygen", endpoint: "myflixerzupcloud/sources-with-title" },
  { name: "Hydrogen", endpoint: "cdn/sources-with-title" },
  { name: "Lithium", endpoint: "moviebox/sources-with-title" },
  { name: "Helium", endpoint: "1movies/sources-with-title" },
  { name: "Titanium", endpoint: "primesrcme/sources-with-title" }
];
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
function safeFetch(url, opts, ms) {
  ms = ms || 15e3;
  var controller;
  var tid;
  try {
    controller = new AbortController();
    tid = setTimeout(function() {
      controller.abort();
    }, ms);
  } catch (e) {
    controller = null;
  }
  var o = Object.assign({ method: "GET" }, opts || {});
  if (controller)
    o.signal = controller.signal;
  return fetch(url, o).then(function(r) {
    if (tid)
      clearTimeout(tid);
    return r;
  }).catch(function(e) {
    if (tid)
      clearTimeout(tid);
    throw e;
  });
}
function getTmdbMeta(mediaType, tmdbId) {
  return __async(this, null, function* () {
    var url = VIDEASY_DB + "/" + mediaType + "/" + tmdbId + "?append_to_response=external_ids,genres";
    var resp = yield safeFetch(url);
    if (!resp.ok)
      throw new Error("TMDB " + resp.status);
    var data = yield resp.json();
    var title, year, imdbId, isAnime;
    if (mediaType === "movie") {
      title = data.title;
      year = data.release_date ? new Date(data.release_date).getFullYear() : "";
    } else {
      title = data.name;
      year = data.first_air_date ? new Date(data.first_air_date).getFullYear() : "";
    }
    imdbId = data.external_ids && data.external_ids.imdb_id || "";
    var genres = (data.genres || []).map(function(g) {
      return g.id;
    });
    var isAnimation = genres.indexOf(16) !== -1;
    var isJapanese = data.original_language === "ja";
    isAnime = mediaType === "tv" && isAnimation && isJapanese;
    return { title, year, imdbId, isAnime, originalTitle: data.original_name || data.original_title || "" };
  });
}
function fetchEncrypted(serverEndpoint, params) {
  return __async(this, null, function* () {
    var url = VIDEASY_API + "/" + serverEndpoint + "?title=" + encodeURIComponent(params.title) + "&mediaType=" + params.mediaType + "&year=" + params.year + "&episodeId=" + (params.episodeId || "1") + "&seasonId=" + (params.seasonId || "1") + "&tmdbId=" + params.tmdbId + "&imdbId=" + encodeURIComponent(params.imdbId || "") + "&_t=" + Date.now();
    var resp = yield safeFetch(url, {
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache" }
    }, 2e4);
    if (!resp.ok)
      throw new Error("API " + resp.status);
    return resp.text();
  });
}
function normalizeQuality(q) {
  if (!q)
    return "Unknown";
  var s = String(q).toUpperCase().trim();
  if (s === "4K" || s === "2160P")
    return "4K";
  if (s === "1080P")
    return "1080p";
  if (s === "720P")
    return "720p";
  if (s === "480P")
    return "480p";
  if (s === "360P")
    return "360p";
  return q;
}
function normTitle(s) {
  return String(s || "").toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}
function titleScore(a, b) {
  var wa = normTitle(a).split(" ").filter(Boolean);
  var wb = normTitle(b).split(" ").filter(Boolean);
  var query = wa.length <= wb.length ? wa : wb;
  var result = wa.length <= wb.length ? wb : wa;
  var setResult = {};
  result.forEach(function(w) {
    setResult[w] = true;
  });
  var hits = query.filter(function(w) {
    return setResult[w];
  }).length;
  if (hits === query.length)
    return 1;
  return hits / Math.max(wa.length, wb.length, 1);
}
function findHiAnimeId(title, originalTitle, year) {
  return __async(this, null, function* () {
    var queries = [title];
    if (originalTitle && normTitle(originalTitle) !== normTitle(title)) {
      queries.push(originalTitle);
    }
    var bestId = null;
    var bestScore = 0;
    var bestHasDub = false;
    for (var qi = 0; qi < queries.length; qi++) {
      var q = queries[qi];
      try {
        var url = ANIME_DB + "/search?q=" + encodeURIComponent(q);
        var resp = yield safeFetch(url, {}, 1e4);
        if (!resp.ok)
          continue;
        var data = yield resp.json();
        var results = data.data && data.data.animes || data.animes || [];
        for (var i = 0; i < results.length; i++) {
          var anime = results[i];
          var score = titleScore(anime.name, q);
          if (score > bestScore || score === bestScore && anime.episodes && anime.episodes.dub && !bestHasDub) {
            bestScore = score;
            bestId = anime.id;
            bestHasDub = !!(anime.episodes && anime.episodes.dub);
          }
        }
        if (bestScore >= 0.8)
          break;
      } catch (e) {
        console.log("[Cineby/HiAnime] Search error: " + e.message);
      }
    }
    if (bestScore < 0.4) {
      console.log("[Cineby/HiAnime] No match found (best score: " + bestScore.toFixed(2) + ")");
      return null;
    }
    console.log("[Cineby/HiAnime] Matched: " + bestId + " (score: " + bestScore.toFixed(2) + ")");
    return bestId;
  });
}
function getHiAnimeStreams(hiAnimeId, episodeNumber) {
  return __async(this, null, function* () {
    var url = VIDEASY_API + "/hianime/sources-with-id?providerId=" + encodeURIComponent(hiAnimeId) + "&episodeId=" + episodeNumber + "&dub=true";
    var resp = yield safeFetch(url, {}, 2e4);
    if (!resp.ok)
      throw new Error("HiAnime API " + resp.status);
    var data = yield resp.json();
    var ms = data.mediaSources;
    if (!ms)
      throw new Error("No mediaSources in response");
    return {
      sources: ms.sources || [],
      subtitles: ms.subtitles || []
    };
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      var mType = mediaType === "movie" ? "movie" : "tv";
      var seasonId = String(parseInt(season, 10) || 1);
      var episodeId = String(parseInt(episode, 10) || 1);
      console.log("[Cineby] Fetching " + mType + " tmdb:" + tmdbId + (mType === "tv" ? " S" + seasonId + "E" + episodeId : ""));
      var meta = yield getTmdbMeta(mType, tmdbId);
      console.log("[Cineby] " + meta.title + " (" + meta.year + ")" + (meta.isAnime ? " [ANIME]" : ""));
      if (meta.isAnime) {
        console.log("[Cineby] Using HiAnime path for anime");
        try {
          var hiAnimeId = yield findHiAnimeId(meta.title, meta.originalTitle, meta.year);
          if (!hiAnimeId) {
            console.log("[Cineby] HiAnime: no match, falling back to TV path");
          } else {
            var hiResult = yield getHiAnimeStreams(hiAnimeId, episodeId);
            var hiSources = hiResult.sources;
            var hiSubtitles = hiResult.subtitles;
            console.log("[Cineby/HiAnime] " + hiSources.length + " sources, " + hiSubtitles.length + " subtitles");
            if (hiSources.length === 0) {
              console.log("[Cineby] HiAnime: no sources, falling back to TV path");
            } else {
              var subs = hiSubtitles.filter(function(s) {
                return s.url && s.url.indexOf(".vtt") !== -1;
              }).map(function(s) {
                return {
                  url: s.url,
                  lang: s.lang || s.language || "Unknown"
                };
              });
              var streams = [];
              for (var j = 0; j < hiSources.length; j++) {
                var src = hiSources[j];
                if (!src.url)
                  continue;
                var qLabel = src.quality || "Unknown";
                var qParts = qLabel.split(" - ");
                var res = normalizeQuality(qParts[0]);
                var audioLabel = qParts[1] || "";
                var displayTitle = audioLabel ? res + " - " + audioLabel : res;
                streams.push({
                  name: "Cineby",
                  title: displayTitle + " [HiAnime]",
                  url: src.url,
                  quality: res,
                  size: "Unknown",
                  headers: {
                    "User-Agent": UA,
                    "Referer": "https://hianime.to/",
                    "Origin": "https://hianime.to"
                  },
                  subtitles: subs,
                  provider: "cineby"
                });
              }
              console.log("[Cineby/HiAnime] Returning " + streams.length + " streams");
              return streams;
            }
          }
        } catch (animeErr) {
          console.log("[Cineby/HiAnime] Error: " + animeErr.message + " \u2014 falling back to TV path");
        }
      }
      var params = {
        title: meta.title,
        mediaType: mType,
        year: String(meta.year),
        tmdbId: String(tmdbId),
        imdbId: meta.imdbId,
        seasonId,
        episodeId
      };
      var encPromises = SERVERS.map(function(srv) {
        return fetchEncrypted(srv.endpoint, params).then(function(text) {
          if (!text || text.length < 10)
            throw new Error("Empty");
          return { server: srv.name, encrypted: text };
        }).catch(function() {
          return null;
        });
      });
      var encResults = yield Promise.all(encPromises);
      var items = [];
      for (var i = 0; i < encResults.length; i++) {
        if (encResults[i])
          items.push(encResults[i]);
      }
      if (items.length === 0) {
        console.log("[Cineby] No encrypted data from any server");
        return [];
      }
      console.log("[Cineby] Got encrypted data from " + items.length + " servers");
      var resp = yield safeFetch(BACKEND + "/decrypt-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, tmdbId: String(tmdbId) })
      }, 6e4);
      if (!resp.ok) {
        console.log("[Cineby] Backend returned " + resp.status);
        return [];
      }
      var data = yield resp.json();
      if (data.error) {
        console.log("[Cineby] Backend error: " + data.error);
        return [];
      }
      var sources = data.sources || [];
      var subtitles = data.subtitles || [];
      console.log("[Cineby] " + sources.length + " sources from [" + (data.servers || []).join(", ") + "]");
      var streams = [];
      for (var j = 0; j < sources.length; j++) {
        var src = sources[j];
        if (!src.url)
          continue;
        var subs = [];
        for (var k = 0; k < subtitles.length; k++) {
          var sub = subtitles[k];
          if (sub.url) {
            subs.push({
              url: sub.url,
              lang: sub.lang || sub.language || "Unknown"
            });
          }
        }
        var quality = normalizeQuality(src.quality);
        var serverTag = src.server ? " [" + src.server + "]" : "";
        streams.push({
          name: "Cineby",
          title: quality + serverTag,
          url: src.url,
          quality,
          size: "Unknown",
          headers: {
            "User-Agent": UA,
            "Referer": "https://www.vidking.net/",
            "Origin": "https://www.vidking.net"
          },
          subtitles: subs,
          provider: "cineby"
        });
      }
      console.log("[Cineby] Returning " + streams.length + " streams");
      return streams;
    } catch (error) {
      console.error("[Cineby] Error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
