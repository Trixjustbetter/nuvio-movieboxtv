const { fetchText } = require('../movieboxtv/http');
const { UA, REFERER, decodeEntities } = require('./resolve');

const SITE = 'https://4khdhub.one';

function headers(referer) {
    return {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': referer || SITE + '/',
    };
}

function normalize(t) {
    return String(t || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '');
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return Math.max(b.length);
    if (!b.length) return Math.max(a.length);
    const prev = [];
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        const curr = [i];
        for (let j = 1; j <= b.length; j++) {
            curr[j] = Math.min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
        prev.length = b.length + 1;
    }
    return prev[b.length];
}

function titleScore(query, candidate) {
    const q = normalize(query);
    const c = normalize(candidate);
    if (!q || !c) return 0;
    if (q === c) return 100;
    if (c.indexOf(q) === 0 || q.indexOf(c) === 0) return 90;
    if (c.indexOf(q) !== -1 || q.indexOf(c) !== -1) return 80;
    const dist = levenshtein(q, c);
    const ratio = 1 - dist / Math.max(q.length, c.length);
    return ratio >= 0.65 ? Math.round(ratio * 70) : 0;
}

async function getHtml(url, referer) {
    const r = await fetchText(url, { headers: headers(referer) });
    if (r.status >= 400) {
        throw new Error('HTTP ' + r.status + ' for ' + url);
    }
    if (!r.text) throw new Error('empty response for ' + url);
    return r;
}

function stripTags(s) {
    return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function searchCards(query, log) {
    const url = SITE + '/?s=' + encodeURIComponent(query);
    const page = await getHtml(url);
    const cards = [];
    const re = /<a\s+href="([^"]+)"\s+class="movie-card"\s+aria-label="([^"]*)"/gi;
    let m;
    while ((m = re.exec(page.text)) !== null) {
        const href = m[1];
        if (!/-movie-\d+\/$/.test(href) && !/-series-\d+\/$/.test(href)) continue;
        cards.push({
            url: SITE + href,
            kind: href.indexOf('-series-') !== -1 ? 'tv' : 'movie',
            title: decodeEntities(m[2]).replace(/\s+details$/i, '').trim(),
        });
    }
    log('search "' + query + '" -> ' + cards.length + ' card(s)');
    return cards;
}

function parsePostTitle(html) {
    const m = String(html || '').match(/<title>([\s\S]*?)<\/title>/i);
    const text = decodeEntities(m ? m[1] : '');
    const y = text.match(/\((19|20)\d{2}\)/);
    return {
        title: text.replace(/\s*-\s*4K-HDHub.*$/i, '').trim(),
        year: y ? parseInt(y[0].replace(/[()]/g, ''), 10) : 0,
    };
}

function qualityOf(title) {
    const m = String(title || '').match(/\b(2160|1440|1200|1080|720|576|480|360)\s*p\b/i);
    if (m) return m[1] + 'p';
    if (/\b4k\b/i.test(title)) return '2160p';
    if (/\bhd\b/i.test(title)) return '1080p';
    return '';
}

function sizeOf(chunk) {
    const a = String(chunk || '').match(/badge-size">\s*([^<]+)</);
    if (a) return a[1].trim();
    const b = String(chunk || '').match(/>\s*(\d+(?:\.\d+)?\s*(?:GB|MB))\s*</);
    return b ? b[1].trim() : '';
}

function sizeBytes(size) {
    const m = String(size || '').match(/([\d.]+)\s*(GB|MB)/i);
    if (!m) return 0;
    const n = parseFloat(m[1]) || 0;
    return /mb/i.test(m[2]) ? n * 1024 * 1024 : n * 1024 * 1024 * 1024;
}

function mirrorsOf(chunk) {
    const out = [];
    const re = /<a[^>]+href="(https?:\/\/[^"]+\?id=[A-Za-z0-9+/=]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(String(chunk || ''))) !== null) {
        out.push({ url: decodeEntities(m[1]), label: stripTags(m[2]).replace(/&nbsp;/gi, '').trim() });
    }
    return out;
}

function numberFrom(str, kind) {
    const s = String(str || '');
    if (kind === 'episode') {
        const badge = s.match(/Episode[-\s]?(\d{1,3})/i);
        if (badge) return parseInt(badge[1], 10);
        const se = s.match(/\bS\d{1,2}\s*E(\d{1,3})\b/i);
        if (se) return parseInt(se[1], 10);
        return 0;
    }
    const se = s.match(/\bS(\d{1,2})\s*E\d{1,3}\b/i);
    if (se) return parseInt(se[1], 10);
    const pack = s.match(/\bS(\d{1,2})\b/i);
    if (pack) return parseInt(pack[1], 10);
    return 0;
}

function collectBlocks(html, cls, isEpisode, items) {
    const marker = '<div class="' + cls + '">';
    let idx = String(html || '').indexOf(marker);
    while (idx !== -1) {
        const contentStart = idx + marker.length;
        const titleEnd = String(html).indexOf('</div>', contentStart);
        const rawTitle = titleEnd === -1 ? '' : String(html).slice(contentStart, titleEnd);
        const next = String(html).indexOf(marker, contentStart);
        const chunk = String(html).slice(contentStart, next === -1 ? String(html).length : next);
        const title = decodeEntities(stripTags(rawTitle));
        if (title) {
            items.push({
                title: title,
                chunk: chunk,
                quality: qualityOf(title),
                size: sizeOf(chunk),
                season: isEpisode ? numberFrom(title, 'season') : 0,
                episode: isEpisode ? numberFrom(chunk, 'episode') || numberFrom(title, 'episode') : 0,
                mirrors: mirrorsOf(chunk),
            });
        }
        idx = next;
    }
}

function parseItems(html) {
    const items = [];
    collectBlocks(html, 'file-title', false, items);
    collectBlocks(html, 'episode-file-title', true, items);
    return items.filter(function (it) { return it.mirrors.length > 0; });
}

async function fetchPost(url) {
    const page = await getHtml(url);
    const meta = parsePostTitle(page.text);
    const items = parseItems(page.text);
    return { url: url, title: meta.title, year: meta.year, items: items };
}

async function findPost(title, year, mediaType, log) {
    const want = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
    const cards = (await searchCards(title, log)).filter(function (c) { return c.kind === want; });
    if (!cards.length) throw new Error('no ' + want + ' result for "' + title + '"');

    cards.forEach(function (c) { c.score = titleScore(title, c.title); });
    cards.sort(function (a, b) { return b.score - a.score; });

    const strong = cards.filter(function (c) { return c.score >= 95; });
    const candidates = (strong.length ? strong : cards).slice(0, strong.length ? 1 : 3);

    let fallback = null;
    for (let i = 0; i < candidates.length; i++) {
        const post = await fetchPost(candidates[i].url);
        log('post "' + post.title + '" (' + (post.year || '?') + ') items=' + post.items.length);
        if (!post.items.length) continue;
        if (!fallback) fallback = post;
        if (!year || !post.year || Math.abs(post.year - year) <= 1) return post;
        if (Math.abs(post.year - year) <= 3 && i === candidates.length - 1) return post;
    }
    if (fallback) return fallback;
    throw new Error('no downloadable item on "' + title + '"');
}

module.exports = {
    SITE,
    headers,
    normalize,
    titleScore,
    sizeBytes,
    searchCards,
    fetchPost,
    findPost,
    parseItems,
};
