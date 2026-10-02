const { getTmdbDetails } = require('../movieboxtv/tmdb');
const site = require('./site');
const { resolveItem, UA } = require('./resolve');

const NAME = '4KHDHub';
const REFERRER = 'https://4khdhub.one/';

let TRACE = [];
function tr(msg) {
    TRACE.push(msg);
    console.log('[4KHDHub] ' + msg);
}

function debugRow(msg) {
    const text = String(msg || 'unknown').slice(0, 220);
    return {
        title: '4KHDHub • ' + text,
        quality: 'DEBUG',
        type: 'direct',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        headers: {},
    };
}

const QUALITY_ORDER = { '2160p': 4, '1440p': 3, '1080p': 3, '720p': 2, '576p': 1, '480p': 1, '360p': 1 };

function qualityRank(q) {
    return QUALITY_ORDER[q] || (q ? 2 : 0);
}

function sortItems(items) {
    return items.slice().sort(function (a, b) {
        const qa = qualityRank(a.quality) - qualityRank(b.quality);
        if (qa !== 0) return -qa;
        return site.sizeBytes(b.size) - site.sizeBytes(a.size);
    });
}

function filterForEpisode(items, season, episode) {
    const wantSeason = Number(season) || 1;
    const wantEp = Number(episode) || 1;
    const exact = items.filter(function (it) {
        return it.episode === wantEp && (it.season === wantSeason || it.season === 0);
    });
    if (exact.length) return exact;
    return items.filter(function (it) { return it.episode === wantEp; });
}

function availableLabel(items) {
    const eps = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].episode) eps.push(items[i].season ? 'S' + items[i].season + 'E' + items[i].episode : 'E' + items[i].episode);
    }
    return eps.length ? eps.slice(0, 12).join(',') : 'none';
}

async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let cursor = 0;
    async function worker() {
        for (;;) {
            const i = cursor++;
            if (i >= items.length) return;
            out[i] = await fn(items[i], i);
        }
    }
    const workers = [];
    const n = Math.min(limit, items.length);
    for (let i = 0; i < n; i++) workers.push(worker());
    await Promise.all(workers);
    return out;
}

function streamHeaders() {
    return {
        'User-Agent': UA,
        'Referer': REFERRER,
    };
}

function buildStream(item, url, index) {
    const parts = [];
    if (item.quality) parts.push(item.quality);
    if (item.size) parts.push(item.size);
    const label = item.mirrors[0] && item.mirrors[0].label;
    if (label) parts.push(label.replace(/^Download\s+/i, ''));
    const title = String(item.title || '').replace(/\s+/g, ' ').trim();
    if (title && !item.episode) parts.push(shortTitle(title));
    return {
        title: pad(index) + '. ' + (parts.length ? parts.join(' • ') : title),
        quality: item.quality || undefined,
        type: 'direct',
        url: url,
        headers: streamHeaders(),
        behaviorHints: {
            bingeGroup: '4khdhub-' + (item.quality || 'sd'),
        },
    };
}

function shortTitle(t) {
    const s = String(t || '').replace(/\s*\((19|20)\d{2}\)/g, '').replace(/\.(mkv|mp4)$/i, '');
    return s.length > 60 ? s.slice(0, 60) + '…' : s;
}

function pad(i) {
    const n = i + 1;
    return n < 10 ? '0' + n : String(n);
}

async function getStreamsForTitle(title, year, mediaType, season, episode) {
    const isTv = mediaType === 'tv' || mediaType === 'series';
    const post = await site.findPost(title, year, isTv ? 'tv' : 'movie', tr);
    tr('items=' + post.items.length);

    let items = post.items;
    if (isTv) {
        const matched = filterForEpisode(items, season, episode);
        tr('episode match ' + (Number(season) || 1) + 'x' + (Number(episode) || 1) + ' -> ' + matched.length +
            ' (available ' + availableLabel(items) + ')');
        if (!matched.length) {
            throw new Error('no S' + (Number(season) || 1) + 'E' + (Number(episode) || 1) +
                ' on "' + post.title + '" (has ' + availableLabel(items) + ')');
        }
        items = matched;
    }

    items = sortItems(items).slice(0, isTv ? 6 : 6);
    tr('resolving ' + items.length + ' item(s)');

    const urls = await mapLimit(items, 4, function (item) {
        return resolveItem(item, tr);
    });

    const out = [];
    for (let i = 0; i < items.length; i++) {
        if (urls[i]) out.push(buildStream(items[i], urls[i], out.length));
    }
    return out;
}

async function resolve(tmdbId, mediaType, season, episode) {
    TRACE = [];
    const mt = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
    tr('call tmdb=' + tmdbId + ' type=' + mt + ' s' + season + 'e' + episode);
    const meta = await getTmdbDetails(tmdbId, mt);
    if (!meta || !meta.title) throw new Error('TMDB lookup failed for id ' + tmdbId);
    tr('tmdb "' + meta.title + '" ' + (meta.year || '?'));
    const streams = await getStreamsForTitle(meta.title, meta.year, mt, season, episode);
    tr('done ' + streams.length + ' stream(s)');
    if (!streams.length) {
        return [debugRow('no sources | ' + TRACE.join(' > '))];
    }
    return streams;
}

const api = {
    getStreams(tmdbId, mediaType, season, episode) {
        return resolve(tmdbId, mediaType, season, episode).catch(function (err) {
            const msg = err && err.message ? err.message : String(err);
            console.error('[4KHDHub] Error:', msg);
            return [debugRow('error: ' + msg + ' | ' + TRACE.join(' > '))];
        });
    },
    _internal: {
        getStreamsForTitle,
        sortItems,
        filterForEpisode,
        clearCaches() {},
    },
};

module.exports = api;
