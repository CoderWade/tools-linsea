// Minimal relay for UnionPay's daily rate file.
//
// UnionPay publishes `/jfimg/YYYYMMDD.json` (about 137 KB, ~2400 pairs) but the
// response carries no CORS headers, so a browser cannot read it directly. This
// server fetches the file and re-serves it with permissive CORS.
//
// Mastercard and Visa are NOT relayed here: both sit behind Akamai bot
// protection and answer 403 to non-browser clients, so scraping them is not
// reliable enough to depend on.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PORT = Number(process.env.UNIONPAY_PROXY_PORT || 8788);
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const cache = new Map();

async function fetchUnionPayFile(stamp) {
  const url = `https://m.unionpayintl.com/jfimg/${stamp}.json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Referer: "https://m.unionpayintl.com/cn/rate/", Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const list = payload?.exchangeRateJson;
    if (!Array.isArray(list) || !list.length) throw new Error("empty exchangeRateJson");

    const entries = [];
    for (const item of list) {
      const transCur = String(item?.transCur || "").toUpperCase();
      const baseCur = String(item?.baseCur || "").toUpperCase();
      const rateData = Number(item?.rateData);
      if (/^[A-Z]{3}$/.test(transCur) && /^[A-Z]{3}$/.test(baseCur) && Number.isFinite(rateData) && rateData > 0) {
        entries.push({ transCur, baseCur, rateData });
      }
    }
    return entries;
  } finally {
    clearTimeout(timer);
  }
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

  if (url.pathname === "/api/unionpay/health") {
    json(res, 200, { ok: true, service: "unionpay-relay" });
    return;
  }

  if (url.pathname === "/api/unionpay") {
    const raw = (url.searchParams.get("date") || "").trim();
    if (!/^\d{8}$/.test(raw)) {
      json(res, 400, { ok: false, error: "date must be YYYYMMDD" });
      return;
    }
    const hit = cache.get(raw);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      json(res, 200, { ok: true, date: hit.date, entries: hit.entries, cached: true });
      return;
    }
    try {
      const entries = await fetchUnionPayFile(raw);
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      cache.set(raw, { at: Date.now(), date, entries });
      json(res, 200, { ok: true, date, entries, count: entries.length });
    } catch (error) {
      // Serve a cached neighbour so a weekend/holiday still has data.
      if (hit) {
        json(res, 200, { ok: true, date: hit.date, entries: hit.entries, cached: true, stale: true });
        return;
      }
      json(res, 502, { ok: false, error: error.message });
    }
    return;
  }

  json(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, process.env.RELAY_HOST || "127.0.0.1", () => {
  console.log(`[unionpay-relay] listening on http://127.0.0.1:${PORT}`);
});
