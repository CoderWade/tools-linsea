// Visa Foreign Exchange Rates relay (Visa Developer Platform).
//
// Visa's public site sits behind Cloudflare and cannot be scraped, but the
// official API is available to any registered developer. This relay calls it,
// handles authentication, and re-serves the numbers with CORS so the browser can
// use them.
//
// Two auth modes are supported; pick whichever you set up in the dashboard:
//
//   1. X-Pay-Token (simpler, no client certificate)
//      VISA_API_KEY       - project API key
//      VISA_SHARED_SECRET - decrypted shared secret
//
//   2. Two-Way SSL / mutual TLS (client certificate + HTTP Basic)
//      VISA_CERT_PATH     - client certificate .pem
//      VISA_KEY_PATH      - client private key .pem
//      VISA_USER_ID       - HTTP Basic user id
//      VISA_PASSWORD      - HTTP Basic password
//
// Endpoint (sandbox returns simulated data; production returns live rates):
//   POST /forexrates/v2/foreignexchangerates
//   { sourceCurrencyCode, destinationCurrencyCode, rateProductCode, sourceAmount }
//   Currency codes are ISO 4217 *numeric* (USD=840, CNY=156, EUR=978 ...)

import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const PORT = Number(process.env.VISA_PROXY_PORT || 8790);

const API_KEY = process.env.VISA_API_KEY || "";
const SHARED_SECRET = process.env.VISA_SHARED_SECRET || "";
const CERT_PATH = process.env.VISA_CERT_PATH || "";
const KEY_PATH = process.env.VISA_KEY_PATH || "";
const USER_ID = process.env.VISA_USER_ID || "";
const PASSWORD = process.env.VISA_PASSWORD || "";
const CA_PATH = process.env.VISA_CA_PATH || "";

// Set VISA_ENV=production once Visa approves the project; sandbox data is
// simulated and must not be shown as real rates.
const ENV = (process.env.VISA_ENV || "sandbox").toLowerCase();
const HOST = ENV === "production" ? "api.visa.com" : "sandbox.api.visa.com";
// v2 answers 9209 ("Token validation failed") with valid credentials, while v1
// returns real Visa card rates. Use v1.
const RESOURCE_PATH = "/forexrates/v1/foreignexchangerates";
const VERSION = "v1.0.0";

const hasXPay = Boolean(API_KEY && SHARED_SECRET);
const hasTwoWaySsl = Boolean(CERT_PATH && KEY_PATH && USER_ID && PASSWORD);

/**
 * Build the X-Pay-Token header.
 *   message = timestamp + resource_path + query_string + request_body
 *   token   = "xv2:" + timestamp + ":" + hmac_sha256(sharedSecret, message)
 * For non-Visa-Token-Service APIs the resource path excludes the first context
 * segment, so "/forexrates/v2/foreignexchangerates" is signed as
 * "/v2/foreignexchangerates".
 */
function xPayToken(requestBody) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPath = RESOURCE_PATH.replace(/^\/forexrates/, "");
  const query = `apikey=${API_KEY}`;
  const message = timestamp + signedPath + query + requestBody;
  const hash = crypto.createHmac("sha256", SHARED_SECRET).update(message, "utf8").digest("hex");
  return `xv2:${timestamp}:${hash}`;
}

/** ISO 4217 numeric codes for the currencies we support. */
const ISO_NUMERIC = {
  AED: "784", AFN: "971", ALL: "008", AMD: "051", ANG: "532", AOA: "973", ARS: "032",
  AUD: "036", AWG: "533", AZN: "944", BAM: "977", BBD: "052", BDT: "050", BGN: "975",
  BHD: "048", BIF: "108", BMD: "060", BND: "096", BOB: "068", BRL: "986", BSD: "044",
  BTN: "064", BWP: "072", BYN: "933", BZD: "084", CAD: "124", CDF: "976", CHF: "756",
  CLP: "152", CNY: "156", COP: "170", CRC: "188", CUP: "192", CVE: "132", CZK: "203",
  DJF: "262", DKK: "208", DOP: "214", DZD: "012", EGP: "818", ERN: "232", ETB: "230",
  EUR: "978", FJD: "242", FKP: "238", GBP: "826", GEL: "981", GHS: "936", GIP: "292",
  GMD: "270", GNF: "324", GTQ: "320", GYD: "328", HKD: "344", HNL: "340", HTG: "332",
  HUF: "348", IDR: "360", ILS: "376", INR: "356", IQD: "368", IRR: "364", ISK: "352",
  JMD: "388", JOD: "400", JPY: "392", KES: "404", KGS: "417", KHR: "116", KMF: "174",
  KPW: "408", KRW: "410", KWD: "414", KYD: "136", KZT: "398", LAK: "418", LBP: "422",
  LKR: "144", LRD: "430", LSL: "426", LYD: "434", MAD: "504", MDL: "498", MGA: "969",
  MKD: "807", MMK: "104", MNT: "496", MOP: "446", MRU: "929", MUR: "480", MVR: "462",
  MWK: "454", MXN: "484", MYR: "458", MZN: "943", NAD: "516", NGN: "566", NIO: "558",
  NOK: "578", NPR: "524", NZD: "554", OMR: "512", PAB: "590", PEN: "604", PGK: "598",
  PHP: "608", PKR: "586", PLN: "985", PYG: "600", QAR: "634", RON: "946", RSD: "941",
  RUB: "643", RWF: "646", SAR: "682", SBD: "090", SCR: "690", SDG: "938", SEK: "752",
  SGD: "702", SHP: "654", SLE: "925", SOS: "706", SRD: "968", SSP: "728", STN: "930",
  SVC: "222", SYP: "760", SZL: "748", THB: "764", TJS: "972", TMT: "934", TND: "788",
  TOP: "776", TRY: "949", TTD: "780", TWD: "901", TZS: "834", UAH: "980", UGX: "800",
  USD: "840", UYU: "858", UZS: "860", VES: "928", VND: "704", VUV: "548", WST: "882",
  XAF: "950", XCD: "951", XOF: "952", XPF: "953", YER: "886", ZAR: "710", ZMW: "967",
  ZWL: "932",
};

const cache = new Map();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

async function postJson(path, body, headers, tlsOptions) {
  return new Promise((resolve, reject) => {
    const requestOptions = { host: HOST, port: 443, path, method: "POST", headers };
    if (tlsOptions) requestOptions.agent = tlsOptions;
    const req = https.request(requestOptions, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(25_000, () => req.destroy(new Error("Visa request timed out")));
    req.write(body);
    req.end();
  });
}

async function fetchVisaRate(toCode) {
  const toNumeric = ISO_NUMERIC[toCode];
  if (!toNumeric) throw new Error(`no ISO numeric code for ${toCode}`);
  if (!hasXPay && !hasTwoWaySsl) throw new Error("Visa credentials not configured");

  const payload = {
    sourceCurrencyCode: ISO_NUMERIC.USD,
    destinationCurrencyCode: toNumeric,
    sourceAmount: "1",
    // NOTE: do not send rateProductCode here. The v1 endpoint rejects it with
    // "Invalid content found starting with element 'rateProductCode'", and it
    // already returns card-based rates by default.
  };
  const body = JSON.stringify(payload);

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  let path = RESOURCE_PATH;
  let agent;

  if (hasXPay) {
    path = `${RESOURCE_PATH}?apikey=${API_KEY}`;
    headers["X-PAY-TOKEN"] = xPayToken(body);
  } else {
    headers.Authorization = "Basic " + Buffer.from(`${USER_ID}:${PASSWORD}`).toString("base64");
  }

  if (hasTwoWaySsl) {
    const cert = readFileSync(CERT_PATH);
    const key = readFileSync(KEY_PATH);
    // TLS chain to sandbox.api.visa.com is DigiCert, while our client certificate
    // chains to Visa's sandbox root. Trust both so neither side fails verify.
    const fallback = KEY_PATH.replace(/\.key$/, "_ca.pem");
    const caPath = CA_PATH || (existsSync(fallback) ? fallback : "");
    const ca = caPath ? readFileSync(caPath) : undefined;
    agent = new https.Agent({ cert, key, ca, keepAlive: false });
  }

  const res = await postJson(path, body, headers, agent);

  if (res.status !== 200) {
    throw new Error(`Visa HTTP ${res.status}: ${res.body.slice(0, 200)}`);
  }
  const json = JSON.parse(res.body);
  const rate = Number(json.conversionRate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Visa response missing conversionRate");
  return { rate, table: json.currentFxRateTable || null, markup: json.markupRateApplied || "0" };
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

  if (url.pathname === "/api/visa/health") {
    json(res, 200, {
      ok: true,
      service: "visa-relay",
      configured: hasXPay || hasTwoWaySsl,
      mode: hasXPay ? "x-pay-token" : hasTwoWaySsl ? "two-way-ssl" : "unconfigured",
      env: ENV,
      host: HOST,
    });
    return;
  }

  if (url.pathname === "/api/visa") {
    const raw = url.searchParams.get("codes") || "";
    const codes = [...new Set(raw.split(",").map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c)))];
    if (!codes.length) {
      json(res, 400, { ok: false, error: "provide ?codes=CNY,EUR" });
      return;
    }
    if (!hasXPay && !hasTwoWaySsl) {
      json(res, 503, { ok: false, error: "Visa credentials not configured", configured: false });
      return;
    }

    const rates = {};
    const errors = {};
    for (const code of codes) {
      if (code === "USD") {
        rates.USD = 1;
        continue;
      }
      const key = `visa:${code}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        rates[code] = hit.value;
        continue;
      }
      try {
        const r = await fetchVisaRate(code);
        rates[code] = r.rate;
        cache.set(key, { at: Date.now(), value: r.rate, table: r.table });
      } catch (error) {
        errors[code] = error.message;
      }
    }
    json(res, 200, { ok: true, env: ENV, asOf: new Date().toISOString(), rates, errors });
    return;
  }

  json(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[visa-relay] listening on http://127.0.0.1:${PORT}`);
  console.log(`[visa-relay] env=${ENV} host=${HOST} mode=${hasXPay ? "x-pay-token" : hasTwoWaySsl ? "two-way-ssl" : "UNCONFIGURED"}`);
  if (!hasXPay && !hasTwoWaySsl) {
    console.log("[visa-relay] set VISA_API_KEY + VISA_SHARED_SECRET (or the two-way SSL vars) to enable");
  }
});
