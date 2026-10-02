const { fetchText, statusOf } = require('../movieboxtv/http');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const REFERER = 'https://4khdhub.one/';

function htmlHeaders(referer) {
    return {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': referer || REFERER,
    };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64d(s) {
    const clean = String(s || '').replace(/[^A-Za-z0-9+/=]/g, '');
    const out = [];
    let buf = 0;
    let bits = 0;
    for (let i = 0; i < clean.length; i++) {
        const ch = clean.charAt(i);
        if (ch === '=') break;
        const v = B64.indexOf(ch);
        if (v < 0) continue;
        buf = (buf << 6) | v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push((buf >> bits) & 0xff);
        }
    }
    let str = '';
    for (let i = 0; i < out.length; i++) str += String.fromCharCode(out[i]);
    return str;
}

function rot13(s) {
    return String(s || '').replace(/[a-zA-Z]/g, function (c) {
        const base = c <= 'Z' ? 90 : 122;
        let v = c.charCodeAt(0) + 13;
        if (v > base) v -= 26;
        return String.fromCharCode(v);
    });
}

function decodeEntities(s) {
    return String(s || '')
        .replace(/&#0?39;|&#8217;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, function (_m, n) {
            const code = parseInt(n, 10);
            if (code < 0x80) return String.fromCharCode(code);
            if (code < 0x800) {
                return String.fromCharCode(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
            }
            return String.fromCharCode(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        })
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function shortUrl(u) {
    const s = String(u || '');
    return s.length > 90 ? s.slice(0, 90) + '...' : s;
}

async function getHtml(url, referer) {
    const r = await fetchText(url, { headers: htmlHeaders(referer) });
    if (r.status >= 400) throw new Error('HTTP ' + r.status + ' for ' + shortUrl(url));
    if (!r.text) throw new Error('empty response for ' + shortUrl(url));
    return r;
}

function decodeShortLink(html) {
    const m = String(html || '').match(/s\('o','([^']+)'/);
    if (!m) return null;
    try {
        const json = b64d(rot13(b64d(b64d(m[1]))));
        const data = JSON.parse(json);
        if (!data || !data.o) return null;
        return b64d(data.o);
    } catch (e) {
        return null;
    }
}

function collectAnchors(html) {
    const out = [];
    const re = /<a[^>]+href="([^"]+)"/gi;
    let m;
    while ((m = re.exec(String(html || ''))) !== null) {
        const href = decodeEntities(m[1]).trim();
        if (href) out.push(href);
    }
    return out;
}

function extractLinkParam(url) {
    const m = String(url || '').match(/[?&]link=((?:https?|ftp)%3A[^&]+|https?:[^&]+)/i);
    if (!m) return null;
    let v = m[1];
    try {
        v = decodeURIComponent(v);
    } catch (e) { /* keep raw */ }
    return /^https?:\/\//i.test(v) ? v : null;
}

// Candidate file urls in the order a player prefers them: hosts that honour
// HTTP Range (signed R2, CDN files) so seeking works, then link-generator
// payloads (Google download links play but ignore Range). Cloudflare-worker
// blobs are dropped: they answer the open-ended Range a player sends with a
// JSON 403 and rate-limit every other shape, so a row built on one is a row
// that fails to open.
function directCandidates(anchors, finalUrl) {
    const all = (anchors || []).concat(finalUrl ? [finalUrl] : []);
    const r2 = [];
    const link = [];
    const ext = [];
    const seen = {};
    for (let i = 0; i < all.length; i++) {
        const u = all[i];
        if (!u || seen[u]) continue;
        seen[u] = true;
        if (/workers\.dev/i.test(u)) continue;
        if (/r2\.cloudflarestorage\.com/.test(u)) { r2.push(u); continue; }
        const lp = extractLinkParam(u);
        if (lp && !/gpdl\./.test(lp)) { link.push(lp); continue; }
        if (/\.(mkv|mp4|m4v|avi)(\?|$)/i.test(u) && !/gpdl\./.test(u)) { ext.push(u); continue; }
    }
    return r2.concat(ext, link);
}

// Google download links ignore Range, so a ranged GET would pull the whole
// file; a HEAD is enough to tell a live link from an expired one.
function isGoogleFile(url) {
    return /googleusercontent\.com/i.test(String(url || ''));
}

// Ask for the file the way a player does (open-ended Range) and decide on
// the status only. Worker blobs answer 403 to that request while serving
// bounded ranges, so a bounded probe would return a row the player cannot
// open; signed R2 links can expire or rate-limit too, which a status check
// catches before the row is offered.
async function looksPlayable(url) {
    if (typeof fetch !== 'function') return true;
    const google = isGoogleFile(url);
    let res;
    try {
        res = google
            ? await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA, Referer: REFERER } })
            : await fetch(url, { headers: { 'User-Agent': UA, Range: 'bytes=0-', Referer: REFERER } });
    } catch (e) {
        return false;
    }
    const status = statusOf(res);
    if (status < 200 || status >= 400) return false;
    let ct = '';
    try {
        if (res && res.headers && typeof res.headers.get === 'function') {
            ct = String(res.headers.get('content-type') || '');
        }
    } catch (e) { /* headers may be absent */ }
    if (ct && /(json|text\/html)/i.test(ct)) return false;
    if (google) return true;
    try {
        if (res.body) {
            if (typeof res.body.cancel === 'function') {
                const p = res.body.cancel();
                if (p && typeof p.catch === 'function') p.catch(function () { /* noop */ });
            } else if (typeof res.body.getReader === 'function') {
                const rd = res.body.getReader();
                const c = rd.cancel();
                if (c && typeof c.catch === 'function') c.catch(function () { /* noop */ });
            }
        }
    } catch (e) { /* ignore */ }
    return true;
}

async function firstPlayable(candidates) {
    for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const ok = await looksPlayable(c);
        if (!ok) {
            console.log('[4KHDHub] skipping unplayable link');
            continue;
        }
        return c;
    }
    return null;
}

function pickPixelAnchor(anchors) {
    for (let i = 0; i < (anchors || []).length; i++) {
        const a = anchors[i];
        if (/pixel\.[a-z0-9.-]+\/\?id=/i.test(a)) return a;
    }
    for (let i = 0; i < (anchors || []).length; i++) {
        if (/\/\?id=[0-9a-f]{60,}/i.test(anchors[i])) return anchors[i];
    }
    return null;
}

async function resolveApiPage(apiUrl, referer) {
    const res = await getHtml(apiUrl, referer);
    const anchors = collectAnchors(res.text);
    const direct = await firstPlayable(directCandidates(anchors, res.url));
    if (direct) return direct;

    // Server button redirects through pixel.<host> to a link generator page
    // whose final URL carries the real file url in ?link=
    const pixel = pickPixelAnchor(anchors);
    if (pixel) {
        try {
            const hop = await getHtml(pixel, referer);
            const hopDirect = await firstPlayable(directCandidates(collectAnchors(hop.text), hop.url));
            if (hopDirect) return hopDirect;
        } catch (e) {
            console.log('[4KHDHub] pixel hop failed: ' + (e && e.message ? e.message : e));
        }
    }
    throw new Error('no direct file on ' + shortUrl(apiUrl));
}

function isHubcloudDrive(url) {
    return /\/drive\//.test(url);
}

function isHubdriveFile(url) {
    return /hubdrive/i.test(url);
}

async function resolveDrivePage(url) {
    const page = await getHtml(url, 'https://4khdhub.one/');
    const anchors = collectAnchors(page.text);
    const selfDirect = await firstPlayable(directCandidates(anchors, page.url));
    if (selfDirect && selfDirect !== page.url) return selfDirect;

    const api = decodeApiUrl(page.text);
    if (!api) throw new Error('no link API on ' + shortUrl(url));
    return resolveApiPage(api, originOf(url));
}

function decodeApiUrl(html) {
    const m = String(html || '').match(/var\s+url\s*=\s*'([^']+)'/);
    if (m) return decodeEntities(m[1]);
    const m2 = String(html || '').match(/var\s+url\s*=\s*"([^"]+)"/);
    if (m2) return decodeEntities(m2[1]);
    return null;
}

function originOf(url) {
    const m = String(url || '').match(/^(https?:\/\/[^/]+)/i);
    return m ? m[1] + '/' : 'https://4khdhub.one/';
}

async function resolveTarget(target, hops) {
    if (!target) throw new Error('empty target');
    if (hops > 4) throw new Error('too many hops for ' + shortUrl(target));
    // A decoded payload may already be the file itself; only hand it over
    // once it answers the same open-ended Range request a player sends.
    if (/\.(mkv|mp4|m4v|avi)(\?|$)/i.test(target) && !/gpdl\./.test(target) && !/workers\.dev/i.test(target)) {
        if (await looksPlayable(target)) return target;
        console.log('[4KHDHub] skipping unplayable file link');
    }

    const page = await getHtml(target, 'https://4khdhub.one/');
    const direct = await firstPlayable(directCandidates(collectAnchors(page.text), page.url));
    if (direct && /\.cloudflarestorage\.com/.test(direct)) return direct;

    if (isHubdriveFile(target)) {
        const anchors = collectAnchors(page.text);
        const drive = anchors.filter(function (a) {
            return /\/drive\//.test(a) && a.indexOf('#') !== 0;
        });
        if (drive.length) return resolveDrivePage(drive[0]);
        if (direct) return direct;
        throw new Error('hubdrive page has no drive link');
    }

    if (isHubcloudDrive(target) || decodeApiUrl(page.text)) {
        return resolveDrivePage(target);
    }

    if (direct) return direct;
    throw new Error('unhandled page ' + shortUrl(target));
}

// greenmotors short link -> target host -> signed direct file url
async function resolveShortLink(shortLink) {
    const page = await getHtml(shortLink, 'https://4khdhub.one/');
    const target = decodeShortLink(page.text);
    if (!target) {
        const direct = await firstPlayable(directCandidates(collectAnchors(page.text), page.url));
        if (direct) return direct;
        throw new Error('no payload in ' + shortUrl(shortLink));
    }
    return resolveTarget(target, 0);
}

// Some mirrors hand back a raw file url containing literal spaces/brackets
// from the release name; percent-encode those so players can open it.
function normalizeUrl(url) {
    return String(url || '')
        .replace(/ /g, '%20')
        .replace(/\[/g, '%5B')
        .replace(/\]/g, '%5D')
        .replace(/"/g, '%22')
        .replace(/\{/g, '%7B')
        .replace(/\}/g, '%7D')
        .replace(/\|/g, '%7C')
        .replace(/\^/g, '%5E');
}

// mirrors: first working wins; failures are logged by the caller
async function resolveItem(item, log) {
    const mirrors = item.mirrors || [];
    for (let i = 0; i < mirrors.length; i++) {
        try {
            const url = await resolveShortLink(mirrors[i].url);
            if (url) {
                log('resolved ' + item.quality + ' via ' + (mirrors[i].label || 'mirror' + (i + 1)));
                return normalizeUrl(url);
            }
        } catch (e) {
            log('mirror ' + (i + 1) + ' failed: ' + (e && e.message ? e.message : e));
        }
    }
    return null;
}

module.exports = {
    UA,
    REFERER,
    htmlHeaders,
    decodeEntities,
    normalizeUrl,
    resolveShortLink,
    resolveItem,
    getHtml,
};
