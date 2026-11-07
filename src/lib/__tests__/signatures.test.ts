import { describe, expect, it, vi } from "vitest";
import { keccak256Hex } from "../evm";
import {
  candidateTypeList,
  clearSignatureCache,
  lookupSignature,
  makeCandidate,
  normalizeSelector,
  normalizeTopic,
  sanitizeRemoteText,
} from "../signatures";

const TRANSFER_SELECTOR = "a9059cbb";
const TRANSFER_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** Builds a fetcher that answers each URL by substring match. */
function fetcherFor(routes: Array<{ match: string; respond: () => Promise<Response> | Response }>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const route = routes.find((candidate) => url.includes(candidate.match));
    if (!route) throw new Error(`Unexpected request: ${url}`);
    return route.respond();
  }) as unknown as typeof fetch;
}

describe("hash normalisation", () => {
  it("accepts selectors in any case or prefix form", () => {
    expect(normalizeSelector("0xA9059CBB")).toBe(TRANSFER_SELECTOR);
    expect(normalizeSelector("a9059cbb")).toBe(TRANSFER_SELECTOR);
    expect(normalizeSelector("0xa9059cb")).toBeNull();
    expect(normalizeSelector("0xa9059cbb00")).toBeNull();
    expect(normalizeSelector("0xzzzzzzzz")).toBeNull();
  });

  it("accepts topics only at full width", () => {
    expect(normalizeTopic(`0x${TRANSFER_TOPIC}`)).toBe(TRANSFER_TOPIC);
    expect(normalizeTopic(TRANSFER_SELECTOR)).toBeNull();
  });
});

describe("sanitizeRemoteText", () => {
  it("strips control characters and bidi overrides", () => {
    expect(sanitizeRemoteText("transfer\u202e(address)")).toBe("transfer(address)");
    expect(sanitizeRemoteText("balance\u0000Of(uint256)")).toBe("balance Of(uint256)");
    expect(sanitizeRemoteText("a\u200bb\u2060c")).toBe("abc");
  });

  it("collapses whitespace and caps length", () => {
    expect(sanitizeRemoteText("  a \n\t b  ")).toBe("a b");
    expect(sanitizeRemoteText("a".repeat(2000)).length).toBeLessThanOrEqual(513);
  });
});

describe("makeCandidate", () => {
  it("rejects a row whose text does not hash to the requested selector", () => {
    const genuine = makeCandidate("transfer(address,uint256)", TRANSFER_SELECTOR, { source: "4byte" });
    expect(genuine?.verified).toBe(true);
    expect(genuine?.signature?.canonical).toBe("transfer(address,uint256)");

    // A transcription error, not a decoy: this text cannot produce the selector.
    const typo = makeCandidate("transfer(address,uint64)", TRANSFER_SELECTOR, { source: "4byte" });
    expect(typo?.verified).toBe(false);
  });

  it("accepts genuine selector collisions as verified, because they really do collide", () => {
    // Every one of these hashes to 0xa9059cbb. Local re-hashing cannot tell a
    // real function from a deliberately mined decoy, which is exactly why the
    // UI must show all of them and never pick one on the user's behalf.
    for (const text of [
      "transfer(address,uint256)",
      "many_msg_babbage(bytes1)",
      "workMyDirefulOwner(uint256,uint256)",
      "func_2093253501(bytes)",
    ]) {
      const candidate = makeCandidate(text, TRANSFER_SELECTOR, { source: "openchain" });
      expect(candidate?.verified, text).toBe(true);
    }
  });

  it("keeps unparseable rows but marks them unusable", () => {
    const candidate = makeCandidate("this is not a signature", TRANSFER_SELECTOR, { source: "4byte" });
    expect(candidate?.verified).toBe(false);
    expect(candidate?.signature).toBeNull();
  });

  it("returns null for an empty or fully stripped row", () => {
    expect(makeCandidate("", TRANSFER_SELECTOR, { source: "4byte" })).toBeNull();
    expect(makeCandidate("\u0000\u0001", TRANSFER_SELECTOR, { source: "4byte" })).toBeNull();
  });
});

describe("lookupSignature", () => {
  it("merges both sources, verifies locally, and ranks verified-contract rows first", async () => {
    clearSignatureCache();
    const fetcher = fetcherFor([
      {
        match: "openchain.xyz",
        respond: () =>
          jsonResponse({
            ok: true,
            result: {
              function: {
                "0xa9059cbb": [{ name: "transfer(address,uint256)", filtered: false, hasVerifiedContract: true }],
              },
              event: {},
            },
          }),
      },
      {
        match: "4byte.directory",
        respond: () =>
          jsonResponse({
            count: 2,
            results: [
              { text_signature: "workMyDirefulOwner(uint256,uint256)", hex_signature: "0xa9059cbb" },
              { text_signature: "transfer(address,uint256)", hex_signature: "0xa9059cbb" },
            ],
          }),
      },
    ]);

    const result = await lookupSignature(TRANSFER_SELECTOR, "function", { fetcher });
    expect(result.sources.sort()).toEqual(["4byte", "OpenChain"]);
    expect(result.candidates[0].canonical).toBe("transfer(address,uint256)");
    expect(result.candidates[0].hasVerifiedContract).toBe(true);
    expect(result.candidates[0].verified).toBe(true);

    // The decoy collides for real, so it verifies too — but it must never
    // outrank the row a verified contract is known to use, and it must stay
    // visible so the user can judge.
    const decoy = result.candidates.find((candidate) => candidate.text.includes("workMyDirefulOwner"));
    expect(decoy).toBeDefined();
    expect(decoy?.hasVerifiedContract).toBe(false);
    expect(result.candidates.indexOf(decoy!)).toBeGreaterThan(0);
  });

  it("deduplicates the same signature reported by both sources", async () => {
    clearSignatureCache();
    const fetcher = fetcherFor([
      {
        match: "openchain.xyz",
        respond: () =>
          jsonResponse({
            result: { function: { "0xa9059cbb": [{ name: "transfer(address,uint256)", hasVerifiedContract: true }] }, event: {} },
          }),
      },
      {
        match: "4byte.directory",
        respond: () => jsonResponse({ results: [{ text_signature: "transfer(address,uint256)" }] }),
      },
    ]);

    const result = await lookupSignature(TRANSFER_SELECTOR, "function", { fetcher });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].hasVerifiedContract).toBe(true);
  });

  it("ranks plain names above machine-generated ones", async () => {
    clearSignatureCache();
    // The real OpenChain answer for 0xa9059cbb includes mined decoys that are
    // also flagged as verified contracts. Ordering by that flag alone would put
    // junk at the top of the list.
    const fetcher = fetcherFor([
      {
        match: "openchain.xyz",
        respond: () =>
          jsonResponse({
            result: {
              function: {
                "0xa9059cbb": [
                  { name: "_____$_$__$___$$$___$$___$__$$(address,uint256)", hasVerifiedContract: true },
                  { name: "permit8355429682040(address,uint256)", hasVerifiedContract: true },
                  { name: "transfer(address,uint256)", hasVerifiedContract: true },
                ],
              },
              event: {},
            },
          }),
      },
      { match: "4byte.directory", respond: () => jsonResponse({ results: [] }) },
    ]);

    const result = await lookupSignature(TRANSFER_SELECTOR, "function", { fetcher });
    expect(result.candidates[0].canonical).toBe("transfer(address,uint256)");
  });

  it("survives one source failing", async () => {
    clearSignatureCache();
    const fetcher = fetcherFor([
      { match: "openchain.xyz", respond: () => jsonResponse({ message: "nope" }, 500) },
      {
        match: "4byte.directory",
        respond: () => jsonResponse({ results: [{ text_signature: "transfer(address,uint256)" }] }),
      },
    ]);

    const result = await lookupSignature(TRANSFER_SELECTOR, "function", { fetcher });
    expect(result.sources).toEqual(["4byte"]);
    expect(result.errors[0]).toMatch(/OpenChain/);
    expect(result.candidates).toHaveLength(1);
  });

  it("throws only when every source fails", async () => {
    clearSignatureCache();
    const fetcher = fetcherFor([
      { match: "openchain.xyz", respond: () => jsonResponse({}, 500) },
      { match: "4byte.directory", respond: () => jsonResponse({}, 503) },
    ]);
    await expect(lookupSignature(TRANSFER_SELECTOR, "function", { fetcher })).rejects.toThrow(/lookup failed/);
  });

  it("asks for the event endpoint when the kind is event", async () => {
    clearSignatureCache();
    const seen: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("openchain.xyz")) {
        return jsonResponse({ result: { function: {}, event: { [`0x${TRANSFER_TOPIC}`]: [{ name: "Transfer(address,address,uint256)", hasVerifiedContract: true }] } } });
      }
      return jsonResponse({ results: [{ text_signature: "Transfer(address,address,uint256)" }] });
    }) as unknown as typeof fetch;

    const result = await lookupSignature(TRANSFER_TOPIC, "event", { fetcher });
    expect(seen.some((url) => url.includes("event-signatures"))).toBe(true);
    expect(seen.some((url) => url.includes("event=0x"))).toBe(true);
    expect(result.candidates[0].canonical).toBe("Transfer(address,address,uint256)");
    expect(keccak256Hex(result.candidates[0].canonical)).toBe(TRANSFER_TOPIC);
  });

  it("rejects malformed hashes before any request", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(lookupSignature("zz", "function", { fetcher })).rejects.toThrow(/4-byte selector/);
    await expect(lookupSignature("0xa9059cbb", "event", { fetcher })).rejects.toThrow(/64 hex/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("serves repeat lookups from cache without another request", async () => {
    clearSignatureCache();
    const fetcher = fetcherFor([
      { match: "openchain.xyz", respond: () => jsonResponse({ result: { function: { "0xa9059cbb": [{ name: "transfer(address,uint256)" }] }, event: {} } }) },
      { match: "4byte.directory", respond: () => jsonResponse({ results: [] }) },
    ]);

    await lookupSignature(TRANSFER_SELECTOR, "function", { fetcher });
    const callsAfterFirst = (fetcher as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    const second = await lookupSignature(TRANSFER_SELECTOR, "function", { fetcher });
    const callsAfterSecond = (fetcher as unknown as { mock: { calls: unknown[] } }).mock.calls.length;

    expect(callsAfterSecond).toBe(callsAfterFirst);
    expect(second.sources).toEqual(["cache"]);
  });

  it("times out instead of hanging", async () => {
    clearSignatureCache();
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    ) as unknown as typeof fetch;

    await expect(lookupSignature(TRANSFER_SELECTOR, "function", { fetcher, timeoutMs: 5 })).rejects.toThrow(/timed out/);
  });

  it("rejects an oversized body rather than parsing it", async () => {
    clearSignatureCache();
    const huge = "x".repeat(600 * 1024);
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, text: async () => huge }) as unknown as Response) as unknown as typeof fetch;
    await expect(lookupSignature(TRANSFER_SELECTOR, "function", { fetcher })).rejects.toThrow(/lookup failed/);
  });
});

describe("candidateTypeList", () => {
  it("renders the input types when the candidate is usable", () => {
    const candidate = makeCandidate("transfer(address,uint256)", TRANSFER_SELECTOR, { source: "4byte" });
    expect(candidate && candidateTypeList(candidate)).toBe("address, uint256");
  });

  it("returns an empty string for an unusable candidate", () => {
    const candidate = makeCandidate("nonsense", TRANSFER_SELECTOR, { source: "4byte" });
    expect(candidate && candidateTypeList(candidate)).toBe("");
  });
});
