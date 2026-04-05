// AnimeCloud Nuvio Provider v2.7.2
// Direct API integration with server-side fallback for TV compatibility.
// Uses AnimeCloud's mobile app API with RNCryptor decryption for video URLs.
// v2.7.2: Rewrite fetchWithTimeout to use AbortController (like Cineby) — setTimeout unreliable on TV
// v2.7.1: Fix TV detection — crypto-js may return empty object instead of throwing
// v2.7.0: Server-side decryption fallback for TV (crypto-js unavailable on smart TV runtime)

var CryptoJS = null;
try {
    var _cjs = require('crypto-js');
    // Verify crypto-js is functional (TV runtime may return empty/broken object)
    if (_cjs && _cjs.enc && _cjs.enc.Base64 && _cjs.AES && _cjs.PBKDF2) {
        CryptoJS = _cjs;
    } else {
        console.log('[AnimeCloud] crypto-js loaded but incomplete — using backend fallback');
    }
} catch (e) {
    console.log('[AnimeCloud] crypto-js not available: ' + e.message);
}

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB_BASE = 'https://api.themoviedb.org/3';
var ANILIST_URL = 'https://graphql.anilist.co';
var AC_API = 'https://khkhkhkh.com/animecp/animeapi65/';
var RNC_PASSWORD = 'anime5w\x26f4H\x26434*';

var UA = 'AnimeCloud/6.5 CFNetwork/1399 Darwin/22.1.0';
var FETCH_TIMEOUT = 12000; // 12s default timeout
var FETCH_TIMEOUT_LONG = 25000; // 25s for large payloads (One Piece = 310KB, 1174 episodes)
var DECRYPT_BACKEND = 'http://145.241.158.129:3112/animecloud/video';

// ── Timeout wrapper (AbortController-based, like Cineby — setTimeout unreliable on TV) ──

function fetchWithTimeout(url, options, timeout) {
    var ms = timeout || FETCH_TIMEOUT;
    var controller;
    var tid;
    try {
        controller = new AbortController();
        tid = setTimeout(function() { controller.abort(); }, ms);
    } catch (e) { controller = null; }
    var opts = Object.assign({ method: 'GET' }, options || {});
    if (controller) opts.signal = controller.signal;
    return fetch(url, opts)
        .then(function(r) { if (tid) clearTimeout(tid); return r; })
        .catch(function(e) { if (tid) clearTimeout(tid); throw e; });
}

// ── AnimeCloud API helper ──────────────────────────────────────────────

async function acPost(command, params, timeout) {
    var body = 'command=' + encodeURIComponent(command);
    if (params) {
        var keys = Object.keys(params);
        for (var i = 0; i < keys.length; i++) {
            body += '&' + encodeURIComponent(keys[i]) + '=' + encodeURIComponent(params[keys[i]]);
        }
    }

    try {
        var response = await fetchWithTimeout(AC_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': UA,
            },
            body: body,
        }, timeout || FETCH_TIMEOUT);

        if (!response.ok) return null;

        var text = await response.text();
        if (!text || text.length === 0) return null;

        try {
            return JSON.parse(text);
        } catch (e) {
            return { _raw: text };
        }
    } catch (e) {
        console.log('[AnimeCloud] acPost error: ' + e.message);
        return null;
    }
}

// ── RNCryptor v3 Decryption ────────────────────────────────────────────

function decryptRNCryptor(base64Data) {
    if (!CryptoJS) {
        console.log('[AnimeCloud] Cannot decrypt — crypto-js not loaded');
        return null;
    }
    var raw = CryptoJS.enc.Base64.parse(base64Data);
    var rawBytes = wordArrayToBytes(raw);

    if (rawBytes.length < 66) return null;

    var encSalt = bytesToWordArray(rawBytes.slice(2, 10));
    var iv = bytesToWordArray(rawBytes.slice(18, 34));
    var ciphertext = bytesToWordArray(rawBytes.slice(34, rawBytes.length - 32));

    var encKey = CryptoJS.PBKDF2(RNC_PASSWORD, encSalt, {
        keySize: 256 / 32,
        iterations: 10000,
        hasher: CryptoJS.algo.SHA1,
    });

    var decrypted = CryptoJS.AES.decrypt(
        { ciphertext: ciphertext },
        encKey,
        { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );

    return CryptoJS.enc.Utf8.stringify(decrypted);
}

function wordArrayToBytes(wordArray) {
    var words = wordArray.words;
    var sigBytes = wordArray.sigBytes;
    // Pre-allocate array (avoids repeated .push() reallocation on low-RAM devices)
    var bytes = new Array(sigBytes);
    for (var i = 0; i < sigBytes; i++) {
        bytes[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return bytes;
}

function bytesToWordArray(bytes) {
    var words = [];
    for (var i = 0; i < bytes.length; i += 4) {
        var word = 0;
        for (var j = 0; j < 4 && (i + j) < bytes.length; j++) {
            word |= bytes[i + j] << (24 - j * 8);
        }
        words.push(word);
    }
    return CryptoJS.lib.WordArray.create(words, bytes.length);
}

// ── TMDB helpers ───────────────────────────────────────────────────────

async function tmdbGet(path) {
    try {
        var url = TMDB_BASE + path + (path.indexOf('?') > -1 ? '&' : '?') + 'api_key=' + TMDB_KEY;
        var response = await fetchWithTimeout(url, {
            headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.log('[AnimeCloud] TMDB error: ' + e.message);
        return null;
    }
}

async function getTmdbDetails(tmdbId, mediaType, season) {
    var type = mediaType === 'movie' ? 'movie' : 'tv';
    var data = await tmdbGet('/' + type + '/' + tmdbId + '?language=en-US&append_to_response=alternative_titles');
    if (!data) return null;

    var titles = [];
    if (data.name) titles.push(data.name);
    if (data.title) titles.push(data.title);
    if (data.original_name) titles.push(data.original_name);
    if (data.original_title) titles.push(data.original_title);

    var alts = (data.alternative_titles || {}).results || [];
    for (var i = 0; i < alts.length; i++) {
        if (alts[i].title) titles.push(alts[i].title);
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
    if (dateStr) year = parseInt(dateStr.split('-')[0], 10);

    var seasonName = null;
    if (data.seasons && season) {
        var seasonInt = parseInt(season, 10);
        for (var i = 0; i < data.seasons.length; i++) {
            if (data.seasons[i].season_number === seasonInt) {
                seasonName = data.seasons[i].name;
                break;
            }
        }
    }

    var seasonEpCounts = null;
    if (data.seasons && data.seasons.length > 0) {
        seasonEpCounts = {};
        for (var i = 0; i < data.seasons.length; i++) {
            var s = data.seasons[i];
            if (s.season_number > 0) {
                seasonEpCounts[s.season_number] = s.episode_count;
            }
        }
    }

    return {
        title: data.name || data.title || '',
        originalTitle: data.original_name || data.original_title || '',
        titles: unique,
        year: year,
        seasonName: seasonName,
        seasonEpCounts: seasonEpCounts,
        totalSeasons: data.number_of_seasons || 1,
    };
}

// ── AniList matching ──────────────────────────────────────────────────

function calcAbsoluteEpisode(tmdb, season, episode) {
    if (!tmdb.seasonEpCounts || season <= 1) return episode;

    var offset = 0;
    for (var s = 1; s < season; s++) {
        var count = tmdb.seasonEpCounts[s];
        if (count === undefined) return episode;
        offset += count;
    }
    var seasonEpCount = tmdb.seasonEpCounts[season] || 0;
    if (episode <= seasonEpCount) {
        var absolute = offset + episode;
        console.log('[AnimeCloud] Absolute ep calc: S' + season + 'E' + episode + ' + offset ' + offset + ' = ep ' + absolute);
        return absolute;
    }
    return episode;
}

async function searchAniList(title, year) {
    var query = year
        ? 'query ($search: String, $year: Int) { Media(search: $search, type: ANIME, seasonYear: $year) { id idMal title { english romaji native } startDate { year } } }'
        : 'query ($search: String) { Media(search: $search, type: ANIME) { id idMal title { english romaji native } startDate { year } } }';

    var variables = year ? { search: title, year: year } : { search: title };

    try {
        var response = await fetchWithTimeout(ANILIST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: query, variables: variables }),
        });

        if (!response.ok) return null;

        var data = await response.json();
        if (data.data && data.data.Media) {
            var media = data.data.Media;
            return {
                romaji: media.title ? media.title.romaji : null,
                english: media.title ? media.title.english : null,
                native: media.title ? media.title.native : null,
            };
        }
        return null;
    } catch (e) {
        console.log('[AnimeCloud] AniList error: ' + e.message);
        return null;
    }
}

async function getAniListTitles(tmdbTitle, originalTitle, year) {
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
        var result = year ? await searchAniList(searches[i], year) : null;
        if (!result) result = await searchAniList(searches[i], null);

        if (result) {
            if (result.romaji) titles.push(result.romaji);
            if (result.english) titles.push(result.english);
            if (result.native) titles.push(result.native);
            break;
        }
    }

    return titles;
}

// ── Anime list cache (OPTIMIZED — strips unused fields, 2h TTL) ──────

var animeListCache = null;
var animeListCacheTime = 0;
var CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours (was 30min — TVs don't need frequent refresh)

async function getAnimeList() {
    var now = Date.now();
    if (animeListCache && (now - animeListCacheTime) < CACHE_TTL) {
        return animeListCache;
    }

    var data = await acPost('getAllAnime', null, FETCH_TIMEOUT_LONG);
    if (!data || !data.result) return [];

    // Strip to only id/name/year — saves ~72% memory (612KB → 169KB for 2434 entries)
    // Original entries have: id, name, image, status, year, keywords
    // We only use: id, name, year
    var raw = data.result;
    var stripped = new Array(raw.length);
    for (var i = 0; i < raw.length; i++) {
        stripped[i] = { id: raw[i].id, name: raw[i].name, year: raw[i].year || '' };
    }

    animeListCache = stripped;
    animeListCacheTime = now;
    return animeListCache;
}

// ── Title matching ─────────────────────────────────────────────────────

function normalize(str) {
    return str.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractBaseName(name) {
    return name
        .replace(/\s+Part\s+\d+\s*[:].*/i, '')
        .replace(/\s+Part\s+\d+\s*$/i, '')
        .replace(/\s*(1st|2nd|3rd|\d+th)\s+Season\s*$/i, '')
        .replace(/\s*Season\s*\d+\s*$/i, '')
        .replace(/\s*[:]\s+.*$/, '')
        .replace(/\s*\((?:TV|OVA|ONA|\d{4})\)\s*$/i, '')
        .replace(/\s+(?:Movie|Film)\s*\d*\s*$/i, '')
        .replace(/\s+\d+\s+Movie\s*$/i, '')
        .trim();
}

function extractSeason(name) {
    var m;
    m = name.match(/Part\s+(\d+)/i);
    if (m) return parseInt(m[1], 10);
    m = name.match(/(\d+)(?:st|nd|rd|th)\s+Season/i);
    if (m) return parseInt(m[1], 10);
    m = name.match(/Season\s*(\d+)/i);
    if (m) return parseInt(m[1], 10);
    if (/[:]\s*Ni\s+no\s+Shou/i.test(name)) return 2;
    if (/[:]\s*San\s+no\s+Shou/i.test(name)) return 3;
    return 1;
}

function titleScore(searchTitle, acTitle) {
    var a = normalize(searchTitle);
    var b = normalize(acTitle);

    if (a === b) return 100;

    var lenRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    if (lenRatio > 0.5) {
        if (b.length > 2 && a.indexOf(b) > -1) return 85;
        if (a.length > 2 && b.indexOf(a) > -1) return 82;
    }

    var wordsA = a.split(' ').filter(function(w) { return w.length > 1; });
    var wordsB = b.split(' ').filter(function(w) { return w.length > 1; });

    if (wordsA.length === 0 || wordsB.length === 0) return 0;

    var matched = 0;
    var usedB = {};
    for (var i = 0; i < wordsA.length; i++) {
        for (var j = 0; j < wordsB.length; j++) {
            if (!usedB[j] && wordsA[i] === wordsB[j]) {
                matched++;
                usedB[j] = true;
                break;
            }
        }
    }

    var overlapA = matched / wordsA.length;
    var overlapB = matched / wordsB.length;
    var score = Math.round(Math.min(overlapA, overlapB) * 70);
    if (overlapA > 0.8 && overlapB > 0.8) score += 10;

    return score;
}

function isMovie(name) {
    return /\bMovie\b/i.test(name) || /\bFilm\b/i.test(name) || /\b0\s+Movie\b/i.test(name);
}

// ── SINGLE-PASS matching (replaces findBestMatch + findBySeasonName) ──
// One iteration over the anime list instead of 2-4.
// No pre-fetch episode count phase — that was the biggest perf killer
// (5 parallel getAnimeDetails calls BEFORE even matching).

function matchAnime(animeList, searchTitles, targetSeason, seasonName) {
    var candidates = [];
    var franchiseCandidates = [];

    // Prep season-name matching data once
    var normSeason = seasonName ? normalize(seasonName) : null;
    var seasonWords = null;
    var useSeasonName = seasonName && !/^Season\s+\d+$/i.test(seasonName.trim());
    if (useSeasonName && normSeason) {
        seasonWords = normSeason.split(' ').filter(function(w) { return w.length > 2; });
        if (seasonWords.length === 0) useSeasonName = false;
    }

    // === SINGLE PASS over all entries ===
    for (var i = 0; i < animeList.length; i++) {
        var anime = animeList[i];
        var acName = anime.name || '';
        var acBase = extractBaseName(acName);
        var acSeason = extractSeason(acName);

        var bestTitleScore = 0;
        for (var j = 0; j < searchTitles.length; j++) {
            var baseScore = titleScore(searchTitles[j], acBase);
            var fullScore = titleScore(searchTitles[j], acName);
            var score = Math.max(baseScore, fullScore);
            if (score > bestTitleScore) bestTitleScore = score;
        }

        if (bestTitleScore < 40) continue;

        var entry = {
            anime: anime,
            tScore: bestTitleScore,
            season: acSeason,
            name: acName,
        };

        candidates.push(entry);

        // Track franchise candidates for season-name matching (score >= 50)
        if (useSeasonName && bestTitleScore >= 50) {
            franchiseCandidates.push(entry);
        }
    }

    if (candidates.length === 0) return null;

    // Phase A: Season-name matching (handles multi-part anime like JoJo, Demon Slayer arcs)
    if (useSeasonName && franchiseCandidates.length > 0 && seasonWords) {
        // Strategy 1: Match season name words against AC entry full names
        var bestSnScore = 0;
        var bestSnMatch = null;
        for (var i = 0; i < franchiseCandidates.length; i++) {
            var fullNorm = normalize(franchiseCandidates[i].name);
            var matched = 0;
            for (var w = 0; w < seasonWords.length; w++) {
                if (fullNorm.indexOf(seasonWords[w]) > -1) matched++;
            }
            var snScore = matched / seasonWords.length;
            if (snScore > bestSnScore) {
                bestSnScore = snScore;
                bestSnMatch = franchiseCandidates[i];
            }
        }
        if (bestSnScore >= 0.5 && bestSnMatch) {
            console.log('[AnimeCloud] Season name match: ' + bestSnMatch.name);
            bestSnMatch.anime._bestScore = bestSnMatch.tScore;
            return bestSnMatch.anime;
        }

        // Strategy 2: Franchise index by year (JoJo S4 → 4th entry sorted by year)
        if (franchiseCandidates.length > 1 && targetSeason > 1) {
            var tvFranchise = [];
            for (var i = 0; i < franchiseCandidates.length; i++) {
                if (!isMovie(franchiseCandidates[i].name)) {
                    tvFranchise.push(franchiseCandidates[i]);
                }
            }
            if (tvFranchise.length > 1) {
                tvFranchise.sort(function(a, b) {
                    var ya = parseInt(a.anime.year) || 9999;
                    var yb = parseInt(b.anime.year) || 9999;
                    if (ya !== yb) return ya - yb;
                    return a.season - b.season;
                });
                var idx = targetSeason - 1;
                if (idx >= 0 && idx < tvFranchise.length) {
                    console.log('[AnimeCloud] Franchise index match: S' + targetSeason + ' -> ' + tvFranchise[idx].name);
                    tvFranchise[idx].anime._bestScore = tvFranchise[idx].tScore;
                    return tvFranchise[idx].anime;
                }
            }
        }
    }

    // Phase B: Standard title + season scoring (no pre-fetch needed)
    var bestScore = 0;
    var bestMatch = null;
    var hasExactSeason = false;

    for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        var finalScore = c.tScore;
        if (c.season === targetSeason) {
            finalScore += 15;
            hasExactSeason = true;
        } else if (targetSeason > 1 && c.season !== targetSeason) {
            finalScore -= 20;
        }
        if (finalScore > bestScore) {
            bestScore = finalScore;
            bestMatch = c;
        }
    }

    // Franchise index fallback (no exact season found)
    if (!hasExactSeason && targetSeason > 1 && candidates.length > 1) {
        var tvCandidates = [];
        for (var i = 0; i < candidates.length; i++) {
            if (!isMovie(candidates[i].name)) {
                tvCandidates.push(candidates[i]);
            }
        }
        if (tvCandidates.length > 1) {
            tvCandidates.sort(function(a, b) {
                var ya = parseInt(a.anime.year) || 9999;
                var yb = parseInt(b.anime.year) || 9999;
                if (ya !== yb) return ya - yb;
                return a.season - b.season;
            });
            var idx = targetSeason - 1;
            if (idx >= 0 && idx < tvCandidates.length) {
                console.log('[AnimeCloud] Franchise index fallback: S' + targetSeason + ' -> ' + tvCandidates[idx].name);
                tvCandidates[idx].anime._bestScore = tvCandidates[idx].tScore;
                return tvCandidates[idx].anime;
            }
        }
    }

    console.log('[AnimeCloud] Best match: ' + (bestMatch ? bestMatch.name : 'none') + ' (score: ' + bestScore + ')');
    if (bestScore < 40) return null;
    if (bestMatch) {
        var result = bestMatch.anime;
        result._bestScore = bestScore;
        return result;
    }
    return null;
}

// ── Episode mapping ────────────────────────────────────────────────────

function parseEpisodeNumber(name) {
    var m = name.match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
    return -1;
}

function findEpisode(episodes, targetEpNum) {
    for (var i = 0; i < episodes.length; i++) {
        var epNum = parseEpisodeNumber(episodes[i].name || '');
        if (epNum === targetEpNum) return episodes[i];
    }
    return null;
}

// ── Video URL extraction ───────────────────────────────────────────────

async function getVideoURLs(epID) {
    var urls = [];
    var results = await Promise.all([fetchVideoURL(epID, 1), fetchVideoURL(epID, 2)]);
    if (results[0]) urls.push({ url: results[0].url, quality: 'auto', note: results[0].note, label: 'High' });
    if (results[1]) urls.push({ url: results[1].url, quality: 'auto', note: results[1].note, label: 'Low' });
    return urls;
}

async function fetchVideoURL(epID, quality) {
    // Path 1: Local decryption via crypto-js (phone — fast, no network hop)
    if (CryptoJS) {
        try {
            var response = await fetchWithTimeout(AC_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': UA,
                },
                body: 'command=getVideoURL&epID=' + epID + '&quality=' + quality,
            });

            if (!response.ok) return null;

            var text = await response.text();
            if (!text || text.length === 0) return null;

            var decrypted = decryptRNCryptor(text);
            if (!decrypted) return null;

            var data = JSON.parse(decrypted);
            if (!data.result || data.result.length === 0) return null;

            return { url: data.result[0].url, note: data.result[0].note || '' };
        } catch (e) {
            console.log('[AnimeCloud] fetchVideoURL local error (q=' + quality + '): ' + e.message);
            return null;
        }
    }

    // Path 2: Server-side decryption fallback (TV — crypto-js unavailable)
    try {
        console.log('[AnimeCloud] Using backend decrypt for epID=' + epID + ' q=' + quality);
        var backendUrl = DECRYPT_BACKEND + '?epID=' + epID + '&quality=' + quality;
        var response = await fetchWithTimeout(backendUrl, {
            headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
            console.log('[AnimeCloud] Backend returned ' + response.status);
            return null;
        }

        var data = await response.json();
        if (data.error) {
            console.log('[AnimeCloud] Backend error: ' + data.error);
            return null;
        }
        if (!data.url) return null;

        return { url: data.url, note: data.note || '' };
    } catch (e) {
        console.log('[AnimeCloud] fetchVideoURL backend error (q=' + quality + '): ' + e.message);
        return null;
    }
}

// ── Main getStreams (v2.5.0 — try-match-first, AniList fallback only) ──

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        var isTV = mediaType !== 'movie';
        // Type safety: ensure season/episode are numbers
        var seasonNum = isTV ? (parseInt(season, 10) || 1) : 1;
        var episodeNum = isTV ? (parseInt(episode, 10) || 1) : 1;
        console.log('[AnimeCloud] Request: ' + mediaType + ' ' + tmdbId + (isTV ? ' S' + seasonNum + 'E' + episodeNum : ''));

        // Step 1: Fire TMDB + anime list + AniList ALL in parallel
        // AniList uses TMDB title, so we fire a speculative search with the TMDB ID first
        var tmdbPromise = getTmdbDetails(tmdbId, mediaType, isTV ? seasonNum : null);
        var animeListPromise = getAnimeList();

        // Wait for TMDB + anime list (need both for matching)
        var tmdb = await tmdbPromise;
        if (!tmdb || !tmdb.titles || tmdb.titles.length === 0) {
            console.log('[AnimeCloud] No TMDB data found');
            return [];
        }
        console.log('[AnimeCloud] TMDB: ' + tmdb.title + ' (' + tmdb.year + ')' + (tmdb.seasonName ? ' [' + tmdb.seasonName + ']' : ''));

        // Fire AniList in background NOW (don't await yet)
        var anilistPromise = getAniListTitles(tmdb.title, tmdb.originalTitle, tmdb.year);

        var animeList = await animeListPromise;
        if (!animeList || animeList.length === 0) {
            console.log('[AnimeCloud] Failed to load anime list');
            return [];
        }
        console.log('[AnimeCloud] Anime catalog: ' + animeList.length + ' entries');

        // Step 2: Try matching with TMDB titles FIRST (no AniList wait)
        var matchedAnime = matchAnime(animeList, tmdb.titles, seasonNum, isTV ? tmdb.seasonName : null);

        // If weak match (<80) or no match, wait for AniList and retry
        if (!matchedAnime || (matchedAnime._bestScore && matchedAnime._bestScore < 80)) {
            console.log('[AnimeCloud] TMDB-only match ' + (matchedAnime ? 'weak (' + matchedAnime._bestScore + ')' : 'failed') + ', waiting for AniList...');
            var anilistTitles = await anilistPromise;
            if (anilistTitles && anilistTitles.length > 0) {
                console.log('[AnimeCloud] AniList titles: ' + anilistTitles.join(', '));
                // Build combined title list: AniList first, then TMDB
                var seen = {};
                var combined = [];
                var allTitles = anilistTitles.concat(tmdb.titles);
                for (var i = 0; i < allTitles.length; i++) {
                    var lower = allTitles[i].toLowerCase().trim();
                    if (!seen[lower]) { seen[lower] = true; combined.push(allTitles[i]); }
                }
                var retryMatch = matchAnime(animeList, combined, seasonNum, isTV ? tmdb.seasonName : null);
                if (retryMatch) matchedAnime = retryMatch;
            }
        } else {
            console.log('[AnimeCloud] Strong TMDB match, skipping AniList wait');
        }

        if (!matchedAnime) {
            console.log('[AnimeCloud] No match found');
            return [];
        }
        console.log('[AnimeCloud] Matched: ' + matchedAnime.name + ' (ID: ' + matchedAnime.id + ')');

        // Step 3: Get episode list (single fetch)
        var details = await acPost('getAnimeDetails', { animeID: matchedAnime.id }, FETCH_TIMEOUT_LONG);
        if (!details || !details.result) {
            console.log('[AnimeCloud] Failed to get episode list');
            return [];
        }
        var episodes = details.result;
        console.log('[AnimeCloud] Episodes: ' + episodes.length);

        // Step 4: Find target episode (with long-runner + split-cour fallback)
        var targetEp;
        if (isTV) {
            var lookupEp = episodeNum;
            // Long-runner detection: if entry has 100+ eps and we're past S1
            if (episodes.length > 100 && seasonNum > 1 && tmdb.seasonEpCounts) {
                lookupEp = calcAbsoluteEpisode(tmdb, seasonNum, episodeNum);
            }
            targetEp = findEpisode(episodes, lookupEp);

            // Split-cour fallback
            if (!targetEp && lookupEp > episodes.length) {
                console.log('[AnimeCloud] Episode ' + lookupEp + ' not in ' + matchedAnime.name + ' (' + episodes.length + ' eps), trying split-cour fallback');
                var offsetEp = lookupEp - episodes.length;
                var matchedBase = normalize(extractBaseName(matchedAnime.name || ''));
                var continuations = [];
                for (var ci = 0; ci < animeList.length; ci++) {
                    var cEntry = animeList[ci];
                    if (cEntry.id === matchedAnime.id) continue;
                    var cBase = normalize(extractBaseName(cEntry.name || ''));
                    if (cBase === matchedBase || titleScore(matchedBase, cBase) >= 70) {
                        var cYear = parseInt(cEntry.year) || 0;
                        var mYear = parseInt(matchedAnime.year) || 0;
                        if (cYear >= mYear && !isMovie(cEntry.name || '')) {
                            continuations.push(cEntry);
                        }
                    }
                }
                continuations.sort(function(a, b) {
                    var ya = parseInt(a.year) || 9999;
                    var yb = parseInt(b.year) || 9999;
                    if (ya !== yb) return ya - yb;
                    return extractSeason(a.name || '') - extractSeason(b.name || '');
                });
                var remaining = offsetEp;
                for (var ci = 0; ci < continuations.length; ci++) {
                    var contDetails = await acPost('getAnimeDetails', { animeID: continuations[ci].id }, FETCH_TIMEOUT_LONG);
                    if (!contDetails || !contDetails.result) continue;
                    var contEps = contDetails.result;
                    console.log('[AnimeCloud] Checking continuation: ' + continuations[ci].name + ' (' + contEps.length + ' eps), need ep ' + remaining);
                    targetEp = findEpisode(contEps, remaining);
                    if (targetEp) {
                        matchedAnime = continuations[ci];
                        episodes = contEps;
                        console.log('[AnimeCloud] Split-cour resolved: ' + matchedAnime.name + ' ep ' + remaining);
                        break;
                    }
                    remaining -= contEps.length;
                    if (remaining <= 0) break;
                }
                if (!targetEp) {
                    console.log('[AnimeCloud] Episode ' + lookupEp + ' not found (split-cour search exhausted)');
                    return [];
                }
            } else if (!targetEp) {
                console.log('[AnimeCloud] Episode ' + lookupEp + ' not found');
                return [];
            }
        } else {
            targetEp = episodes[0];
        }

        console.log('[AnimeCloud] Target: ' + targetEp.name + ' (ID: ' + targetEp.id + ')');

        // Step 5: Get video URLs (HD + SD in parallel)
        var videoURLs = await getVideoURLs(targetEp.id);
        if (videoURLs.length === 0) {
            console.log('[AnimeCloud] No video URLs available');
            return [];
        }

        // Step 6: Build Nuvio stream objects
        var playHeaders = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.5',
            'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
            'Accept-Encoding': 'identity',
        };

        var streams = [];
        for (var i = 0; i < videoURLs.length; i++) {
            var v = videoURLs[i];
            streams.push({
                name: 'ANIMECLOUD - ' + v.label,
                title: 'AnimeCloud ' + v.label,
                url: v.url,
                quality: v.quality,
                size: 'Unknown',
                headers: playHeaders,
                subtitles: [],
                provider: 'animecloud',
            });
        }

        console.log('[AnimeCloud] Returning ' + streams.length + ' stream(s)');
        return streams;
    } catch (error) {
        console.error('[AnimeCloud] Error: ' + error.message);
        return [];
    }
}

module.exports = { getStreams };
