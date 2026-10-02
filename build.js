const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'movieboxtv');
const outDir = path.join(__dirname, 'providers');
const outFile = path.join(outDir, 'movieboxtv.js');

if (!fs.existsSync(srcDir)) {
    console.error('src/movieboxtv not found');
    process.exit(1);
}
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

esbuild.buildSync({
    entryPoints: [path.join(srcDir, 'index.js')],
    bundle: true,
    outfile: outFile,
    format: 'iife',
    platform: 'browser',
    target: 'es2016',
    minify: process.argv.includes('--minify'),
    sourcemap: false,
    globalName: '__movieboxtv',
    footer: {
        js: '\nconsole.log("[MovieBox TV] provider v1.2.0 loaded");\n' +
            'if (typeof module !== "undefined" && module.exports) { module.exports = __movieboxtv; }\n' +
            'if (typeof globalThis !== "undefined") { globalThis.getStreams = __movieboxtv.getStreams; }\n' +
            'if (typeof global !== "undefined") { global.getStreams = __movieboxtv.getStreams; }\n' +
            'if (typeof self !== "undefined") { self.getStreams = __movieboxtv.getStreams; }\n',
    },
    logLevel: 'warning',
});

const stats = fs.statSync(outFile);
console.log('providers/movieboxtv.js (' + (stats.size / 1024).toFixed(1) + ' KB)');
