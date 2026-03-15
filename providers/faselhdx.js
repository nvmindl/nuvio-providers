/**
 * faselhdx - Built from src/faselhdx/
 * Generated: 2026-03-15T01:19:23.250Z
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

// src/faselhdx/http.js
var CryptoJS = require("crypto-js");
var MOVIESAPI_BASE = "https://ww2.moviesapi.to/api";
var FLIXCDN_BASE = "https://flixcdn.cyou/api/v1";
var AES_KEY = "kiemtienmua911ca";
var AES_IV = "1234567890oiuytr";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json, text/html, */*",
  "Accept-Language": "en-US,en;q=0.9,ar;q=0.8"
};
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
function decryptResponse(hexData) {
  var key = CryptoJS.enc.Utf8.parse(AES_KEY);
  var iv = CryptoJS.enc.Utf8.parse(AES_IV);
  var ciphertext = CryptoJS.enc.Hex.parse(hexData);
  var cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext });
  var decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}
function fetchMoviesApi(path) {
  var url = MOVIESAPI_BASE + "/" + path;
  console.log("[FaselHDX] MoviesAPI: " + url);
  return safeFetch(url).then(function(r) {
    return r.ok ? r.json() : null;
  }).catch(function(e) {
    console.log("[FaselHDX] MoviesAPI error: " + e.message);
    return null;
  });
}
function fetchFlixVideo(videoCode) {
  var url = FLIXCDN_BASE + "/video?id=" + videoCode + "&w=1920&h=1080&r=ww2.moviesapi.to";
  console.log("[FaselHDX] FlixCDN: " + videoCode);
  return safeFetch(url, {
    headers: {
      "User-Agent": HEADERS["User-Agent"],
      "Referer": "https://flixcdn.cyou/",
      "Origin": "https://flixcdn.cyou"
    }
  }).then(function(r) {
    return r.ok ? r.text() : null;
  }).then(function(hex) {
    if (!hex)
      return null;
    var json = decryptResponse(hex.trim());
    if (!json)
      return null;
    try {
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }).catch(function(e) {
    console.log("[FaselHDX] FlixCDN error: " + e.message);
    return null;
  });
}
function fetchM3U8(url) {
  return safeFetch(url, {
    headers: {
      "User-Agent": HEADERS["User-Agent"],
      "Referer": "https://flixcdn.cyou/",
      "Origin": "https://flixcdn.cyou"
    }
  }).then(function(r) {
    return r.ok ? r.text() : "";
  }).catch(function(e) {
    console.log("[FaselHDX] M3U8 error: " + e.message);
    return "";
  });
}

// src/faselhdx/extractor.js
function parseQualities(masterText, masterUrl) {
  var streams = [];
  var lines = masterText.split("\n");
  var baseUrl = masterUrl.replace(/\/[^/]*$/, "/");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf("#EXT-X-STREAM-INF") !== 0)
      continue;
    var resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
    var width = resMatch ? parseInt(resMatch[1], 10) : 0;
    var height = resMatch ? parseInt(resMatch[2], 10) : 0;
    var variantUrl = "";
    for (var j = i + 1; j < lines.length; j++) {
      var next = lines[j].trim();
      if (next && next.charAt(0) !== "#") {
        variantUrl = next;
        break;
      }
    }
    if (!variantUrl)
      continue;
    if (variantUrl.indexOf("http") !== 0) {
      variantUrl = baseUrl + variantUrl;
    }
    var quality = "auto";
    if (width >= 1920 || height >= 1080)
      quality = "1080p";
    else if (width >= 1280 || height >= 720)
      quality = "720p";
    else if (width >= 854 || height >= 480)
      quality = "480p";
    else if (width > 0 || height > 0)
      quality = "360p";
    streams.push({ url: variantUrl, quality, height });
  }
  streams.sort(function(a, b) {
    return b.height - a.height;
  });
  return streams;
}
function extractVideoCode(videoUrl) {
  var hashIdx = videoUrl.indexOf("#");
  if (hashIdx === -1)
    return null;
  var fragment = videoUrl.substring(hashIdx + 1);
  var ampIdx = fragment.indexOf("&");
  if (ampIdx !== -1)
    fragment = fragment.substring(0, ampIdx);
  return fragment || null;
}
function extractSubtitles(data) {
  var subs = data.subtitles;
  if (!subs || !subs.length)
    return [];
  var results = [];
  for (var i = 0; i < subs.length; i++) {
    var s = subs[i];
    if (s.url) {
      results.push({
        language: s.language || s.label || "Unknown",
        url: s.url
      });
    }
  }
  return results;
}
function buildStreams(videoData, masterUrl, subtitles) {
  return __async(this, null, function* () {
    var headers = {
      "Referer": "https://flixcdn.cyou/",
      "Origin": "https://flixcdn.cyou",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    };
    var masterText = yield fetchM3U8(masterUrl);
    var variants = parseQualities(masterText, masterUrl);
    if (variants.length > 0) {
      return variants.map(function(v) {
        return {
          name: "FaselHDX",
          title: "FaselHDX " + v.quality,
          url: v.url,
          quality: v.quality,
          headers,
          subtitles
        };
      });
    }
    return [{
      name: "FaselHDX",
      title: "FaselHDX Auto",
      url: masterUrl,
      quality: "auto",
      headers,
      subtitles
    }];
  });
}
function extractMovie(tmdbId) {
  return __async(this, null, function* () {
    console.log("[FaselHDX] Movie TMDB: " + tmdbId);
    var data = yield fetchMoviesApi("movie/" + tmdbId);
    if (!data || !data.video_url) {
      console.log("[FaselHDX] Movie not found on MoviesAPI");
      return [];
    }
    console.log("[FaselHDX] Movie: " + (data.title || "untitled"));
    var videoCode = extractVideoCode(data.video_url);
    if (!videoCode) {
      console.log("[FaselHDX] No video code in URL");
      return [];
    }
    console.log("[FaselHDX] Video code: " + videoCode);
    var videoData = yield fetchFlixVideo(videoCode);
    if (!videoData || !videoData.source) {
      console.log("[FaselHDX] FlixCDN returned no source");
      return [];
    }
    console.log("[FaselHDX] Source: " + videoData.source.substring(0, 80));
    var subtitles = extractSubtitles(data);
    return buildStreams(videoData, videoData.source, subtitles);
  });
}
function extractSeries(tmdbId, season, episode) {
  return __async(this, null, function* () {
    var seasonNum = parseInt(season, 10);
    var episodeNum = parseInt(episode, 10);
    console.log("[FaselHDX] Series TMDB: " + tmdbId + " S" + seasonNum + "E" + episodeNum);
    var data = yield fetchMoviesApi("tv/" + tmdbId + "/" + seasonNum + "/" + episodeNum);
    if (!data || !data.video_url) {
      console.log("[FaselHDX] Episode not found on MoviesAPI");
      return [];
    }
    console.log("[FaselHDX] Episode: " + (data.title || "untitled"));
    var videoCode = extractVideoCode(data.video_url);
    if (!videoCode) {
      console.log("[FaselHDX] No video code in URL");
      return [];
    }
    console.log("[FaselHDX] Video code: " + videoCode);
    var videoData = yield fetchFlixVideo(videoCode);
    if (!videoData || !videoData.source) {
      console.log("[FaselHDX] FlixCDN returned no source");
      return [];
    }
    console.log("[FaselHDX] Source: " + videoData.source.substring(0, 80));
    var subtitles = extractSubtitles(data);
    return buildStreams(videoData, videoData.source, subtitles);
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log("[FaselHDX] Starting: " + mediaType + " " + tmdbId);
    var streams = [];
    if (mediaType === "movie") {
      streams = yield extractMovie(tmdbId);
    } else {
      streams = yield extractSeries(tmdbId, season, episode);
    }
    if (!streams.length) {
      console.log("[FaselHDX] No streams found");
    } else {
      console.log("[FaselHDX] Got " + streams.length + " streams");
    }
    return streams;
  });
}

// src/faselhdx/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[FaselHDX] Request: " + mediaType + " " + tmdbId);
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      console.error("[FaselHDX] Error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
