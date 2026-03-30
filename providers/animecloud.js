/**
 * animecloud - Built from src/animecloud/
 * Generated: 2026-03-30T17:26:35.369Z
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

// src/animecloud/index.js
var CryptoJS = require("crypto-js");
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE = "https://api.themoviedb.org/3";
var ANILIST_URL = "https://graphql.anilist.co";
var AC_API = "https://khkhkhkh.com/animecp/animeapi65/";
var RNC_PASSWORD = "anime5w&f4H&434*";
var UA = "AnimeCloud/6.5 CFNetwork/1399 Darwin/22.1.0";
function acPost(command, params) {
  return __async(this, null, function* () {
    var body = "command=" + encodeURIComponent(command);
    if (params) {
      var keys = Object.keys(params);
      for (var i = 0; i < keys.length; i++) {
        body += "&" + encodeURIComponent(keys[i]) + "=" + encodeURIComponent(params[keys[i]]);
      }
    }
    try {
      var response = yield fetch(AC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA
        },
        body
      });
      if (!response.ok)
        return null;
      var text = yield response.text();
      if (!text || text.length === 0)
        return null;
      try {
        return JSON.parse(text);
      } catch (e) {
        return { _raw: text };
      }
    } catch (e) {
      console.log("[AnimeCloud] acPost error: " + e.message);
      return null;
    }
  });
}
function decryptRNCryptor(base64Data) {
  var raw = CryptoJS.enc.Base64.parse(base64Data);
  var rawBytes = wordArrayToBytes(raw);
  if (rawBytes.length < 66)
    return null;
  var encSalt = bytesToWordArray(rawBytes.slice(2, 10));
  var iv = bytesToWordArray(rawBytes.slice(18, 34));
  var ciphertext = bytesToWordArray(rawBytes.slice(34, rawBytes.length - 32));
  var encKey = CryptoJS.PBKDF2(RNC_PASSWORD, encSalt, {
    keySize: 256 / 32,
    iterations: 1e4,
    hasher: CryptoJS.algo.SHA1
  });
  var decrypted = CryptoJS.AES.decrypt(
    { ciphertext },
    encKey,
    { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );
  return CryptoJS.enc.Utf8.stringify(decrypted);
}
function wordArrayToBytes(wordArray) {
  var words = wordArray.words;
  var sigBytes = wordArray.sigBytes;
  var bytes = [];
  for (var i = 0; i < sigBytes; i++) {
    bytes.push(words[i >>> 2] >>> 24 - i % 4 * 8 & 255);
  }
  return bytes;
}
function bytesToWordArray(bytes) {
  var words = [];
  for (var i = 0; i < bytes.length; i += 4) {
    var word = 0;
    for (var j = 0; j < 4 && i + j < bytes.length; j++) {
      word |= bytes[i + j] << 24 - j * 8;
    }
    words.push(word);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}
function tmdbGet(path) {
  return __async(this, null, function* () {
    try {
      var url = TMDB_BASE + path + (path.indexOf("?") > -1 ? "&" : "?") + "api_key=" + TMDB_KEY;
      var response = yield fetch(url, {
        headers: { "Accept": "application/json" }
      });
      if (!response.ok)
        return null;
      return yield response.json();
    } catch (e) {
      console.log("[AnimeCloud] TMDB error: " + e.message);
      return null;
    }
  });
}
function getTmdbDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var type = mediaType === "movie" ? "movie" : "tv";
    var data = yield tmdbGet("/" + type + "/" + tmdbId + "?language=en-US&append_to_response=alternative_titles");
    if (!data)
      return null;
    var titles = [];
    if (data.name)
      titles.push(data.name);
    if (data.title)
      titles.push(data.title);
    if (data.original_name)
      titles.push(data.original_name);
    if (data.original_title)
      titles.push(data.original_title);
    var alts = (data.alternative_titles || {}).results || [];
    for (var i = 0; i < alts.length; i++) {
      if (alts[i].title)
        titles.push(alts[i].title);
    }
    var seen = {};
    var unique = [];
    for (var i = 0; i < titles.length; i++) {
      var lower = titles[i].toLowerCase().trim();
      if (!seen[lower]) {
        seen[lower] = true;
        unique.push(titles[i]);
      }
    }
    var year = null;
    var dateStr = data.first_air_date || data.release_date;
    if (dateStr)
      year = parseInt(dateStr.split("-")[0], 10);
    return {
      title: data.name || data.title || "",
      originalTitle: data.original_name || data.original_title || "",
      titles: unique,
      year
    };
  });
}
function searchAniList(title, year) {
  return __async(this, null, function* () {
    var query = year ? "query ($search: String, $year: Int) { Media(search: $search, type: ANIME, seasonYear: $year) { id idMal title { english romaji native } startDate { year } } }" : "query ($search: String) { Media(search: $search, type: ANIME) { id idMal title { english romaji native } startDate { year } } }";
    var variables = year ? { search: title, year } : { search: title };
    try {
      var response = yield fetch(ANILIST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query, variables })
      });
      if (!response.ok)
        return null;
      var data = yield response.json();
      if (data.data && data.data.Media) {
        var media = data.data.Media;
        return {
          anilistId: media.id,
          malId: media.idMal,
          romaji: media.title ? media.title.romaji : null,
          english: media.title ? media.title.english : null,
          native: media.title ? media.title.native : null,
          year: media.startDate ? media.startDate.year : null
        };
      }
      return null;
    } catch (e) {
      console.log("[AnimeCloud] AniList error: " + e.message);
      return null;
    }
  });
}
function getAniListTitles(tmdbTitle, originalTitle, year) {
  return __async(this, null, function* () {
    var titles = [];
    var searchOrder = [originalTitle, tmdbTitle];
    var seen = {};
    var searches = [];
    for (var i = 0; i < searchOrder.length; i++) {
      if (searchOrder[i] && !seen[searchOrder[i].toLowerCase()]) {
        seen[searchOrder[i].toLowerCase()] = true;
        searches.push(searchOrder[i]);
      }
    }
    for (var i = 0; i < searches.length; i++) {
      var result = year ? yield searchAniList(searches[i], year) : null;
      if (!result)
        result = yield searchAniList(searches[i], null);
      if (result) {
        if (result.romaji)
          titles.push(result.romaji);
        if (result.english)
          titles.push(result.english);
        if (result.native)
          titles.push(result.native);
        break;
      }
    }
    return titles;
  });
}
var animeListCache = null;
var animeListCacheTime = 0;
var CACHE_TTL = 30 * 60 * 1e3;
function getAnimeList() {
  return __async(this, null, function* () {
    var now = Date.now();
    if (animeListCache && now - animeListCacheTime < CACHE_TTL) {
      return animeListCache;
    }
    var data = yield acPost("getAllAnime");
    if (!data || !data.result)
      return [];
    animeListCache = data.result;
    animeListCacheTime = now;
    return animeListCache;
  });
}
function normalize(str) {
  return str.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}
function stripSeasonSuffix(name) {
  return name.replace(/\s*(1st|2nd|3rd|\d+th)\s+season\s*$/i, "").replace(/\s*season\s*\d+\s*$/i, "").replace(/\s*s\d+\s*$/i, "").replace(/\s*\(\d{4}\)\s*$/i, "").trim();
}
function extractSeason(name) {
  var m;
  m = name.match(/(\d+)(?:st|nd|rd|th)\s+season/i);
  if (m)
    return parseInt(m[1], 10);
  m = name.match(/season\s*(\d+)/i);
  if (m)
    return parseInt(m[1], 10);
  m = name.match(/\s+s(\d+)\s*$/i);
  if (m)
    return parseInt(m[1], 10);
  m = name.match(/part\s*(?:2|ii)\s*$/i);
  if (m)
    return 2;
  m = name.match(/part\s*(?:3|iii)\s*$/i);
  if (m)
    return 3;
  return 1;
}
function titleScore(tmdbTitle, acTitle) {
  var a = normalize(tmdbTitle);
  var b = normalize(acTitle);
  if (a === b)
    return 100;
  if (b.length > 2 && a.indexOf(b) > -1)
    return 85;
  if (a.length > 2 && b.indexOf(a) > -1)
    return 80;
  var wordsA = a.split(" ");
  var wordsB = b.split(" ");
  var matched = 0;
  for (var i = 0; i < wordsA.length; i++) {
    for (var j = 0; j < wordsB.length; j++) {
      if (wordsA[i] === wordsB[j] && wordsA[i].length > 1)
        matched++;
    }
  }
  var maxLen = Math.max(wordsA.length, wordsB.length);
  if (maxLen === 0)
    return 0;
  return Math.round(matched / maxLen * 70);
}
function findBestMatch(animeList, searchTitles, targetSeason) {
  var bestScore = 0;
  var bestMatch = null;
  for (var i = 0; i < animeList.length; i++) {
    var anime = animeList[i];
    var acName = anime.name || "";
    var acBaseName = stripSeasonSuffix(acName);
    var acSeason = extractSeason(acName);
    for (var j = 0; j < searchTitles.length; j++) {
      var score = titleScore(searchTitles[j], acBaseName);
      var fullScore = titleScore(searchTitles[j], acName);
      score = Math.max(score, fullScore);
      if (acSeason === targetSeason) {
        score += 15;
      } else if (targetSeason > 1 && acSeason !== targetSeason) {
        score -= 30;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = anime;
      }
    }
  }
  console.log("[AnimeCloud] Best match: " + (bestMatch ? bestMatch.name : "none") + " (score: " + bestScore + ")");
  if (bestScore < 40)
    return null;
  return bestMatch;
}
function parseEpisodeNumber(name) {
  var m = name.match(/(\d+)/);
  if (m)
    return parseInt(m[1], 10);
  return -1;
}
function findEpisode(episodes, targetEpNum) {
  for (var i = 0; i < episodes.length; i++) {
    var epNum = parseEpisodeNumber(episodes[i].name || "");
    if (epNum === targetEpNum)
      return episodes[i];
  }
  return null;
}
function getVideoURLs(epID) {
  return __async(this, null, function* () {
    var urls = [];
    var results = yield Promise.all([fetchVideoURL(epID, 1), fetchVideoURL(epID, 2)]);
    if (results[0])
      urls.push({ url: results[0].url, quality: "720p", note: results[0].note, label: "HD" });
    if (results[1])
      urls.push({ url: results[1].url, quality: "480p", note: results[1].note, label: "SD" });
    return urls;
  });
}
function fetchVideoURL(epID, quality) {
  return __async(this, null, function* () {
    try {
      var response = yield fetch(AC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA
        },
        body: "command=getVideoURL&epID=" + epID + "&quality=" + quality
      });
      if (!response.ok)
        return null;
      var text = yield response.text();
      if (!text || text.length === 0)
        return null;
      var decrypted = decryptRNCryptor(text);
      if (!decrypted)
        return null;
      var data = JSON.parse(decrypted);
      if (!data.result || data.result.length === 0)
        return null;
      return { url: data.result[0].url, note: data.result[0].note || "" };
    } catch (e) {
      console.log("[AnimeCloud] fetchVideoURL error (q=" + quality + "): " + e.message);
      return null;
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      var isTV = mediaType !== "movie";
      console.log("[AnimeCloud] Request: " + mediaType + " " + tmdbId + (isTV ? " S" + season + "E" + episode : ""));
      var tmdb = yield getTmdbDetails(tmdbId, mediaType);
      if (!tmdb || !tmdb.titles || tmdb.titles.length === 0) {
        console.log("[AnimeCloud] No TMDB data found");
        return [];
      }
      console.log("[AnimeCloud] TMDB: " + tmdb.title + " (" + tmdb.year + ")");
      var searchTitles = tmdb.titles.slice();
      var anilistTitles = yield getAniListTitles(tmdb.title, tmdb.originalTitle, tmdb.year);
      if (anilistTitles.length > 0) {
        console.log("[AnimeCloud] AniList titles: " + anilistTitles.join(", "));
        for (var i = anilistTitles.length - 1; i >= 0; i--) {
          searchTitles.unshift(anilistTitles[i]);
        }
      } else {
        console.log("[AnimeCloud] AniList unavailable, using TMDB titles only");
      }
      var seen = {};
      var uniqueTitles = [];
      for (var i = 0; i < searchTitles.length; i++) {
        var lower = searchTitles[i].toLowerCase().trim();
        if (!seen[lower]) {
          seen[lower] = true;
          uniqueTitles.push(searchTitles[i]);
        }
      }
      console.log("[AnimeCloud] Search titles: " + uniqueTitles.slice(0, 6).join(" | "));
      var animeList = yield getAnimeList();
      if (!animeList || animeList.length === 0) {
        console.log("[AnimeCloud] Failed to load anime list");
        return [];
      }
      console.log("[AnimeCloud] Anime catalog: " + animeList.length + " entries");
      var targetSeason = isTV ? season || 1 : 1;
      var matchedAnime = findBestMatch(animeList, uniqueTitles, targetSeason);
      if (!matchedAnime) {
        console.log("[AnimeCloud] No match found");
        return [];
      }
      console.log("[AnimeCloud] Matched: " + matchedAnime.name + " (ID: " + matchedAnime.id + ")");
      var details = yield acPost("getAnimeDetails", { animeID: matchedAnime.id });
      if (!details || !details.result) {
        console.log("[AnimeCloud] Failed to get episode list");
        return [];
      }
      var episodes = details.result;
      console.log("[AnimeCloud] Episodes: " + episodes.length);
      var targetEp;
      if (isTV) {
        targetEp = findEpisode(episodes, episode);
        if (!targetEp) {
          console.log("[AnimeCloud] Episode " + episode + " not found");
          return [];
        }
      } else {
        targetEp = episodes[0];
      }
      console.log("[AnimeCloud] Target: " + targetEp.name + " (ID: " + targetEp.id + ")");
      var videoURLs = yield getVideoURLs(targetEp.id);
      if (videoURLs.length === 0) {
        console.log("[AnimeCloud] No video URLs available");
        return [];
      }
      var playHeaders = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
        "Accept-Encoding": "identity"
      };
      var streams = [];
      for (var i = 0; i < videoURLs.length; i++) {
        var v = videoURLs[i];
        streams.push({
          name: "ANIMECLOUD " + v.label + " - " + v.quality,
          title: "AnimeCloud " + v.label,
          url: v.url,
          quality: v.quality,
          size: "Unknown",
          headers: playHeaders,
          subtitles: [],
          provider: "animecloud"
        });
      }
      console.log("[AnimeCloud] Returning " + streams.length + " stream(s)");
      return streams;
    } catch (error) {
      console.error("[AnimeCloud] Error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
