/**
 * faselhdx - Built from src/faselhdx/
 * Generated: 2026-03-19T22:12:28.631Z
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

// src/faselhdx/tmdb.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_API_BASE = "https://api.themoviedb.org/3";
function getTmdbMeta(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var type = mediaType === "movie" ? "movie" : "tv";
    var url = TMDB_API_BASE + "/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=en-US&append_to_response=external_ids";
    try {
      var resp = yield fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
      });
      if (!resp.ok)
        return null;
      var data = yield resp.json();
      var title = data.title || data.name || "";
      var origTitle = data.original_title || data.original_name || "";
      var year = "";
      if (data.release_date)
        year = data.release_date.split("-")[0];
      else if (data.first_air_date)
        year = data.first_air_date.split("-")[0];
      var imdbId = "";
      if (data.external_ids && data.external_ids.imdb_id)
        imdbId = data.external_ids.imdb_id;
      else if (data.imdb_id)
        imdbId = data.imdb_id;
      return { title, originalTitle: origTitle, year, imdbId };
    } catch (e) {
      console.log("[FaselHD] TMDB error: " + e.message);
      return null;
    }
  });
}

// src/faselhdx/index.js
var ADDON_URL = "https://faselhdx.onrender.com";
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[FaselHD] Request: " + mediaType + " " + tmdbId + (season ? " S" + season + "E" + episode : ""));
      var wakeup = fetch(ADDON_URL + "/manifest.json").catch(function() {
      });
      var meta = yield getTmdbMeta(tmdbId, mediaType);
      if (!meta || !meta.imdbId) {
        console.log("[FaselHD] No IMDB ID for " + tmdbId);
        return [];
      }
      console.log("[FaselHD] " + meta.title + " (" + meta.year + ") \u2192 " + meta.imdbId);
      yield wakeup;
      var stremioType = mediaType === "movie" ? "movie" : "series";
      var stremioId = meta.imdbId;
      if (stremioType === "series" && season && episode) {
        stremioId += ":" + season + ":" + episode;
      }
      var apiUrl = ADDON_URL + "/stream/" + stremioType + "/" + stremioId + ".json";
      console.log("[FaselHD] API: " + apiUrl);
      var resp = yield fetch(apiUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      if (!resp.ok) {
        console.log("[FaselHD] API error: " + resp.status);
        return [];
      }
      var data = yield resp.json();
      if (!data.streams || data.streams.length === 0) {
        console.log("[FaselHD] No streams from API");
        return [];
      }
      var streams = [];
      for (var i = 0; i < data.streams.length; i++) {
        var s = data.streams[i];
        streams.push({
          name: s.name || "FaselHD",
          title: s.title || "FaselHD",
          url: s.url
        });
      }
      console.log("[FaselHD] " + streams.length + " stream(s)");
      return streams;
    } catch (error) {
      console.error("[FaselHD] Error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
