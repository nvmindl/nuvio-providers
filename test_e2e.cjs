// End-to-end test: extract streams from a known FaselHDX page
// Using a direct page URL to skip TMDB resolution

const { getStreams } = require('./providers/faselhdx.js');

(async () => {
    try {
        // Jujutsu Kaisen 0 movie page URL
        const pageUrl = 'https://web376x.faselhdx.best/anime-movies/%D9%81%D9%8A%D9%84%D9%85-jujutsu-kaisen-0';
        console.log('Testing with page URL:', pageUrl);
        
        const streams = await getStreams(pageUrl, 'movie');
        console.log('\n=== RESULTS ===');
        console.log('Streams found:', streams.length);
        for (const s of streams) {
            console.log(`  [${s.quality}] ${s.title}: ${s.url.substring(0, 80)}...`);
        }
        
        if (streams.length === 0) {
            console.log('\n❌ No streams found!');
            process.exit(1);
        } else {
            console.log('\n✅ Success!');
        }
    } catch (e) {
        console.error('Error:', e.message);
        console.error(e.stack);
        process.exit(1);
    }
})();
