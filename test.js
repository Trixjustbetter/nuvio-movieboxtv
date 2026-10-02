const provider = require('./providers/movieboxtv.js');

const CASES = [
    { label: 'Movie (Batman 1989)', args: ['268', 'movie', null, null] },
    { label: 'TV (Breaking Bad S01E01)', args: ['1396', 'tv', 1, 1] },
    { label: 'Movie (The Matrix)', args: ['603', 'movie', null, null] },
];

async function run() {
    let failed = 0;
    for (const c of CASES) {
        console.log('\n=== ' + c.label + ' ===');
        try {
            const streams = await provider.getStreams(...c.args);
            if (!streams.length || !streams[0].url) {
                console.error('FAIL: no stream URL returned');
                failed++;
                continue;
            }
            for (const s of streams) {
                console.log('  ' + (s.quality || '?') + '  ' + s.type + '  ' + (s.size || '') + '  ' + s.url.slice(0, 90));
            }
            console.log('OK: ' + streams.length + ' stream(s)');
        } catch (e) {
            console.error('FAIL:', e && e.message ? e.message : e);
            failed++;
        }
    }
    if (failed) process.exitCode = 1;
}

run();
