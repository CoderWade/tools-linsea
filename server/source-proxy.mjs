// Relay for Google Finance / Sina Finance / XE rates.
//
// None of the three send CORS headers, so the browser cannot read them directly.
// This server fetches them and re-serves JSON with permissive CORS.
//
// Notes on the upstreams:
//  - Sina: one batched request covers many currencies; needs a Referer or 403.
//  - XE:   one page per currency; HTTP 202 with an empty body means rate-limited,
//          so retry with backoff.
//  - Google: one page per currency; Node's HTTP/1.1 through the local proxy gets
//          a 302 loop, so the Windows/.NET stack (powershell.exe) is the fallback.

import http from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { execFileSync } from "node:child_process";

const PORT = Number(process.env.SOURCE_PROXY_PORT || 8789);
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CONCURRENCY = Number(process.env.SOURCE_CONCURRENCY || 4);

// Minimum spacing between two requests to the same site, in milliseconds.
// A full sweep is 154 pages per source. Spreading ~154 requests over roughly
// half an hour keeps both sites happy: XE gets one page every ~11s, Google one
// every ~12s. The refresh window is an hour, so there is plenty of room.
const XE_MIN_GAP_MS = Number(process.env.XE_MIN_GAP_MS || 11000);
const GOOGLE_MIN_GAP_MS = Number(process.env.GOOGLE_MIN_GAP_MS || 12000);

// Earliest moment the next request to a given site may start.
const nextSlotAt = new Map();

/** Wait until this site's pacing slot opens, then claim it. */
async function pace(site, gapMs) {
  if (!gapMs || gapMs <= 0) return;
  const now = Date.now();
  const slot = Math.max(now, (nextSlotAt.get(site) || 0));
  nextSlotAt.set(site, slot + gapMs);
  const wait = slot - now;
  if (wait > 0) await sleep(wait);
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const cache = new Map();

// Adaptive throttles: upstream sites rate-limit by frequency, so failures widen
// the gap between requests instead of retrying immediately.


function detectProxy() {
  const fromEnv = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
  if (fromEnv) return fromEnv;
  if (process.platform !== "win32") return "";
  try {
    const key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
    const enabled = execFileSync("reg", ["query", key, "/v", "ProxyEnable"], { encoding: "utf8" });
    if (!/0x1\b/.test(enabled)) return "";
    const server = execFileSync("reg", ["query", key, "/v", "ProxyServer"], { encoding: "utf8" });
    const match = server.match(/ProxyServer\s+REG_SZ\s+(\S+)/);
    if (!match) return "";
    const value = match[1];
    if (value.includes("=")) {
      const parts = Object.fromEntries(value.split(";").map((i) => i.split("=")));
      const picked = parts.https || parts.http;
      return picked ? `http://${picked}` : "";
    }
    return `http://${value}`;
  } catch {
    return "";
  }
}

const PROXY_URL = detectProxy();

async function requestViaProxy(url, headers, signal, hop = 0) {
  if (hop > 4) throw new Error(`too many redirects for ${url}`);
  const httpModule = await import("node:http");
  const httpsModule = await import("node:https");
  const tls = await import("node:tls");
  const target = new URL(url);
  const proxy = new URL(PROXY_URL);

  const socket = await new Promise((resolve, reject) => {
    const connectReq = httpModule.default.request({
      host: proxy.hostname,
      port: proxy.port || 8080,
      method: "CONNECT",
      path: `${target.hostname}:443`,
      headers: { Host: `${target.hostname}:443` },
    });
    connectReq.on("connect", (res, established) => {
      if (res.statusCode !== 200) {
        established.destroy();
        reject(new Error(`proxy CONNECT ${res.statusCode}`));
        return;
      }
      resolve(established);
    });
    connectReq.on("error", reject);
    connectReq.end();
  });

  const { response, body } = await new Promise((resolve, reject) => {
    const req = httpsModule.default.request(
      url,
      { method: "GET", headers, signal, createConnection: () => tls.connect({ socket, servername: target.hostname }) },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ response: res, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });

  const status = response.statusCode || 0;
  const location = response.headers?.location;
  if (status >= 300 && status < 400 && location) {
    socket.destroy();
    return await requestViaProxy(new URL(location, url).toString(), headers, signal, hop + 1);
  }
  return { status, body };
}

async function fetchText(url, extraHeaders = {}, timeoutMs = 20_000) {
  const headers = { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...extraHeaders };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let status = 0;
    let body = "";
    if (PROXY_URL) {
      const result = await requestViaProxy(url, headers, controller.signal);
      status = result.status;
      body = result.body;
    } else {
      try {
        const response = await fetch(url, { headers, signal: controller.signal });
        status = response.status;
        body = await response.text();
      } catch (error) {
        // Hosts like hq.sinajs.cn resolve to both A and AAAA records. Node prefers
        // IPv6, but many containers have no IPv6 egress, so the request dies with
        // a bare "fetch failed" even though IPv4 works. Retry over IPv4 only.
        const retry = await fetchOverIpv4(url, headers, controller.signal);
        status = retry.status;
        body = retry.body;
      }
    }
    if (status >= 400) throw new Error(`HTTP ${status} from ${new URL(url).host}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** One GET over IPv4 only, used when the default fetch fails to connect. */
async function fetchOverIpv4(url, headers, signal) {
  const httpModule = await import("node:http");
  const httpsModule = await import("node:https");
  const target = new URL(url);
  const transport = target.protocol === "http:" ? httpModule.default : httpsModule.default;

  return await new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === "http:" ? 80 : 443),
        path: target.pathname + target.search,
        method: "GET",
        headers,
        family: 4,
        signal,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.setTimeout(20_000, () => req.destroy(new Error("IPv4 request timed out")));
    req.end();
  });
}

// --- Sina: batched -----------------------------------------------------------
async function fetchSinaBatch(codes) {
  const symbols = codes.map((code) => `fx_susd${code.toLowerCase()}`).join(",");
  const text = await fetchText(`https://hq.sinajs.cn/list=${symbols}`, { Referer: "https://finance.sina.com.cn/" });
  const out = {};
  const re = /hq_str_fx_susd([a-z]{3})="([^"]*)"/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const code = match[1].toUpperCase();
    const fields = match[2].split(",");
    // Field 1 is the current rate; field 8 is the in-bank quote when present.
    for (const index of [8, 1, 3]) {
      const value = Number(fields[index]);
      if (Number.isFinite(value) && value > 0) {
        out[code] = value;
        break;
      }
    }
  }
  return out;
}

// --- XE: one page per currency ----------------------------------------------
// XE's markup moved off `result__BigRate` and now renders a table row like:
//   <a ...To=NOK">1<!-- --> <!-- -->USD</a></td>
//   <td class="... tabular-nums ...">9.2832<!-- --> <!-- -->NOK</td>
// so the reliable signal is the number that precedes the target code.
function parseXeRate(html, code) {
  const escape = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`To=${escape}">1(?:<!-- -->|\\s)*USD</a></td>\\s*<td[^>]*>\\s*([0-9][0-9,]*\\.?[0-9]*)(?:<!-- -->|\\s)*${escape}`),
    new RegExp(`<td[^>]*>\\s*([0-9][0-9,]*\\.[0-9]{2,6})(?:<!-- -->|\\s)*${escape}<`),
    new RegExp(`<p[^>]*class="[^"]*result__BigRate[^"]*"[^>]*>\\s*([0-9][0-9,\\.\\s]*)`),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const value = Number(String(match[1]).replace(/[,\s]/g, ""));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

async function fetchXeOne(code) {
  if (Date.now() < xeCooldownUntil) throw new Error("XE cooling down");
  const url = `https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=${encodeURIComponent(code)}`;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const html = await fetchText(url);
      if (!html || html.length < 500) throw new Error("XE empty body (rate limited)");
      const value = parseXeRate(html, code);
      if (value) return value;
      // A parse miss is not retryable: the page simply carries no quote for this
      // code (XE answers 404/blank for currencies it does not trade).
      throw Object.assign(new Error(`XE no quote for ${code}`), { fatal: true });
    } catch (error) {
      lastError = error;
      if (error.fatal) break;
      // A 403/429 means the whole site is throttling us; retrying other
      // currencies will only deepen the block. Trip the breaker instead.
      const message = String((error && error.message) || "");
      if (/\b(403|429)\b/.test(message)) {
        xeFailures += 1;
        // XE blocks for hours once tripped; backing off saves the whole sweep.
        xeCooldownUntil = Date.now() + 60 * 60_000;
        break;
      }
      if (attempt < 2) await sleep(1200 * (attempt + 1));
    }
  }
  throw lastError ?? new Error(`XE failed for ${code}`);
}

// --- Google: one page per currency, .NET stack fallback ----------------------
let googleCooldownUntil = 0;
let googleFailures = 0;
let xeCooldownUntil = 0;
let xeFailures = 0;

async function fetchGoogleOne(code) {
  if (Date.now() < googleCooldownUntil) throw new Error("Google cooling down");
  const url = `https://www.google.com/finance/quote/USD-${encodeURIComponent(code)}`;
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const parse = (html) => {
    const patterns = [
      new RegExp(`"USD / ${escaped}"\\s*,\\s*\\d+\\s*,\\s*null\\s*,\\s*\\[\\s*([0-9]+(?:\\.[0-9]+)?)`),
      new RegExp(`,\\s*([0-9]+\\.[0-9]{3,8})\\s*,\\s*"USD / ${escaped}"`),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const value = Number(match[1]);
        if (Number.isFinite(value) && value > 0) return value;
      }
    }
    return null;
  };

  try {
    const html = await fetchText(url, { Accept: "text/html,application/xhtml+xml" });
    const value = parse(html);
    if (value) {
      googleFailures = 0;
      return value;
    }
  } catch {
    /* fall through to the .NET path */
  }

  if (process.platform === "win32") {
    try {
      const script = [
        "$ProgressPreference='SilentlyContinue'",
        `$ua='${UA}'`,
        `$r=Invoke-WebRequest -Uri '${url}' -UseBasicParsing -TimeoutSec 8 -Headers @{'User-Agent'=$ua}`,
        "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8",
        "[Console]::Out.Write($r.Content)",
      ].join("; ");
      const output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        timeout: 12_000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const value = output && output.length > 1000 ? parse(output) : null;
      if (value) {
        googleFailures = 0;
        return value;
      }
    } catch {
      /* handled below */
    }
  }

  // Trip immediately on a block. Google answers 403 consistently once it throttles
  // us, so retrying every currency only burns 10-25s each and delays the rest of
  // the sweep. Cool down, keep serving the other sources, and try again later.
  googleFailures += 1;
  if (googleFailures >= 1) {
    googleCooldownUntil = Date.now() + 15 * 60_000;
  }
  throw new Error(`Google blocked for ${code}`);
}

/** Values still inside the cache TTL, used to answer while a source cools down. */
function pickCached(codes, source) {
  const out = {};
  for (const code of codes) {
    const hit = cache.get(`${source}:${code}`);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) out[code] = hit.value;
  }
  return out;
}

async function mapLimit(items, limit, worker) {
  const results = {};
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      const code = items[index];
      try {
        const value = await worker(code);
        if (typeof value === "number" && value > 0) results[code] = value;
      } catch {
        /* skip this currency */
      }
    }
  });
  await Promise.all(runners);
  return results;
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS" });
    res.end();
    return;
  }

  if (url.pathname === "/api/sources/health") {
    json(res, 200, {
      ok: true,
      service: "source-relay",
      proxy: PROXY_URL || "direct",
      sources: ["google", "sina", "xe"],
      pacing: { xeMs: XE_MIN_GAP_MS, googleMs: GOOGLE_MIN_GAP_MS, concurrency: MAX_CONCURRENCY },
    });
    return;
  }

  if (url.pathname === "/api/sources") {
    const raw = url.searchParams.get("codes") || "";
    const codes = [...new Set(raw.split(",").map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c)))];
    if (!codes.length) {
      json(res, 400, { ok: false, error: "provide ?codes=CNY,EUR" });
      return;
    }

    const rates = { google: {}, sina: {}, xe: {} };
    const errors = {};

    // Sina: one batch, cached per currency (a batch-level cache would return a
    // stale subset when a later request asks for different currencies).
    try {
      const missing = codes.filter((code) => {
        const hit = cache.get(`sina:${code}`);
        if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
          rates.sina[code] = hit.value;
          return false;
        }
        return true;
      });
      if (missing.length) {
        const batch = await fetchSinaBatch(missing);
        for (const code of missing) {
          const value = batch[code];
          if (typeof value === "number" && value > 0) {
            rates.sina[code] = value;
            cache.set(`sina:${code}`, { at: Date.now(), value });
          }
        }
      }
    } catch (error) {
      errors.sina = error.message;
    }

    // XE + Google: per-currency with limited concurrency, cached per code.
    // Low coverage on obscure currencies is expected: XE answers 404 for codes it
    // does not quote (CUP, KPW, ...), so those codes simply stay empty.
    //
    // Pacing matters: a full sweep is 154 pages per source, and requesting them
    // back-to-back makes both sites start answering 403. Each request keeps a
    // minimum gap so a sweep spreads across the hour-long refresh window instead
    // of finishing in two minutes and getting the IP blocked.
    //
    // A source that is cooling down is skipped outright: waiting on its pacing
    // slot would stall every other source in the same request for nothing.
    const xeReady = Date.now() >= xeCooldownUntil;
    if (!xeReady) Object.assign(rates.xe, pickCached(codes, "xe"));
    const googleReady = Date.now() >= googleCooldownUntil;
    if (!xeReady) errors.xe = "XE cooling down after repeated blocks";
    if (!googleReady) errors.google = "Google cooling down after repeated blocks";

    await Promise.all([
      xeReady
        ? mapLimit(codes, MAX_CONCURRENCY, async (code) => {
            const key = `xe:${code}`;
            const hit = cache.get(key);
            if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
            await pace("xe", XE_MIN_GAP_MS);
            const value = await fetchXeOne(code);
            cache.set(key, { at: Date.now(), value });
            return value;
          }).then((out) => Object.assign(rates.xe, out))
        : (Object.assign(rates.xe, pickCached(codes, "xe")), Promise.resolve()),
      googleReady
        ? mapLimit(codes, 1, async (code) => {
            const key = `google:${code}`;
            const hit = cache.get(key);
            if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
            await pace("google", GOOGLE_MIN_GAP_MS);
            const value = await fetchGoogleOne(code);
            cache.set(key, { at: Date.now(), value });
            return value;
          }).then((out) => Object.assign(rates.google, out))
        : (Object.assign(rates.google, pickCached(codes, "google")), Promise.resolve()),
    ]);

    json(res, 200, { ok: true, asOf: new Date().toISOString(), rates, errors });
    return;
  }

  json(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, process.env.RELAY_HOST || "127.0.0.1", () => {
  console.log(`[source-relay] listening on http://127.0.0.1:${PORT}`);
  console.log(`[source-relay] upstream proxy: ${PROXY_URL || "direct"}`);
});
