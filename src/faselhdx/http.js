// StreamFlix v7.0.0 — Direct scraping via moviesapi.to + flixcdn.cyou
var CryptoJS = require('crypto-js');

var MOVIESAPI_BASE = 'https://ww2.moviesapi.to/api';
var FLIXCDN_BASE = 'https://flixcdn.cyou/api/v1';
var AES_KEY = 'kiemtienmua911ca';
var AES_IV = '1234567890oiuytr';

export var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/html, */*',
    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
};

function safeFetch(url, opts) {
    opts = opts || {};
    var ms = opts.timeout || 25000;
    var controller;
    var tid;
    try {
        controller = new AbortController();
        tid = setTimeout(function() { controller.abort(); }, ms);
    } catch(e) { controller = null; }
    var fetchOpts = { method: 'GET', headers: opts.headers || HEADERS };
    if (controller) fetchOpts.signal = controller.signal;
    return fetch(url, fetchOpts)
        .then(function(r) { if (tid) clearTimeout(tid); return r; })
        .catch(function(e) { if (tid) clearTimeout(tid); throw e; });
}

// Decrypt AES-128-CBC hex-encoded response from flixcdn
export function decryptResponse(hexData) {
    var key = CryptoJS.enc.Utf8.parse(AES_KEY);
    var iv = CryptoJS.enc.Utf8.parse(AES_IV);
    var ciphertext = CryptoJS.enc.Hex.parse(hexData);
    var cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ciphertext });
    var decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

// Fetch movie/tv metadata from moviesapi.to
export function fetchMoviesApi(path) {
    var url = MOVIESAPI_BASE + '/' + path;
    console.log('[StreamFlix] MoviesAPI: ' + url);
    return safeFetch(url)
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function(e) {
            console.log('[StreamFlix] MoviesAPI error: ' + e.message);
            return null;
        });
}

// Fetch encrypted video data from flixcdn and decrypt it
export function fetchFlixVideo(videoCode) {
    var url = FLIXCDN_BASE + '/video?id=' + videoCode + '&w=1920&h=1080&r=ww2.moviesapi.to';
    console.log('[StreamFlix] FlixCDN: ' + videoCode);
    return safeFetch(url, {
        headers: {
            'User-Agent': HEADERS['User-Agent'],
            'Referer': 'https://flixcdn.cyou/',
            'Origin': 'https://flixcdn.cyou',
        },
    })
        .then(function(r) { return r.ok ? r.text() : null; })
        .then(function(hex) {
            if (!hex) return null;
            var json = decryptResponse(hex.trim());
            if (!json) return null;
            try { return JSON.parse(json); } catch(e) { return null; }
        })
        .catch(function(e) {
            console.log('[StreamFlix] FlixCDN error: ' + e.message);
            return null;
        });
}

// Fetch m3u8 master playlist text
export function fetchM3U8(url) {
    return safeFetch(url, {
        headers: {
            'User-Agent': HEADERS['User-Agent'],
            'Referer': 'https://flixcdn.cyou/',
            'Origin': 'https://flixcdn.cyou',
        },
    })
        .then(function(r) { return r.ok ? r.text() : ''; })
        .catch(function(e) {
            console.log('[StreamFlix] M3U8 error: ' + e.message);
            return '';
        });
}
