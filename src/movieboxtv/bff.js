const { BASE, HOST_Q, encodeQuery, buildHeaders, b64decode } = require('./sign');

let authToken = null;
let tokenExpMs = 0;
let tokenPromise = null;

function b64ToUtf8(b64) {
    const bytes = b64decode(b64);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try {
        return decodeURIComponent(escape(s));
    } catch (e) {
        return s;
    }
}

function decodeJwtExp(token) {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return 0;
        let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const payload = JSON.parse(b64ToUtf8(b64));
        return (payload.exp || 0) * 1000;
    } catch (e) {
        return 0;
    }
}

async function call(path, options) {
    const opts = options || {};
    const method = opts.method || 'GET';
    const params = Object.assign({}, opts.params || {});
    if (params.host === undefined) params.host = HOST_Q;
    const query = encodeQuery(params);
    const body = opts.data !== undefined && opts.data !== null
        ? JSON.stringify(opts.data)
        : '';
    const headers = buildHeaders(method, path, query, body, authToken);

    let url = BASE + path;
    if (query) url += '?' + query;

    const init = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') init.body = body;

    const res = await fetch(url, init);
    let data = null;
    const text = await res.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = { code: -1, message: text.slice(0, 200) };
        }
    }
    if (!res.ok && data && data.code === undefined) {
        data = { code: res.status, message: (data && data.message) || ('HTTP ' + res.status) };
    }
    return data;
}

async function ensureToken() {
    if (authToken && Date.now() < tokenExpMs - 60000) return authToken;
    if (!tokenPromise) {
        tokenPromise = call('/wefeed-tv-bff/user/visitor-login', {
            method: 'POST',
            data: {},
        })
            .then((data) => {
                if (!data || data.code !== 0 || !data.data || !data.data.token) {
                    throw new Error('visitor-login failed: ' + ((data && data.message) || 'no token'));
                }
                authToken = data.data.token;
                const exp = decodeJwtExp(authToken);
                tokenExpMs = exp > 0 ? exp : Date.now() + 12 * 60 * 60 * 1000;
                return authToken;
            })
            .finally(() => {
                tokenPromise = null;
            });
    }
    return tokenPromise;
}

async function api(path, options) {
    await ensureToken();
    let data = await call(path, options);
    if (data && (data.code === 401 || /jwt/i.test(String(data.message || '')))) {
        authToken = null;
        tokenExpMs = 0;
        await ensureToken();
        data = await call(path, options);
    }
    if (!data || data.code !== 0) {
        const msg = (data && (data.message || data.msg)) || 'request failed';
        const err = new Error(path + ': ' + msg + ' (code=' + (data && data.code) + ')');
        err.code = data && data.code;
        throw err;
    }
    return data.data;
}

async function search(keyword, subjectType, page, perPage) {
    return api('/wefeed-tv-bff/search/result', {
        params: {
            keyword,
            page: String(page || 1),
            perPage: String(perPage || 20),
            subjectType: String(subjectType),
        },
    });
}

async function getSubject(subjectId) {
    return api('/wefeed-tv-bff/subject/get', {
        params: { subjectId: String(subjectId) },
    });
}

async function getPlayInfo(subjectId, season, episode, vipLevel) {
    const params = {
        subjectId: String(subjectId),
        vipLevel: String(vipLevel === undefined || vipLevel === null || vipLevel === '' ? '2' : vipLevel),
    };
    if (season !== undefined && season !== null && season !== '') {
        params.se = String(season);
    }
    if (episode !== undefined && episode !== null && episode !== '') {
        params.ep = String(episode);
    }
    return api('/wefeed-tv-bff/subject/play-info/v2', { params });
}

async function getSeasonInfo(subjectId) {
    return api('/wefeed-tv-bff/subject/season-info', {
        params: { subjectId: String(subjectId) },
    });
}

module.exports = {
    ensureToken,
    search,
    getSubject,
    getPlayInfo,
    getSeasonInfo,
    _getToken: () => authToken,
};
