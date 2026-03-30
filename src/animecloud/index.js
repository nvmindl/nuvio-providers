// AnimeCloud Nuvio Provider v1.0.0
// Direct API integration — no backend required.
// Uses AnimeCloud's mobile app API with RNCryptor decryption for video URLs.
// Matching: TMDB → AniList (romaji) → AnimeCloud fuzzy match (same as AnimeKai flow)

var CryptoJS = require('crypto-js');

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB_BASE = 'https://api.themoviedb.org/3';
var ANILIST_URL = 'https://graphql.anilist.co';
var AC_API = 'https://khkhkhkh.com/animecp/animeapi65/';
var RNC_PASSWORD = 'anime5w\x26f4H\x26434*';

var UA = 'AnimeCloud/6.5 CFNetwork/1399 Darwin/22.1.0';

// ── AnimeCloud API helper ──────────────────────────────────────────────

async function acPost(command, params) {
    var body = 'command=' + encodeURIComponent(command);
    if (params) {
        var keys = Object.keys(params);
        for (var i = 0; i < keys.length; i++) {
            body += '&' + encodeURIComponent(keys[i]) + '=' + encodeURIComponent(params[keys[i]]);
        }
    }

    try {
        var response = await fetch(AC_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': UA,
            },
            body: body,
        });

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
    // RNCryptor v3 format:
    // version(1) | options(1) | encSalt(8) | hmacSalt(8) | IV(16) | ciphertext(N) | HMAC(32)
    var raw = CryptoJS.enc.Base64.parse(base64Data);
    var rawBytes = wordArrayToBytes(raw);

    if (rawBytes.length < 66) return null;

    var encSalt = bytesToWordArray(rawBytes.slice(2, 10));
    var iv = bytesToWordArray(rawBytes.slice(18, 34));
    var ciphertext = bytesToWordArray(rawBytes.slice(34, rawBytes.length - 32));

    // Derive encryption key: PBKDF2 with SHA1, 10000 iterations, 256-bit key
    var encKey = CryptoJS.PBKDF2(RNC_PASSWORD, encSalt, {
        keySize: 256 / 32,
        iterations: 10000,
        hasher: CryptoJS.algo.SHA1,
    });

    // Decrypt AES-256-CBC
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
    var bytes = [];
    for (var i = 0; i < sigBytes; i++) {
        bytes.push((words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff);
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
        var response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.log('[AnimeCloud] TMDB error: ' + e.message);
        return null;
    }
}

// Get TMDB details — title, original title, year
async function getTmdbDetails(tmdbId, mediaType) {
    var type = mediaType === 'movie' ? 'movie' : 'tv';
    var data = await tmdbGet('/' + type + '/' + tmdbId + '?language=en-US&append_to_response=alternative_titles');
    if (!data) return null;

    var titles = [];
    if (data.name) titles.push(data.name);
    if (data.title) titles.push(data.title);
    if (data.original_name) titles.push(data.original_name);
    if (data.original_title) titles.push(data.original_title);

    // Alternative titles (includes romaji from JP entries)
    var alts = (data.alternative_titles || {}).results || [];
    for (var i = 0; i < alts.length; i++) {
        if (alts[i].title) titles.push(alts[i].title);
    }

    // Deduplicate
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

    return {
        title: data.name || data.title || '',
        originalTitle: data.original_name || data.original_title || '',
        titles: unique,
        year: year,
    };
}

// ── AniList matching (primary — same as AnimeKai) ─────────────────────

async function searchAniList(title, year) {
    var query = year
        ? 'query ($search: String, $year: Int) { Media(search: $search, type: ANIME, seasonYear: $year) { id idMal title { english romaji native } startDate { year } } }'
        : 'query ($search: String) { Media(search: $search, type: ANIME) { id idMal title { english romaji native } startDate { year } } }';

    var variables = year ? { search: title, year: year } : { search: title };

    try {
        var response = await fetch(ANILIST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: query, variables: variables }),
        });

        if (!response.ok) return null;

        var data = await response.json();
        if (data.data && data.data.Media) {
            var media = data.data.Media;
            return {
                anilistId: media.id,
                malId: media.idMal,
                romaji: media.title ? media.title.romaji : null,
                english: media.title ? media.title.english : null,
                native: media.title ? media.title.native : null,
                year: media.startDate ? media.startDate.year : null,
            };
        }
        return null;
    } catch (e) {
        console.log('[AnimeCloud] AniList error: ' + e.message);
        return null;
    }
}

// Get romaji title via AniList, trying multiple search strategies
async function getAniListTitles(tmdbTitle, originalTitle, year) {
    var titles = [];

    // Try original title first (usually Japanese), then English
    var searchOrder = [originalTitle, tmdbTitle];
    // Dedupe
    var seen = {};
    var searches = [];
    for (var i = 0; i < searchOrder.length; i++) {
        if (searchOrder[i] && !seen[searchOrder[i].toLowerCase()]) {
            seen[searchOrder[i].toLowerCase()] = true;
            searches.push(searchOrder[i]);
        }
    }

    for (var i = 0; i < searches.length; i++) {
        // Try with year first for accuracy, then without
        var result = year ? await searchAniList(searches[i], year) : null;
        if (!result) result = await searchAniList(searches[i], null);

        if (result) {
            if (result.romaji) titles.push(result.romaji);
            if (result.english) titles.push(result.english);
            if (result.native) titles.push(result.native);
            break; // Found a match, no need to search more
        }
    }

    return titles;
}

// ── Anime list cache ───────────────────────────────────────────────────

var animeListCache = null;
var animeListCacheTime = 0;
var CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getAnimeList() {
    var now = Date.now();
    if (animeListCache && (now - animeListCacheTime) < CACHE_TTL) {
        return animeListCache;
    }

    var data = await acPost('getAllAnime');
    if (!data || !data.result) return [];

    animeListCache = data.result;
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

// Remove season suffixes from AnimeCloud title
function stripSeasonSuffix(name) {
    return name
        .replace(/\s*(1st|2nd|3rd|\d+th)\s+season\s*$/i, '')
        .replace(/\s*season\s*\d+\s*$/i, '')
        .replace(/\s*s\d+\s*$/i, '')
        .replace(/\s*\(\d{4}\)\s*$/i, '')
        .trim();
}

// Extract season number from AnimeCloud title
function extractSeason(name) {
    var m;
    m = name.match(/(\d+)(?:st|nd|rd|th)\s+season/i);
    if (m) return parseInt(m[1], 10);
    m = name.match(/season\s*(\d+)/i);
    if (m) return parseInt(m[1], 10);
    m = name.match(/\s+s(\d+)\s*$/i);
    if (m) return parseInt(m[1], 10);
    m = name.match(/part\s*(?:2|ii)\s*$/i);
    if (m) return 2;
    m = name.match(/part\s*(?:3|iii)\s*$/i);
    if (m) return 3;
    return 1;
}

// Score how well two titles match (higher = better)
function titleScore(tmdbTitle, acTitle) {
    var a = normalize(tmdbTitle);
    var b = normalize(acTitle);
    if (a === b) return 100;

    // Check if one contains the other
    if (b.length > 2 && a.indexOf(b) > -1) return 85;
    if (a.length > 2 && b.indexOf(a) > -1) return 80;

    // Word overlap scoring
    var wordsA = a.split(' ');
    var wordsB = b.split(' ');
    var matched = 0;
    for (var i = 0; i < wordsA.length; i++) {
        for (var j = 0; j < wordsB.length; j++) {
            if (wordsA[i] === wordsB[j] && wordsA[i].length > 1) matched++;
        }
    }
    var maxLen = Math.max(wordsA.length, wordsB.length);
    if (maxLen === 0) return 0;
    return Math.round((matched / maxLen) * 70);
}

// Find best matching anime in AnimeCloud for given titles and target season
function findBestMatch(animeList, searchTitles, targetSeason) {
    var bestScore = 0;
    var bestMatch = null;

    for (var i = 0; i < animeList.length; i++) {
        var anime = animeList[i];
        var acName = anime.name || '';
        var acBaseName = stripSeasonSuffix(acName);
        var acSeason = extractSeason(acName);

        for (var j = 0; j < searchTitles.length; j++) {
            var score = titleScore(searchTitles[j], acBaseName);
            // Also try matching against full name (for titles that include season)
            var fullScore = titleScore(searchTitles[j], acName);
            score = Math.max(score, fullScore);

            // Season matching: bonus for correct season, heavy penalty for wrong
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

    console.log('[AnimeCloud] Best match: ' + (bestMatch ? bestMatch.name : 'none') + ' (score: ' + bestScore + ')');

    // Require minimum score of 40 to avoid false matches
    if (bestScore < 40) return null;
    return bestMatch;
}

// ── Episode mapping ────────────────────────────────────────────────────

function parseEpisodeNumber(name) {
    // Arabic: "الحلقة 10" = "Episode 10", also "الحلقة 10 الأخيرة" = "Episode 10 Final"
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

    // Fetch HD (quality=1) and SD (quality=2) in parallel
    var results = await Promise.all([fetchVideoURL(epID, 1), fetchVideoURL(epID, 2)]);
    if (results[0]) urls.push({ url: results[0].url, quality: 'auto', note: results[0].note, label: 'High' });
    if (results[1]) urls.push({ url: results[1].url, quality: 'auto', note: results[1].note, label: 'Low' });

    return urls;
}

async function fetchVideoURL(epID, quality) {
    try {
        var response = await fetch(AC_API, {
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
        console.log('[AnimeCloud] fetchVideoURL error (q=' + quality + '): ' + e.message);
        return null;
    }
}

// ── Main getStreams ────────────────────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        var isTV = mediaType !== 'movie';
        console.log('[AnimeCloud] Request: ' + mediaType + ' ' + tmdbId + (isTV ? ' S' + season + 'E' + episode : ''));

        // Step 1: Get TMDB details
        var tmdb = await getTmdbDetails(tmdbId, mediaType);
        if (!tmdb || !tmdb.titles || tmdb.titles.length === 0) {
            console.log('[AnimeCloud] No TMDB data found');
            return [];
        }
        console.log('[AnimeCloud] TMDB: ' + tmdb.title + ' (' + tmdb.year + ')');

        // Step 2: Get AniList romaji title (primary matching source, same as AnimeKai)
        var searchTitles = tmdb.titles.slice(); // start with TMDB titles as fallback
        var anilistTitles = await getAniListTitles(tmdb.title, tmdb.originalTitle, tmdb.year);
        if (anilistTitles.length > 0) {
            console.log('[AnimeCloud] AniList titles: ' + anilistTitles.join(', '));
            // Prepend AniList titles (romaji first) — they'll score highest against AnimeCloud
            for (var i = anilistTitles.length - 1; i >= 0; i--) {
                searchTitles.unshift(anilistTitles[i]);
            }
        } else {
            console.log('[AnimeCloud] AniList unavailable, using TMDB titles only');
        }

        // Deduplicate search titles
        var seen = {};
        var uniqueTitles = [];
        for (var i = 0; i < searchTitles.length; i++) {
            var lower = searchTitles[i].toLowerCase().trim();
            if (!seen[lower]) {
                seen[lower] = true;
                uniqueTitles.push(searchTitles[i]);
            }
        }
        console.log('[AnimeCloud] Search titles: ' + uniqueTitles.slice(0, 6).join(' | '));

        // Step 3: Get AnimeCloud anime list
        var animeList = await getAnimeList();
        if (!animeList || animeList.length === 0) {
            console.log('[AnimeCloud] Failed to load anime list');
            return [];
        }
        console.log('[AnimeCloud] Anime catalog: ' + animeList.length + ' entries');

        // Step 4: Find matching anime (season-aware)
        var targetSeason = isTV ? (season || 1) : 1;
        var matchedAnime = findBestMatch(animeList, uniqueTitles, targetSeason);
        if (!matchedAnime) {
            console.log('[AnimeCloud] No match found');
            return [];
        }
        console.log('[AnimeCloud] Matched: ' + matchedAnime.name + ' (ID: ' + matchedAnime.id + ')');

        // Step 5: Get episode list
        var details = await acPost('getAnimeDetails', { animeID: matchedAnime.id });
        if (!details || !details.result) {
            console.log('[AnimeCloud] Failed to get episode list');
            return [];
        }

        var episodes = details.result;
        console.log('[AnimeCloud] Episodes: ' + episodes.length);

        // Step 6: Find target episode
        var targetEp;
        if (isTV) {
            targetEp = findEpisode(episodes, episode);
            if (!targetEp) {
                console.log('[AnimeCloud] Episode ' + episode + ' not found');
                return [];
            }
        } else {
            targetEp = episodes[0];
        }

        console.log('[AnimeCloud] Target: ' + targetEp.name + ' (ID: ' + targetEp.id + ')');

        // Step 7: Get video URLs (HD + SD in parallel)
        var videoURLs = await getVideoURLs(targetEp.id);
        if (videoURLs.length === 0) {
            console.log('[AnimeCloud] No video URLs available');
            return [];
        }

        // Step 8: Build Nuvio stream objects
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
