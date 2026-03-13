var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/faselhdx/http.js
function safeFetch(url, opts) {
  opts = opts || {};
  var ms = opts.timeout || 25e3;
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
  var fetchOpts = { method: "GET", headers: opts.headers || HEADERS };
  if (controller)
    fetchOpts.signal = controller.signal;
  return fetch(url, fetchOpts).then(function(r) {
    if (tid)
      clearTimeout(tid);
    return r;
  }).catch(function(e) {
    if (tid)
      clearTimeout(tid);
    throw e;
  });
}
function apiGet(path) {
  var url = PROXY_BASE + "/api/" + path;
  console.log("[FaselHDX] API: " + url.substring(0, 120));
  return safeFetch(url, { headers: HEADERS }).then(function(r) {
    return r.ok ? r.json() : null;
  }).catch(function(e) {
    console.log("[FaselHDX] API error: " + e.message);
    return null;
  });
}
function extractSources(embedUrl) {
  var url = PROXY_BASE + "/extract?url=" + encodeURIComponent(embedUrl);
  console.log("[FaselHDX] Extract: " + embedUrl.substring(0, 80));
  return safeFetch(url, { headers: HEADERS }).then(function(r) {
    return r.ok ? r.json() : { sources: [] };
  }).catch(function(e) {
    console.log("[FaselHDX] Extract error: " + e.message);
    return { sources: [] };
  });
}
function resolveId(tmdbId, type) {
  var url = PROXY_BASE + "/resolve/" + type + "/" + tmdbId;
  console.log("[FaselHDX] Resolve: " + type + " " + tmdbId);
  return safeFetch(url, { headers: HEADERS }).then(function(r) {
    return r.ok ? r.json() : null;
  }).catch(function(e) {
    console.log("[FaselHDX] Resolve error: " + e.message);
    return null;
  });
}
var PROXY_BASE, HEADERS;
var init_http = __esm({
  "src/faselhdx/http.js"() {
    PROXY_BASE = "https://faselhdx-proxy.onrender.com";
    HEADERS = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      "Accept": "application/json, text/html, */*",
      "Accept-Language": "ar,en;q=0.8"
    };
  }
});

// src/faselhdx/extractor.js
function sortVideos(videos) {
  var preferred = [];
  var others = [];
  for (var i = 0; i < videos.length; i++) {
    var link = videos[i].link || "";
    if (!link)
      continue;
    if (BLOCKED_HOST_RE.test(link))
      continue;
    if (PREFERRED_HOST_RE.test(link)) {
      preferred.push(videos[i]);
    } else {
      others.push(videos[i]);
    }
  }
  return preferred.concat(others);
}
async function processVideos(videos) {
  if (!videos || !videos.length)
    return [];
  var sorted = sortVideos(videos);
  var results = [];
  for (var i = 0; i < sorted.length; i++) {
    var v = sorted[i];
    var link = v.link || "";
    if (!link)
      continue;
    var serverName = (v.server || "Server " + (i + 1)).trim();
    var lang = v.lang || "";
    var data = await extractSources(link);
    var sources = data && data.sources ? data.sources : [];
    for (var j = 0; j < sources.length; j++) {
      var s = sources[j];
      results.push({
        url: s.url,
        quality: s.quality || "auto",
        type: s.type || "mp4",
        name: serverName,
        lang
      });
    }
    if (results.length >= 6)
      break;
  }
  return results;
}
async function extractMovie(tmdbId) {
  console.log("[FaselHDX] Movie TMDB: " + tmdbId);
  var resolved = await resolveId(tmdbId, "movie");
  if (!resolved || !resolved.id) {
    console.log("[FaselHDX] Could not resolve TMDB " + tmdbId);
    return [];
  }
  console.log("[FaselHDX] Resolved: internal=" + resolved.id + " title=" + (resolved.title || "?"));
  var data = await apiGet("media/detail/" + resolved.id + "/0");
  if (!data || typeof data !== "object" || !data.id) {
    console.log("[FaselHDX] Movie detail failed for internal ID " + resolved.id);
    return [];
  }
  console.log("[FaselHDX] Movie: " + (data.title || "untitled") + " | Videos: " + (data.videos ? data.videos.length : 0));
  return processVideos(data.videos);
}
async function extractSeries(tmdbId, season, episode) {
  var seasonNum = parseInt(season, 10);
  var episodeNum = parseInt(episode, 10);
  console.log("[FaselHDX] Series TMDB: " + tmdbId + " S" + seasonNum + "E" + episodeNum);
  var resolved = await resolveId(tmdbId, "tv");
  if (!resolved || !resolved.id) {
    console.log("[FaselHDX] Could not resolve series TMDB " + tmdbId);
    return [];
  }
  console.log("[FaselHDX] Resolved: internal=" + resolved.id + " title=" + (resolved.title || "?"));
  var seriesData = await apiGet("series/show/" + resolved.id + "/0");
  if (!seriesData || typeof seriesData === "string") {
    console.log("[FaselHDX] Series not found for internal ID " + resolved.id);
    return [];
  }
  var seasons = seriesData.seasons || [];
  console.log("[FaselHDX] Series: " + (seriesData.name || "untitled") + " | Seasons: " + seasons.length);
  var targetSeason = null;
  for (var s = 0; s < seasons.length; s++) {
    if (seasons[s].season_number === seasonNum) {
      targetSeason = seasons[s];
      break;
    }
  }
  if (!targetSeason) {
    for (var s2 = 0; s2 < seasons.length; s2++) {
      var nm = (seasons[s2].name || "").match(/\d+/);
      if (nm && parseInt(nm[0], 10) === seasonNum) {
        targetSeason = seasons[s2];
        break;
      }
    }
  }
  if (!targetSeason) {
    console.log("[FaselHDX] Season " + seasonNum + " not found");
    return [];
  }
  console.log("[FaselHDX] Season found: id=" + targetSeason.id + " name=" + (targetSeason.name || "?"));
  var seasonData = await apiGet("series/season/" + targetSeason.id + "/0");
  if (!seasonData) {
    console.log("[FaselHDX] Failed to load season data");
    return [];
  }
  var episodes = seasonData.episodes || [];
  console.log("[FaselHDX] Episodes: " + episodes.length);
  var targetEp = null;
  for (var e = 0; e < episodes.length; e++) {
    if (episodes[e].episode_number === episodeNum) {
      targetEp = episodes[e];
      break;
    }
  }
  if (!targetEp) {
    console.log("[FaselHDX] Episode " + episodeNum + " not found");
    return [];
  }
  console.log("[FaselHDX] Episode: " + (targetEp.name || episodeNum) + " | Videos: " + (targetEp.videos ? targetEp.videos.length : 0));
  return processVideos(targetEp.videos);
}
async function extractStreams(tmdbId, mediaType, season, episode) {
  console.log("[FaselHDX] Starting: " + mediaType + " " + tmdbId);
  var streams = [];
  if (mediaType === "movie") {
    streams = await extractMovie(tmdbId);
  } else {
    streams = await extractSeries(tmdbId, season, episode);
  }
  if (!streams.length) {
    console.log("[FaselHDX] No streams found");
    return [];
  }
  console.log("[FaselHDX] Got " + streams.length + " streams");
  return streams.map(function(s) {
    var label = s.name || "FaselHDX";
    if (s.lang)
      label = label + " [" + s.lang + "]";
    if (s.quality && s.quality !== "auto")
      label = label + " " + s.quality;
    return {
      name: "FaselHDX",
      title: label,
      url: s.url,
      quality: s.quality || "auto"
    };
  });
}
var PREFERRED_HOST_RE, BLOCKED_HOST_RE;
var init_extractor = __esm({
  "src/faselhdx/extractor.js"() {
    init_http();
    PREFERRED_HOST_RE = /aflam\.news|mp4plus\.org|anafast\.org|reviewrate\.net|vidtube\.one|vidtube\.pro|1vid\.xyz|fasel-hd\.cam|faselhdx\.best/i;
    BLOCKED_HOST_RE = /egybestvid\.com|vidspeed|uqload|dw\.uns|liiivideo\.com/i;
  }
});

// src/faselhdx/index.js
var require_faselhdx = __commonJS({
  "src/faselhdx/index.js"(exports, module) {
    init_extractor();
    async function getStreams(tmdbId, mediaType, season, episode) {
      try {
        console.log("[FaselHDX] Request: " + mediaType + " " + tmdbId);
        return await extractStreams(tmdbId, mediaType, season, episode);
      } catch (error) {
        console.error("[FaselHDX] Error: " + error.message);
        return [];
      }
    }
    module.exports = { getStreams };
  }
});
export default require_faselhdx();
