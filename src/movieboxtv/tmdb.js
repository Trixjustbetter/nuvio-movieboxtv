const TMDB_API_KEY = 'cd85a9c87eb793d68cbf5b492590e1de';

const cacheStore = {};

function cacheSet(key, value, ttlMs) {
    cacheStore[key] = { v: value, exp: Date.now() + ttlMs };
}

function cacheGet(key) {
    const e = cacheStore[key];
    if (!e) return null;
    if (Date.now() > e.exp) {
        delete cacheStore[key];
        return null;
    }
    return e.v;
}

// Sweep expired entries on demand — the app's JS runtime has no Node timers.
function cacheSweep() {
    const now = Date.now();
    for (const k of Object.keys(cacheStore)) {
        if (cacheStore[k].exp < now) delete cacheStore[k];
    }
}

async function httpGetJson(url) {
    const res = await fetch(url, {
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
    return res.json();
}

function toMeta(data) {
    const dateStr = data.release_date || data.first_air_date || '';
    const meta = {
        title: data.title || data.name || '',
        year: parseInt(String(dateStr).substring(0, 4), 10) || 0,
    };
    if (!meta.title) throw new Error('TMDB lookup returned no title');
    return meta;
}

async function getTmdbDetails(tmdbId, mediaType) {
    const t = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
    const idStr = String(tmdbId || '').trim();
    const cacheKey = 'tmdb_' + t + '_' + idStr;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    let data;
    if (/^tt\d+$/i.test(idStr)) {
        const findUrl = 'https://api.themoviedb.org/3/find/' + idStr +
            '?api_key=' + TMDB_API_KEY + '&external_source=imdb_id';
        const res = await httpGetJson(findUrl);
        let bucket = res[t + '_results'] || [];
        if (!bucket.length) bucket = res.movie_results || res.tv_results || [];
        if (!bucket.length) throw new Error('TMDB find failed for id ' + idStr);
        data = bucket[0];
    } else {
        const url = 'https://api.themoviedb.org/3/' + t + '/' + idStr +
            '?api_key=' + TMDB_API_KEY;
        data = await httpGetJson(url);
    }

    const meta = toMeta(data);
    cacheSet(cacheKey, meta, 24 * 60 * 60 * 1000);
    return meta;
}

module.exports = { getTmdbDetails, TMDB_API_KEY };
