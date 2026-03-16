/**
 * fasel_probe - Built from src/fasel_probe/
 * Generated: 2026-03-16T01:48:10.685Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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

// src/fasel_probe/http.js
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.8"
};
function resolveUrl(base, next) {
  try {
    return new URL(next, base).toString();
  } catch (e) {
    return next;
  }
}
function traceRedirects(startUrl, maxHops = 8) {
  return __async(this, null, function* () {
    const hops = [];
    let currentUrl = startUrl;
    for (let i = 0; i < maxHops; i += 1) {
      const response = yield fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: HEADERS
      });
      const location = response.headers.get("location");
      const status = response.status;
      hops.push({
        step: i + 1,
        url: currentUrl,
        status,
        location: location || null
      });
      if (location && [301, 302, 303, 307, 308].includes(status)) {
        const nextUrl = resolveUrl(currentUrl, location);
        if (nextUrl === currentUrl) {
          break;
        }
        currentUrl = nextUrl;
        continue;
      }
      let body = "";
      try {
        body = yield response.text();
      } catch (e) {
        body = "";
      }
      return {
        startUrl,
        finalUrl: currentUrl,
        status,
        body,
        hops
      };
    }
    return {
      startUrl,
      finalUrl: currentUrl,
      status: 0,
      body: "",
      hops
    };
  });
}

// src/fasel_probe/extractor.js
var PROBE_URL = "https://web370x.faselhdx.top/movies/%D9%81%D9%8A%D9%84%D9%85-moana-2-2024-%D9%85%D8%AA%D8%B1%D8%AC%D9%85";
var HOME_URL = "https://web370x.faselhdx.xyz/main";
function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}
function pickProbeUrl(tmdbId, mediaType) {
  if (isHttpUrl(tmdbId)) {
    return tmdbId;
  }
  if (mediaType === "home") {
    return HOME_URL;
  }
  return PROBE_URL;
}
function summarizeBody(html) {
  if (!html) {
    return { movieLinks: 0, seriesLinks: 0, hasArabicUi: false };
  }
  const movieLinks = (html.match(/href=["'][^"']*\/movies\//gi) || []).length;
  const seriesLinks = (html.match(/href=["'][^"']*\/series\//gi) || []).length;
  const hasArabicUi = /(فاصل|الأفلام|المسلسلات)/i.test(html);
  return { movieLinks, seriesLinks, hasArabicUi };
}
function classifyTrace(trace) {
  const joined = JSON.stringify(trace.hops).toLowerCase();
  const body = (trace.body || "").toLowerCase();
  const finalUrl = (trace.finalUrl || "").toLowerCase();
  const adRedirect = /(coosync\.com|doubleclick|adservice|popunder|clickadu)/i.test(joined + finalUrl);
  const challenge = /(captcha|verify you are human|checking your browser|cloudflare|javascript required|ddos)/i.test(body);
  const hasPlayableMarkers = /(\.m3u8|\.mp4|<video|source\s+src=|application\/vnd\.apple\.mpegurl)/i.test(body);
  if (adRedirect)
    return "ad_redirect_chain";
  if (challenge)
    return "challenge_page";
  if (hasPlayableMarkers)
    return "media_markers_found";
  return "unknown_or_empty";
}
function printTrace(trace, classification) {
  console.log(`[FaselProbe] Classification: ${classification}`);
  for (const hop of trace.hops) {
    const location = hop.location ? ` -> ${hop.location}` : "";
    console.log(`[FaselProbe] Hop ${hop.step}: ${hop.status} ${hop.url}${location}`);
  }
  console.log(`[FaselProbe] Final: ${trace.finalUrl} (status ${trace.status})`);
  const summary = summarizeBody(trace.body);
  console.log(
    `[FaselProbe] Body summary: movieLinks=${summary.movieLinks}, seriesLinks=${summary.seriesLinks}, hasArabicUi=${summary.hasArabicUi}`
  );
}
function buildNuvioResults(trace, classification, targetUrl) {
  const results = [];
  const summary = summarizeBody(trace.body || "");
  results.push({
    name: "FaselProbe",
    title: `Source Page (${classification})`,
    url: trace.finalUrl || targetUrl,
    quality: "INFO",
    headers: __spreadProps(__spreadValues({}, HEADERS), {
      Referer: trace.finalUrl || targetUrl,
      "X-Nuvio-Status": classification,
      "X-Nuvio-Movie-Links": String(summary.movieLinks),
      "X-Nuvio-Series-Links": String(summary.seriesLinks)
    })
  });
  if (classification === "media_markers_found" && targetUrl !== (trace.finalUrl || targetUrl)) {
    results.push({
      name: "FaselProbe",
      title: "Requested Source Page",
      url: targetUrl,
      quality: "INFO",
      headers: __spreadProps(__spreadValues({}, HEADERS), {
        Referer: targetUrl
      })
    });
  }
  return results;
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log(
      `[FaselProbe] Probe only for ${mediaType}:${tmdbId} s=${season || "-"} e=${episode || "-"}`
    );
    const targetUrl = pickProbeUrl(tmdbId, mediaType);
    console.log(`[FaselProbe] Target: ${targetUrl}`);
    try {
      const trace = yield traceRedirects(targetUrl, 10);
      const classification = classifyTrace(trace);
      printTrace(trace, classification);
      return buildNuvioResults(trace, classification, targetUrl);
    } catch (error) {
      console.log(`[FaselProbe] Probe failed: ${error.message}`);
      return [{
        name: "FaselProbe",
        title: "Source Page (network_error)",
        url: targetUrl,
        quality: "INFO",
        headers: __spreadProps(__spreadValues({}, HEADERS), {
          Referer: targetUrl,
          "X-Nuvio-Status": "network_error",
          "X-Nuvio-Error": String(error.message || "unknown_error")
        })
      }];
    }
  });
}

// src/fasel_probe/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[FaselProbe] Request: ${mediaType} ${tmdbId}`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[FaselProbe] Error: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
