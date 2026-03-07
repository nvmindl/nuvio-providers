// Debug: what does the FaselHDX search page actually look like?
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };
const BASE_URL = 'https://web376x.faselhdx.best';

async function main() {
    // Search with different queries
    const queries = [
        'sherlock holmes',
        'source code',         // this worked before
        'شارلوك هولمز',       // Arabic from TMDB title
        'لعبة الظلال',        // Arabic subtitle
    ];
    
    for (const q of queries) {
        console.log(`\n=== Search: "${q}" ===`);
        const searchUrl = BASE_URL + '/?s=' + encodeURIComponent(q);
        const resp = await fetch(searchUrl, { headers: { ...headers, Referer: BASE_URL + '/main' }, signal: AbortSignal.timeout(15000) });
        const html = await resp.text();
        console.log('HTML length:', html.length);
        
        // Find ALL links with their text context
        const allLinks = [...html.matchAll(/href="(https?:\/\/web\d+x\.faselhdx\.best\/[^"]+)"/gi)];
        const uniqueHrefs = [...new Set(allLinks.map(m => m[1]))];
        
        // Filter: actual content pages (have numbers or Arabic in slug after category)
        const contentLinks = uniqueHrefs.filter(u => 
            /\/(movies|series|episodes|anime-movies|anime-series)\/\d/.test(u)
        );
        
        const navLinks = uniqueHrefs.filter(u => 
            /\/(movies|series|episodes)(?:_|$)/.test(u) || !/\/\d/.test(u.split('/').pop())
        );
        
        console.log('Total unique links:', uniqueHrefs.length);
        console.log('Content links (with ID):', contentLinks.length);
        contentLinks.slice(0, 5).forEach(u => console.log('  ', decodeURIComponent(u).substring(0, 120)));
        
        if (contentLinks.length === 0) {
            console.log('Nav/category links found:', navLinks.slice(0, 3).map(u => u.replace(BASE_URL, '')));
            
            // Check if search returned "no results" message
            const noResults = html.includes('لا توجد نتائج') || html.includes('no results') || html.includes('لم يتم العثور');
            console.log('Has "no results" text:', noResults);
            
            // Look for any div that might contain results
            const postDivs = html.match(/class="[^"]*post[^"]*"/gi);
            console.log('Post divs:', postDivs ? postDivs.slice(0, 3) : 'none');
        }
    }
    
    // Also check: what does a KNOWN working movie's URL look like?
    console.log('\n=== Known working URL pattern ===');
    // Source Code worked, let's see its pattern
    const scSearch = BASE_URL + '/?s=' + encodeURIComponent('source code');
    const scHtml = await (await fetch(scSearch, { headers: { ...headers, Referer: BASE_URL + '/main' }, signal: AbortSignal.timeout(15000) })).text();
    const scLinks = [...scHtml.matchAll(/href="(https?:\/\/web\d+x\.faselhdx\.best\/(?:movies|series|episodes|anime)[^"]+)"/gi)]
        .map(m => m[1])
        .filter(u => /\/\d/.test(u.split('/').pop()));
    const scUnique = [...new Set(scLinks)];
    console.log('Source Code search results:', scUnique.length);
    scUnique.slice(0, 5).forEach(u => console.log('  ', decodeURIComponent(u).substring(0, 120)));
}

main().catch(e => console.error('Fatal:', e));
