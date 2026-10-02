// Emulates the Nuvio JS runtime as closely as we can from Node:
//  - no escape()/unescape()
//  - setInterval() returns a plain number (no .unref())
//  - no document/window/navigator
// If the bundle throws while evaluating, getStreams is never exposed.
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'providers', 'movieboxtv.js'), 'utf8');

const sandboxGlobals = {};
for (const name of ['escape', 'unescape', 'document', 'window', 'navigator']) {
    sandboxGlobals[name] = globalThis[name];
    delete globalThis[name];
}
const realSetInterval = globalThis.setInterval;
globalThis.setInterval = () => 1;

const moduleObj = { exports: {} };
let failure = null;
try {
    const fn = new Function(
        'module',
        'exports',
        'fetch',
        'console',
        'setTimeout',
        'clearTimeout',
        code + '\nreturn module.exports;'
    );
    const api = fn(
        moduleObj,
        moduleObj.exports,
        fetch,
        console,
        setTimeout,
        clearTimeout
    );
    if (!api || typeof api.getStreams !== 'function') {
        failure = 'bundle evaluated but getStreams is not a function';
    } else {
        console.log('bundle evaluated cleanly; getStreams is a function');
    }
} catch (e) {
    failure = 'bundle threw during evaluation: ' + (e && e.message ? e.message : String(e));
}

if (failure) {
    console.error('FAIL: ' + failure);
    process.exit(1);
}

// End-to-end call inside the restricted environment.
moduleObj.exports
    .getStreams('268', 'movie', null, null)
    .then((streams) => {
        if (!streams.length || !streams[0].url) {
            console.error('FAIL: getStreams returned no streams in sandboxed runtime');
            process.exitCode = 1;
            return;
        }
        console.log('getStreams -> ' + streams.length + ' stream(s), first title "' + streams[0].title + '"');
        console.log('PASS');
    })
    .catch((e) => {
        console.error('FAIL: getStreams threw ' + (e && e.message ? e.message : e));
        process.exitCode = 1;
    })
    .then(() => {
        globalThis.setInterval = realSetInterval;
        for (const [k, v] of Object.entries(sandboxGlobals)) {
            if (v !== undefined) globalThis[k] = v;
        }
    });
