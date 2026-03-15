import { extractStreams } from './extractor.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log('[Flex] Request: ' + mediaType + ' ' + tmdbId);
        return await extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
        console.error('[Flex] Error: ' + error.message);
        return [];
    }
}

module.exports = { getStreams };
