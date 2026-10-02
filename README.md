# nuvio-movieboxtv

Nuvio plugin that pulls streams from the **MovieBox TV** Android app
(`com.community.mbox.tv`, version `1.1.9.0820.03`).

The provider reproduces the app's own API client: it signs every request with
the `x-tr-signature` header (HMAC-MD5 over method/headers/timestamp/path), logs
in as a visitor against `wefeed-tv-bff/user/visitor-login`, then resolves
titles through TMDB → `search/result` → `season-info` → `play-info/v2` on
`https://tv.aoneroom.com`. Results come back as direct MP4 plus HLS renditions
from `*.hakunaymatata.com`.

## Layout

```
manifest.json          Nuvio plugin repository manifest (one scraper)
src/movieboxtv/        Provider source (sign, bff, tmdb, index)
providers/movieboxtv.js  Bundled provider Nuvio actually loads
build.js               esbuild bundle: src/ -> providers/
test.js                Live end-to-end check against the API
server.js              Tiny static host for the Plugin Tester
```

## Usage

```bash
npm install
npm run build     # writes providers/movieboxtv.js
npm test          # verifies 3 titles return playable streams
npm start         # serves manifest.json on port 3000
```

### Install in Nuvio

1. Publish this folder (GitHub raw works fine) or run `npm start` on your LAN.
2. Nuvio → **Settings → Plugins → Add Repository** and paste the manifest URL,
   e.g. `https://raw.githubusercontent.com/<you>/nuvio-movieboxtv/main/manifest.json`.
3. Refresh and enable the **MovieBox TV** provider.

Only sideloaded Nuvio builds support plugins (not app-store builds).

### Local testing

`node server.js` then point **Settings → Developer → Plugin Tester** at
`http://<your-pc-ip>:3000/manifest.json`.
