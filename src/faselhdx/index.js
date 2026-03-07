import { extractStreams } from './extractor.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[FaselHDX] Request: ${mediaType} ${tmdbId}`);
        return await extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
        console.error(`[FaselHDX] Error: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
