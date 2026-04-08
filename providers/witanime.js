/**
 * witanime - Built from src/witanime/
 * Generated: 2026-04-08T19:10:10.418Z
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
function fetchJson(url, timeoutMs) {
  return __async(this, null, function* () {
    timeoutMs = timeoutMs || 2e4;
    var controller;
    var timeoutId;
    try {
      controller = new AbortController();
      timeoutId = setTimeout(function() {
        controller.abort();
      }, timeoutMs);
    } catch (e) {
      controller = null;
    }
    try {
      var opts = { method: "GET", headers: { "Accept": "application/json", "User-Agent": "NuvioApp/1.0" } };
      if (controller)
        opts.signal = controller.signal;
      var resp = yield fetch(url, opts);
      if (timeoutId)
        clearTimeout(timeoutId);
      if (!resp.ok)
        return null;
      return yield resp.json();
    } catch (e) {
      if (timeoutId)
        clearTimeout(timeoutId);
      console.log("[WitAnime] Fetch error: " + e.message + " url=" + url);
      return null;
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[WitAnime] " + mediaType + " " + tmdbId + " S" + (season || 0) + "E" + (episode || 0));
      var id = String(tmdbId);
      if (mediaType !== "movie" && season && episode) {
        id = tmdbId + ":" + season + ":" + episode;
      }
      var type = mediaType === "movie" ? "movie" : "tv";
      var url = BACKEND_URL + "/streams/" + type + "/" + id + ".json";
      console.log("[WitAnime] Backend: " + url);
      var data = yield fetchJson(url, 25e3);
      if (!data || !data.streams || !data.streams.length) {
        console.log("[WitAnime] No streams from backend");
        return [];
      }
      console.log("[WitAnime] Got " + data.streams.length + " stream(s) from backend");
      return data.streams;
    } catch (err) {
      console.error("[WitAnime] Error: " + err.message);
      return [];
    }
  });
}
module.exports = { getStreams };
