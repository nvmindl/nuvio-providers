/**
 * witanime - Built from src/witanime/
 * Generated: 2026-03-29T12:07:11.621Z
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
var BACKEND_URL = "https://witanime-backend.onrender.com";
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[WitAnime] Request: " + mediaType + " " + tmdbId);
      var id = String(tmdbId);
      if (mediaType !== "movie" && season && episode) {
        id = tmdbId + ":" + season + ":" + episode;
      }
      var type = mediaType === "movie" ? "movie" : "series";
      var url = BACKEND_URL + "/streams/" + type + "/" + id + ".json";
      console.log("[WitAnime] Calling backend: " + url);
      var controller;
      var timeoutId;
      try {
        controller = new AbortController();
        timeoutId = setTimeout(function() {
          controller.abort();
        }, 6e4);
      } catch (e) {
        controller = null;
      }
      var fetchOpts = {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "NuvioApp/1.0"
        }
      };
      if (controller)
        fetchOpts.signal = controller.signal;
      var response = yield fetch(url, fetchOpts);
      if (timeoutId)
        clearTimeout(timeoutId);
      if (!response.ok) {
        console.log("[WitAnime] Backend returned status " + response.status);
        return [];
      }
      var data = yield response.json();
      var streams = data.streams || [];
      console.log("[WitAnime] Got " + streams.length + " stream(s) from backend");
      var result = [];
      for (var i = 0; i < streams.length; i++) {
        var s = streams[i];
        var rawUrl = s.url || "";
        var proxyUrl = s.proxyUrl || "";
        if (!rawUrl && !proxyUrl)
          continue;
        if (s.ipLocked && proxyUrl) {
          result.push({
            name: s.name || "WitAnime",
            title: s.title || "Server",
            url: proxyUrl,
            quality: s.quality || "auto"
          });
        } else if (rawUrl) {
          result.push({
            name: s.name || "WitAnime",
            title: s.title || "Server",
            url: rawUrl,
            quality: s.quality || "auto",
            headers: s.headers || {}
          });
        }
      }
      return result;
    } catch (error) {
      console.error("[WitAnime] Error: " + error.message);
      return [];
    }
  });
}
function searchAnime(query) {
  return __async(this, null, function* () {
    try {
      console.log("[WitAnime] Search: " + query);
      var url = BACKEND_URL + "/search?q=" + encodeURIComponent(query);
      var response = yield fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(3e4)
      });
      if (!response.ok) {
        console.log("[WitAnime] Search returned status " + response.status);
        return [];
      }
      var data = yield response.json();
      var results = data.results || [];
      console.log("[WitAnime] Search found " + results.length + " result(s)");
      return results.map(function(r) {
        return {
          slug: r.slug,
          title: r.title,
          url: r.url,
          thumbnail: r.thumbnail || "",
          type: r.type || "",
          status: r.status || ""
        };
      });
    } catch (error) {
      console.error("[WitAnime] Search error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams, searchAnime };
