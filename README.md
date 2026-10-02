# nuvio-movieboxtv

Nuvio providers for **MovieBox TV** and **4KHDHub**.

## Sources

### 1. MovieBox TV

Reproduces the `com.community.mbox.tv` (v1.1.9.0820.03) API client: signs every
request with `x-tr-signature` (HMAC-MD5 over method/headers/timestamp/path),
logs in as a visitor against `wefeed-tv-bff/user/visitor-login`, then resolves
titles through TMDB → `search/result` → `season-info` → `play-info/v2` on
`https://tv.aoneroom.com`. Results are direct MP4 plus HLS renditions from
`*.hakunaymatata.com`.

### 2. 4KHDHub

Scraper for `https://4khdhub.one/` (movies + series). Flow per title:

```
TMDB → /?s=<title> → post page (file-title / episode-file-title blocks)
     → greenmotors.club/?id=…   (b64(b64(x)) → rot13 → b64 → JSON.o → b64)
     → hubcloud.ist/drive/<id>  (var url = …hubcloud.php?…)
     → signed direct .mkv  (r2.cloudflarestorage / worker blob / googleusercontent)
```

Series posts are filtered to the requested `SxxEyy` before resolving; mirrors
(HubCloud then HubDrive) are tried in order and dead worker blobs are probed
and skipped.

## Layout

```
manifest.json            Nuvio repository manifest (two scrapers)
src/movieboxtv/          MovieBox source (sign, bff, tmdb, http, index)
src/4khdhub/             4KHDHub source (site, resolve, index)
providers/*.js           Bundled providers Nuvio actually loads
build.js                 esbuild bundle: src/<name>/ -> providers/<name>.js
test.js                  Live MovieBox end-to-end check
test-4khdhub.js          Live 4KHDHub end-to-end check + stream probes
test-runtime.js          Evaluates both bundles in a restricted runtime
server.js                Tiny static host for the Plugin Tester
```

## Usage

```bash
npm install
npm run build             # writes providers/movieboxtv.js + providers/4khdhub.js
npm test                  # both live providers
npm run test:runtime      # sandbox evaluation check
npm start                 # serves manifest.json on port 3000
```

### Install in Nuvio

1. Publish this folder (GitHub raw works fine) or run `npm start` on your LAN.
2. Nuvio → **Settings → Plugins → Add Repository** and paste the manifest URL,
   e.g. `https://raw.githubusercontent.com/<you>/nuvio-movieboxtv/main/manifest.json`.
3. Refresh and enable **MovieBox TV** and/or **4KHDHub**.

Only sideloaded Nuvio builds support plugins (not app-store builds).
raw.githubusercontent.com caches for ~5 minutes — remove and re-add the
repository after pushing a new version.

### Local testing

`node server.js` then point **Settings → Developer → Plugin Tester** at
`http://<your-pc-ip>:3000/manifest.json`.
