import { extractStreams } from './extractor.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log('[Kirmzi] Request: ' + mediaType + ' ' + tmdbId);
        return await extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
        console.error('[Kirmzi] Error: ' + error.message);
        return [];
    }
}

module.exports = { getStreams };
