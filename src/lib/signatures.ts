/*
 * Reverse lookup of 4-byte selectors and 32-byte event topics.
 *
 * Keccak-256 is one-way, so a selector cannot be inverted — it can only be
 * matched against a corpus of known signatures. Two public, CORS-enabled
 * services provide that corpus, and both are queried only on explicit user
 * action.
 *
 * What the local re-hash can and cannot do:
 *
 *   It catches corrupt rows, transcription errors, and anything the service
 *   normalised into a different selector. It CANNOT catch a deliberate decoy.
 *   A 4-byte space holds only 2^32 values, so anyone can mine a nonsense
 *   signature ("many_msg_babbage(bytes1)") that collides with a real one, and
 *   every genuine database row is by construction a valid collision. That is
 *   why verification is a hygiene filter, not a security boundary: the real
 *   defences are showing every candidate, never auto-selecting one, ranking by
 *   the has-verified-contract signal, and letting the user confirm.
 *
 * Remote text is untrusted: control characters and bidirectional overrides are
 * stripped, length is capped, and the result is only ever rendered as text.
 */

import { formatAbiType, parseSignature, type AbiSignature } from "./abi";
import { keccak256Hex } from "./evm";

export type SignatureKind = "function" | "event";

export type SignatureCandidate = {
  /** Text as the remote service reported it, after sanitising. */
  text: string;
  /** Canonical form rebuilt locally; this is what the selector is computed over. */
  canonical: string;
  /** Parsed signature, or null when the text cannot be parsed as ABI. */
  signature: AbiSignature | null;
  /** True when the local keccak of `canonical` reproduces the requested hash. */
  verified: boolean;
  /** True when a verified contract is known to use this signature. */
  hasVerifiedContract: boolean;
  source: "openchain" | "4byte";
};

export type SignatureLookupResult = {
  hash: string;
  kind: SignatureKind;
  candidates: SignatureCandidate[];
  /** Sources that answered successfully, so the UI can say what was consulted. */
  sources: string[];
  /** Per-source failure notes; a partial result is still useful. */
  errors: string[];
};

export type SignatureCache = Map<string, { at: number; candidates: SignatureCandidate[] }>;

export type SignatureLookupOptions = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Injected by tests; production uses the module-level cache. */
  cache?: SignatureCache;
};

const OPENCHAIN_URL = "https://api.openchain.xyz/signature-database/v1/lookup";
const FOURBYTE_URL = "https://www.4byte.directory/api/v1";
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 512 * 1024;
const MAX_TEXT_LENGTH = 512;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 200;

type CacheEntry = { at: number; candidates: SignatureCandidate[] };
const memoryCache = new Map<string, CacheEntry>();

/* ------------------------------------------------------------------ */
/* Hash helpers                                                        */
/* ------------------------------------------------------------------ */

export function normalizeSelector(input: string): string | null {
  const clean = input.trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(clean)) return null;
  return clean;
}

export function normalizeTopic(input: string): string | null {
  const clean = input.trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) return null;
  return clean;
}

/** Selector for a function, or topic0 for an event. Always local. */
export function hashForSignature(signature: AbiSignature): string {
  return keccak256Hex(signature.canonical);
}

/* ------------------------------------------------------------------ */
/* Sanitising                                                          */
/* ------------------------------------------------------------------ */

/**
 * Strips what must never reach a layout: control characters, bidirectional
 * overrides (which can make `transfer` render as something else), and
 * zero-width joiners used to fake a familiar name. Language characters are
 * kept, because some signatures do contain non-ASCII identifiers.
 */
export function sanitizeRemoteText(raw: string): string {
  const withoutControls = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");
  const withoutBidi = withoutControls.replace(/[\u202a-\u202e\u2066-\u2069\u200e\u200f]/g, "");
  const withoutInvisible = withoutBidi.replace(/[\u200b-\u200d\u2060\ufeff]/g, "");
  const collapsed = withoutInvisible.replace(/\s+/g, " ").trim();
  return collapsed.length > MAX_TEXT_LENGTH ? `${collapsed.slice(0, MAX_TEXT_LENGTH)}…` : collapsed;
}

/* ------------------------------------------------------------------ */
/* Candidate construction                                              */
/* ------------------------------------------------------------------ */

export function makeCandidate(
  rawText: string,
  hash: string,
  meta: { source: SignatureCandidate["source"]; hasVerifiedContract?: boolean },
): SignatureCandidate | null {
  const text = sanitizeRemoteText(rawText);
  if (!text) return null;
  const expected = hash.toLowerCase();
  // A function is identified by the first 4 bytes of the digest, an event by
  // the whole 32-byte word, so the comparison depends on the hash width.
  const isTopic = expected.length === 64;
  try {
    const signature = parseSignature(text);
    const canonical = signature.canonical;
    const digest = keccak256Hex(canonical);
    const verified = isTopic ? digest === expected : digest.startsWith(expected);
    return {
      text,
      canonical,
      signature: verified ? signature : null,
      verified,
      hasVerifiedContract: Boolean(meta.hasVerifiedContract),
      source: meta.source,
    };
  } catch {
    // Unparseable rows still get shown, flagged, so a user can see that the
    // database answered without pretending the answer is usable.
    return {
      text,
      canonical: "",
      signature: null,
      verified: false,
      hasVerifiedContract: Boolean(meta.hasVerifiedContract),
      source: meta.source,
    };
  }
}

/**
 * Readability heuristic, not a truth ranking.
 *
 * Selector space is small and mined decoys are real, so no ordering can be
 * authoritative. What we can do is keep the list scannable: names that look
 * machine-generated (mined collisions such as `permit8355429682040` or
 * `_____$_$__$___$$$___$$___$__$$`) go last, then shorter, plainer names come
 * first. The UI still shows every candidate and still explains that any two
 * candidates with the same type list decode to identical bytes.
 */
function machineLook(name: string): number {
  let score = 0;
  if (/\d{6,}/.test(name)) score += 2; // long digit run: mined or auto-suffixed
  if (/^_|_$/.test(name)) score += 2; // bracketed by underscores
  if ((name.match(/\$/g) ?? []).length > 0) score += 2; // `$` is legal but rare in real code
  if (name.length > 40) score += 1;
  return score;
}

function rank(candidate: SignatureCandidate): number[] {
  const name = candidate.canonical ? candidate.canonical.slice(0, candidate.canonical.indexOf("(")) : candidate.text;
  return [
    candidate.verified ? 0 : 1,
    machineLook(name),
    name.length,
    candidate.canonical.length,
    candidate.hasVerifiedContract ? 0 : 1,
  ];
}

function sortAndDedupe(candidates: SignatureCandidate[]): SignatureCandidate[] {
  const byCanonical = new Map<string, SignatureCandidate>();
  for (const candidate of candidates) {
    const key = candidate.canonical || `raw:${candidate.text}`;
    const existing = byCanonical.get(key);
    if (!existing) {
      byCanonical.set(key, candidate);
      continue;
    }
    // Same signature from both sources: keep the verified-contract signal and
    // remember that two sources agreed.
    byCanonical.set(key, {
      ...existing,
      hasVerifiedContract: existing.hasVerifiedContract || candidate.hasVerifiedContract,
    });
  }
  return [...byCanonical.values()]
    .sort((a, b) => {
      const left = rank(a);
      const right = rank(b);
      for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) return left[index] - right[index];
      }
      return a.canonical.localeCompare(b.canonical);
    })
    .slice(0, 50);
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

async function fetchJson(url: string, options: SignatureLookupOptions): Promise<unknown> {
  const fetcher = options.fetcher ?? fetch;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_BODY_BYTES) throw new Error("Response is too large to be a signature lookup.");
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

type OpenChainRow = { name?: unknown; hasVerifiedContract?: unknown };
type OpenChainPayload = {
  result?: {
    function?: Record<string, OpenChainRow[]>;
    event?: Record<string, OpenChainRow[]>;
  };
};

async function lookupOpenChain(
  hash: string,
  kind: SignatureKind,
  options: SignatureLookupOptions,
): Promise<SignatureCandidate[]> {
  // OpenChain keys results by the hash it was asked for, and accepts a
  // comma-separated batch, so ask for exactly the one hash we need.
  const field = kind === "event" ? "event" : "function";
  const url = `${OPENCHAIN_URL}?${field}=0x${hash}&filter=false`;
  const payload = (await fetchJson(url, options)) as OpenChainPayload;
  const bucket = payload.result?.[field]?.[`0x${hash}`];
  if (!Array.isArray(bucket)) return [];
  return bucket
    .map((row) =>
      typeof row?.name === "string"
        ? makeCandidate(row.name, hash, { source: "openchain", hasVerifiedContract: row.hasVerifiedContract === true })
        : null,
    )
    .filter((candidate): candidate is SignatureCandidate => candidate !== null);
}

async function lookup4Byte(
  hash: string,
  kind: SignatureKind,
  options: SignatureLookupOptions,
): Promise<SignatureCandidate[]> {
  const path = kind === "event" ? "event-signatures" : "signatures";
  const url = `${FOURBYTE_URL}/${path}/?hex_signature=0x${hash}`;
  const payload = await fetchJson(url, options);
  const rows = (payload as { results?: Array<{ text_signature?: unknown }> }).results;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) =>
      typeof row?.text_signature === "string"
        ? makeCandidate(row.text_signature, hash, { source: "4byte" })
        : null,
    )
    .filter((candidate): candidate is SignatureCandidate => candidate !== null);
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Looks a selector (8 hex chars) or event topic0 (64 hex chars) up in both
 * public corpora. Requires an explicit call: nothing here runs on keystroke.
 */
export async function lookupSignature(
  rawHash: string,
  kind: SignatureKind,
  options: SignatureLookupOptions = {},
): Promise<SignatureLookupResult> {
  const hash = kind === "event" ? normalizeTopic(rawHash) : normalizeSelector(rawHash);
  if (!hash) {
    throw new Error(
      kind === "event"
        ? "Expected a 32-byte event topic (64 hex characters)."
        : "Expected a 4-byte selector (8 hex characters).",
    );
  }

  const cacheKey = `${kind}:${hash}`;
  const cached = options.cache?.get(cacheKey) ?? memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { hash, kind, candidates: cached.candidates, sources: ["cache"], errors: [] };
  }
  const errors: string[] = [];
  const sources: string[] = [];
  const [openchain, fourbyte] = await Promise.allSettled([
    lookupOpenChain(hash, kind, options),
    lookup4Byte(hash, kind, options),
  ]);

  const found: SignatureCandidate[] = [];
  if (openchain.status === "fulfilled") {
    found.push(...openchain.value);
    sources.push("OpenChain");
  } else {
    errors.push(`OpenChain: ${messageOf(openchain.reason)}`);
  }
  if (fourbyte.status === "fulfilled") {
    found.push(...fourbyte.value);
    sources.push("4byte");
  } else {
    errors.push(`4byte: ${messageOf(fourbyte.reason)}`);
  }

  if (!sources.length) {
    throw new Error(`Signature lookup failed. ${errors.join(" ")}`);
  }

  const candidates = sortAndDedupe(found);
  writeCache(cacheKey, candidates, options.cache);
  return { hash, kind, candidates, sources, errors };
}

function writeCache(key: string, candidates: SignatureCandidate[], cache?: SignatureCache) {
  (cache ?? memoryCache).set(key, { at: Date.now(), candidates });
  if (cache) return;
  if (memoryCache.size > CACHE_LIMIT) {
    const oldest = [...memoryCache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, memoryCache.size - CACHE_LIMIT);
    for (const [stale] of oldest) memoryCache.delete(stale);
  }
}

function messageOf(reason: unknown): string {
  if (reason instanceof Error) {
    if (reason.name === "AbortError") return "timed out";
    return reason.message;
  }
  return String(reason);
}

export function clearSignatureCache() {
  memoryCache.clear();
}

/** Human-readable type list for a candidate, for the picker row. */
export function candidateTypeList(candidate: SignatureCandidate): string {
  if (!candidate.signature) return "";
  return candidate.signature.inputs.map((parameter) => formatAbiType(parameter.type)).join(", ");
}
