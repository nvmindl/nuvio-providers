/**
 * faselhd - Built from src/faselhd/
 * Generated: 2026-04-03T19:10:21.917Z
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

// src/faselhd/index.js
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE = "https://api.themoviedb.org/3";
var EXTRACT_URL = "http://145.241.158.129:3112/extract";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var FETCH_TIMEOUT = 12e3;
var GLOBAL_TIMEOUT = 25e3;
var EASYPLEX_BASES = [
  { host: "fashd.com", path: "/faselhd15/public/api" },
  { host: "flech.tn", path: "/egybestantoo/public/api" },
  { host: "hrrejgh.com", path: "/wecima15/public/api" },
  { host: "www.hrrejhp.com", path: "/egybestanto/public/api" }
];
function safeFetch(url, options, timeout) {
  var ms = timeout || FETCH_TIMEOUT;
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
  var opts = options || {};
  if (controller)
    opts.signal = controller.signal;
  if (!opts.headers)
    opts.headers = {};
  if (!opts.headers["User-Agent"])
    opts.headers["User-Agent"] = UA;
  return fetch(url, opts).then(function(r) {
    if (tid)
      clearTimeout(tid);
    return r;
  }).catch(function(e) {
    if (tid)
      clearTimeout(tid);
    throw e;
  });
}
function fetchJSON(url, headers) {
  return safeFetch(url, { headers: headers || {} }).then(function(r) {
    return r.ok ? r.json() : null;
  }).catch(function() {
    return null;
  });
}
function fetchText(url, headers) {
  return safeFetch(url, { headers: headers || {} }).then(function(r) {
    return r.ok ? r.text() : null;
  }).catch(function() {
    return null;
  });
}
function easyplexFetch(endpoint) {
  var idx = 0;
  function tryNext() {
    if (idx >= EASYPLEX_BASES.length)
      return Promise.resolve(null);
    var base = EASYPLEX_BASES[idx];
    idx++;
    var url = "https://" + base.host + base.path + "/" + endpoint;
    return fetchJSON(url).then(function(data) {
      if (data) {
        if (typeof data === "string") {
          var s = data.trim();
          if (s === "Non autoris\xE9" || s === "Merci" || s === "Non autorise\u0301") {
            return tryNext();
          }
        }
        return data;
      }
      return tryNext();
    }).catch(function() {
      return tryNext();
    });
  }
  return tryNext();
}
function normalizeTitle(t) {
  return (t || "").toLowerCase().replace(/[''`]/g, "").replace(/[^a-z0-9\u0600-\u06FF]+/g, " ").trim();
}
function titleMatch(a, b) {
  var na = normalizeTitle(a);
  var nb = normalizeTitle(b);
  if (!na || !nb)
    return 0;
  if (na === nb)
    return 100;
  if (na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1)
    return 90;
  var wa = na.split(" ").filter(function(w) {
    return w.length > 1;
  });
  var wb = nb.split(" ").filter(function(w) {
    return w.length > 1;
  });
  if (!wa.length || !wb.length)
    return 0;
  var common = 0;
  for (var i = 0; i < wa.length; i++) {
    for (var j = 0; j < wb.length; j++) {
      if (wa[i] === wb[j]) {
        common++;
        break;
      }
    }
  }
  return Math.round(common * 100 / Math.max(wa.length, wb.length));
}
function resolveFaselPageUrl(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var tmdbType = mediaType === "movie" ? "movie" : "tv";
    var tmdbUrl = TMDB_BASE + "/" + tmdbType + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=en";
    var tmdbData = yield fetchJSON(tmdbUrl);
    if (!tmdbData)
      return null;
    var title = tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name || "";
    if (!title)
      return null;
    console.log("[FaselHD] TMDB: " + title);
    function searchByTitle(searchTitle) {
      return __async(this, null, function* () {
        var data = yield easyplexFetch("search/" + encodeURIComponent(searchTitle) + "/0");
        if (!data)
          return { match: null, nullCandidates: [] };
        var items = data.search || data.data || [];
        if (Array.isArray(data))
          items = data;
        var nullCandidates2 = [];
        for (var i2 = 0; i2 < items.length; i2++) {
          if (String(items[i2].tmdb_id) === String(tmdbId))
            return { match: items[i2], nullCandidates: [] };
          if (!items[i2].tmdb_id)
            nullCandidates2.push(items[i2]);
        }
        return { match: null, nullCandidates: nullCandidates2 };
      });
    }
    var result = yield searchByTitle(title);
    var match = result.match;
    var nullCandidates = result.nullCandidates;
    if (!match) {
      var origTitle = tmdbData.original_title || tmdbData.original_name || "";
      if (origTitle && origTitle !== title) {
        var result2 = yield searchByTitle(origTitle);
        if (result2.match)
          match = result2.match;
        else
          nullCandidates = nullCandidates.concat(result2.nullCandidates);
      }
    }
    if (!match && nullCandidates.length > 0) {
      console.log("[FaselHD] Trying " + nullCandidates.length + " null-tmdb candidate(s)...");
      var detailEndpoint = mediaType === "movie" ? "media/detail/" : "series/show/";
      var seenIds = {};
      var uniqueCandidates = [];
      for (var c = 0; c < nullCandidates.length; c++) {
        if (!seenIds[nullCandidates[c].id]) {
          seenIds[nullCandidates[c].id] = true;
          uniqueCandidates.push(nullCandidates[c]);
        }
      }
      for (var ci = 0; ci < Math.min(uniqueCandidates.length, 5); ci++) {
        var candidate = uniqueCandidates[ci];
        var detail = yield easyplexFetch(detailEndpoint + candidate.id + "/0");
        if (!detail)
          continue;
        var detailTitle = detail.title || detail.name || detail.original_name || "";
        if (!detailTitle)
          continue;
        var score = Math.max(titleMatch(title, detailTitle), titleMatch(tmdbData.original_title || tmdbData.original_name || "", detailTitle));
        console.log("[FaselHD] Candidate id=" + candidate.id + ' "' + detailTitle.substring(0, 50) + '" score=' + score);
        if (score >= 60) {
          match = candidate;
          console.log("[FaselHD] Title match! id=" + candidate.id);
          break;
        }
      }
    }
    if (!match) {
      console.log("[FaselHD] No EasyPlex match");
      return null;
    }
    console.log("[FaselHD] Match id=" + match.id);
    var videos = [];
    if (mediaType === "movie") {
      var detail = yield easyplexFetch("media/detail/" + match.id + "/0");
      if (detail)
        videos = detail.videos || [];
    } else {
      var show = yield easyplexFetch("series/show/" + match.id + "/0");
      if (!show)
        return null;
      var seasons = show.seasons || [];
      var targetSeason = null;
      for (var i = 0; i < seasons.length; i++) {
        if (String(seasons[i].season_number) === String(season)) {
          targetSeason = seasons[i];
          break;
        }
      }
      if (!targetSeason) {
        console.log("[FaselHD] Season " + season + " not found");
        return null;
      }
      var seasonData = yield easyplexFetch("series/season/" + targetSeason.id + "/0");
      if (!seasonData)
        return null;
      var episodes = seasonData.episodes || [];
      var targetEp = null;
      for (var j = 0; j < episodes.length; j++) {
        if (String(episodes[j].episode_number) === String(episode)) {
          targetEp = episodes[j];
          break;
        }
      }
      if (!targetEp) {
        console.log("[FaselHD] Episode " + episode + " not found");
        return null;
      }
      videos = targetEp.videos || [];
    }
    for (var v = 0; v < videos.length; v++) {
      var link = videos[v].link || "";
      if (link.indexOf("fasel-hd") !== -1 || link.indexOf("faselhd") !== -1) {
        console.log("[FaselHD] Page: " + link.substring(0, 80));
        return link;
      }
    }
    console.log("[FaselHD] No fasel link in " + videos.length + " videos");
    return null;
  });
}
function extractPlayerTokens(faselUrl) {
  return __async(this, null, function* () {
    var html = yield fetchText(faselUrl, {
      "Accept": "text/html,application/xhtml+xml,*/*",
      "Accept-Language": "ar,en;q=0.8",
      "Referer": "https://fasel-hd.cam/"
    });
    if (!html)
      return null;
    var tokenMatches = html.match(/player_token=([A-Za-z0-9+/=%]+)/g);
    if (!tokenMatches || !tokenMatches.length) {
      console.log("[FaselHD] No player_token in page");
      return null;
    }
    var seen = {};
    var tokens = [];
    for (var i = 0; i < tokenMatches.length; i++) {
      var m = tokenMatches[i].match(/player_token=([A-Za-z0-9+/=%]+)/);
      if (m && !seen[m[1]]) {
        seen[m[1]] = true;
        tokens.push(m[1]);
      }
    }
    var hostMatch = html.match(/https?:\/\/(web[0-9]+x?\.[a-z0-9.-]+)/i);
    var hostname = hostMatch ? hostMatch[1] : null;
    if (!hostname) {
      var fhMatch = html.match(/https?:\/\/([a-z0-9.-]*faselhdx[a-z0-9.-]*)/i);
      hostname = fhMatch ? fhMatch[1] : null;
    }
    console.log("[FaselHD] " + tokens.length + " token(s), host=" + hostname);
    return { tokens, hostname };
  });
}
function extractStreamsFromToken(token, hostname) {
  return __async(this, null, function* () {
    var playerUrl = "https://" + hostname + "/video_player?player_token=" + encodeURIComponent(token);
    console.log("[FaselHD] Fetching player: " + playerUrl.substring(0, 80) + "...");
    var html = yield fetchText(playerUrl, {
      "Referer": "https://" + hostname + "/",
      "Accept": "text/html,application/xhtml+xml,*/*"
    });
    if (!html) {
      console.log("[FaselHD] Player page empty");
      return [];
    }
    console.log("[FaselHD] Player HTML: " + html.length + " chars");
    var extractResponse;
    try {
      extractResponse = yield safeFetch(EXTRACT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/html"
        },
        body: html
      }, 15e3);
    } catch (e) {
      console.log("[FaselHD] Extract POST failed: " + e.message);
      return [];
    }
    if (!extractResponse.ok) {
      console.log("[FaselHD] Extract returned " + extractResponse.status);
      return [];
    }
    var extractData;
    try {
      extractData = yield extractResponse.json();
    } catch (e) {
      console.log("[FaselHD] Extract JSON parse failed");
      return [];
    }
    if (!extractData.streams || !extractData.streams.length) {
      console.log("[FaselHD] No streams from extract: " + (extractData.error || "unknown"));
      return [];
    }
    console.log("[FaselHD] Backend returned " + extractData.streams.length + " stream(s)");
    var results = [];
    for (var i = 0; i < extractData.streams.length; i++) {
      var stream = extractData.streams[i];
      if (!stream.url)
        continue;
      results.push({ url: stream.url, quality: "auto" });
    }
    return results;
  });
}
function resolveStreams(mediaType, tmdbId, season, episode) {
  return __async(this, null, function* () {
    var t0 = Date.now();
    var faselUrl = yield resolveFaselPageUrl(tmdbId, mediaType, season, episode);
    if (!faselUrl)
      return [];
    console.log("[FaselHD] Resolve in " + (Date.now() - t0) + "ms");
    var tokenResult = yield extractPlayerTokens(faselUrl);
    if (!tokenResult || !tokenResult.tokens.length || !tokenResult.hostname)
      return [];
    console.log("[FaselHD] Tokens in " + (Date.now() - t0) + "ms");
    var rawStreams = [];
    for (var i = 0; i < Math.min(tokenResult.tokens.length, 2); i++) {
      var streams = yield extractStreamsFromToken(tokenResult.tokens[i], tokenResult.hostname);
      if (streams.length > 0) {
        rawStreams = rawStreams.concat(streams);
        break;
      }
    }
    console.log("[FaselHD] Extract in " + (Date.now() - t0) + "ms");
    if (!rawStreams.length) {
      console.log("[FaselHD] No streams");
      return [];
    }
    var seen = {};
    var result = [];
    var faselHeaders = {
      "User-Agent": UA,
      "Referer": "https://" + tokenResult.hostname + "/",
      "Origin": "https://" + tokenResult.hostname
    };
    for (var j = 0; j < rawStreams.length; j++) {
      var raw = rawStreams[j];
      if (seen[raw.url])
        continue;
      seen[raw.url] = true;
      result.push({
        name: "FaselHD",
        title: "FaselHD - " + raw.quality + " (Arabic Hard Sub)",
        url: raw.url,
        quality: raw.quality,
        size: "Unknown",
        headers: faselHeaders,
        subtitles: [],
        provider: "faselhd"
      });
    }
    console.log("[FaselHD] " + result.length + " streams in " + (Date.now() - t0) + "ms");
    return result;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var t0 = Date.now();
    console.log("[FaselHD] === " + mediaType + "/" + tmdbId + (mediaType !== "movie" ? " S" + season + "E" + episode : "") + " ===");
    try {
      var timeoutP = new Promise(function(resolve) {
        setTimeout(function() {
          resolve([]);
        }, GLOBAL_TIMEOUT);
      });
      var mainP = resolveStreams(
        mediaType,
        tmdbId,
        season ? parseInt(season, 10) : void 0,
        episode ? parseInt(episode, 10) : void 0
      ).catch(function(e) {
        console.log("[FaselHD] Error: " + e.message);
        return [];
      });
      var streams = yield Promise.race([mainP, timeoutP]);
      console.log("[FaselHD] === Done: " + streams.length + " streams in " + (Date.now() - t0) + "ms ===");
      return streams;
    } catch (error) {
      console.error("[FaselHD] Fatal: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
