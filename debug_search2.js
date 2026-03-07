// Debug: dump the actual search result links from the HTML
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };
const BASE_URL = 'https://web376x.faselhdx.best';

async function main() {  
    // Search "sherlock holmes" and look at ALL links
    const q = 'sherlock holmes';
    console.log(`=== All links from search: "${q}" ===`);
    const searchUrl = BASE_URL + '/?s=' + encodeURIComponent(q);
    const resp = await fetch(searchUrl, { headers: { ...headers, Referer: BASE_URL + '/main' }, signal: AbortSignal.timeout(15000) });
    const html = await resp.text();
    
    // Get all links
    const allLinks = [...new Set([...html.matchAll(/href="([^"]+)"/gi)].map(m => m[1]))];
    console.log('Total unique hrefs:', allLinks.length);
    
    // Filter to just faselhdx links
    const faselLinks = allLinks.filter(u => u.includes('faselhdx.best') && !u.includes('wp-content') && !u.includes('xmlrpc') && !u.includes('.png') && !u.includes('.jpg') && !u.includes('.css') && !u.includes('.js'));
    console.log('\nFaselHDX content links:');
    faselLinks.forEach(u => console.log('  ', decodeURIComponent(u)));
    
    // Look for any postDiv, card, or result container
    console.log('\n=== Search result containers ===');
    const resultDivs = html.match(/<div[^>]*class="[^"]*(?:postDiv|result|search|card|movie|film)[^"]*"[^>]*>/gi);
    if (resultDivs) {
        resultDivs.slice(0, 10).forEach(d => console.log('  ', d.substring(0, 100)));
    } else {
        console.log('No result containers found with common class names');
    }
    
    // Search for the actual movie content area
    console.log('\n=== Looking for content area ===');
    const contentArea = html.match(/<div[^>]*class="[^"]*(?:content|main|results|posts)[^"]*"[^>]*>/gi);
    if (contentArea) {
        contentArea.slice(0, 5).forEach(d => console.log('  ', d.substring(0, 100)));
    }
    
    // Let's look for <a> tags inside the main content that have sherlock-like text
    console.log('\n=== Links containing movie names ===');
    const movieLinks = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]*(?:sherlock|هولمز|game|shadow|شارلوك)[^<]*)<\/a>/gi)];
    movieLinks.forEach(m => console.log('  ', decodeURIComponent(m[1]).substring(0, 100), '|', m[2]));
    
    // What about just looking at links in the postDiv area? Let's find postDiv boundaries
    console.log('\n=== postDiv content ===');
    const postDivMatch = html.match(/<div[^>]*id="postDiv"[^>]*>([\s\S]*?)(?=<\/div>\s*<div|<footer)/);
    if (postDivMatch) {
        console.log('postDiv length:', postDivMatch[1].length);
        const innerLinks = [...postDivMatch[1].matchAll(/href="([^"]+)"/gi)].map(m => m[1]);
        console.log('Links in postDiv:');
        [...new Set(innerLinks)].forEach(u => console.log('  ', decodeURIComponent(u).substring(0, 120)));
    } else {
        console.log('No postDiv found');
        // Try other common IDs
        const mainContent = html.match(/id="(?:content|main|results|searchResults|page-body)"[^>]*>([\s\S]{1,500})/i);
        if (mainContent) console.log('Main content preview:', mainContent[1].substring(0, 200));
    }
    
    // Let's try the current cleanText + scoring to understand 
    console.log('\n=== What our extractor sees ===');
    const p = require('./providers/faselhdx.js');
    // Check what the extractor's search actually captures
    // The extractor filters for /\/(movies|series|episodes|anime-movies|anime-series)\//
    const filtered = allLinks.filter(u => /\/(movies|series|episodes|anime-movies|anime-series)\//i.test(u));
    console.log('Links matching extractor filter:', filtered.length);
    filtered.forEach(u => console.log('  ', decodeURIComponent(u).substring(0, 120)));
}

main().catch(e => console.error('Fatal:', e));
