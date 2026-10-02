var __movieboxtv = (() => {
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

  // src/movieboxtv/sign.js
  var require_sign = __commonJS({
    "src/movieboxtv/sign.js"(exports, module) {
      var BASE = "https://tv.aoneroom.com";
      var HOST_Q = "api6.aoneroom.com";
      var SECRET_B64 = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";
      function b64decode(str) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        const lookup = {};
        for (let i = 0; i < chars.length; i++)
          lookup[chars.charAt(i)] = i;
        str = String(str).replace(/=+$/, "");
        let bits = 0;
        let bitCount = 0;
        const out = [];
        for (let i = 0; i < str.length; i++) {
          const c = str.charAt(i);
          const val = lookup[c];
          if (val === void 0)
            continue;
          bits = bits << 6 | val;
          bitCount += 6;
          if (bitCount >= 8) {
            bitCount -= 8;
            out.push(bits >> bitCount & 255);
          }
        }
        return out;
      }
      function b64encode(bytes) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let out = "";
        for (let i = 0; i < bytes.length; i += 3) {
          const b0 = bytes[i];
          const b1 = bytes[i + 1];
          const b2 = bytes[i + 2];
          out += chars.charAt(b0 >> 2);
          out += chars.charAt((b0 & 3) << 4 | (b1 === void 0 ? 0 : b1) >> 4);
          out += b1 === void 0 ? "=" : chars.charAt((b1 & 15) << 2 | (b2 === void 0 ? 0 : b2) >> 6);
          out += b2 === void 0 ? "=" : chars.charAt(b2 & 63);
        }
        return out;
      }
      function utf8Bytes(str) {
        const s = unescape(encodeURIComponent(String(str)));
        const out = [];
        for (let i = 0; i < s.length; i++)
          out.push(s.charCodeAt(i) & 255);
        return out;
      }
      function md5(input) {
        let bytes = input;
        if (typeof input === "string")
          bytes = utf8Bytes(input);
        function safeAdd(x, y) {
          const lsw = (x & 65535) + (y & 65535);
          const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
          return msw << 16 | lsw & 65535;
        }
        function rol(n, c) {
          return n << c | n >>> 32 - c;
        }
        function cmn(q, a, b, x, s, t) {
          return safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
        }
        function ff(a, b, c, d, x, s, t) {
          return cmn(b & c | ~b & d, a, b, x, s, t);
        }
        function gg(a, b, c, d, x, s, t) {
          return cmn(b & d | c & ~d, a, b, x, s, t);
        }
        function hh(a, b, c, d, x, s, t) {
          return cmn(b ^ c ^ d, a, b, x, s, t);
        }
        function ii(a, b, c, d, x, s, t) {
          return cmn(c ^ (b | ~d), a, b, x, s, t);
        }
        const msg = bytes.slice();
        const originalLen = msg.length;
        msg.push(128);
        while (msg.length % 64 !== 56)
          msg.push(0);
        const bitLen = originalLen * 8;
        msg.push(bitLen & 255);
        msg.push(bitLen >>> 8 & 255);
        msg.push(bitLen >>> 16 & 255);
        msg.push(bitLen >>> 24 & 255);
        for (let i = 0; i < 4; i++)
          msg.push(0);
        let a0 = 1732584193;
        let b0 = 4023233417;
        let c0 = 2562383102;
        let d0 = 271733878;
        for (let i = 0; i < msg.length; i += 64) {
          const x = [];
          for (let j = 0; j < 16; j++) {
            x[j] = msg[i + j * 4] | msg[i + j * 4 + 1] << 8 | msg[i + j * 4 + 2] << 16 | msg[i + j * 4 + 3] << 24;
          }
          let a = a0, b = b0, c = c0, d = d0;
          a = ff(a, b, c, d, x[0], 7, 3614090360);
          d = ff(d, a, b, c, x[1], 12, 3905402710);
          c = ff(c, d, a, b, x[2], 17, 606105819);
          b = ff(b, c, d, a, x[3], 22, 3250441966);
          a = ff(a, b, c, d, x[4], 7, 4118548399);
          d = ff(d, a, b, c, x[5], 12, 1200080426);
          c = ff(c, d, a, b, x[6], 17, 2821735955);
          b = ff(b, c, d, a, x[7], 22, 4249261313);
          a = ff(a, b, c, d, x[8], 7, 1770035416);
          d = ff(d, a, b, c, x[9], 12, 2336552879);
          c = ff(c, d, a, b, x[10], 17, 4294925233);
          b = ff(b, c, d, a, x[11], 22, 2304563134);
          a = ff(a, b, c, d, x[12], 7, 1804603682);
          d = ff(d, a, b, c, x[13], 12, 4254626195);
          c = ff(c, d, a, b, x[14], 17, 2792965006);
          b = ff(b, c, d, a, x[15], 22, 1236535329);
          a = gg(a, b, c, d, x[1], 5, 4129170786);
          d = gg(d, a, b, c, x[6], 9, 3225465664);
          c = gg(c, d, a, b, x[11], 14, 643717713);
          b = gg(b, c, d, a, x[0], 20, 3921069994);
          a = gg(a, b, c, d, x[5], 5, 3593408605);
          d = gg(d, a, b, c, x[10], 9, 38016083);
          c = gg(c, d, a, b, x[15], 14, 3634488961);
          b = gg(b, c, d, a, x[4], 20, 3889429448);
          a = gg(a, b, c, d, x[9], 5, 568446438);
          d = gg(d, a, b, c, x[14], 9, 3275163606);
          c = gg(c, d, a, b, x[3], 14, 4107603335);
          b = gg(b, c, d, a, x[8], 20, 1163531501);
          a = gg(a, b, c, d, x[13], 5, 2850285829);
          d = gg(d, a, b, c, x[2], 9, 4243563512);
          c = gg(c, d, a, b, x[7], 14, 1735328473);
          b = gg(b, c, d, a, x[12], 20, 2368359562);
          a = hh(a, b, c, d, x[5], 4, 4294588738);
          d = hh(d, a, b, c, x[8], 11, 2272392833);
          c = hh(c, d, a, b, x[11], 16, 1839030562);
          b = hh(b, c, d, a, x[14], 23, 4259657740);
          a = hh(a, b, c, d, x[1], 4, 2763975236);
          d = hh(d, a, b, c, x[4], 11, 1272893353);
          c = hh(c, d, a, b, x[7], 16, 4139469664);
          b = hh(b, c, d, a, x[10], 23, 3200236656);
          a = hh(a, b, c, d, x[13], 4, 681279174);
          d = hh(d, a, b, c, x[0], 11, 3936430074);
          c = hh(c, d, a, b, x[3], 16, 3572445317);
          b = hh(b, c, d, a, x[6], 23, 76029189);
          a = hh(a, b, c, d, x[9], 4, 3654602809);
          d = hh(d, a, b, c, x[12], 11, 3873151461);
          c = hh(c, d, a, b, x[15], 16, 530742520);
          b = hh(b, c, d, a, x[2], 23, 3299628645);
          a = ii(a, b, c, d, x[0], 6, 4096336452);
          d = ii(d, a, b, c, x[7], 10, 1126891415);
          c = ii(c, d, a, b, x[14], 15, 2878612391);
          b = ii(b, c, d, a, x[5], 21, 4237533241);
          a = ii(a, b, c, d, x[12], 6, 1700485571);
          d = ii(d, a, b, c, x[3], 10, 2399980690);
          c = ii(c, d, a, b, x[10], 15, 4293915773);
          b = ii(b, c, d, a, x[1], 21, 2240044497);
          a = ii(a, b, c, d, x[8], 6, 1873313359);
          d = ii(d, a, b, c, x[15], 10, 4264355552);
          c = ii(c, d, a, b, x[6], 15, 2734768916);
          b = ii(b, c, d, a, x[13], 21, 1309151649);
          a = ii(a, b, c, d, x[4], 6, 4149444226);
          d = ii(d, a, b, c, x[11], 10, 3174756917);
          c = ii(c, d, a, b, x[2], 15, 718787259);
          b = ii(b, c, d, a, x[9], 21, 3951481745);
          a0 = safeAdd(a0, a);
          b0 = safeAdd(b0, b);
          c0 = safeAdd(c0, c);
          d0 = safeAdd(d0, d);
        }
        function toLE(n) {
          return [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
        }
        return toLE(a0).concat(toLE(b0)).concat(toLE(c0)).concat(toLE(d0));
      }
      function hex(bytes) {
        let out = "";
        for (let i = 0; i < bytes.length; i++) {
          out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
        }
        return out;
      }
      function hmacMd5(keyBytes, msgBytes) {
        let key = keyBytes.slice();
        if (key.length > 64)
          key = md5(key);
        while (key.length < 64)
          key.push(0);
        const ipad = [];
        const opad = [];
        for (let i = 0; i < 64; i++) {
          ipad.push(key[i] ^ 54);
          opad.push(key[i] ^ 92);
        }
        return md5(opad.concat(md5(ipad.concat(msgBytes))));
      }
      function sortQuery(query) {
        if (!query)
          return "";
        const pairs = [];
        const parts = query.split("&");
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (!part)
            continue;
          const eq = part.indexOf("=");
          const rawK = eq < 0 ? part : part.slice(0, eq);
          const rawV = eq < 0 ? "" : part.slice(eq + 1);
          const k = decodeURIComponent(rawK.replace(/\+/g, " "));
          const v = decodeURIComponent(rawV.replace(/\+/g, " "));
          if (k)
            pairs.push([k, v]);
        }
        pairs.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
        let out = "";
        for (let i = 0; i < pairs.length; i++) {
          if (i)
            out += "&";
          out += pairs[i][0] + "=" + pairs[i][1];
        }
        return out;
      }
      function encodeQuery(params) {
        if (!params)
          return "";
        const keys = Object.keys(params);
        const sorted = keys.slice().sort();
        let out = "";
        for (let i = 0; i < sorted.length; i++) {
          if (i)
            out += "&";
          out += encodeURIComponent(sorted[i]) + "=" + encodeURIComponent(String(params[sorted[i]]));
        }
        return out;
      }
      function contentMd5(body) {
        if (!body)
          return "";
        return hex(md5(body));
      }
      function stringToSign(method, accept, ctype, body, ts, pathWithQuery) {
        const clen = body ? String(utf8Bytes(body).length) : "";
        const md5Hex = contentMd5(body);
        return [
          method.toUpperCase(),
          accept || "",
          ctype || "",
          clen,
          String(ts),
          md5Hex,
          pathWithQuery
        ].join("\n");
      }
      function sign(method, accept, ctype, urlPath, query, body) {
        const bodyText = body || "";
        const ts = Date.now();
        const sq = sortQuery(query);
        const pq = urlPath + (sq ? "?" + sq : "");
        const sts = stringToSign(method, accept, ctype, bodyText, ts, pq);
        const mac = hmacMd5(b64decode(SECRET_B64), utf8Bytes(sts));
        return ts + "|1|" + b64encode(mac);
      }
      function clientToken() {
        const ts = String(Date.now());
        const reversed = ts.split("").reverse().join("");
        const md5Hex = hex(md5(reversed));
        return ts + "," + md5Hex;
      }
      function clientInfo() {
        const info = {
          package_name: "com.movieboxtv.app",
          version_name: "1.1.9.0820.03",
          version_code: 1010908203,
          os: "android",
          os_version: "14",
          device_id: "aaaaaaaaaaaaaaaa",
          brand: "samsung",
          model: "SM-S918B",
          system_language: "en",
          net: "wifi",
          region: "US",
          timezone: "UTC",
          sp_code: "US"
        };
        return JSON.stringify(info);
      }
      function buildHeaders(method, path, query, body, token) {
        const accept = "application/json";
        const ctype = "application/json";
        const headers = {
          "User-Agent": "okhttp/4.12.0",
          Accept: accept,
          "Content-Type": ctype,
          "x-tr-signature": sign(method, accept, ctype, path, query || "", body || ""),
          "X-Client-Token": clientToken(),
          "X-Client-Info": clientInfo(),
          "X-Client-Status": "1"
        };
        if (token)
          headers.Authorization = "Bearer " + token;
        return headers;
      }
      module.exports = {
        BASE,
        HOST_Q,
        sortQuery,
        encodeQuery,
        contentMd5,
        sign,
        clientToken,
        clientInfo,
        buildHeaders,
        md5,
        hmacMd5,
        b64encode,
        b64decode
      };
    }
  });

  // src/movieboxtv/bff.js
  var require_bff = __commonJS({
    "src/movieboxtv/bff.js"(exports, module) {
      var { BASE, HOST_Q, encodeQuery, buildHeaders, b64decode } = require_sign();
      var authToken = null;
      var tokenExpMs = 0;
      var tokenPromise = null;
      function b64ToUtf8(b64) {
        const bytes = b64decode(b64);
        let s = "";
        for (let i = 0; i < bytes.length; i++)
          s += String.fromCharCode(bytes[i]);
        try {
          return decodeURIComponent(escape(s));
        } catch (e) {
          return s;
        }
      }
      function decodeJwtExp(token) {
        try {
          const parts = token.split(".");
          if (parts.length < 2)
            return 0;
          let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
          while (b64.length % 4)
            b64 += "=";
          const payload = JSON.parse(b64ToUtf8(b64));
          return (payload.exp || 0) * 1e3;
        } catch (e) {
          return 0;
        }
      }
      function call(path, options) {
        return __async(this, null, function* () {
          const opts = options || {};
          const method = opts.method || "GET";
          const params = Object.assign({}, opts.params || {});
          if (params.host === void 0)
            params.host = HOST_Q;
          const query = encodeQuery(params);
          const body = opts.data !== void 0 && opts.data !== null ? JSON.stringify(opts.data) : "";
          const headers = buildHeaders(method, path, query, body, authToken);
          let url = BASE + path;
          if (query)
            url += "?" + query;
          const init = { method, headers };
          if (method !== "GET" && method !== "HEAD")
            init.body = body;
          const res = yield fetch(url, init);
          let data = null;
          const text = yield res.text();
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (e) {
              data = { code: -1, message: text.slice(0, 200) };
            }
          }
          if (!res.ok && data && data.code === void 0) {
            data = { code: res.status, message: data && data.message || "HTTP " + res.status };
          }
          return data;
        });
      }
      function ensureToken() {
        return __async(this, null, function* () {
          if (authToken && Date.now() < tokenExpMs - 6e4)
            return authToken;
          if (!tokenPromise) {
            tokenPromise = call("/wefeed-tv-bff/user/visitor-login", {
              method: "POST",
              data: {}
            }).then((data) => {
              if (!data || data.code !== 0 || !data.data || !data.data.token) {
                throw new Error("visitor-login failed: " + (data && data.message || "no token"));
              }
              authToken = data.data.token;
              const exp = decodeJwtExp(authToken);
              tokenExpMs = exp > 0 ? exp : Date.now() + 12 * 60 * 60 * 1e3;
              return authToken;
            }).finally(() => {
              tokenPromise = null;
            });
          }
          return tokenPromise;
        });
      }
      function api(path, options) {
        return __async(this, null, function* () {
          yield ensureToken();
          let data = yield call(path, options);
          if (data && (data.code === 401 || /jwt/i.test(String(data.message || "")))) {
            authToken = null;
            tokenExpMs = 0;
            yield ensureToken();
            data = yield call(path, options);
          }
          if (!data || data.code !== 0) {
            const msg = data && (data.message || data.msg) || "request failed";
            const err = new Error(path + ": " + msg + " (code=" + (data && data.code) + ")");
            err.code = data && data.code;
            throw err;
          }
          return data.data;
        });
      }
      function search(keyword, subjectType, page, perPage) {
        return __async(this, null, function* () {
          return api("/wefeed-tv-bff/search/result", {
            params: {
              keyword,
              page: String(page || 1),
              perPage: String(perPage || 20),
              subjectType: String(subjectType)
            }
          });
        });
      }
      function getSubject(subjectId) {
        return __async(this, null, function* () {
          return api("/wefeed-tv-bff/subject/get", {
            params: { subjectId: String(subjectId) }
          });
        });
      }
      function getPlayInfo(subjectId, season, episode, vipLevel) {
        return __async(this, null, function* () {
          const params = {
            subjectId: String(subjectId),
            vipLevel: String(vipLevel === void 0 || vipLevel === null || vipLevel === "" ? "2" : vipLevel)
          };
          if (season !== void 0 && season !== null && season !== "") {
            params.se = String(season);
          }
          if (episode !== void 0 && episode !== null && episode !== "") {
            params.ep = String(episode);
          }
          return api("/wefeed-tv-bff/subject/play-info/v2", { params });
        });
      }
      function getSeasonInfo(subjectId) {
        return __async(this, null, function* () {
          return api("/wefeed-tv-bff/subject/season-info", {
            params: { subjectId: String(subjectId) }
          });
        });
      }
      module.exports = {
        ensureToken,
        search,
        getSubject,
        getPlayInfo,
        getSeasonInfo,
        _getToken: () => authToken
      };
    }
  });

  // src/movieboxtv/tmdb.js
  var require_tmdb = __commonJS({
    "src/movieboxtv/tmdb.js"(exports, module) {
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
      setInterval(() => {
        const now = Date.now();
        for (const k of Object.keys(cacheStore)) {
          if (cacheStore[k].exp < now)
            delete cacheStore[k];
        }
      }, 60 * 1e3).unref();
      function httpGetJson(url) {
        return __async(this, null, function* () {
          const res = yield fetch(url, {
            headers: { Accept: "application/json" }
          });
          if (!res.ok)
            throw new Error("HTTP " + res.status + " for " + url);
          return res.json();
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

  // src/movieboxtv/index.js
  var require_movieboxtv = __commonJS({
    "src/movieboxtv/index.js"(exports, module) {
      var bff = require_bff();
      var { getTmdbDetails } = require_tmdb();
      var NAME = "MovieBox TV";
      function normalizeTitle(t) {
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
        const q = normalizeTitle(query);
        const c = normalizeTitle(candidate);
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
      function yearOf(item) {
        const d = item && item.releaseDate;
        if (!d)
          return 0;
        return parseInt(String(d).substring(0, 4), 10) || 0;
      }
      function matchItem(items, title, year) {
        let best = null;
        let bestScore = -1;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          let score = titleScore(title, item.title);
          const iy = yearOf(item);
          if (year && iy) {
            const dy = Math.abs(iy - year);
            if (dy === 0)
              score += 15;
            else if (dy === 1)
              score += 8;
            else if (dy > 3)
              score -= 10;
          }
          if (score > bestScore) {
            bestScore = score;
            best = item;
          }
        }
        if (!best || bestScore < 70)
          return null;
        return best;
      }
      function findSubject(title, year, mediaType) {
        return __async(this, null, function* () {
          const subjectType = mediaType === "tv" || mediaType === "series" ? 2 : 1;
          const data = yield bff.search(title, subjectType, 1, 20);
          const items = data && data.items || [];
          let match = matchItem(items, title, year);
          if (match)
            return match;
          const data2 = yield bff.search(title, 0, 1, 20);
          const items2 = data2 && data2.items || [];
          return matchItem(items2, title, year);
        });
      }
      function qualityRank(q) {
        const s = String(q || "");
        if (/2160|4k/i.test(s))
          return 0;
        if (/1080/.test(s))
          return 1;
        if (/720/.test(s))
          return 2;
        if (/480/.test(s))
          return 3;
        if (/360/.test(s))
          return 4;
        return 9;
      }
      function formatBytes(n) {
        if (!n || n <= 0)
          return "";
        const g = n / (1024 * 1024 * 1024);
        if (g >= 1)
          return g.toFixed(1) + " GB";
        const m = n / (1024 * 1024);
        if (m >= 1)
          return Math.round(m) + " MB";
        return Math.round(n / 1024) + " KB";
      }
      function headSize(url) {
        return new Promise((resolve2) => {
          const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
          const timer = setTimeout(() => {
            if (ctrl) {
              try {
                ctrl.abort();
              } catch (e) {
              }
            }
            resolve2(0);
          }, 1500);
          const opts = { method: "HEAD", headers: { "User-Agent": "okhttp/4.12.0" } };
          if (ctrl)
            opts.signal = ctrl.signal;
          fetch(url, opts).then((r) => {
            clearTimeout(timer);
            const n = Number(r.headers && r.headers.get("content-length") || 0);
            resolve2(n > 0 ? n : 0);
          }).catch(() => {
            clearTimeout(timer);
            resolve2(0);
          });
        });
      }
      function streamKind(url) {
        const u = String(url || "").toLowerCase();
        if (u.indexOf(".m3u8") !== -1)
          return "hls";
        if (u.indexOf(".mpd") !== -1)
          return "dash";
        return "direct";
      }
      function mapResources(playData) {
        return __async(this, null, function* () {
          const resources = playData && playData.resources || [];
          const seen = {};
          const out = [];
          for (let i = 0; i < resources.length; i++) {
            const r = resources[i];
            if (!r || !r.url)
              continue;
            if (seen[r.url])
              continue;
            seen[r.url] = true;
            const res = r.resolution || "";
            const quality = res ? /^\d+$/.test(res) ? res + "p" : res : "Auto";
            out.push({
              name: NAME,
              title: quality + (r.codec ? " " + r.codec : ""),
              url: r.url,
              quality,
              type: "direct",
              headers: { "User-Agent": "okhttp/4.12.0" }
            });
          }
          const sizes = yield Promise.all(out.map((s) => headSize(s.url)));
          for (let i = 0; i < out.length; i++) {
            if (sizes[i]) {
              out[i].bytes = sizes[i];
              out[i].size = formatBytes(sizes[i]);
            }
          }
          out.sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality));
          return out;
        });
      }
      function mapHlsStreams(playData) {
        const streams = playData && playData.streams || [];
        const out = [];
        for (let i = 0; i < streams.length; i++) {
          const s = streams[i];
          if (!s || !s.url)
            continue;
          const kind = streamKind(s.url);
          if (kind !== "hls")
            continue;
          const headers = { "User-Agent": "okhttp/4.12.0" };
          if (s.signCookie)
            headers.Cookie = s.signCookie;
          const resolutions = String(s.resolutions || "").split(",")[0];
          const quality = resolutions ? resolutions + "p" : s.format || "HLS";
          const bytes = /^\d+$/.test(String(s.size || "")) ? Number(s.size) : 0;
          out.push({
            name: NAME,
            title: quality + (s.codecName ? " " + s.codecName : "") + " HLS",
            url: s.url,
            quality,
            type: "hls",
            bytes,
            size: bytes ? formatBytes(bytes) : "",
            headers
          });
        }
        return out;
      }
      function dedupe(list) {
        const byUrl = {};
        const out = [];
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (byUrl[s.url] !== void 0) {
            const prev = out[byUrl[s.url]];
            if (qualityRank(s.quality) < qualityRank(prev.quality))
              out[byUrl[s.url]] = s;
            continue;
          }
          byUrl[s.url] = out.length;
          out.push(s);
        }
        out.sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality));
        return out;
      }
      function hasStreams(playData) {
        return !!(playData && ((playData.resources || []).length || (playData.streams || []).length));
      }
      function getStreamsForSubject(subject, mediaType, season, episode) {
        return __async(this, null, function* () {
          const isTv = mediaType === "tv" || mediaType === "series";
          let playData;
          if (isTv) {
            const want = Number(season) || 1;
            const ep = Number(episode) || 1;
            let se = want;
            try {
              const seasonInfo = yield bff.getSeasonInfo(subject.subjectId);
              const seasons = seasonInfo && seasonInfo.seasons || [];
              se = null;
              for (let i = 0; i < seasons.length; i++) {
                if (Number(seasons[i].se) === want) {
                  se = seasons[i].se;
                  break;
                }
              }
              if (se === null)
                se = seasons.length ? seasons[0].se : want;
            } catch (e) {
              se = want;
            }
            playData = yield bff.getPlayInfo(subject.subjectId, se, ep);
            if (!hasStreams(playData))
              playData = yield bff.getPlayInfo(subject.subjectId, want, ep);
            if (!hasStreams(playData))
              playData = yield bff.getPlayInfo(subject.subjectId, se, ep);
          } else {
            playData = yield bff.getPlayInfo(subject.subjectId, 0, 0);
            if (!hasStreams(playData))
              playData = yield bff.getPlayInfo(subject.subjectId);
          }
          const mp4 = yield mapResources(playData);
          const hls = mapHlsStreams(playData);
          return dedupe(mp4.concat(hls));
        });
      }
      function getStreamsByMeta(title, year, mediaType, season, episode) {
        return __async(this, null, function* () {
          const subject = yield findSubject(title, year, mediaType);
          if (!subject) {
            throw new Error("No " + NAME + ' result for "' + title + '" (' + year + ")");
          }
          return getStreamsForSubject(subject, mediaType, season, episode);
        });
      }
      function resolve(tmdbId, mediaType, season, episode) {
        return __async(this, null, function* () {
          const mt = mediaType === "tv" || mediaType === "series" ? "tv" : "movie";
          const meta = yield getTmdbDetails(tmdbId, mt);
          if (!meta || !meta.title) {
            throw new Error("TMDB lookup failed for id " + tmdbId);
          }
          const streams = yield getStreamsByMeta(meta.title, meta.year, mt, season, episode);
          console.log("[MovieBox TV] " + meta.title + " -> " + streams.length + " stream(s)");
          return streams;
        });
      }
      var api = {
        getStreams(tmdbId, mediaType, season, episode) {
          return resolve(tmdbId, mediaType, season, episode).catch((err) => {
            console.error("[MovieBox TV] Error:", err && err.message ? err.message : err);
            return [];
          });
        },
        _internal: {
          getStreamsByMeta,
          findSubject,
          getStreamsForSubject,
          mapResources,
          mapHlsStreams,
          clearCaches() {
          }
        }
      };
      module.exports = api;
    }
  });
  return require_movieboxtv();
})();

if (typeof module !== "undefined" && module.exports) { module.exports = __movieboxtv; }
if (typeof globalThis !== "undefined") { globalThis.getStreams = __movieboxtv.getStreams; }
if (typeof global !== "undefined") { global.getStreams = __movieboxtv.getStreams; }
if (typeof self !== "undefined") { self.getStreams = __movieboxtv.getStreams; }

