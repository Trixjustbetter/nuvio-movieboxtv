const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const TYPES = {
    '.json': 'application/json',
    '.js': 'application/javascript',
    '.png': 'image/png',
};

http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? 'manifest.json' : urlPath.replace(/^\/+/, '');
    const file = path.join(ROOT, rel);

    if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
    }
    fs.readFile(file, (err, buf) => {
        if (err) {
            res.writeHead(404);
            res.end('not found');
            return;
        }
        res.writeHead(200, {
            'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
        });
        res.end(buf);
    });
}).listen(PORT, () => {
    console.log('Nuvio plugin repo: http://<your-lan-ip>:' + PORT + '/manifest.json');
});
