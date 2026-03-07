import { extractStreams } from './extractor.js';

/**
 * Main function called by Nuvio
 * @param {string} tmdbId - TMDB ID of the media
 * @param {string} mediaType - 'movie' or 'tv'
 * @param {number} season - Season number (for TV)
 * @param {number} episode - Episode number (for TV)
 */
async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[FaselProbe] Request: ${mediaType} ${tmdbId}`);

        // Diagnostics-only provider: returns no streams, only logs behavior.
        const streams = await extractStreams(tmdbId, mediaType, season, episode);

        return streams;
    } catch (error) {
        console.error(`[FaselProbe] Error: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
