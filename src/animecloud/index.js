// AnimeCloud Nuvio Provider v2.1.0
// Direct API integration — no backend required.
// Uses AnimeCloud's mobile app API with RNCryptor decryption for video URLs.
// Matching v2.1: TMDB titles + season names + AniList romaji → AnimeCloud fuzzy match
//   - Franchise grouping, season name matching, length-guarded scoring
//   - Franchise index fallback for titles with no season indicator (JJK S3 fix)

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

// Get TMDB details — title, original title, year, season name
async function getTmdbDetails(tmdbId, mediaType, season) {
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

    // Get season name for multi-season shows (e.g., "Diamond Is Unbreakable" for JoJo S3)
    var seasonName = null;
    if (data.seasons && season) {
        for (var i = 0; i < data.seasons.length; i++) {
            if (data.seasons[i].season_number === season) {
                seasonName = data.seasons[i].name;
                break;
            }
        }
    }

    return {
        title: data.name || data.title || '',
        originalTitle: data.original_name || data.original_title || '',
        titles: unique,
        year: year,
        seasonName: seasonName,
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

// ── Title matching (v2) ────────────────────────────────────────────────

function normalize(str) {
    return str.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Extract base franchise name from AnimeCloud title
// "JoJo no Kimyou na Bouken Part 4: Diamond wa Kudakenai" → "JoJo no Kimyou na Bouken"
// "Jujutsu Kaisen 2nd Season" → "Jujutsu Kaisen"
// "Enen no Shouboutai: Ni no Shou" → "Enen no Shouboutai"
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

// Extract season/part number from AnimeCloud title
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

// Score how well two titles match (higher = better)
function titleScore(searchTitle, acTitle) {
    var a = normalize(searchTitle);
    var b = normalize(acTitle);

    if (a === b) return 100;

    // Containment check WITH length ratio guard (prevents "blood" matching "...phantom blood")
    var lenRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    if (lenRatio > 0.5) {
        if (b.length > 2 && a.indexOf(b) > -1) return 85;
        if (a.length > 2 && b.indexOf(a) > -1) return 82;
    }

    // Word overlap — Jaccard-like scoring (penalizes extra words on either side)
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

// Check if an AnimeCloud title looks like a movie
function isMovie(name) {
    return /\bMovie\b/i.test(name) || /\bFilm\b/i.test(name) || /\b0\s+Movie\b/i.test(name);
}

// Find best matching anime using base title + season number
function findBestMatch(animeList, searchTitles, targetSeason) {
    var candidates = [];

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

        if (bestTitleScore >= 40) {
            candidates.push({
                anime: anime,
                tScore: bestTitleScore,
                season: acSeason,
                name: acName,
            });
        }
    }

    if (candidates.length === 0) return null;

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

    // Franchise index fallback: if no candidate had the exact target season,
    // sort non-movie franchise entries by year and use targetSeason as index.
    // Handles cases like JJK S3 where "Shimetsu Kaiyuu" has no season indicator in name.
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
                return tvCandidates[idx].anime;
            }
        }
    }

    console.log('[AnimeCloud] Best match: ' + (bestMatch ? bestMatch.name : 'none') + ' (score: ' + bestScore + ')');
    if (bestScore < 40) return null;
    return bestMatch ? bestMatch.anime : null;
}

// Season-name based matching for multi-part anime (e.g., JoJo, Demon Slayer arcs)
// Uses TMDB season name to find the correct entry within a franchise
function findBySeasonName(animeList, searchTitles, targetSeason, seasonName) {
    if (!seasonName) return null;
    // Skip generic "Season N" names — they don't help distinguish entries
    if (/^Season\s+\d+$/i.test(seasonName.trim())) return null;

    // Find all franchise entries (AC entries whose base name matches any search title)
    var franchise = [];
    for (var i = 0; i < animeList.length; i++) {
        var anime = animeList[i];
        var acBase = extractBaseName(anime.name || '');
        for (var j = 0; j < searchTitles.length; j++) {
            if (titleScore(searchTitles[j], acBase) >= 50) {
                franchise.push(anime);
                break;
            }
        }
    }
    if (franchise.length === 0) return null;

    // Strategy 1: Match season name words directly against AC entry full names
    var normSeason = normalize(seasonName);
    var bestScore = 0;
    var bestMatch = null;

    for (var i = 0; i < franchise.length; i++) {
        var fullNorm = normalize(franchise[i].name);
        var seasonWords = normSeason.split(' ').filter(function(w) { return w.length > 2; });
        var matched = 0;
        for (var w = 0; w < seasonWords.length; w++) {
            if (fullNorm.indexOf(seasonWords[w]) > -1) matched++;
        }
        var score = seasonWords.length > 0 ? matched / seasonWords.length : 0;
        if (score > bestScore) {
            bestScore = score;
            bestMatch = franchise[i];
        }
    }
    if (bestScore >= 0.5 && bestMatch) {
        console.log('[AnimeCloud] Season name match: ' + bestMatch.name);
        return bestMatch;
    }

    // Strategy 2: Find TMDB alt titles containing the season name, match against AC
    var seasonSpecificTitles = [];
    for (var i = 0; i < searchTitles.length; i++) {
        var normTitle = normalize(searchTitles[i]);
        if (normTitle.indexOf(normSeason) > -1 && normTitle !== normSeason) {
            seasonSpecificTitles.push(searchTitles[i]);
        }
    }
    if (seasonSpecificTitles.length > 0) {
        var best2 = 0;
        var bestMatch2 = null;
        for (var i = 0; i < franchise.length; i++) {
            for (var j = 0; j < seasonSpecificTitles.length; j++) {
                var s = titleScore(seasonSpecificTitles[j], franchise[i].name);
                if (s > best2) { best2 = s; bestMatch2 = franchise[i]; }
            }
        }
        if (best2 >= 40 && bestMatch2) {
            console.log('[AnimeCloud] Season-specific title match: ' + bestMatch2.name);
            return bestMatch2;
        }
    }

    // Strategy 3: Use season number as franchise index (sorted by year)
    // Handles JoJo S4="Golden Wind" → 4th franchise entry = Part 5: Ougon no Kaze
    if (franchise.length > 1) {
        var sorted = franchise.slice().sort(function(a, b) {
            var ya = parseInt(a.year) || 9999;
            var yb = parseInt(b.year) || 9999;
            if (ya !== yb) return ya - yb;
            return extractSeason(a.name) - extractSeason(b.name);
        });
        var idx = targetSeason - 1;
        if (idx >= 0 && idx < sorted.length) {
            console.log('[AnimeCloud] Franchise index match: S' + targetSeason + ' -> ' + sorted[idx].name);
            return sorted[idx];
        }
    }

    return null;
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
        var tmdb = await getTmdbDetails(tmdbId, mediaType, isTV ? season : null);
        if (!tmdb || !tmdb.titles || tmdb.titles.length === 0) {
            console.log('[AnimeCloud] No TMDB data found');
            return [];
        }
        console.log('[AnimeCloud] TMDB: ' + tmdb.title + ' (' + tmdb.year + ')' + (tmdb.seasonName ? ' [' + tmdb.seasonName + ']' : ''));

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

        // Step 4: Find matching anime (season-aware, two-phase)
        var targetSeason = isTV ? (season || 1) : 1;

        // Phase A: Try season-name matching first (handles multi-part anime like JoJo)
        var matchedAnime = null;
        if (isTV && tmdb.seasonName) {
            matchedAnime = findBySeasonName(animeList, uniqueTitles, targetSeason, tmdb.seasonName);
        }

        // Phase B: Fall back to standard title + season number matching
        if (!matchedAnime) {
            matchedAnime = findBestMatch(animeList, uniqueTitles, targetSeason);
        }

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
