/**
 * faselhdx - Built from src/faselhdx/
 * Generated: 2026-03-30T16:50:00.056Z
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
var SBOX = [
  99,
  124,
  119,
  123,
  242,
  107,
  111,
  197,
  48,
  1,
  103,
  43,
  254,
  215,
  171,
  118,
  202,
  130,
  201,
  125,
  250,
  89,
  71,
  240,
  173,
  212,
  162,
  175,
  156,
  164,
  114,
  192,
  183,
  253,
  147,
  38,
  54,
  63,
  247,
  204,
  52,
  165,
  229,
  241,
  113,
  216,
  49,
  21,
  4,
  199,
  35,
  195,
  24,
  150,
  5,
  154,
  7,
  18,
  128,
  226,
  235,
  39,
  178,
  117,
  9,
  131,
  44,
  26,
  27,
  110,
  90,
  160,
  82,
  59,
  214,
  179,
  41,
  227,
  47,
  132,
  83,
  209,
  0,
  237,
  32,
  252,
  177,
  91,
  106,
  203,
  190,
  57,
  74,
  76,
  88,
  207,
  208,
  239,
  170,
  251,
  67,
  77,
  51,
  133,
  69,
  249,
  2,
  127,
  80,
  60,
  159,
  168,
  81,
  163,
  64,
  143,
  146,
  157,
  56,
  245,
  188,
  182,
  218,
  33,
  16,
  255,
  243,
  210,
  205,
  12,
  19,
  236,
  95,
  151,
  68,
  23,
  196,
  167,
  126,
  61,
  100,
  93,
  25,
  115,
  96,
  129,
  79,
  220,
  34,
  42,
  144,
  136,
  70,
  238,
  184,
  20,
  222,
  94,
  11,
  219,
  224,
  50,
  58,
  10,
  73,
  6,
  36,
  92,
  194,
  211,
  172,
  98,
  145,
  149,
  228,
  121,
  231,
  200,
  55,
  109,
  141,
  213,
  78,
  169,
  108,
  86,
  244,
  234,
  101,
  122,
  174,
  8,
  186,
  120,
  37,
  46,
  28,
  166,
  180,
  198,
  232,
  221,
  116,
  31,
  75,
  189,
  139,
  138,
  112,
  62,
  181,
  102,
  72,
  3,
  246,
  14,
  97,
  53,
  87,
  185,
  134,
  193,
  29,
  158,
  225,
  248,
  152,
  17,
  105,
  217,
  142,
  148,
  155,
  30,
  135,
  233,
  206,
  85,
  40,
  223,
  140,
  161,
  137,
  13,
  191,
  230,
  66,
  104,
  65,
  153,
  45,
  15,
  176,
  84,
  187,
  22
];
var INV_SBOX = [];
for (_si = 0; _si < 256; _si++)
  INV_SBOX[SBOX[_si]] = _si;
var _si;
var RCON = [1, 2, 4, 8, 16, 32, 64, 128, 27, 54];
function xtime(a) {
  return (a << 1 ^ (a >> 7 & 1) * 27) & 255;
}
function aesExpandKey(key) {
  var w = [];
  for (var i = 0; i < 16; i++)
    w[i] = key[i];
  for (var i = 16; i < 176; i += 4) {
    var t = [w[i - 4], w[i - 3], w[i - 2], w[i - 1]];
    if (i % 16 === 0) {
      t = [SBOX[t[1]] ^ RCON[i / 16 - 1], SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]];
    }
    for (var j = 0; j < 4; j++)
      w[i + j] = w[i - 16 + j] ^ t[j];
  }
  return w;
}
function aesDecryptBlock(block, w) {
  var s = [];
  for (var i = 0; i < 16; i++)
    s[i] = block[i] ^ w[160 + i];
  for (var round = 9; round >= 1; round--) {
    var t = s[13];
    s[13] = s[9];
    s[9] = s[5];
    s[5] = s[1];
    s[1] = t;
    t = s[10];
    s[10] = s[2];
    s[2] = t;
    t = s[14];
    s[14] = s[6];
    s[6] = t;
    t = s[3];
    s[3] = s[7];
    s[7] = s[11];
    s[11] = s[15];
    s[15] = t;
    for (var i = 0; i < 16; i++)
      s[i] = INV_SBOX[s[i]];
    var rk = round * 16;
    for (var i = 0; i < 16; i++)
      s[i] = s[i] ^ w[rk + i];
    for (var c = 0; c < 4; c++) {
      var i0 = c * 4, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
      var a0 = s[i0], a1 = s[i1], a2 = s[i2], a3 = s[i3];
      var x0 = xtime(a0), x1 = xtime(a1), x2 = xtime(a2), x3 = xtime(a3);
      var xx0 = xtime(x0), xx1 = xtime(x1), xx2 = xtime(x2), xx3 = xtime(x3);
      var xxx0 = xtime(xx0), xxx1 = xtime(xx1), xxx2 = xtime(xx2), xxx3 = xtime(xx3);
      s[i0] = x0 ^ xx0 ^ xxx0 ^ (a1 ^ x1 ^ xxx1) ^ (a2 ^ xx2 ^ xxx2) ^ (a3 ^ xxx3);
      s[i1] = a0 ^ xxx0 ^ (x1 ^ xx1 ^ xxx1) ^ (a2 ^ x2 ^ xxx2) ^ (a3 ^ xx3 ^ xxx3);
      s[i2] = a0 ^ xx0 ^ xxx0 ^ (a1 ^ xxx1) ^ (x2 ^ xx2 ^ xxx2) ^ (a3 ^ x3 ^ xxx3);
      s[i3] = a0 ^ x0 ^ xxx0 ^ (a1 ^ xx1 ^ xxx1) ^ (a2 ^ xxx2) ^ (x3 ^ xx3 ^ xxx3);
    }
  }
  var t2 = s[13];
  s[13] = s[9];
  s[9] = s[5];
  s[5] = s[1];
  s[1] = t2;
  t2 = s[10];
  s[10] = s[2];
  s[2] = t2;
  t2 = s[14];
  s[14] = s[6];
  s[6] = t2;
  t2 = s[3];
  s[3] = s[7];
  s[7] = s[11];
  s[11] = s[15];
  s[15] = t2;
  for (var i = 0; i < 16; i++)
    s[i] = INV_SBOX[s[i]];
  for (var i = 0; i < 16; i++)
    s[i] = s[i] ^ w[i];
  return s;
}
function aesCbcDecrypt(hexData, keyStr, ivStr) {
  var data = [];
  for (var i = 0; i < hexData.length; i += 2) {
    data.push(parseInt(hexData.substring(i, i + 2), 16));
  }
  var key = [];
  for (var i = 0; i < keyStr.length; i++)
    key.push(keyStr.charCodeAt(i));
  var iv = [];
  for (var i = 0; i < ivStr.length; i++)
    iv.push(ivStr.charCodeAt(i));
  var w = aesExpandKey(key);
  var result = [];
  var prev = iv;
  for (var offset = 0; offset < data.length; offset += 16) {
    var block = data.slice(offset, offset + 16);
    var decrypted = aesDecryptBlock(block, w);
    for (var i = 0; i < 16; i++)
      result.push(decrypted[i] ^ prev[i]);
    prev = block;
  }
  var padLen = result[result.length - 1];
  if (padLen > 0 && padLen <= 16)
    result = result.slice(0, result.length - padLen);
  var out = "";
  for (var i = 0; i < result.length; i++)
    out += String.fromCharCode(result[i]);
  return out;
}
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
  return aesCbcDecrypt(hexData, AES_KEY, AES_IV);
}
function fetchMoviesApi(path) {
  var url = MOVIESAPI_BASE + "/" + path;
  console.log("[Flex] MoviesAPI: " + url);
  return safeFetch(url).then(function(r) {
    return r.ok ? r.json() : null;
  }).catch(function(e) {
    console.log("[Flex] MoviesAPI error: " + e.message);
    return null;
  });
}
function fetchFlixVideo(videoCode) {
  var url = FLIXCDN_BASE + "/video?id=" + videoCode + "&w=1920&h=1080&r=ww2.moviesapi.to";
  console.log("[Flex] FlixCDN: " + videoCode);
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
    console.log("[Flex] FlixCDN error: " + e.message);
    return null;
  });
}

// src/faselhdx/extractor.js
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
function buildTiktokUrl(videoData) {
  var path = videoData.hlsVideoTiktok;
  if (!path)
    return null;
  try {
    var config = typeof videoData.streamingConfig === "string" ? JSON.parse(videoData.streamingConfig) : videoData.streamingConfig;
    if (!config || !config.adjust || !config.adjust.Tiktok)
      return null;
    var tk = config.adjust.Tiktok;
    if (tk.disabled)
      return null;
    var domain = tk.domain;
    if (!domain)
      return null;
    var url = "https://" + domain + path;
    if (tk.params && tk.params.v)
      url += "?v=" + tk.params.v;
    return url;
  } catch (e) {
    return null;
  }
}
function buildCfUrl(videoData) {
  var cfPath = videoData.cf;
  if (!cfPath)
    return null;
  try {
    var config = typeof videoData.streamingConfig === "string" ? JSON.parse(videoData.streamingConfig) : videoData.streamingConfig;
    if (!config || !config.adjust || !config.adjust.Cloudflare)
      return null;
    var cf = config.adjust.Cloudflare;
    if (cf.disabled)
      return null;
    var cfDomain = videoData.metric && videoData.metric.cfDomain;
    var url = cfPath;
    if (url.indexOf("http") !== 0 && cfDomain) {
      url = "https://snq." + cfDomain + cfPath;
    }
    if (cf.params) {
      var sep = url.indexOf("?") !== -1 ? "&" : "?";
      if (cf.params.t)
        url += sep + "t=" + cf.params.t;
      if (cf.params.e)
        url += "&e=" + cf.params.e;
    }
    return url;
  } catch (e) {
    return null;
  }
}
function buildStreams(videoData, subtitles) {
  var headers = {
    "Referer": "https://flixcdn.cyou/",
    "Origin": "https://flixcdn.cyou",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  };
  var streams = [];
  var tiktokUrl = buildTiktokUrl(videoData);
  if (tiktokUrl) {
    streams.push({
      name: "Flex",
      title: "Flex",
      url: tiktokUrl,
      quality: "auto",
      headers,
      subtitles
    });
  }
  if (videoData.source) {
    streams.push({
      name: "Flex",
      title: "Flex HD",
      url: videoData.source,
      quality: "auto",
      headers,
      subtitles
    });
  }
  var cfUrl = buildCfUrl(videoData);
  if (cfUrl) {
    streams.push({
      name: "Flex",
      title: "Flex CF",
      url: cfUrl,
      quality: "auto",
      headers,
      subtitles
    });
  }
  return streams;
}
function extractMovie(tmdbId) {
  return __async(this, null, function* () {
    console.log("[Flex] Movie TMDB: " + tmdbId);
    var data = yield fetchMoviesApi("movie/" + tmdbId);
    if (!data || !data.video_url) {
      console.log("[Flex] Movie not found on MoviesAPI");
      return [];
    }
    console.log("[Flex] Movie: " + (data.title || "untitled"));
    var videoCode = extractVideoCode(data.video_url);
    if (!videoCode) {
      console.log("[Flex] No video code in URL");
      return [];
    }
    console.log("[Flex] Video code: " + videoCode);
    var videoData = yield fetchFlixVideo(videoCode);
    if (!videoData) {
      console.log("[Flex] FlixCDN returned no data");
      return [];
    }
    console.log("[Flex] Source: " + (videoData.source || "none").substring(0, 80));
    var subtitles = extractSubtitles(data);
    return buildStreams(videoData, subtitles);
  });
}
function extractSeries(tmdbId, season, episode) {
  return __async(this, null, function* () {
    var seasonNum = parseInt(season, 10);
    var episodeNum = parseInt(episode, 10);
    console.log("[Flex] Series TMDB: " + tmdbId + " S" + seasonNum + "E" + episodeNum);
    var data = yield fetchMoviesApi("tv/" + tmdbId + "/" + seasonNum + "/" + episodeNum);
    if (!data || !data.video_url) {
      console.log("[Flex] Episode not found on MoviesAPI");
      return [];
    }
    console.log("[Flex] Episode: " + (data.title || "untitled"));
    var videoCode = extractVideoCode(data.video_url);
    if (!videoCode) {
      console.log("[Flex] No video code in URL");
      return [];
    }
    console.log("[Flex] Video code: " + videoCode);
    var videoData = yield fetchFlixVideo(videoCode);
    if (!videoData) {
      console.log("[Flex] FlixCDN returned no data");
      return [];
    }
    console.log("[Flex] Source: " + (videoData.source || "none").substring(0, 80));
    var subtitles = extractSubtitles(data);
    return buildStreams(videoData, subtitles);
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log("[Flex] Starting: " + mediaType + " " + tmdbId);
    var streams = [];
    if (mediaType === "movie") {
      streams = yield extractMovie(tmdbId);
    } else {
      streams = yield extractSeries(tmdbId, season, episode);
    }
    if (!streams.length) {
      console.log("[Flex] No streams found");
    } else {
      console.log("[Flex] Got " + streams.length + " streams");
    }
    return streams;
  });
}

// src/faselhdx/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[Flex] Request: " + mediaType + " " + tmdbId);
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      console.error("[Flex] Error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
