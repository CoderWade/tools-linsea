// Daily snapshot service for the exchange-rate table.
//
// The table used to be fetched by whichever browser happened to open the page
// during the 17:00-18:00 window. That meant no page open = no fresh data, and
// every visitor triggered their own full sweep.
//
// This module does the sweep once, server-side, and writes a JSON snapshot that
// the frontend simply reads:
//
//   /api/snapshot          latest snapshot (any age)
//   /api/snapshot/refresh  force a fresh sweep now (used by the timer)
//   /api/snapshot/health   service status
//
// Scheduled by systemd (deploy/timeminer-tools-snapshot.timer) at 17:00 local.

import http from "node:http";
import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.SNAPSHOT_PORT || 8792);
const DIR = process.env.SNAPSHOT_DIR || "/app/data";
const KEEP_DAYS = Number(process.env.SNAPSHOT_KEEP_DAYS || 14);


const ISO_NUMERIC_SAFE = /^[A-Z]{3}$/;

/** Gather every feed in parallel; failures degrade to empty maps, never throw. */
async function collect() {
  const endpoints = {
    unionpay: `http://127.0.0.1:${process.env.UNIONPAY_PROXY_PORT || 8788}`,
    sources: `http://127.0.0.1:${process.env.SOURCE_PROXY_PORT || 8789}`,
    visa: `http://127.0.0.1:${process.env.VISA_PROXY_PORT || 8790}`,
    mastercard: `http://127.0.0.1:${process.env.MC_PROXY_PORT || 8791}`,
  };

  const today = new Date();
  const stamps = [];
  for (let back = 0; back < 4; back++) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    stamps.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`);
  }

  const errors = {};

  async function getJson(url, label) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      errors[label] = (error && error.message) || String(error);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // UnionPay: step back over weekends/holidays until a file exists.
  let unionpay = null;
  for (const stamp of stamps) {
    const data = await getJson(`${endpoints.unionpay}/api/unionpay?date=${stamp}`, `unionpay:${stamp}`);
    if (data && data.ok && Array.isArray(data.entries) && data.entries.length) {
      unionpay = data;
      delete errors[`unionpay:${stamp}`];
      break;
    }
  }

  // Reference feeds come from the same relays the browser used.
  const [unp, sources, visa, mastercard] = await Promise.all([
    Promise.resolve(unionpay),
    (async () => {
      const out = { google: {}, sina: {}, xe: {}, errors: {} };
      // The relay paces Google/XE at ~11s per currency, so one request for all
      // 153 codes would hang for half an hour and hit the request timeout.
      // Ask in small batches instead and merge as each returns.
      const batchSize = 8;
      for (let i = 0; i < ALL_CODES.length; i += batchSize) {
        const batch = ALL_CODES.slice(i, i + batchSize);
        const part = await getJson(`${endpoints.sources}/api/sources?codes=${batch.join(",")}`, `sources:${i}`);
        if (part && part.rates) {
          Object.assign(out.google, part.rates.google || {});
          Object.assign(out.sina, part.rates.sina || {});
          Object.assign(out.xe, part.rates.xe || {});
          if (part.errors && Object.keys(part.errors).length) out.errors = { ...out.errors, ...part.errors };
          delete errors[`sources:${i}`];
        }
      }
      return out;
    })(),
    getJson(`${endpoints.visa}/api/visa?codes=${ALL_CODES}`, "visa"),
    getJson(`${endpoints.mastercard}/api/mastercard?codes=${ALL_CODES}`, "mastercard"),
  ]);

  return { unionpay: unp, sources, visa, mastercard, errors };
}

/**
 * The relay APIs take currency codes; keep the list here so the snapshot service
 * does not need to import the frontend bundle.
 */
const ALL_CODES = (
  process.env.SNAPSHOT_CODES ||
  "AED,AFN,ALL,AMD,ANG,AOA,ARS,AUD,AWG,AZN,BAM,BBD,BDT,BGN,BHD,BIF,BMD,BND,BOB,BRL,BSD,BTN,BWP,BYN,BZD,CAD,CDF,CHF,CLP,CNY,COP,CRC,CUP,CVE,CZK,DJF,DKK,DOP,DZD,EGP,ERN,ETB,EUR,FJD,FKP,GBP,GEL,GHS,GIP,GMD,GNF,GTQ,GYD,HKD,HNL,HTG,HUF,IDR,ILS,INR,IQD,IRR,ISK,JMD,JOD,JPY,KES,KGS,KHR,KMF,KPW,KRW,KWD,KYD,KZT,LAK,LBP,LKR,LRD,LSL,LYD,MAD,MDL,MGA,MKD,MMK,MNT,MOP,MRU,MUR,MVR,MWK,MXN,MYR,MZN,NAD,NGN,NIO,NOK,NPR,NZD,OMR,PAB,PEN,PGK,PHP,PKR,PLN,PYG,QAR,RON,RSD,RUB,RWF,SAR,SBD,SCR,SDG,SEK,SGD,SHP,SLE,SOS,SRD,SSP,STN,SVC,SYP,SZL,THB,TJS,TMT,TND,TOP,TRY,TTD,TWD,TZS,UAH,UGX,UYU,UZS,VES,VND,VUV,WST,XAF,XCD,XOF,XPF,YER,ZAR,ZMW,ZWL"
).split(",").filter((c) => ISO_NUMERIC_SAFE.test(c));

/** UnionPay quotes against many bases; convert to "1 USD = X". */
function unionPayToUsd(entries) {
  const byBase = new Map();
  for (const e of entries || []) {
    if (!Number.isFinite(e.rateData) || e.rateData <= 0) continue;
    const list = byBase.get(e.baseCur) || [];
    list.push(e);
    byBase.set(e.baseCur, list);
  }
  const usdGroup = byBase.get("USD");
  if (usdGroup && usdGroup.length > 50) {
    const rates = { USD: 1 };
    for (const { transCur, rateData } of usdGroup) {
      if (transCur !== "USD") rates[transCur] = 1 / rateData;
    }
    return rates;
  }
  let bestBase = "";
  let best = [];
  for (const [base, list] of byBase) {
    if (list.some((i) => i.transCur === "USD") && list.length > best.length) {
      bestBase = base;
      best = list;
    }
  }
  if (!bestBase) return { USD: 1 };
  const perUsd = best.find((i) => i.transCur === "USD").rateData;
  const rates = { USD: 1 };
  for (const { transCur, rateData } of best) {
    if (transCur !== "USD") rates[transCur] = perUsd / rateData;
  }
  if (!rates[bestBase]) rates[bestBase] = perUsd;
  return rates;
}

/** Build the same shape the frontend already caches. */
function buildSnapshot(collected) {
  const { unionpay, sources, visa, mastercard } = collected;
  const unionPayRates = unionPayToUsd(unionpay?.entries);
  const upDate = unionpay?.date || "";

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    // Reference column comes from the sources relay when available; the frontend
    // keeps using its own currency-api primary feed for the reference columns.
    unionPay: unionPayRates,
    unionPayDate: upDate,
    unionPayNote: upDate ? `银联 ${upDate} 官方清算汇率` : "银联未取到数据",
    google: sources?.google || {},
    sina: sources?.sina || {},
    xe: sources?.xe || {},
    visa: visa?.rates || {},
    visaEnv: visa?.env || "",
    mastercard: mastercard?.rates || {},
    mastercardDate: mastercard?.fxDate || "",
    errors: collected.errors || {},
  };
}

async function save(snapshot) {
  await mkdir(DIR, { recursive: true });
  const day = snapshot.generatedAt.slice(0, 10);
  const file = path.join(DIR, `snapshot-${day}.json`);
  await writeFile(file, JSON.stringify(snapshot, null, 2), "utf8");
  await writeFile(path.join(DIR, "latest.json"), JSON.stringify(snapshot), "utf8");
  return file;
}

async function prune() {
  try {
    const files = (await readdir(DIR)).filter((f) => f.startsWith("snapshot-")).sort();
    for (const f of files.slice(0, Math.max(0, files.length - KEEP_DAYS))) {
      await unlink(path.join(DIR, f)).catch(() => {});
    }
  } catch {
    /* directory may not exist yet */
  }
}

let running = null;
async function refresh() {
  if (running) return running;
  running = (async () => {
    const started = Date.now();
    const collected = await collect();
    const snapshot = buildSnapshot(collected);
    const file = await save(snapshot);
    await prune();
    console.log(
      `[snapshot] wrote ${file} in ${((Date.now() - started) / 1000).toFixed(0)}s ` +
        `(unionpay=${Object.keys(snapshot.unionPay).length} ` +
        `google=${Object.keys(snapshot.google).length} sina=${Object.keys(snapshot.sina).length} ` +
        `xe=${Object.keys(snapshot.xe).length} visa=${Object.keys(snapshot.visa).length} ` +
        `mc=${Object.keys(snapshot.mastercard).length})`,
    );
    return snapshot;
  })().finally(() => {
    running = null;
  });
  return running;
}

async function readLatest() {
  const file = path.join(DIR, "latest.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/api/snapshot/health") {
    const latest = await readLatest();
    json(res, 200, {
      ok: true,
      service: "snapshot",
      dir: DIR,
      latest: latest ? { generatedAt: latest.generatedAt, unionPay: Object.keys(latest.unionPay || {}).length } : null,
    });
    return;
  }

  if (url.pathname === "/api/snapshot") {
    const latest = await readLatest();
    if (!latest) {
      json(res, 404, { ok: false, error: "no snapshot yet" });
      return;
    }
    json(res, 200, latest);
    return;
  }

  if (url.pathname === "/api/snapshot/refresh") {
    // Guard with a shared secret so the endpoint cannot be used to hammer upstreams.
    const token = url.searchParams.get("token") || req.headers["x-snapshot-token"] || "";
    const expected = process.env.SNAPSHOT_TOKEN || "";
    if (expected && token !== expected) {
      json(res, 403, { ok: false, error: "bad token" });
      return;
    }
    // A full sweep is paced at ~11s per currency for Google/XE, so it can run for
    // half an hour. Answer immediately and let it finish in the background; the
    // caller polls /api/snapshot/status (or simply reads /api/snapshot later).
    if (running) {
      json(res, 202, { ok: true, started: false, running: true, note: "a sweep is already in progress" });
      return;
    }
    refresh().catch((error) => console.error("[snapshot] refresh failed:", error?.message || error));
    json(res, 202, { ok: true, started: true, running: true });
    return;
  }

  if (url.pathname === "/api/snapshot/status") {
    const latest = await readLatest();
    json(res, 200, {
      ok: true,
      running: Boolean(running),
      latest: latest ? { generatedAt: latest.generatedAt } : null,
    });
    return;
  }

  json(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, process.env.RELAY_HOST || "127.0.0.1", () => {
  console.log(`[snapshot] listening on http://${process.env.RELAY_HOST || "127.0.0.1"}:${PORT}`);
  console.log(`[snapshot] dir=${DIR} codes=${ALL_CODES.length} keep=${KEEP_DAYS}d`);
});
