const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'providers');

const targets = [
    { src: 'movieboxtv', out: 'movieboxtv.js', global: '__movieboxtv', version: '1.2.1', label: 'MovieBox TV' },
    { src: '4khdhub', out: '4khdhub.js', global: '__4khdhub', version: '1.0.0', label: '4KHDHub' },
];

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const t of targets) {
    const srcDir = path.join(__dirname, 'src', t.src);
    if (!fs.existsSync(srcDir)) {
        console.error('src/' + t.src + ' not found');
        process.exit(1);
    }

    esbuild.buildSync({
        entryPoints: [path.join(srcDir, 'index.js')],
        bundle: true,
        outfile: path.join(outDir, t.out),
        format: 'iife',
        platform: 'browser',
        target: 'es2016',
        minify: process.argv.includes('--minify'),
        sourcemap: false,
        globalName: t.global,
        footer: {
            js: '\nconsole.log("[' + t.label + '] provider v' + t.version + ' loaded");\n' +
                'if (typeof module !== "undefined" && module.exports) { module.exports = ' + t.global + '; }\n' +
                'if (typeof globalThis !== "undefined") { globalThis.getStreams = ' + t.global + '.getStreams; }\n' +
                'if (typeof global !== "undefined") { global.getStreams = ' + t.global + '.getStreams; }\n' +
                'if (typeof self !== "undefined") { self.getStreams = ' + t.global + '.getStreams; }\n',
        },
        logLevel: 'warning',
    });

    const stats = fs.statSync(path.join(outDir, t.out));
    console.log('providers/' + t.out + ' (' + (stats.size / 1024).toFixed(1) + ' KB)');
}
