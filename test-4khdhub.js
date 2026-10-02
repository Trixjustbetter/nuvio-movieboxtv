const provider = require('./providers/4khdhub.js');

const CASES = [
    { label: 'Movie (Hacksaw Ridge 2016)', args: ['324786', 'movie', null, null] },
    { label: 'TV (Severance S01E01)', args: ['95396', 'tv', 1, 1] },
    { label: 'Movie (Dune Part Two 2024)', args: ['693134', 'movie', null, null] },
];

function isRow(s) {
    return !!(s && s.url) && s.quality !== 'DEBUG';
}

// Read only the first bytes, then cancel, so a server that ignores Range
// does not stream a whole 7 GB file into the test.
async function probe(url) {
    let res;
    try {
        res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0',
                Range: 'bytes=0-31',
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
    if (p.head.indexOf('1a45dfa3') === 0) return true; // Matroska
    if (p.head.indexOf('000000') === 0 && (p.ct || '').indexOf('mp4') !== -1) return true;
    if ((p.ct || '').indexOf('video') !== -1) return true;
    if ((p.ct || '').indexOf('octet-stream') !== -1 && !/html/i.test(p.ct)) return true;
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
            for (let i = 0; i < rows.length; i++) {
                const s = rows[i];
                const p = await probe(s.url);
                const ok = looksLikeVideo(p);
                if (ok) good++;
                console.log((ok ? '  ok  ' : '  BAD ') + (s.quality || '?') + ' | ' + s.title);
                console.log('        HTTP ' + p.status + ' ct=' + p.ct + ' head=' + p.head +
                    (p.err ? ' err=' + p.err : ''));
                console.log('        ' + s.url.slice(0, 110) + (s.url.length > 110 ? '...' : ''));
            }
            if (!good) {
                console.error('FAIL: no stream served video bytes');
                failed++;
            } else {
                console.log('OK: ' + good + '/' + rows.length + ' stream(s) playable');
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
