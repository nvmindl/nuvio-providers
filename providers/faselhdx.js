/**
 * faselhdx - Built from src/faselhdx/
 * Generated: 2026-04-01T00:58:38.659Z
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

// src/faselhdx/index.js
var BACKEND = "http://145.241.158.129:3112";
var DEFAULT_HEADERS = {
  "Referer": "https://flixcdn.cyou/",
  "Origin": "https://flixcdn.cyou",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
};
function safeFetch(url, ms) {
  ms = ms || 3e4;
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
  var opts = { method: "GET" };
  if (controller)
    opts.signal = controller.signal;
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
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      var url;
      if (mediaType === "movie") {
        url = BACKEND + "/streams/movie/" + tmdbId + ".json";
      } else {
        var s = parseInt(season, 10);
        var e = parseInt(episode, 10);
        url = BACKEND + "/streams/series/" + tmdbId + ":" + s + ":" + e + ".json";
      }
      console.log("[FaselHD] Backend: " + url);
      var resp = yield safeFetch(url);
      if (!resp.ok) {
        console.log("[FaselHD] Backend returned " + resp.status);
        return [];
      }
      var data = yield resp.json();
      var streams = data.streams || [];
      if (!streams.length) {
        console.log("[FaselHD] No streams from backend");
        return [];
      }
      var result = [];
      for (var i = 0; i < streams.length; i++) {
        var st = streams[i];
        var hdrs = st.headers || DEFAULT_HEADERS;
        if (!hdrs["User-Agent"]) {
          hdrs["User-Agent"] = DEFAULT_HEADERS["User-Agent"];
        }
        result.push({
          name: st.name || "FaselHD",
          title: st.title || "FaselHD",
          url: st.url,
          quality: st.quality || "auto",
          size: "Unknown",
          headers: hdrs,
          subtitles: st.subtitles || [],
          provider: "faselhdx"
        });
      }
      console.log("[FaselHD] Got " + result.length + " streams");
      return result;
    } catch (error) {
      console.error("[FaselHD] Error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
