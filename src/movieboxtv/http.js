// Shared fetch helpers tolerant of the app's non-standard fetch shim:
// responses may be a real Response, { body }, { _bodyText } or a bare string,
// and `ok`/`status`/`json()` are not guaranteed.

function statusOf(res) {
    if (res === null || res === undefined) return 0;
    if (typeof res.status === 'number') return res.status;
    if (typeof res.statusCode === 'number') return res.statusCode;
    if (res.ok === false) return 500;
    return 200;
}

async function readBody(res) {
    if (res === null || res === undefined) return '';
    if (typeof res === 'string') return res;
    if (typeof res.text === 'function') {
        try {
            const t = await res.text();
            if (typeof t === 'string') return t;
        } catch (e) { /* fall through */ }
    }
    if (typeof res.json === 'function') {
        try {
            const j = await res.json();
            if (j !== undefined && j !== null) return JSON.stringify(j);
        } catch (e) { /* fall through */ }
    }
    if (typeof res._bodyText === 'string') return res._bodyText;
    if (typeof res.body === 'string') return res.body;
    if (res.body && typeof res.body === 'object') {
        try { return JSON.stringify(res.body); } catch (e) { /* noop */ }
    }
    return '';
}

async function fetchText(url, init) {
    if (typeof fetch !== 'function') {
        const e = new Error('fetch is not available in this runtime');
        e.code = -2;
        throw e;
    }
    let res;
    try {
        res = await fetch(url, init || {});
    } catch (err) {
        const e = new Error('network error: ' + (err && err.message ? err.message : String(err)));
        e.code = -3;
        throw e;
    }
    const status = statusOf(res);
    const text = await readBody(res);
    return { status: status, text: text };
}

async function fetchJson(url, init) {
    const r = await fetchText(url, init);
    if (!r.text) {
        const e = new Error('empty response (HTTP ' + r.status + ') for ' + url);
        e.code = r.status;
        throw e;
    }
    let data;
    try {
        data = JSON.parse(r.text);
    } catch (err) {
        const e = new Error('non-JSON response (HTTP ' + r.status + ') for ' + url +
            ': ' + String(r.text).slice(0, 120));
        e.code = r.status;
        throw e;
    }
    if (r.status >= 400) {
        const msg = (data && (data.status_message || data.message)) || ('HTTP ' + r.status);
        const e = new Error('HTTP ' + r.status + ' for ' + url + ': ' + msg);
        e.code = r.status;
        throw e;
    }
    return data;
}

module.exports = { statusOf, readBody, fetchText, fetchJson };
