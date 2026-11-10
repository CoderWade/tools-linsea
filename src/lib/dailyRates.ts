// Daily-refresh rate feed for the Exchange Rate tool.
//
// Data paths, all fetched at most once per day:
//
// 1. Reference rates (primary) - one JSON file from @fawazahmed0/currency-api
//    (jsDelivr CDN) already contains every ISO 4217 rate against USD. It is the
//    only free source that covers all 154 currencies in the table, allows CORS,
//    and needs no API key. Dated snapshots allow backfilling a missed day.
//
// 2. Reference rates (backup) - ExchangeRate-API open access
//    (open.er-api.com). Also key-free, CORS-enabled, updates daily, and covers
//    166 currencies. Used when the primary is unreachable, and fetched anyway
//    so the two feeds can be cross-checked against each other.
//
// 3. UnionPay card rates - UnionPay publishes a per-day JSON file at
//    `/jfimg/YYYYMMDD.json` containing ~2400 currency pairs. It sends no CORS
//    headers, so the browser cannot read it directly; `server/unionpay-proxy.mjs`
//    relays it. Mastercard and Visa sit behind Akamai bot protection and cannot
//    be scraped reliably, so their columns stay labelled as estimates.

const CDN_MIRRORS: Array<(date: string) => string> = [
  (date) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.json`,
  (date) => `https://${date === "latest" ? "latest" : date}.currency-api.pages.dev/v1/currencies/usd.json`,
];

/** Attribution required by ExchangeRate-API's open access terms. */
export const RATE_ATTRIBUTION = {
  label: "Rates By Exchange Rate API",
  href: "https://www.exchangerate-api.com",
};

/** Cross-check between the primary feed and the independent backup feed. */
export type RateCrossCheck = {
  /** Backup feed that was successfully fetched, or "" when unavailable. */
  backupSource: string;
  /** How many currencies were compared. */
  compared: number;
  /** Median absolute deviation in percent - robust against redenominated currencies. */
  medianDeviation: number;
  /** Largest single-currency deviation, in percent. */
  maxDeviation: number;
  /** The currency responsible for maxDeviation. */
  worstCode: string;
  /**
   * Currencies where the two feeds disagree by more than 5%. These are almost
   * always redenominations (ZWL, SYP) or re-pegs, not data errors, so they are
   * listed for review rather than treated as a failed check.
   */
  outliers: Array<{ code: string; deviation: number }>;
};

export type DailyRates = {
  /** Rate map keyed by uppercase ISO code, all relative to 1 USD. */
  rates: Record<string, number>;
  /** The date the source reports for this snapshot (YYYY-MM-DD). */
  date: string;
  /** Where the data came from, for display and troubleshooting. */
  source: string;
  /** Which feed supplied `rates`. */
  used: "primary" | "backup";
  /**
   * The backup feed's own numbers, kept so the table can show each source in its
   * own column instead of a single merged "reference" value.
   */
  backupRates: Record<string, number>;
  /** Result of comparing primary and backup; null when backup was unreachable. */
  crossCheck: RateCrossCheck | null;
};

export type UnionPayRates = {
  /** Rate map keyed by uppercase ISO code, relative to 1 USD. */
  rates: Record<string, number>;
  /** UnionPay rate date (YYYY-MM-DD), or an empty string when unavailable. */
  date: string;
  /** Human-readable note about provenance/fallback. */
  note: string;
};

type DailyApiPayload = {
  date?: string;
  usd?: Record<string, number>;
};

type BackupApiPayload = {
  result?: string;
  base_code?: string;
  time_last_update_utc?: string;
  time_next_update_utc?: string;
  time_eol_unix?: number;
  rates?: Record<string, number>;
  "error-type"?: string;
};

/**
 * Independent backup feed (ExchangeRate-API open access, no key required).
 * Updates once per day and allows CORS, so it is a drop-in fallback when the
 * primary CDN is unreachable. Their terms require attribution on the page that
 * shows the data - see the notice in the Exchange Rate panel.
 */
async function fetchBackupRates(signal?: AbortSignal): Promise<{ rates: Record<string, number>; date: string; label: string }> {
  const response = await fetch("https://open.er-api.com/v6/latest/USD", { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = (await response.json()) as BackupApiPayload;
  if (payload.result !== "success" || !payload.rates) {
    throw new Error(payload["error-type"] || "backup payload invalid");
  }
  // Surface a planned shutdown well before it happens.
  if (payload.time_eol_unix && payload.time_eol_unix > 0) {
    console.warn("[rates] backup feed announces EOL:", new Date(payload.time_eol_unix * 1000).toISOString());
  }

  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(payload.rates)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) rates[code.toUpperCase()] = value;
  }
  if (rates.USD === undefined) rates.USD = 1;
  if (Object.keys(rates).length < 50) throw new Error("suspiciously few rates from backup");

  const date = payload.time_last_update_utc ? new Date(payload.time_last_update_utc).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return { rates, date, label: "open.er-api.com (备用)" };
}

/**
 * Compare two USD-based rate maps, in percent.
 *
 * A plain mean is useless here: one redenominated currency (ZWL is off by six
 * orders of magnitude because the feeds disagree about the 2024 rebase) drags
 * the average to thousands of percent. So report the median, keep the worst
 * case, and list everything beyond 5% as an outlier for review.
 */
function compareRates(primary: Record<string, number>, backup: Record<string, number>, backupSource: string): RateCrossCheck | null {
  const deviations: Array<{ code: string; deviation: number }> = [];

  for (const [code, pv] of Object.entries(primary)) {
    const bv = backup[code];
    if (!bv || !pv) continue;
    deviations.push({ code, deviation: Math.abs(pv / bv - 1) * 100 });
  }
  if (!deviations.length) return null;

  const sorted = [...deviations].sort((a, b) => a.deviation - b.deviation);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid].deviation : (sorted[mid - 1].deviation + sorted[mid].deviation) / 2;
  const worst = deviations.reduce((max, item) => (item.deviation > max.deviation ? item : max), deviations[0]);

  return {
    backupSource,
    compared: deviations.length,
    medianDeviation: median,
    maxDeviation: worst.deviation,
    worstCode: worst.code,
    outliers: validOutliers(deviations),
  };
}

function validOutliers(deviations: Array<{ code: string; deviation: number }>) {
  return deviations
    .filter((item) => item.deviation > 5)
    .sort((a, b) => b.deviation - a.deviation)
    .map((item) => ({ code: item.code, deviation: item.deviation }));
}

/**
 * Fetch the daily USD-based rate table.
 *
 * Primary: @fawazahmed0/currency-api on jsDelivr (with the pages.dev mirror and
 * dated snapshots as further fallbacks) - it is the free source that covers all
 * 154 currencies in the table.
 *
 * Backup: ExchangeRate-API open access, used only if every primary attempt
 * fails. Both feeds are fetched when possible so their numbers can be
 * cross-checked; a large disagreement is worth surfacing.
 */
export async function fetchDailyRates(signal?: AbortSignal): Promise<DailyRates> {
  const attempts: Array<{ label: string; date: string }> = [
    { label: "jsDelivr latest", date: "latest" },
    { label: "currency-api latest", date: "latest" },
    { label: "yesterday snapshot", date: offsetDate(-1) },
    { label: "two days ago", date: offsetDate(-2) },
  ];

  const errors: string[] = [];
  let primary: { rates: Record<string, number>; date: string; source: string } | null = null;

  for (const attempt of attempts) {
    if (primary) break;
    for (const mirror of CDN_MIRRORS) {
      const url = mirror(attempt.date);
      try {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as DailyApiPayload;
        if (!payload.usd) throw new Error("payload missing usd rates");

        const rates: Record<string, number> = {};
        for (const [code, value] of Object.entries(payload.usd)) {
          if (typeof value === "number" && Number.isFinite(value) && value > 0) {
            rates[code.toUpperCase()] = value;
          }
        }
        if (rates.USD === undefined) rates.USD = 1;
        if (Object.keys(rates).length < 50) throw new Error("suspiciously few rates");

        primary = {
          rates,
          date: payload.date || (attempt.date === "latest" ? new Date().toISOString().slice(0, 10) : attempt.date),
          source: new URL(url).host + " (" + attempt.label + ")",
        };
        break;
      } catch (error) {
        if ((error as Error).name === "AbortError") throw error;
        errors.push(`${new URL(url).host}: ${(error as Error).message}`);
      }
    }
  }

  // Backup is fetched regardless, so a healthy primary still gets validated.
  let backup: { rates: Record<string, number>; date: string; label: string } | null = null;
  try {
    backup = await fetchBackupRates(signal);
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    errors.push(`backup: ${(error as Error).message}`);
  }

  if (primary) {
    return {
      rates: primary.rates,
      date: primary.date,
      source: primary.source,
      used: "primary",
      backupRates: backup ? backup.rates : {},
      crossCheck: backup ? compareRates(primary.rates, backup.rates, backup.label) : null,
    };
  }

  // Primary completely unavailable: fall back to the backup feed.
  if (backup) {
    return {
      rates: backup.rates,
      date: backup.date,
      source: backup.label,
      used: "backup",
      backupRates: {},
      crossCheck: null,
    };
  }

  throw new Error("无法获取汇率数据：" + errors.slice(0, 3).join("; "));
}

/**
 * Fetch UnionPay's own daily card rates through the local relay.
 *
 * UnionPay publishes one file per business day at `/jfimg/YYYYMMDD.json`. Rates
 * are quoted per base currency, so any non-USD base is converted into a
 * USD-relative map by dividing through that base's own USD value.
 *
 * Weekends and holidays reuse Friday's file, so we step backwards a few days.
 */
export async function fetchUnionPayRates(signal?: AbortSignal): Promise<UnionPayRates> {
  const today = new Date();
  const candidates: string[] = [];
  for (let back = 0; back < 6; back++) {
    const date = new Date(today);
    date.setDate(date.getDate() - back);
    candidates.push(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`);
  }

  const errors: string[] = [];
  for (const stamp of candidates) {
    try {
      const response = await fetch(`/api/unionpay?date=${stamp}`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as { ok?: boolean; date?: string; entries?: Array<{ transCur: string; baseCur: string; rateData: number }>; error?: string };
      if (!payload.ok || !Array.isArray(payload.entries)) throw new Error(payload.error || "bad payload");

      const rates = unionPayToUsd(payload.entries);
      const count = Object.keys(rates).length;
      if (count < 50) throw new Error(`only ${count} currencies parsed`);

      const iso = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
      const backfilled = stamp !== candidates[0];
      return {
        rates,
        date: payload.date || iso,
        note: backfilled ? `银联 ${iso} 快照（当日未更新，沿用最近可用）` : `银联 ${iso} 官方清算汇率`,
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      errors.push(`${stamp}: ${(error as Error).message}`);
    }
  }
  throw new Error("银联汇率获取失败：" + errors.slice(0, 2).join("; "));
}

/**
 * UnionPay quotes "1 unit of transCur = rateData units of baseCur".
 *
 * For the USD-anchored group this reads "1 CNY = 0.15034 USD", i.e. rateData is
 * USD per one unit of the currency. The table needs the inverse ("1 USD = X"),
 * so the value must be flipped.
 *
 * For any other base group:
 *   rateData(USD) = units of base per 1 USD
 *   rateData(C)   = units of base per 1 unit of C
 * so 1 USD = rateData(USD) / rateData(C) units of C.
 */
function unionPayToUsd(entries: Array<{ transCur: string; baseCur: string; rateData: number }>) {
  const byBase = new Map<string, Array<{ transCur: string; rateData: number }>>();
  for (const entry of entries) {
    if (!Number.isFinite(entry.rateData) || entry.rateData <= 0) continue;
    const list = byBase.get(entry.baseCur) || [];
    list.push({ transCur: entry.transCur, rateData: entry.rateData });
    byBase.set(entry.baseCur, list);
  }

  // Best case: a group already anchored on USD. Here rateData is "USD per 1 unit",
  // so invert it to get "units per 1 USD".
  const usdGroup = byBase.get("USD");
  if (usdGroup && usdGroup.length > 50) {
    const rates: Record<string, number> = { USD: 1 };
    for (const { transCur, rateData } of usdGroup) {
      if (transCur === "USD") continue;
      const perUsd = 1 / rateData;
      if (Number.isFinite(perUsd) && perUsd > 0) rates[transCur] = perUsd;
    }
    return rates;
  }

  // Fallback: the largest group that mentions USD, converted through its base.
  let bestBase = "";
  let bestList: Array<{ transCur: string; rateData: number }> = [];
  for (const [base, list] of byBase) {
    const hasUsd = list.some((item) => item.transCur === "USD");
    if (hasUsd && list.length > bestList.length) {
      bestBase = base;
      bestList = list;
    }
  }
  if (!bestBase) throw new Error("no base currency containing USD");

  const perUsdInBase = bestList.find((item) => item.transCur === "USD")?.rateData;
  if (!perUsdInBase || perUsdInBase <= 0) throw new Error("USD missing from base table");

  const rates: Record<string, number> = { USD: 1 };
  for (const { transCur, rateData } of bestList) {
    if (transCur === "USD") continue;
    const perUsd = perUsdInBase / rateData;
    if (Number.isFinite(perUsd) && perUsd > 0) rates[transCur] = perUsd;
  }
  if (!rates[bestBase]) rates[bestBase] = perUsdInBase;
  return rates;
}

function offsetDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole-local-day key used to decide whether a refresh is due. */
export function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Parse "HH:MM" into minutes since midnight, or null when invalid. */
export function parseClock(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Whether the scheduled daily refresh time has passed today. */
export function isPastRefreshTime(clock: string) {
  const target = parseClock(clock);
  if (target === null) return true;
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= target;
}

/**
 * The refresh window is 17:00-18:00. A fetch is allowed once the window opens;
 * if it fails, retrying is allowed until the window closes.
 */
export const REFRESH_WINDOW_START = "17:00";
export const REFRESH_WINDOW_END = "18:00";

export function inRefreshWindow(now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = parseClock(REFRESH_WINDOW_START) ?? 1020;
  const end = parseClock(REFRESH_WINDOW_END) ?? 1080;
  return minutes >= start && minutes < end;
}

// ---------------------------------------------------------------------------
// Per-source rates: Google Finance (parallel market), Sina Finance, XE.
//
// These sites send no CORS headers, so all three are reached through
// server/source-proxy.mjs:
//   - Sina accepts one batched request for many currencies (fast).
//   - XE and Google need one page per currency, so they run with limited
//     concurrency and are only swept for a priority set by default.
// ---------------------------------------------------------------------------

export type SourceKey = "google" | "sina" | "xe";

export type SourceRates = {
  /** rate[source][CODE] = "1 USD = X CODE" */
  rates: Record<SourceKey, Record<string, number>>;
  /** Per-source date/label for the UI. */
  meta: Record<SourceKey, { count: number; note: string }>;
};

type SourcesApiPayload = {
  ok?: boolean;
  rates?: Partial<Record<SourceKey, Record<string, number>>>;
  errors?: Record<string, string>;
  error?: string;
};

/**
 * Fetch Google / Sina / XE rates for the given codes.
 *
 * The refresh window is a full hour, so a complete sweep of every currency is
 * affordable: chunks run one after another and `onProgress` reports how far
 * along we are. Each chunk returns its results immediately, so the table fills
 * progressively instead of waiting for the whole sweep.
 */
export async function fetchSourceRates(
  codes: string[],
  options: {
    signal?: AbortSignal;
    chunkSize?: number;
    retryPasses?: number;
    onProgress?: (done: number, total: number, partial: SourceRates) => void;
  } = {},
): Promise<SourceRates> {
  // The relay paces XE/Google at ~11-12s per currency, so a chunk of 12 would
  // take ~140s and trip the browser's request timeout. Keep chunks small enough
  // that a single request stays well under a minute.
  const { signal, chunkSize = 8, retryPasses = 2, onProgress } = options;
  const rates: Record<SourceKey, Record<string, number>> = { google: {}, sina: {}, xe: {} };

  const runChunks = async (list: string[]) => {
    const chunks: string[][] = [];
    for (let i = 0; i < list.length; i += chunkSize) chunks.push(list.slice(i, i + chunkSize));

    let done = 0;
    for (const chunk of chunks) {
      try {
        // Per-request timeout: pacing means a slow-but-healthy chunk still
        // takes tens of seconds, so do not rely on the browser default.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 90_000);
        const onOuterAbort = () => controller.abort();
        signal?.addEventListener("abort", onOuterAbort);
        let response: Response;
        try {
          response = await fetch(`/api/sources?codes=${chunk.join(",")}`, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener("abort", onOuterAbort);
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as SourcesApiPayload;
        if (!payload.ok || !payload.rates) throw new Error(payload.error || "bad payload");
        for (const key of ["google", "sina", "xe"] as SourceKey[]) {
          const part = payload.rates[key];
          if (!part) continue;
          for (const [code, value] of Object.entries(part)) {
            if (typeof value === "number" && Number.isFinite(value) && value > 0) {
              rates[key][code.toUpperCase()] = value;
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") throw error;
        // A failed chunk must not abort the sweep; remaining chunks still run.
      }
      done += chunk.length;
      onProgress?.(Math.min(done, list.length), list.length, snapshot(rates));
    }
  };

  await runChunks(codes);

  // Both XE and Google rate-limit bursts, so a second (and third) pass after the
  // first sweep has cooled off recovers most stragglers.
  for (let pass = 0; pass < retryPasses; pass++) {
    const missingBySource = (["google", "sina", "xe"] as SourceKey[]).map((key) => ({
      key,
      missing: codes.filter((code) => !rates[key][code]),
    }));
    const stillMissing = missingBySource.filter((item) => item.missing.length);
    if (!stillMissing.length) break;
    // Retry whichever codes are still missing in the most incomplete source.
    const target = stillMissing.sort((a, b) => b.missing.length - a.missing.length)[0].missing;
    if (!target.length) break;
    await runChunks(target);
  }

  return snapshot(rates);
}

function snapshot(rates: Record<SourceKey, Record<string, number>>): SourceRates {
  const clone = (key: SourceKey) => ({ ...rates[key] });
  return {
    rates: { google: clone("google"), sina: clone("sina"), xe: clone("xe") },
    meta: {
      google: { count: Object.keys(rates.google).length, note: "Google Finance 平行市场" },
      sina: { count: Object.keys(rates.sina).length, note: "新浪财经在岸/离岸报价" },
      xe: { count: Object.keys(rates.xe).length, note: "XE.com 中间价" },
    },
  };
}

// ---------------------------------------------------------------------------
// Visa official card rates (Visa Developer Platform).
//
// Visa's public calculator is behind Cloudflare, but the official Foreign
// Exchange Rates API returns Visa's own card-based conversion rate. It is served
// by server/visa-proxy.mjs, which holds the credentials (an API key + shared
// secret, or a client certificate) and never exposes them to the browser.
//
// When credentials are absent the relay answers 503 and the UI keeps showing the
// estimated column, clearly labelled.
// ---------------------------------------------------------------------------

export type VisaRates = {
  /** rate[CODE] = "1 USD = X CODE" according to Visa. */
  rates: Record<string, number>;
  /** "sandbox" data is simulated and must never be presented as real. */
  env: string;
  /** True when the relay has usable credentials. */
  configured: boolean;
  /** Why the numbers are missing, when they are. */
  reason: string;
};

type VisaApiPayload = {
  ok?: boolean;
  env?: string;
  rates?: Record<string, number>;
  errors?: Record<string, string>;
  error?: string;
  configured?: boolean;
};

export async function fetchVisaRates(
  codes: string[],
  options: { signal?: AbortSignal; chunkSize?: number } = {},
): Promise<VisaRates> {
  const { signal, chunkSize = 12 } = options;
  const empty: VisaRates = { rates: {}, env: "sandbox", configured: false, reason: "" };

  try {
    // Visa v1 answers one currency pair per request, so the relay loops server
    // side. Send codes in chunks to keep each HTTP call bounded.
    const merged: Record<string, number> = {};
    let env = "sandbox";
    let configured = true;
    let reason = "";
    for (let i = 0; i < codes.length; i += chunkSize) {
      const chunk = codes.slice(i, i + chunkSize);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 120_000);
      const onAbort = () => ctrl.abort();
      signal?.addEventListener("abort", onAbort);
      try {
        const response = await fetch(`/api/visa?codes=${chunk.join(",")}`, { signal: ctrl.signal });
        if (response.status === 503) {
          const payload = (await response.json().catch(() => ({}))) as VisaApiPayload;
          configured = false;
          reason = payload.error || "Visa 凭证未配置";
          break;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as VisaApiPayload;
        env = payload.env || env;
        for (const [code, value] of Object.entries(payload.rates || {})) {
          if (typeof value === "number" && Number.isFinite(value) && value > 0) merged[code.toUpperCase()] = value;
        }
        if (!reason && Object.keys(payload.errors || {}).length) reason = Object.values(payload.errors || {})[0];
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
    if (!configured) return { ...empty, configured: false, reason };
    return { rates: merged, env, configured: true, reason };
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    return { ...empty, reason: (error as Error).message };
  }
}


// ---------------------------------------------------------------------------
// Mastercard official card rates.
//
// Mastercard's public calculator on mastercard.com is backed by an unadvertised
// JSON endpoint (no API key). It sends no CORS headers, so server/mastercard-proxy.mjs
// relays it. Rates are the real cardholder billing rates Mastercard publishes.
// ---------------------------------------------------------------------------

export type MastercardRates = {
  rates: Record<string, number>;
  /** The fx date Mastercard reports for these rates (YYYY-MM-DD). */
  fxDate: string;
  reason: string;
};

type MastercardApiPayload = {
  ok?: boolean;
  fxDate?: string;
  rates?: Record<string, number>;
  errors?: Record<string, string>;
  error?: string;
};

export async function fetchMastercardRates(codes: string[], options: { signal?: AbortSignal; chunkSize?: number } = {}): Promise<MastercardRates> {
  const { signal, chunkSize = 15 } = options;
  const merged: Record<string, number> = {};
  let fxDate = "";
  let reason = "";

  for (let i = 0; i < codes.length; i += chunkSize) {
    const chunk = codes.slice(i, i + chunkSize);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const response = await fetch(`/api/mastercard?codes=${chunk.join(",")}`, { signal: ctrl.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as MastercardApiPayload;
      if (payload.fxDate && !fxDate) fxDate = payload.fxDate;
      for (const [code, value] of Object.entries(payload.rates || {})) {
        if (typeof value === "number" && Number.isFinite(value) && value > 0) merged[code.toUpperCase()] = value;
      }
      if (!reason && Object.keys(payload.errors || {}).length) reason = Object.values(payload.errors || {})[0];
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      reason = reason || (error as Error).message;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  return { rates: merged, fxDate, reason };
}
