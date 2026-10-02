var __4khdhub = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/movieboxtv/http.js
  var require_http = __commonJS({
    "src/movieboxtv/http.js"(exports, module) {
      function statusOf(res) {
        if (res === null || res === void 0)
          return 0;
        if (typeof res.status === "number")
          return res.status;
        if (typeof res.statusCode === "number")
          return res.statusCode;
        if (res.ok === false)
          return 500;
        return 200;
      }
      function readBody(res) {
        return __async(this, null, function* () {
          if (res === null || res === void 0)
            return "";
          if (typeof res === "string")
            return res;
          if (typeof res.text === "function") {
            try {
              const t = yield res.text();
              if (typeof t === "string")
                return t;
            } catch (e) {
            }
          }
          if (typeof res.json === "function") {
            try {
              const j = yield res.json();
              if (j !== void 0 && j !== null)
                return JSON.stringify(j);
            } catch (e) {
            }
          }
          if (typeof res._bodyText === "string")
            return res._bodyText;
          if (typeof res.body === "string")
            return res.body;
          if (res.body && typeof res.body === "object") {
            try {
              return JSON.stringify(res.body);
            } catch (e) {
            }
          }
          return "";
        });
      }
      function fetchText(url, init) {
        return __async(this, null, function* () {
          if (typeof fetch !== "function") {
            const e = new Error("fetch is not available in this runtime");
            e.code = -2;
            throw e;
          }
          let res;
          try {
            res = yield fetch(url, init || {});
          } catch (err) {
            const e = new Error("network error: " + (err && err.message ? err.message : String(err)));
            e.code = -3;
            throw e;
          }
          const status = statusOf(res);
          const text = yield readBody(res);
          let finalUrl = url;
          if (res && typeof res.url === "string" && res.url)
            finalUrl = res.url;
          return { status, text, url: finalUrl };
        });
      }
      function fetchJson(url, init) {
        return __async(this, null, function* () {
          const r = yield fetchText(url, init);
          if (!r.text) {
            const e = new Error("empty response (HTTP " + r.status + ") for " + url);
            e.code = r.status;
            throw e;
          }
          let data;
          try {
            data = JSON.parse(r.text);
          } catch (err) {
            const e = new Error("non-JSON response (HTTP " + r.status + ") for " + url + ": " + String(r.text).slice(0, 120));
            e.code = r.status;
            throw e;
          }
          if (r.status >= 400) {
            const msg = data && (data.status_message || data.message) || "HTTP " + r.status;
            const e = new Error("HTTP " + r.status + " for " + url + ": " + msg);
            e.code = r.status;
            throw e;
          }
          return data;
        });
      }
      module.exports = { statusOf, readBody, fetchText, fetchJson };
    }
  });

  // src/movieboxtv/tmdb.js
  var require_tmdb = __commonJS({
    "src/movieboxtv/tmdb.js"(exports, module) {
      var { fetchJson } = require_http();
      var TMDB_API_KEY = "cd85a9c87eb793d68cbf5b492590e1de";
      var cacheStore = {};
      function cacheSet(key, value, ttlMs) {
        cacheStore[key] = { v: value, exp: Date.now() + ttlMs };
      }
      function cacheGet(key) {
        const e = cacheStore[key];
        if (!e)
          return null;
        if (Date.now() > e.exp) {
          delete cacheStore[key];
          return null;
        }
        return e.v;
      }
      function httpGetJson(url) {
        return __async(this, null, function* () {
          return fetchJson(url, { headers: { Accept: "application/json" } });
        });
      }
      function toMeta(data) {
        const dateStr = data.release_date || data.first_air_date || "";
        const meta = {
          title: data.title || data.name || "",
          year: parseInt(String(dateStr).substring(0, 4), 10) || 0
        };
        if (!meta.title)
          throw new Error("TMDB lookup returned no title");
        return meta;
      }
      function getTmdbDetails(tmdbId, mediaType) {
        return __async(this, null, function* () {
          const t = mediaType === "tv" || mediaType === "series" ? "tv" : "movie";
          const idStr = String(tmdbId || "").trim();
          const cacheKey = "tmdb_" + t + "_" + idStr;
          const cached = cacheGet(cacheKey);
          if (cached)
            return cached;
          let data;
          if (/^tt\d+$/i.test(idStr)) {
            const findUrl = "https://api.themoviedb.org/3/find/" + idStr + "?api_key=" + TMDB_API_KEY + "&external_source=imdb_id";
            const res = yield httpGetJson(findUrl);
            let bucket = res[t + "_results"] || [];
            if (!bucket.length)
              bucket = res.movie_results || res.tv_results || [];
            if (!bucket.length)
              throw new Error("TMDB find failed for id " + idStr);
            data = bucket[0];
          } else {
            const url = "https://api.themoviedb.org/3/" + t + "/" + idStr + "?api_key=" + TMDB_API_KEY;
            data = yield httpGetJson(url);
          }
          const meta = toMeta(data);
          cacheSet(cacheKey, meta, 24 * 60 * 60 * 1e3);
          return meta;
        });
      }
      module.exports = { getTmdbDetails, TMDB_API_KEY };
    }
  });

  // src/4khdhub/resolve.js
  var require_resolve = __commonJS({
    "src/4khdhub/resolve.js"(exports, module) {
      var { fetchText, statusOf } = require_http();
      var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
      var REFERER = "https://4khdhub.one/";
      function htmlHeaders(referer) {
        return {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": referer || REFERER
        };
      }
      var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      function b64d(s) {
        const clean = String(s || "").replace(/[^A-Za-z0-9+/=]/g, "");
        const out = [];
        let buf = 0;
        let bits = 0;
        for (let i = 0; i < clean.length; i++) {
          const ch = clean.charAt(i);
          if (ch === "=")
            break;
          const v = B64.indexOf(ch);
          if (v < 0)
            continue;
          buf = buf << 6 | v;
          bits += 6;
          if (bits >= 8) {
            bits -= 8;
            out.push(buf >> bits & 255);
          }
        }
        let str = "";
        for (let i = 0; i < out.length; i++)
          str += String.fromCharCode(out[i]);
        return str;
      }
      function rot13(s) {
        return String(s || "").replace(/[a-zA-Z]/g, function(c) {
          const base = c <= "Z" ? 90 : 122;
          let v = c.charCodeAt(0) + 13;
          if (v > base)
            v -= 26;
          return String.fromCharCode(v);
        });
      }
      function decodeEntities(s) {
        return String(s || "").replace(/&#0?39;|&#8217;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, function(_m, n) {
          const code = parseInt(n, 10);
          if (code < 128)
            return String.fromCharCode(code);
          if (code < 2048) {
            return String.fromCharCode(192 | code >> 6, 128 | code & 63);
          }
          return String.fromCharCode(224 | code >> 12, 128 | code >> 6 & 63, 128 | code & 63);
        }).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      }
      function shortUrl(u) {
        const s = String(u || "");
        return s.length > 90 ? s.slice(0, 90) + "..." : s;
      }
      function getHtml(url, referer) {
        return __async(this, null, function* () {
          const r = yield fetchText(url, { headers: htmlHeaders(referer) });
          if (r.status >= 400)
            throw new Error("HTTP " + r.status + " for " + shortUrl(url));
          if (!r.text)
            throw new Error("empty response for " + shortUrl(url));
          return r;
        });
      }
      function decodeShortLink(html) {
        const m = String(html || "").match(/s\('o','([^']+)'/);
        if (!m)
          return null;
        try {
          const json = b64d(rot13(b64d(b64d(m[1]))));
          const data = JSON.parse(json);
          if (!data || !data.o)
            return null;
          return b64d(data.o);
        } catch (e) {
          return null;
        }
      }
      function collectAnchors(html) {
        const out = [];
        const re = /<a[^>]+href="([^"]+)"/gi;
        let m;
        while ((m = re.exec(String(html || ""))) !== null) {
          const href = decodeEntities(m[1]).trim();
          if (href)
            out.push(href);
        }
        return out;
      }
      function extractLinkParam(url) {
        const m = String(url || "").match(/[?&]link=((?:https?|ftp)%3A[^&]+|https?:[^&]+)/i);
        if (!m)
          return null;
        let v = m[1];
        try {
          v = decodeURIComponent(v);
        } catch (e) {
        }
        return /^https?:\/\//i.test(v) ? v : null;
      }
      function directCandidates(anchors, finalUrl) {
        const all = (anchors || []).concat(finalUrl ? [finalUrl] : []);
        const r2 = [];
        const link = [];
        const ext = [];
        const seen = {};
        for (let i = 0; i < all.length; i++) {
          const u = all[i];
          if (!u || seen[u])
            continue;
          seen[u] = true;
          if (/workers\.dev/i.test(u))
            continue;
          if (/r2\.cloudflarestorage\.com/.test(u)) {
            r2.push(u);
            continue;
          }
          const lp = extractLinkParam(u);
          if (lp && !/gpdl\./.test(lp)) {
            link.push(lp);
            continue;
          }
          if (/\.(mkv|mp4|m4v|avi)(\?|$)/i.test(u) && !/gpdl\./.test(u)) {
            ext.push(u);
            continue;
          }
        }
        return r2.concat(ext, link);
      }
      function isGoogleFile(url) {
        return /googleusercontent\.com/i.test(String(url || ""));
      }
      function looksPlayable(url) {
        return __async(this, null, function* () {
          if (typeof fetch !== "function")
            return true;
          const google = isGoogleFile(url);
          let res;
          try {
            res = google ? yield fetch(url, { method: "HEAD", headers: { "User-Agent": UA, Referer: REFERER } }) : yield fetch(url, { headers: { "User-Agent": UA, Range: "bytes=0-", Referer: REFERER } });
          } catch (e) {
            return false;
          }
          const status = statusOf(res);
          if (status < 200 || status >= 400)
            return false;
          let ct = "";
          try {
            if (res && res.headers && typeof res.headers.get === "function") {
              ct = String(res.headers.get("content-type") || "");
            }
          } catch (e) {
          }
          if (ct && /(json|text\/html)/i.test(ct))
            return false;
          if (google)
            return true;
          try {
            if (res.body) {
              if (typeof res.body.cancel === "function") {
                const p = res.body.cancel();
                if (p && typeof p.catch === "function")
                  p.catch(function() {
                  });
              } else if (typeof res.body.getReader === "function") {
                const rd = res.body.getReader();
                const c = rd.cancel();
                if (c && typeof c.catch === "function")
                  c.catch(function() {
                  });
              }
            }
          } catch (e) {
          }
          return true;
        });
      }
      function firstPlayable(candidates) {
        return __async(this, null, function* () {
          for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            const ok = yield looksPlayable(c);
            if (!ok) {
              console.log("[4KHDHub] skipping unplayable link");
              continue;
            }
            return c;
          }
          return null;
        });
      }
      function pickPixelAnchor(anchors) {
        for (let i = 0; i < (anchors || []).length; i++) {
          const a = anchors[i];
          if (/pixel\.[a-z0-9.-]+\/\?id=/i.test(a))
            return a;
        }
        for (let i = 0; i < (anchors || []).length; i++) {
          if (/\/\?id=[0-9a-f]{60,}/i.test(anchors[i]))
            return anchors[i];
        }
        return null;
      }
      function resolveApiPage(apiUrl, referer) {
        return __async(this, null, function* () {
          const res = yield getHtml(apiUrl, referer);
          const anchors = collectAnchors(res.text);
          const direct = yield firstPlayable(directCandidates(anchors, res.url));
          if (direct)
            return direct;
          const pixel = pickPixelAnchor(anchors);
          if (pixel) {
            try {
              const hop = yield getHtml(pixel, referer);
              const hopDirect = yield firstPlayable(directCandidates(collectAnchors(hop.text), hop.url));
              if (hopDirect)
                return hopDirect;
            } catch (e) {
              console.log("[4KHDHub] pixel hop failed: " + (e && e.message ? e.message : e));
            }
          }
          throw new Error("no direct file on " + shortUrl(apiUrl));
        });
      }
      function isHubcloudDrive(url) {
        return /\/drive\//.test(url);
      }
      function isHubdriveFile(url) {
        return /hubdrive/i.test(url);
      }
      function resolveDrivePage(url) {
        return __async(this, null, function* () {
          const page = yield getHtml(url, "https://4khdhub.one/");
          const anchors = collectAnchors(page.text);
          const selfDirect = yield firstPlayable(directCandidates(anchors, page.url));
          if (selfDirect && selfDirect !== page.url)
            return selfDirect;
          const api = decodeApiUrl(page.text);
          if (!api)
            throw new Error("no link API on " + shortUrl(url));
          return resolveApiPage(api, originOf(url));
        });
      }
      function decodeApiUrl(html) {
        const m = String(html || "").match(/var\s+url\s*=\s*'([^']+)'/);
        if (m)
          return decodeEntities(m[1]);
        const m2 = String(html || "").match(/var\s+url\s*=\s*"([^"]+)"/);
        if (m2)
          return decodeEntities(m2[1]);
        return null;
      }
      function originOf(url) {
        const m = String(url || "").match(/^(https?:\/\/[^/]+)/i);
        return m ? m[1] + "/" : "https://4khdhub.one/";
      }
      function resolveTarget(target, hops) {
        return __async(this, null, function* () {
          if (!target)
            throw new Error("empty target");
          if (hops > 4)
            throw new Error("too many hops for " + shortUrl(target));
          if (/\.(mkv|mp4|m4v|avi)(\?|$)/i.test(target) && !/gpdl\./.test(target) && !/workers\.dev/i.test(target)) {
            if (yield looksPlayable(target))
              return target;
            console.log("[4KHDHub] skipping unplayable file link");
          }
          const page = yield getHtml(target, "https://4khdhub.one/");
          const direct = yield firstPlayable(directCandidates(collectAnchors(page.text), page.url));
          if (direct && /\.cloudflarestorage\.com/.test(direct))
            return direct;
          if (isHubdriveFile(target)) {
            const anchors = collectAnchors(page.text);
            const drive = anchors.filter(function(a) {
              return /\/drive\//.test(a) && a.indexOf("#") !== 0;
            });
            if (drive.length)
              return resolveDrivePage(drive[0]);
            if (direct)
              return direct;
            throw new Error("hubdrive page has no drive link");
          }
          if (isHubcloudDrive(target) || decodeApiUrl(page.text)) {
            return resolveDrivePage(target);
          }
          if (direct)
            return direct;
          throw new Error("unhandled page " + shortUrl(target));
        });
      }
      function resolveShortLink(shortLink) {
        return __async(this, null, function* () {
          const page = yield getHtml(shortLink, "https://4khdhub.one/");
          const target = decodeShortLink(page.text);
          if (!target) {
            const direct = yield firstPlayable(directCandidates(collectAnchors(page.text), page.url));
            if (direct)
              return direct;
            throw new Error("no payload in " + shortUrl(shortLink));
          }
          return resolveTarget(target, 0);
        });
      }
      function normalizeUrl(url) {
        return String(url || "").replace(/ /g, "%20").replace(/\[/g, "%5B").replace(/\]/g, "%5D").replace(/"/g, "%22").replace(/\{/g, "%7B").replace(/\}/g, "%7D").replace(/\|/g, "%7C").replace(/\^/g, "%5E");
      }
      function resolveItem(item, log) {
        return __async(this, null, function* () {
          const mirrors = item.mirrors || [];
          for (let i = 0; i < mirrors.length; i++) {
            try {
              const url = yield resolveShortLink(mirrors[i].url);
              if (url) {
                log("resolved " + item.quality + " via " + (mirrors[i].label || "mirror" + (i + 1)));
                return normalizeUrl(url);
              }
            } catch (e) {
              log("mirror " + (i + 1) + " failed: " + (e && e.message ? e.message : e));
            }
          }
          return null;
        });
      }
      module.exports = {
        UA,
        REFERER,
        htmlHeaders,
        decodeEntities,
        normalizeUrl,
        resolveShortLink,
        resolveItem,
        getHtml
      };
    }
  });

  // src/4khdhub/site.js
  var require_site = __commonJS({
    "src/4khdhub/site.js"(exports, module) {
      var { fetchText } = require_http();
      var { UA, REFERER, decodeEntities } = require_resolve();
      var SITE = "https://4khdhub.one";
      function headers(referer) {
        return {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": referer || SITE + "/"
        };
      }
      function normalize(t) {
        return String(t || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
      }
      function levenshtein(a, b) {
        if (a === b)
          return 0;
        if (!a.length)
          return Math.max(b.length);
        if (!b.length)
          return Math.max(a.length);
        const prev = [];
        for (let j = 0; j <= b.length; j++)
          prev[j] = j;
        for (let i = 1; i <= a.length; i++) {
          const curr = [i];
          for (let j = 1; j <= b.length; j++) {
            curr[j] = Math.min(
              prev[j] + 1,
              curr[j - 1] + 1,
              prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
          }
          for (let j = 0; j <= b.length; j++)
            prev[j] = curr[j];
          prev.length = b.length + 1;
        }
        return prev[b.length];
      }
      function titleScore(query, candidate) {
        const q = normalize(query);
        const c = normalize(candidate);
        if (!q || !c)
          return 0;
        if (q === c)
          return 100;
        if (c.indexOf(q) === 0 || q.indexOf(c) === 0)
          return 90;
        if (c.indexOf(q) !== -1 || q.indexOf(c) !== -1)
          return 80;
        const dist = levenshtein(q, c);
        const ratio = 1 - dist / Math.max(q.length, c.length);
        return ratio >= 0.65 ? Math.round(ratio * 70) : 0;
      }
      function getHtml(url, referer) {
        return __async(this, null, function* () {
          const r = yield fetchText(url, { headers: headers(referer) });
          if (r.status >= 400) {
            throw new Error("HTTP " + r.status + " for " + url);
          }
          if (!r.text)
            throw new Error("empty response for " + url);
          return r;
        });
      }
      function stripTags(s) {
        return String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      }
      function searchCards(query, log) {
        return __async(this, null, function* () {
          const url = SITE + "/?s=" + encodeURIComponent(query);
          const page = yield getHtml(url);
          const cards = [];
          const re = /<a\s+href="([^"]+)"\s+class="movie-card"\s+aria-label="([^"]*)"/gi;
          let m;
          while ((m = re.exec(page.text)) !== null) {
            const href = m[1];
            if (!/-movie-\d+\/$/.test(href) && !/-series-\d+\/$/.test(href))
              continue;
            cards.push({
              url: SITE + href,
              kind: href.indexOf("-series-") !== -1 ? "tv" : "movie",
              title: decodeEntities(m[2]).replace(/\s+details$/i, "").trim()
            });
          }
          log('search "' + query + '" -> ' + cards.length + " card(s)");
          return cards;
        });
      }
      function parsePostTitle(html) {
        const m = String(html || "").match(/<title>([\s\S]*?)<\/title>/i);
        const text = decodeEntities(m ? m[1] : "");
        const y = text.match(/\((19|20)\d{2}\)/);
        return {
          title: text.replace(/\s*-\s*4K-HDHub.*$/i, "").trim(),
          year: y ? parseInt(y[0].replace(/[()]/g, ""), 10) : 0
        };
      }
      function qualityOf(title) {
        const m = String(title || "").match(/\b(2160|1440|1200|1080|720|576|480|360)\s*p\b/i);
        if (m)
          return m[1] + "p";
        if (/\b4k\b/i.test(title))
          return "2160p";
        if (/\bhd\b/i.test(title))
          return "1080p";
        return "";
      }
      function sizeOf(chunk) {
        const a = String(chunk || "").match(/badge-size">\s*([^<]+)</);
        if (a)
          return a[1].trim();
        const b = String(chunk || "").match(/>\s*(\d+(?:\.\d+)?\s*(?:GB|MB))\s*</);
        return b ? b[1].trim() : "";
      }
      function sizeBytes(size) {
        const m = String(size || "").match(/([\d.]+)\s*(GB|MB)/i);
        if (!m)
          return 0;
        const n = parseFloat(m[1]) || 0;
        return /mb/i.test(m[2]) ? n * 1024 * 1024 : n * 1024 * 1024 * 1024;
      }
      function mirrorsOf(chunk) {
        const out = [];
        const re = /<a[^>]+href="(https?:\/\/[^"]+\?id=[A-Za-z0-9+/=]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let m;
        while ((m = re.exec(String(chunk || ""))) !== null) {
          out.push({ url: decodeEntities(m[1]), label: stripTags(m[2]).replace(/&nbsp;/gi, "").trim() });
        }
        return out;
      }
      function numberFrom(str, kind) {
        const s = String(str || "");
        if (kind === "episode") {
          const badge = s.match(/Episode[-\s]?(\d{1,3})/i);
          if (badge)
            return parseInt(badge[1], 10);
          const se2 = s.match(/\bS\d{1,2}\s*E(\d{1,3})\b/i);
          if (se2)
            return parseInt(se2[1], 10);
          return 0;
        }
        const se = s.match(/\bS(\d{1,2})\s*E\d{1,3}\b/i);
        if (se)
          return parseInt(se[1], 10);
        const pack = s.match(/\bS(\d{1,2})\b/i);
        if (pack)
          return parseInt(pack[1], 10);
        return 0;
      }
      function collectBlocks(html, cls, isEpisode, items) {
        const marker = '<div class="' + cls + '">';
        let idx = String(html || "").indexOf(marker);
        while (idx !== -1) {
          const contentStart = idx + marker.length;
          const titleEnd = String(html).indexOf("</div>", contentStart);
          const rawTitle = titleEnd === -1 ? "" : String(html).slice(contentStart, titleEnd);
          const next = String(html).indexOf(marker, contentStart);
          const chunk = String(html).slice(contentStart, next === -1 ? String(html).length : next);
          const title = decodeEntities(stripTags(rawTitle));
          if (title) {
            items.push({
              title,
              chunk,
              quality: qualityOf(title),
              size: sizeOf(chunk),
              season: isEpisode ? numberFrom(title, "season") : 0,
              episode: isEpisode ? numberFrom(chunk, "episode") || numberFrom(title, "episode") : 0,
              mirrors: mirrorsOf(chunk)
            });
          }
          idx = next;
        }
      }
      function parseItems(html) {
        const items = [];
        collectBlocks(html, "file-title", false, items);
        collectBlocks(html, "episode-file-title", true, items);
        return items.filter(function(it) {
          return it.mirrors.length > 0;
        });
      }
      function fetchPost(url) {
        return __async(this, null, function* () {
          const page = yield getHtml(url);
          const meta = parsePostTitle(page.text);
          const items = parseItems(page.text);
          return { url, title: meta.title, year: meta.year, items };
        });
      }
      function findPost(title, year, mediaType, log) {
        return __async(this, null, function* () {
          const want = mediaType === "tv" || mediaType === "series" ? "tv" : "movie";
          const cards = (yield searchCards(title, log)).filter(function(c) {
            return c.kind === want;
          });
          if (!cards.length)
            throw new Error("no " + want + ' result for "' + title + '"');
          cards.forEach(function(c) {
            c.score = titleScore(title, c.title);
          });
          cards.sort(function(a, b) {
            return b.score - a.score;
          });
          const strong = cards.filter(function(c) {
            return c.score >= 95;
          });
          const rest = cards.filter(function(c) {
            return strong.indexOf(c) === -1;
          });
          const candidates = strong.concat(rest).slice(0, 3);
          for (let i = 0; i < candidates.length; i++) {
            const post = yield fetchPost(candidates[i].url);
            log('post "' + post.title + '" (' + (post.year || "?") + ") items=" + post.items.length);
            if (!post.items.length)
              continue;
            const diff = year && post.year ? Math.abs(post.year - year) : 0;
            const sameTitle = normalize(post.title) === normalize(title);
            if (!year || !post.year || diff <= 1 || sameTitle && diff <= 3)
              return post;
            log("year " + post.year + " is not " + year + ", trying next candidate");
          }
          throw new Error('no "' + title + '" (' + (year || "?") + ") on 4khdhub");
        });
      }
      module.exports = {
        SITE,
        headers,
        normalize,
        titleScore,
        sizeBytes,
        searchCards,
        fetchPost,
        findPost,
        parseItems
      };
    }
  });

  // src/4khdhub/index.js
  var require_khdhub = __commonJS({
    "src/4khdhub/index.js"(exports, module) {
      var { getTmdbDetails } = require_tmdb();
      var site = require_site();
      var { resolveItem, UA } = require_resolve();
      var REFERRER = "https://4khdhub.one/";
      var TRACE = [];
      function tr(msg) {
        TRACE.push(msg);
        console.log("[4KHDHub] " + msg);
      }
      function debugRow(msg) {
        const text = String(msg || "unknown").slice(0, 220);
        return {
          title: "4KHDHub \u2022 " + text,
          quality: "DEBUG",
          type: "direct",
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          headers: {}
        };
      }
      var QUALITY_ORDER = { "2160p": 4, "1440p": 3, "1080p": 3, "720p": 2, "576p": 1, "480p": 1, "360p": 1 };
      function qualityRank(q) {
        return QUALITY_ORDER[q] || (q ? 2 : 0);
      }
      function sortItems(items) {
        return items.slice().sort(function(a, b) {
          const qa = qualityRank(a.quality) - qualityRank(b.quality);
          if (qa !== 0)
            return -qa;
          return site.sizeBytes(b.size) - site.sizeBytes(a.size);
        });
      }
      function filterForEpisode(items, season, episode) {
        const wantSeason = Number(season) || 1;
        const wantEp = Number(episode) || 1;
        const exact = items.filter(function(it) {
          return it.episode === wantEp && (it.season === wantSeason || it.season === 0);
        });
        if (exact.length)
          return exact;
        return items.filter(function(it) {
          return it.episode === wantEp;
        });
      }
      function availableLabel(items) {
        const eps = [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].episode)
            eps.push(items[i].season ? "S" + items[i].season + "E" + items[i].episode : "E" + items[i].episode);
        }
        return eps.length ? eps.slice(0, 12).join(",") : "none";
      }
      function mapLimit(items, limit, fn) {
        return __async(this, null, function* () {
          const out = new Array(items.length);
          let cursor = 0;
          function worker() {
            return __async(this, null, function* () {
              for (; ; ) {
                const i = cursor++;
                if (i >= items.length)
                  return;
                out[i] = yield fn(items[i], i);
              }
            });
          }
          const workers = [];
          const n = Math.min(limit, items.length);
          for (let i = 0; i < n; i++)
            workers.push(worker());
          yield Promise.all(workers);
          return out;
        });
      }
      function streamHeaders() {
        return {
          "User-Agent": UA,
          "Referer": REFERRER
        };
      }
      function buildStream(item, url, index) {
        const parts = [];
        if (item.quality)
          parts.push(item.quality);
        if (item.size)
          parts.push(item.size);
        const label = item.mirrors[0] && item.mirrors[0].label;
        if (label)
          parts.push(label.replace(/^Download\s+/i, ""));
        const title = String(item.title || "").replace(/\s+/g, " ").trim();
        if (title && !item.episode)
          parts.push(shortTitle(title));
        return {
          title: pad(index) + ". " + (parts.length ? parts.join(" \u2022 ") : title),
          quality: item.quality || void 0,
          type: "direct",
          url,
          headers: streamHeaders(),
          behaviorHints: {
            bingeGroup: "4khdhub-" + (item.quality || "sd")
          }
        };
      }
      function shortTitle(t) {
        const s = String(t || "").replace(/\s*\((19|20)\d{2}\)/g, "").replace(/\.(mkv|mp4)$/i, "");
        return s.length > 60 ? s.slice(0, 60) + "\u2026" : s;
      }
      function pad(i) {
        const n = i + 1;
        return n < 10 ? "0" + n : String(n);
      }
      function getStreamsForTitle(title, year, mediaType, season, episode) {
        return __async(this, null, function* () {
          const isTv = mediaType === "tv" || mediaType === "series";
          const post = yield site.findPost(title, year, isTv ? "tv" : "movie", tr);
          tr("items=" + post.items.length);
          let items = post.items;
          if (isTv) {
            const matched = filterForEpisode(items, season, episode);
            tr("episode match " + (Number(season) || 1) + "x" + (Number(episode) || 1) + " -> " + matched.length + " (available " + availableLabel(items) + ")");
            if (!matched.length) {
              throw new Error("no S" + (Number(season) || 1) + "E" + (Number(episode) || 1) + ' on "' + post.title + '" (has ' + availableLabel(items) + ")");
            }
            items = matched;
          }
          items = sortItems(items).slice(0, isTv ? 6 : 6);
          tr("resolving " + items.length + " item(s)");
          const urls = yield mapLimit(items, 4, function(item) {
            return resolveItem(item, tr);
          });
          const out = [];
          for (let i = 0; i < items.length; i++) {
            if (urls[i])
              out.push(buildStream(items[i], urls[i], out.length));
          }
          return out;
        });
      }
      function resolve(tmdbId, mediaType, season, episode) {
        return __async(this, null, function* () {
          TRACE = [];
          const mt = mediaType === "tv" || mediaType === "series" ? "tv" : "movie";
          tr("call tmdb=" + tmdbId + " type=" + mt + " s" + season + "e" + episode);
          const meta = yield getTmdbDetails(tmdbId, mt);
          if (!meta || !meta.title)
            throw new Error("TMDB lookup failed for id " + tmdbId);
          tr('tmdb "' + meta.title + '" ' + (meta.year || "?"));
          const streams = yield getStreamsForTitle(meta.title, meta.year, mt, season, episode);
          tr("done " + streams.length + " stream(s)");
          if (!streams.length) {
            return [debugRow("no sources | " + TRACE.join(" > "))];
          }
          return streams;
        });
      }
      var api = {
        getStreams(tmdbId, mediaType, season, episode) {
          return resolve(tmdbId, mediaType, season, episode).catch(function(err) {
            const msg = err && err.message ? err.message : String(err);
            console.error("[4KHDHub] Error:", msg);
            return [debugRow("error: " + msg + " | " + TRACE.join(" > "))];
          });
        },
        _internal: {
          getStreamsForTitle,
          sortItems,
          filterForEpisode,
          clearCaches() {
          }
        }
      };
      module.exports = api;
    }
  });
  return require_khdhub();
})();

console.log("[4KHDHub] provider v1.0.1 loaded");
if (typeof module !== "undefined" && module.exports) { module.exports = __4khdhub; }
if (typeof globalThis !== "undefined") { globalThis.getStreams = __4khdhub.getStreams; }
if (typeof global !== "undefined") { global.getStreams = __4khdhub.getStreams; }
if (typeof self !== "undefined") { self.getStreams = __4khdhub.getStreams; }

