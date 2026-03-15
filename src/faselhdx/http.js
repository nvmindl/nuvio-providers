// Flex v7.1.0 — Direct scraping via moviesapi.to + flixcdn.cyou
// Inline AES-128-CBC (no external crypto dependency)

// ── AES-128-CBC pure JS implementation ──

var SBOX = [
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
];

var INV_SBOX = [];
for (var _si = 0; _si < 256; _si++) INV_SBOX[SBOX[_si]] = _si;

var RCON = [0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];

function xtime(a) { return ((a << 1) ^ (((a >> 7) & 1) * 0x1b)) & 0xff; }

function aesExpandKey(key) {
    var w = [];
    for (var i = 0; i < 16; i++) w[i] = key[i];
    for (var i = 16; i < 176; i += 4) {
        var t = [w[i-4], w[i-3], w[i-2], w[i-1]];
        if ((i % 16) === 0) {
            t = [SBOX[t[1]] ^ RCON[(i/16)-1], SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]];
        }
        for (var j = 0; j < 4; j++) w[i+j] = w[i-16+j] ^ t[j];
    }
    return w;
}

function aesDecryptBlock(block, w) {
    var s = [];
    for (var i = 0; i < 16; i++) s[i] = block[i] ^ w[160+i];

    for (var round = 9; round >= 1; round--) {
        // InvShiftRows
        var t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
        t = s[10]; s[10] = s[2]; s[2] = t; t = s[14]; s[14] = s[6]; s[6] = t;
        t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;

        // InvSubBytes
        for (var i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];

        // AddRoundKey
        var rk = round * 16;
        for (var i = 0; i < 16; i++) s[i] = s[i] ^ w[rk+i];

        // InvMixColumns: 14=x^xx^xxx, 11=a^x^xxx, 13=a^xx^xxx, 9=a^xxx
        for (var c = 0; c < 4; c++) {
            var i0 = c*4, i1 = i0+1, i2 = i0+2, i3 = i0+3;
            var a0 = s[i0], a1 = s[i1], a2 = s[i2], a3 = s[i3];
            var x0 = xtime(a0), x1 = xtime(a1), x2 = xtime(a2), x3 = xtime(a3);
            var xx0 = xtime(x0), xx1 = xtime(x1), xx2 = xtime(x2), xx3 = xtime(x3);
            var xxx0 = xtime(xx0), xxx1 = xtime(xx1), xxx2 = xtime(xx2), xxx3 = xtime(xx3);
            s[i0] = (x0^xx0^xxx0) ^ (a1^x1^xxx1) ^ (a2^xx2^xxx2) ^ (a3^xxx3);
            s[i1] = (a0^xxx0) ^ (x1^xx1^xxx1) ^ (a2^x2^xxx2) ^ (a3^xx3^xxx3);
            s[i2] = (a0^xx0^xxx0) ^ (a1^xxx1) ^ (x2^xx2^xxx2) ^ (a3^x3^xxx3);
            s[i3] = (a0^x0^xxx0) ^ (a1^xx1^xxx1) ^ (a2^xxx2) ^ (x3^xx3^xxx3);
        }
    }

    // Last round (no InvMixColumns)
    var t2 = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t2;
    t2 = s[10]; s[10] = s[2]; s[2] = t2; t2 = s[14]; s[14] = s[6]; s[6] = t2;
    t2 = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t2;
    for (var i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
    for (var i = 0; i < 16; i++) s[i] = s[i] ^ w[i];

    return s;
}

function aesCbcDecrypt(hexData, keyStr, ivStr) {
    // Parse hex → bytes
    var data = [];
    for (var i = 0; i < hexData.length; i += 2) {
        data.push(parseInt(hexData.substring(i, i + 2), 16));
    }

    var key = [];
    for (var i = 0; i < keyStr.length; i++) key.push(keyStr.charCodeAt(i));
    var iv = [];
    for (var i = 0; i < ivStr.length; i++) iv.push(ivStr.charCodeAt(i));

    var w = aesExpandKey(key);
    var result = [];
    var prev = iv;

    for (var offset = 0; offset < data.length; offset += 16) {
        var block = data.slice(offset, offset + 16);
        var decrypted = aesDecryptBlock(block, w);
        for (var i = 0; i < 16; i++) result.push(decrypted[i] ^ prev[i]);
        prev = block;
    }

    // PKCS7 unpad
    var padLen = result[result.length - 1];
    if (padLen > 0 && padLen <= 16) result = result.slice(0, result.length - padLen);

    // Bytes → string
    var out = '';
    for (var i = 0; i < result.length; i++) out += String.fromCharCode(result[i]);
    return out;
}

// ── HTTP helpers ──

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
    return aesCbcDecrypt(hexData, AES_KEY, AES_IV);
}

// Fetch movie/tv metadata from moviesapi.to
export function fetchMoviesApi(path) {
    var url = MOVIESAPI_BASE + '/' + path;
    console.log('[Flex] MoviesAPI: ' + url);
    return safeFetch(url)
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function(e) {
            console.log('[Flex] MoviesAPI error: ' + e.message);
            return null;
        });
}

// Fetch encrypted video data from flixcdn and decrypt it
export function fetchFlixVideo(videoCode) {
    var url = FLIXCDN_BASE + '/video?id=' + videoCode + '&w=1920&h=1080&r=ww2.moviesapi.to';
    console.log('[Flex] FlixCDN: ' + videoCode);
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
            console.log('[Flex] FlixCDN error: ' + e.message);
            return null;
        });
}
