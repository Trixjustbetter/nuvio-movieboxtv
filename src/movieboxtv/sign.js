const BASE = 'https://tv.aoneroom.com';
const HOST_Q = 'api6.aoneroom.com';
const SECRET_B64 = '76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O';

function b64decode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = {};
    for (let i = 0; i < chars.length; i++) lookup[chars.charAt(i)] = i;
    str = String(str).replace(/=+$/, '');
    let bits = 0;
    let bitCount = 0;
    const out = [];
    for (let i = 0; i < str.length; i++) {
        const c = str.charAt(i);
        const val = lookup[c];
        if (val === undefined) continue;
        bits = (bits << 6) | val;
        bitCount += 6;
        if (bitCount >= 8) {
            bitCount -= 8;
            out.push((bits >> bitCount) & 0xff);
        }
    }
    return out;
}

function b64encode(bytes) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i];
        const b1 = bytes[i + 1];
        const b2 = bytes[i + 2];
        out += chars.charAt(b0 >> 2);
        out += chars.charAt(((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4));
        out += b1 === undefined ? '=' : chars.charAt(((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6));
        out += b2 === undefined ? '=' : chars.charAt(b2 & 63);
    }
    return out;
}

function utf8Bytes(str) {
    const s = String(str);
    const out = [];
    for (let i = 0; i < s.length; i++) {
        let c = s.charCodeAt(i);
        if (c < 0x80) {
            out.push(c);
        } else if (c < 0x800) {
            out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
        } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
            const c2 = s.charCodeAt(++i);
            const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
            out.push(
                0xf0 | (cp >> 18),
                0x80 | ((cp >> 12) & 0x3f),
                0x80 | ((cp >> 6) & 0x3f),
                0x80 | (cp & 0x3f)
            );
        } else {
            out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        }
    }
    return out;
}

function utf8ToString(bytes) {
    let out = '';
    let i = 0;
    while (i < bytes.length) {
        const b = bytes[i++];
        let cp;
        if (b < 0x80) {
            out += String.fromCharCode(b);
            continue;
        } else if (b < 0xe0) {
            cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
        } else if (b < 0xf0) {
            cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        } else {
            cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        }
        if (cp > 0xffff) {
            cp -= 0x10000;
            out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        } else {
            out += String.fromCharCode(cp);
        }
    }
    return out;
}

function md5(input) {
    let bytes = input;
    if (typeof input === 'string') bytes = utf8Bytes(input);

    function safeAdd(x, y) {
        const lsw = (x & 0xffff) + (y & 0xffff);
        const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xffff);
    }
    function rol(n, c) { return (n << c) | (n >>> (32 - c)); }
    function cmn(q, a, b, x, s, t) { return safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

    const msg = bytes.slice();
    const originalLen = msg.length;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    const bitLen = originalLen * 8;
    msg.push(bitLen & 0xff);
    msg.push((bitLen >>> 8) & 0xff);
    msg.push((bitLen >>> 16) & 0xff);
    msg.push((bitLen >>> 24) & 0xff);
    for (let i = 0; i < 4; i++) msg.push(0);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    for (let i = 0; i < msg.length; i += 64) {
        const x = [];
        for (let j = 0; j < 16; j++) {
            x[j] = msg[i + j * 4] | (msg[i + j * 4 + 1] << 8) | (msg[i + j * 4 + 2] << 16) | (msg[i + j * 4 + 3] << 24);
        }
        let a = a0, b = b0, c = c0, d = d0;
        a = ff(a, b, c, d, x[0], 7, 0xd76aa478);
        d = ff(d, a, b, c, x[1], 12, 0xe8c7b756);
        c = ff(c, d, a, b, x[2], 17, 0x242070db);
        b = ff(b, c, d, a, x[3], 22, 0xc1bdceee);
        a = ff(a, b, c, d, x[4], 7, 0xf57c0faf);
        d = ff(d, a, b, c, x[5], 12, 0x4787c62a);
        c = ff(c, d, a, b, x[6], 17, 0xa8304613);
        b = ff(b, c, d, a, x[7], 22, 0xfd469501);
        a = ff(a, b, c, d, x[8], 7, 0x698098d8);
        d = ff(d, a, b, c, x[9], 12, 0x8b44f7af);
        c = ff(c, d, a, b, x[10], 17, 0xffff5bb1);
        b = ff(b, c, d, a, x[11], 22, 0x895cd7be);
        a = ff(a, b, c, d, x[12], 7, 0x6b901122);
        d = ff(d, a, b, c, x[13], 12, 0xfd987193);
        c = ff(c, d, a, b, x[14], 17, 0xa679438e);
        b = ff(b, c, d, a, x[15], 22, 0x49b40821);

        a = gg(a, b, c, d, x[1], 5, 0xf61e2562);
        d = gg(d, a, b, c, x[6], 9, 0xc040b340);
        c = gg(c, d, a, b, x[11], 14, 0x265e5a51);
        b = gg(b, c, d, a, x[0], 20, 0xe9b6c7aa);
        a = gg(a, b, c, d, x[5], 5, 0xd62f105d);
        d = gg(d, a, b, c, x[10], 9, 0x02441453);
        c = gg(c, d, a, b, x[15], 14, 0xd8a1e681);
        b = gg(b, c, d, a, x[4], 20, 0xe7d3fbc8);
        a = gg(a, b, c, d, x[9], 5, 0x21e1cde6);
        d = gg(d, a, b, c, x[14], 9, 0xc33707d6);
        c = gg(c, d, a, b, x[3], 14, 0xf4d50d87);
        b = gg(b, c, d, a, x[8], 20, 0x455a14ed);
        a = gg(a, b, c, d, x[13], 5, 0xa9e3e905);
        d = gg(d, a, b, c, x[2], 9, 0xfcefa3f8);
        c = gg(c, d, a, b, x[7], 14, 0x676f02d9);
        b = gg(b, c, d, a, x[12], 20, 0x8d2a4c8a);

        a = hh(a, b, c, d, x[5], 4, 0xfffa3942);
        d = hh(d, a, b, c, x[8], 11, 0x8771f681);
        c = hh(c, d, a, b, x[11], 16, 0x6d9d6122);
        b = hh(b, c, d, a, x[14], 23, 0xfde5380c);
        a = hh(a, b, c, d, x[1], 4, 0xa4beea44);
        d = hh(d, a, b, c, x[4], 11, 0x4bdecfa9);
        c = hh(c, d, a, b, x[7], 16, 0xf6bb4b60);
        b = hh(b, c, d, a, x[10], 23, 0xbebfbc70);
        a = hh(a, b, c, d, x[13], 4, 0x289b7ec6);
        d = hh(d, a, b, c, x[0], 11, 0xeaa127fa);
        c = hh(c, d, a, b, x[3], 16, 0xd4ef3085);
        b = hh(b, c, d, a, x[6], 23, 0x04881d05);
        a = hh(a, b, c, d, x[9], 4, 0xd9d4d039);
        d = hh(d, a, b, c, x[12], 11, 0xe6db99e5);
        c = hh(c, d, a, b, x[15], 16, 0x1fa27cf8);
        b = hh(b, c, d, a, x[2], 23, 0xc4ac5665);

        a = ii(a, b, c, d, x[0], 6, 0xf4292244);
        d = ii(d, a, b, c, x[7], 10, 0x432aff97);
        c = ii(c, d, a, b, x[14], 15, 0xab9423a7);
        b = ii(b, c, d, a, x[5], 21, 0xfc93a039);
        a = ii(a, b, c, d, x[12], 6, 0x655b59c3);
        d = ii(d, a, b, c, x[3], 10, 0x8f0ccc92);
        c = ii(c, d, a, b, x[10], 15, 0xffeff47d);
        b = ii(b, c, d, a, x[1], 21, 0x85845dd1);
        a = ii(a, b, c, d, x[8], 6, 0x6fa87e4f);
        d = ii(d, a, b, c, x[15], 10, 0xfe2ce6e0);
        c = ii(c, d, a, b, x[6], 15, 0xa3014314);
        b = ii(b, c, d, a, x[13], 21, 0x4e0811a1);
        a = ii(a, b, c, d, x[4], 6, 0xf7537e82);
        d = ii(d, a, b, c, x[11], 10, 0xbd3af235);
        c = ii(c, d, a, b, x[2], 15, 0x2ad7d2bb);
        b = ii(b, c, d, a, x[9], 21, 0xeb86d391);

        a0 = safeAdd(a0, a);
        b0 = safeAdd(b0, b);
        c0 = safeAdd(c0, c);
        d0 = safeAdd(d0, d);
    }

    function toLE(n) {
        return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
    }
    return toLE(a0).concat(toLE(b0)).concat(toLE(c0)).concat(toLE(d0));
}

function hex(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
        out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    }
    return out;
}

function hmacMd5(keyBytes, msgBytes) {
    let key = keyBytes.slice();
    if (key.length > 64) key = md5(key);
    while (key.length < 64) key.push(0);
    const ipad = [];
    const opad = [];
    for (let i = 0; i < 64; i++) {
        ipad.push(key[i] ^ 0x36);
        opad.push(key[i] ^ 0x5c);
    }
    return md5(opad.concat(md5(ipad.concat(msgBytes))));
}

function sortQuery(query) {
    if (!query) return '';
    const pairs = [];
    const parts = query.split('&');
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        const eq = part.indexOf('=');
        const rawK = eq < 0 ? part : part.slice(0, eq);
        const rawV = eq < 0 ? '' : part.slice(eq + 1);
        const k = decodeURIComponent(rawK.replace(/\+/g, ' '));
        const v = decodeURIComponent(rawV.replace(/\+/g, ' '));
        if (k) pairs.push([k, v]);
    }
    pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    let out = '';
    for (let i = 0; i < pairs.length; i++) {
        if (i) out += '&';
        out += pairs[i][0] + '=' + pairs[i][1];
    }
    return out;
}

function encodeQuery(params) {
    if (!params) return '';
    const keys = Object.keys(params);
    const sorted = keys.slice().sort();
    let out = '';
    for (let i = 0; i < sorted.length; i++) {
        if (i) out += '&';
        out += encodeURIComponent(sorted[i]) + '=' + encodeURIComponent(String(params[sorted[i]]));
    }
    return out;
}

function contentMd5(body) {
    if (!body) return '';
    return hex(md5(body));
}

function stringToSign(method, accept, ctype, body, ts, pathWithQuery) {
    const clen = body ? String(utf8Bytes(body).length) : '';
    const md5Hex = contentMd5(body);
    return [
        method.toUpperCase(),
        accept || '',
        ctype || '',
        clen,
        String(ts),
        md5Hex,
        pathWithQuery,
    ].join('\n');
}

function sign(method, accept, ctype, urlPath, query, body) {
    const bodyText = body || '';
    const ts = Date.now();
    const sq = sortQuery(query);
    const pq = urlPath + (sq ? '?' + sq : '');
    const sts = stringToSign(method, accept, ctype, bodyText, ts, pq);
    const mac = hmacMd5(b64decode(SECRET_B64), utf8Bytes(sts));
    return ts + '|1|' + b64encode(mac);
}

function clientToken() {
    const ts = String(Date.now());
    const reversed = ts.split('').reverse().join('');
    const md5Hex = hex(md5(reversed));
    return ts + ',' + md5Hex;
}

function clientInfo() {
    const info = {
        package_name: 'com.movieboxtv.app',
        version_name: '1.1.9.0820.03',
        version_code: 1010908203,
        os: 'android',
        os_version: '14',
        device_id: 'aaaaaaaaaaaaaaaa',
        brand: 'samsung',
        model: 'SM-S918B',
        system_language: 'en',
        net: 'wifi',
        region: 'US',
        timezone: 'UTC',
        sp_code: 'US',
    };
    return JSON.stringify(info);
}

function buildHeaders(method, path, query, body, token) {
    const accept = 'application/json';
    const ctype = 'application/json';
    const headers = {
        'User-Agent': 'okhttp/4.12.0',
        Accept: accept,
        'Content-Type': ctype,
        'x-tr-signature': sign(method, accept, ctype, path, query || '', body || ''),
        'X-Client-Token': clientToken(),
        'X-Client-Info': clientInfo(),
        'X-Client-Status': '1',
    };
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
}

module.exports = {
    BASE,
    HOST_Q,
    sortQuery,
    encodeQuery,
    contentMd5,
    sign,
    clientToken,
    clientInfo,
    buildHeaders,
    md5,
    hmacMd5,
    b64encode,
    b64decode,
    utf8Bytes,
    utf8ToString,
};
