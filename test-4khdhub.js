const provider = require('./providers/4khdhub.js');

const CASES = [
    { label: 'Movie (Hacksaw Ridge 2016)', args: ['324786', 'movie', null, null] },
    { label: 'TV (Severance S01E01)', args: ['95396', 'tv', 1, 1] },
    { label: 'Movie (Dune Part Two 2024)', args: ['693134', 'movie', null, null] },
    { label: 'TV (Reacher S01E01 - 4K worker case)', args: ['108978', 'tv', 1, 1] },
    { label: 'Movie (Goosebumps 2015 - 4K worker case)', args: ['257445', 'movie', null, null] },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0';
const SEEK_AT = 1048576;

function isRow(s) {
    return !!(s && s.url) && s.quality !== 'DEBUG';
}

function isGoogleUrl(u) {
    return /googleusercontent\.com/i.test(String(u || ''));
}

// One request with an explicit byte range, then cancel: hosts that ignore
// Range answer the whole file and must not be pulled into the test.
async function probe(url, range) {
    let res;
    try {
        res = await fetch(url, {
            headers: {
                'User-Agent': UA,
                Range: range,
                Referer: 'https://4khdhub.one/',
            },
        });
    } catch (e) {
        return { status: 0, ct: '', head: 'fetch error: ' + (e.message || e) };
    }
    const ct = String(res.headers.get('content-type') || '');
    const err = String(res.headers.get('x-error-message') || '');
    try {
        if (res.body && typeof res.body.getReader === 'function') {
            const reader = res.body.getReader();
            const chunk = await reader.read();
            try { await reader.cancel(); } catch (e) { /* noop */ }
            const buf = Buffer.from(chunk.value || []);
            return { status: res.status, ct, head: buf.slice(0, 8).toString('hex'), err };
        }
        return { status: res.status, ct, head: '(no stream reader)', err };
    } catch (e) {
        return { status: res.status, ct, head: 'read error: ' + (e.message || e), err };
    }
}

function looksLikeVideo(p) {
    if (p.status !== 200 && p.status !== 206) return false;
    if (/html|json/i.test(p.ct) && !/video/i.test(p.ct)) return false;
    if (p.head.indexOf('1a45dfa3') === 0) return true; // Matroska
    if (p.head.indexOf('000000') === 0 && (p.ct || '').indexOf('mp4') !== -1) return true;
    if ((p.ct || '').indexOf('video') !== -1) return true;
    if ((p.ct || '').indexOf('octet-stream') !== -1) return true;
    return false;
}

async function run() {
    let failed = 0;
    for (const c of CASES) {
        console.log('\n=== ' + c.label + ' ===');
        try {
            const streams = await provider.getStreams(...c.args);
            const rows = streams.filter(isRow);
            if (!rows.length) {
                console.error('FAIL: ' + streams.length + ' row(s) but no usable url');
                streams.forEach((s) => console.log('  !! ' + s.title));
                failed++;
                continue;
            }
            let good = 0;
            let seekBad = 0;
            for (let i = 0; i < rows.length; i++) {
                const s = rows[i];
                // what a player sends when it opens the file
                const p = await probe(s.url, 'bytes=0-');
                const ok = looksLikeVideo(p);
                if (ok) good++;
                console.log((ok ? '  ok  ' : '  BAD ') + (s.quality || '?') + ' | ' + s.title);
                console.log('        open  HTTP ' + p.status + ' ct=' + p.ct + ' head=' + p.head +
                    (p.err ? ' err=' + p.err : ''));
                if (!ok) continue;

                if (isGoogleUrl(s.url)) {
                    // Google download links ignore Range: plays, but no seeking
                    console.log('        seek  skipped (host ignores Range)');
                    continue;
                }
                const q = await probe(s.url, 'bytes=' + SEEK_AT + '-' + (SEEK_AT + 63));
                const seeks = q.status === 206;
                if (!seeks) seekBad++;
                console.log((seeks ? '        seek  206 ok' : '        seek  BAD HTTP ' + q.status));
            }
            if (!good) {
                console.error('FAIL: no stream served video bytes');
                failed++;
            } else if (good !== rows.length) {
                console.error('FAIL: ' + (rows.length - good) + ' stream(s) would not open in a player');
                failed++;
            } else if (seekBad) {
                console.error('FAIL: ' + seekBad + ' stream(s) cannot be seeked');
                failed++;
            } else {
                console.log('OK: ' + good + '/' + rows.length + ' stream(s) openable');
            }
        } catch (e) {
            console.error('FAIL:', e && e.message ? e.message : e);
            failed++;
        }
    }
    if (failed) {
        console.error('\n' + failed + ' case(s) failed');
        process.exitCode = 1;
    } else {
        console.log('\nall cases passed');
    }
}

run();
