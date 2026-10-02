const bff = require('./bff');
const { getTmdbDetails } = require('./tmdb');

const NAME = 'MovieBox TV';

function normalizeTitle(t) {
    return String(t || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
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
    const q = normalizeTitle(query);
    const c = normalizeTitle(candidate);
    if (!q || !c) return 0;
    if (q === c) return 100;
    if (c.indexOf(q) === 0 || q.indexOf(c) === 0) return 90;
    if (c.indexOf(q) !== -1 || q.indexOf(c) !== -1) return 80;
    const dist = levenshtein(q, c);
    const ratio = 1 - dist / Math.max(q.length, c.length);
    return ratio >= 0.65 ? Math.round(ratio * 70) : 0;
}

function yearOf(item) {
    const d = item && item.releaseDate;
    if (!d) return 0;
    return parseInt(String(d).substring(0, 4), 10) || 0;
}

function matchItem(items, title, year) {
    let best = null;
    let bestScore = -1;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let score = titleScore(title, item.title);
        const iy = yearOf(item);
        if (year && iy) {
            const dy = Math.abs(iy - year);
            if (dy === 0) score += 15;
            else if (dy === 1) score += 8;
            else if (dy > 3) score -= 10;
        }
        if (score > bestScore) {
            bestScore = score;
            best = item;
        }
    }
    if (!best || bestScore < 70) return null;
    return best;
}

async function findSubject(title, year, mediaType) {
    const subjectType = mediaType === 'tv' || mediaType === 'series' ? 2 : 1;
    const data = await bff.search(title, subjectType, 1, 20);
    const items = (data && data.items) || [];
    let match = matchItem(items, title, year);
    if (match) return match;

    const data2 = await bff.search(title, 0, 1, 20);
    const items2 = (data2 && data2.items) || [];
    return matchItem(items2, title, year);
}

function qualityRank(q) {
    const s = String(q || '');
    if (/2160|4k/i.test(s)) return 0;
    if (/1080/.test(s)) return 1;
    if (/720/.test(s)) return 2;
    if (/480/.test(s)) return 3;
    if (/360/.test(s)) return 4;
    return 9;
}

function formatBytes(n) {
    if (!n || n <= 0) return '';
    const g = n / (1024 * 1024 * 1024);
    if (g >= 1) return g.toFixed(1) + ' GB';
    const m = n / (1024 * 1024);
    if (m >= 1) return Math.round(m) + ' MB';
    return Math.round(n / 1024) + ' KB';
}

function headSize(url) {
    return new Promise((resolve) => {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = setTimeout(() => {
            if (ctrl) {
                try { ctrl.abort(); } catch (e) { /* noop */ }
            }
            resolve(0);
        }, 1500);
        const opts = { method: 'HEAD', headers: { 'User-Agent': 'okhttp/4.12.0' } };
        if (ctrl) opts.signal = ctrl.signal;
        fetch(url, opts)
            .then((r) => {
                clearTimeout(timer);
                const n = Number((r.headers && r.headers.get('content-length')) || 0);
                resolve(n > 0 ? n : 0);
            })
            .catch(() => {
                clearTimeout(timer);
                resolve(0);
            });
    });
}

function streamKind(url) {
    const u = String(url || '').toLowerCase();
    if (u.indexOf('.m3u8') !== -1) return 'hls';
    if (u.indexOf('.mpd') !== -1) return 'dash';
    return 'direct';
}

async function mapResources(playData) {
    const resources = (playData && playData.resources) || [];
    const seen = {};
    const out = [];
    for (let i = 0; i < resources.length; i++) {
        const r = resources[i];
        if (!r || !r.url) continue;
        if (seen[r.url]) continue;
        seen[r.url] = true;
        const res = r.resolution || '';
        const quality = res ? (/^\d+$/.test(res) ? res + 'p' : res) : 'Auto';
        out.push({
            name: NAME,
            title: quality + (r.codec ? ' ' + r.codec : ''),
            url: r.url,
            quality: quality,
            type: 'direct',
            headers: { 'User-Agent': 'okhttp/4.12.0' },
        });
    }

    const sizes = await Promise.all(out.map((s) => headSize(s.url)));
    for (let i = 0; i < out.length; i++) {
        if (sizes[i]) {
            out[i].bytes = sizes[i];
            out[i].size = formatBytes(sizes[i]);
        }
    }
    out.sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality));
    return out;
}

function mapHlsStreams(playData) {
    const streams = (playData && playData.streams) || [];
    const out = [];
    for (let i = 0; i < streams.length; i++) {
        const s = streams[i];
        if (!s || !s.url) continue;
        const kind = streamKind(s.url);
        if (kind !== 'hls') continue;
        const headers = { 'User-Agent': 'okhttp/4.12.0' };
        if (s.signCookie) headers.Cookie = s.signCookie;
        const resolutions = String(s.resolutions || '').split(',')[0];
        const quality = resolutions ? resolutions + 'p' : (s.format || 'HLS');
        const bytes = /^\d+$/.test(String(s.size || '')) ? Number(s.size) : 0;
        out.push({
            name: NAME,
            title: quality + (s.codecName ? ' ' + s.codecName : '') + ' HLS',
            url: s.url,
            quality: quality,
            type: 'hls',
            bytes: bytes,
            size: bytes ? formatBytes(bytes) : '',
            headers: headers,
        });
    }
    return out;
}

function dedupe(list) {
    const byUrl = {};
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (byUrl[s.url] !== undefined) {
            const prev = out[byUrl[s.url]];
            if (qualityRank(s.quality) < qualityRank(prev.quality)) out[byUrl[s.url]] = s;
            continue;
        }
        byUrl[s.url] = out.length;
        out.push(s);
    }
    out.sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality));
    return out;
}

function hasStreams(playData) {
    return !!(
        playData &&
        ((playData.resources || []).length || (playData.streams || []).length)
    );
}

async function getStreamsForSubject(subject, mediaType, season, episode) {
    const isTv = mediaType === 'tv' || mediaType === 'series';
    let playData;

    if (isTv) {
        const want = Number(season) || 1;
        const ep = Number(episode) || 1;
        let se = want;
        try {
            const seasonInfo = await bff.getSeasonInfo(subject.subjectId);
            const seasons = (seasonInfo && seasonInfo.seasons) || [];
            se = null;
            for (let i = 0; i < seasons.length; i++) {
                if (Number(seasons[i].se) === want) {
                    se = seasons[i].se;
                    break;
                }
            }
            if (se === null) se = seasons.length ? seasons[0].se : want;
        } catch (e) {
            se = want;
        }
        playData = await bff.getPlayInfo(subject.subjectId, se, ep);
        if (!hasStreams(playData)) playData = await bff.getPlayInfo(subject.subjectId, want, ep);
        if (!hasStreams(playData)) playData = await bff.getPlayInfo(subject.subjectId, se, ep);
    } else {
        playData = await bff.getPlayInfo(subject.subjectId, 0, 0);
        if (!hasStreams(playData)) playData = await bff.getPlayInfo(subject.subjectId);
    }

    const mp4 = await mapResources(playData);
    const hls = mapHlsStreams(playData);
    return dedupe(mp4.concat(hls));
}

async function getStreamsByMeta(title, year, mediaType, season, episode) {
    const subject = await findSubject(title, year, mediaType);
    if (!subject) {
        throw new Error('No ' + NAME + ' result for "' + title + '" (' + year + ')');
    }
    return getStreamsForSubject(subject, mediaType, season, episode);
}

async function resolve(tmdbId, mediaType, season, episode) {
    const mt = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
    const meta = await getTmdbDetails(tmdbId, mt);
    if (!meta || !meta.title) {
        throw new Error('TMDB lookup failed for id ' + tmdbId);
    }
    const streams = await getStreamsByMeta(meta.title, meta.year, mt, season, episode);
    console.log('[MovieBox TV] ' + meta.title + ' -> ' + streams.length + ' stream(s)');
    return streams;
}

const api = {
    getStreams(tmdbId, mediaType, season, episode) {
        return resolve(tmdbId, mediaType, season, episode).catch((err) => {
            console.error('[MovieBox TV] Error:', err && err.message ? err.message : err);
            return [];
        });
    },
    _internal: {
        getStreamsByMeta,
        findSubject,
        getStreamsForSubject,
        mapResources,
        mapHlsStreams,
        clearCaches() {},
    },
};

module.exports = api;
