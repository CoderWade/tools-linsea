// Mastercard currency conversion relay.
//
// Mastercard's public calculator on mastercard.com is powered by an unadvertised
// but publicly reachable JSON endpoint:
//
//   GET /marketingservices/public/mccom-services/currency-conversions/conversion-rates
//       ?transaction_currency=USD
//       &cardholder_billing_currency=CNY
//       &transaction_amount=1
//       &bank_fee=0
//       &exchange_date=0000-00-00
//
// Parameters MUST be snake_case; the camelCase variants that the developer docs
// use are silently ignored and the server replies "Transaction currency is
// required". exchange_date=0000-00-00 means "latest available".
//
// No API key is needed, but the endpoint sends no CORS headers, so the browser
// cannot call it directly. This relay adds CORS and caches per currency.

import http from "node:http";

const PORT = Number(process.env.MC_PROXY_PORT || 8791);
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CONCURRENCY = Number(process.env.MC_CONCURRENCY || 3);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BASE = "https://www.mastercard.com";
const PATH = "/marketingservices/public/mccom-services/currency-conversions/conversion-rates";

/** Request headers that make mastercard.com treat us like its own calculator. */
const HEADERS = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: `${BASE}/us/en/personal/get-support/currency-exchange-rate-converter.html`,
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

const cache = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch 1 USD -> `code` from Mastercard.
 * Returns { rate, date } or throws with the upstream message.
 */
async function fetchRate(code) {
  const params = new URLSearchParams({
    transaction_currency: "USD",
    cardholder_billing_currency: code,
    transaction_amount: "1",
    bank_fee: "0",
    exchange_date: "0000-00-00",
  });
  const url = `${BASE}${PATH}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { headers: HEADERS, signal: controller.signal });
    const text = await response.text();

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`non-JSON response (HTTP ${response.status})`);
    }

    const data = payload?.data;
    if (!data) throw new Error(payload?.data?.errorMessage || text.slice(0, 120));
    if (data.errorMessage) throw new Error(data.errorMessage);

    const rate = Number(data.conversionRate);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error(`no rate in response for ${code}`);

    return { rate, date: data.fxDate || "" };
  } finally {
    clearTimeout(timer);
  }
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
        if (value) results[code] = value;
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

  if (url.pathname === "/api/mastercard/health") {
    json(res, 200, { ok: true, service: "mastercard-relay", upstream: BASE + PATH });
    return;
  }

  if (url.pathname === "/api/mastercard") {
    const raw = url.searchParams.get("codes") || "";
    const codes = [...new Set(raw.split(",").map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c)))];
    if (!codes.length) {
      json(res, 400, { ok: false, error: "provide ?codes=CNY,EUR" });
      return;
    }

    const rates = {};
    const errors = {};
    const dates = new Set();

    await mapLimit(codes, CONCURRENCY, async (code) => {
      if (code === "USD") {
        rates.USD = 1;
        return 1;
      }
      const hit = cache.get(code);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        rates[code] = hit.rate;
        if (hit.date) dates.add(hit.date);
        return hit.rate;
      }
      try {
        const { rate, date } = await fetchRate(code);
        rates[code] = rate;
        if (date) dates.add(date);
        cache.set(code, { at: Date.now(), rate, date });
        // Mastercard throttles bursts; a small gap keeps long sweeps stable.
        await sleep(120);
        return rate;
      } catch (error) {
        errors[code] = error.message;
        throw error;
      }
    });

    json(res, 200, {
      ok: true,
      asOf: new Date().toISOString(),
      fxDate: [...dates][0] || "",
      rates,
      errors,
    });
    return;
  }

  json(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, process.env.RELAY_HOST || "127.0.0.1", () => {
  console.log(`[mastercard-relay] listening on http://127.0.0.1:${PORT}`);
  console.log(`[mastercard-relay] upstream ${BASE}${PATH}`);
});
