// Step-by-step debug for Sherlock Holmes: A Game of Shadows (TMDB 58574)
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };
const BASE_URL = 'https://web376x.faselhdx.best';

async function main() {
    // Step 1: TMDB resolution
    console.log('=== Step 1: TMDB lookup ===');
    const tmdbUrl = 'https://www.themoviedb.org/movie/58574';
    console.log('Fetching:', tmdbUrl);
    try {
        const resp = await fetch(tmdbUrl, { headers: { ...headers, Referer: 'https://www.themoviedb.org/' }, signal: AbortSignal.timeout(10000) });
        console.log('Status:', resp.status);
        const html = await resp.text();
        console.log('HTML length:', html.length);
        
        const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        console.log('Title tag:', titleTag ? titleTag[1] : 'NOT FOUND');
        
        const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
        console.log('Canonical:', canonical ? canonical[1] : 'NOT FOUND');
    } catch(e) {
        console.log('TMDB ERROR:', e.message);
    }

    // Step 2: Search FaselHDX  
    console.log('\n=== Step 2: Search FaselHDX ===');
    const searchTerms = ['sherlock holmes a game of shadows 2011', 'sherlock holmes', 'شيرلوك هولمز'];
    for (const q of searchTerms) {
        console.log('\nSearching:', q);
        try {
            const searchUrl = BASE_URL + '/?s=' + encodeURIComponent(q);
            const resp = await fetch(searchUrl, { headers: { ...headers, Referer: BASE_URL + '/main' }, signal: AbortSignal.timeout(10000) });
            console.log('Status:', resp.status);
            const html = await resp.text();
            
            // Find movie links
            const links = html.match(/href="(https?:\/\/web\d+x\.faselhdx\.best\/(?:movies|series|episodes)[^"]+)"/gi);
            if (links) {
                const unique = [...new Set(links.map(l => l.match(/href="([^"]+)"/i)[1]))];
                console.log('Found', unique.length, 'links:');
                unique.slice(0, 5).forEach(u => console.log('  ', decodeURIComponent(u)));
            } else {
                console.log('No movie links found');
                // Check if there's content at all
                const hasResults = html.includes('postDiv') || html.includes('result');
                console.log('Has search results div:', hasResults);
            }
        } catch(e) {
            console.log('Search ERROR:', e.message);
        }
    }

    // Step 3: Try direct URL patterns
    console.log('\n=== Step 3: Try direct URLs ===');
    const directUrls = [
        BASE_URL + '/movies/sherlock-holmes-a-game-of-shadows-2011',
        BASE_URL + '/movies/%d8%b4%d9%8a%d8%b1%d9%84%d9%88%d9%83-%d9%87%d9%88%d9%84%d9%85%d8%b2',
    ];
    for (const url of directUrls) {
        try {
            const resp = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(10000) });
            console.log(url.substring(0, 80), '->', resp.status);
        } catch(e) {
            console.log(url.substring(0, 80), '-> ERROR:', e.message);
        }
    }
}

main().catch(e => console.error('Fatal:', e));
