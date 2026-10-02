// Emulates the Nuvio JS runtime as closely as we can from Node:
//  - no escape()/unescape()
//  - setInterval() returns a plain number (no .unref())
//  - no document/window/navigator
// If a bundle throws while evaluating, getStreams is never exposed.
const fs = require('fs');
const path = require('path');

const TARGETS = [
    { file: 'movieboxtv.js', args: ['268', 'movie', null, null] },
    { file: '4khdhub.js', args: ['324786', 'movie', null, null] },
];

const sandboxGlobals = {};
for (const name of ['escape', 'unescape', 'document', 'window', 'navigator']) {
    sandboxGlobals[name] = globalThis[name];
    delete globalThis[name];
}
const realSetInterval = globalThis.setInterval;
globalThis.setInterval = () => 1;

function restore() {
    globalThis.setInterval = realSetInterval;
    for (const [k, v] of Object.entries(sandboxGlobals)) {
        if (v !== undefined) globalThis[k] = v;
    }
}

function evaluate(file) {
    const code = fs.readFileSync(path.join(__dirname, 'providers', file), 'utf8');
    const moduleObj = { exports: {} };
    const fn = new Function(
        'module',
        'exports',
        'fetch',
        'console',
        'setTimeout',
        'clearTimeout',
        code + '\nreturn module.exports;'
    );
    const api = fn(moduleObj, moduleObj.exports, fetch, console, setTimeout, clearTimeout);
    if (!api || typeof api.getStreams !== 'function') {
        throw new Error('bundle evaluated but getStreams is not a function');
    }
    return api;
}

async function run() {
    let failed = 0;
    for (const t of TARGETS) {
        console.log('\n=== ' + t.file + ' ===');
        try {
            const api = evaluate(t.file);
            console.log('bundle evaluated cleanly; getStreams is a function');
            const streams = await api.getStreams(...t.args);
            if (!streams.length || !streams[0].url) {
                throw new Error('getStreams returned no streams in sandboxed runtime');
            }
            console.log('getStreams -> ' + streams.length + ' stream(s), first title "' + streams[0].title + '"');
        } catch (e) {
            console.error('FAIL: ' + (e && e.message ? e.message : String(e)));
            failed++;
        }
    }
    restore();
    if (failed) {
        console.error('\n' + failed + ' bundle(s) failed');
        process.exitCode = 1;
    } else {
        console.log('\nPASS');
    }
}

run();
