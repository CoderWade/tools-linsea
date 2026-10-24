import { describe, expect, it, vi } from "vitest";
import { assertChain, clearChainIdCache, resolveBlockTag, rpcBatch, rpcChainId, rpcRequest } from "../rpc";
import { CHAINS } from "../chains";

const ANUBIS = CHAINS.find((chain) => chain.id === "anubis")!;
const BSC = CHAINS.find((chain) => chain.id === "bsc")!;

type Call = { method: string; params: unknown[] };

function fakeFetch(handler: (body: unknown, init?: RequestInit) => { status?: number; json: unknown } | Promise<{ status?: number; json: unknown }>) {
  const calls: Call[] = [];
  const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (Array.isArray(body)) calls.push(...body);
    else calls.push(body);
    const { status = 200, json } = await handler(body, init);
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  });
  return { fetcher: fetcher as unknown as typeof fetch, calls };
}

describe("rpcRequest", () => {
  it("sends a JSON-RPC 2.0 envelope and returns the string result", async () => {
    const { fetcher, calls } = fakeFetch(() => ({ json: { jsonrpc: "2.0", id: 1, result: "0xabc" } }));
    const result = await rpcRequest("https://rpc.example.org", "eth_getStorageAt", ["0xabc", "0x0", "latest"], { fetcher });
    expect(result).toBe("0xabc");
    expect(calls[0].method).toBe("eth_getStorageAt");
    expect(calls[0].params).toEqual(["0xabc", "0x0", "latest"]);
  });

  it("surfaces JSON-RPC errors instead of returning undefined", async () => {
    const { fetcher } = fakeFetch(() => ({ json: { jsonrpc: "2.0", id: 1, error: { code: -32602, message: "invalid argument 0: hex string has length 2" } } }));
    await expect(rpcRequest("https://rpc.example.org", "eth_getStorageAt", [], { fetcher })).rejects.toThrow(/invalid argument/);
  });

  it("reports non-JSON responses with the HTTP status", async () => {
    const fetcher = vi.fn(async () => new Response("<html>bad gateway</html>", { status: 502 })) as unknown as typeof fetch;
    await expect(rpcRequest("https://rpc.example.org", "eth_chainId", [], { fetcher })).rejects.toThrow(/non-JSON \(HTTP 502\)/);
  });

  it("explains transport failures with the endpoint host", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(rpcRequest("https://rpc.anubispace.org", "eth_chainId", [], { fetcher })).rejects.toThrow(/Could not reach rpc\.anubispace\.org[\s\S]*CORS/);
  });

  it("aborts after the configured timeout", async () => {
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) as unknown as typeof fetch;
    await expect(rpcRequest("https://rpc.example.org", "eth_chainId", [], { fetcher, timeoutMs: 20 })).rejects.toThrow(/timed out after 20ms/);
  });
});

describe("rpcBatch", () => {
  it("maps batched responses back by position even when out of order", async () => {
    const { fetcher } = fakeFetch(() => ({
      json: [
        { jsonrpc: "2.0", id: 2, result: "0x22" },
        { jsonrpc: "2.0", id: 1, result: "0x11" },
      ],
    }));
    const results = await rpcBatch("https://rpc.example.org", [
      { method: "eth_getStorageAt", params: ["0xa", "0x0", "latest"] },
      { method: "eth_getStorageAt", params: ["0xa", "0x1", "latest"] },
    ], { fetcher });
    expect(results).toEqual([{ ok: true, result: "0x11" }, { ok: true, result: "0x22" }]);
  });

  it("keeps per-call errors isolated", async () => {
    const { fetcher } = fakeFetch(() => ({
      json: [
        { jsonrpc: "2.0", id: 1, result: "0x11" },
        { jsonrpc: "2.0", id: 2, error: { message: "execution timeout" } },
      ],
    }));
    const results = await rpcBatch("https://rpc.example.org", [
      { method: "eth_getStorageAt", params: [] },
      { method: "eth_getStorageAt", params: [] },
    ], { fetcher });
    expect(results[0]).toEqual({ ok: true, result: "0x11" });
    expect(results[1]).toEqual({ ok: false, error: { message: "execution timeout" } });
  });

  it("falls back to sequential reads when the endpoint rejects batches", async () => {
    let seen = 0;
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (Array.isArray(body)) {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { message: "batch not supported" } }), { status: 200 });
      }
      seen += 1;
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: `0x${seen}` }), { status: 200 });
    }) as unknown as typeof fetch;
    const results = await rpcBatch("https://rpc.example.org", [
      { method: "eth_getStorageAt", params: [] },
      { method: "eth_getStorageAt", params: [] },
    ], { fetcher, fallbackToSequential: true });
    expect(results).toEqual([{ ok: true, result: "0x1" }, { ok: true, result: "0x2" }]);
  });

  it("returns an empty array for zero calls", async () => {
    const { fetcher } = fakeFetch(() => ({ json: [] }));
    expect(await rpcBatch("https://rpc.example.org", [], { fetcher })).toEqual([]);
  });
});

describe("chain id verification", () => {
  it("accepts a matching chainId and caches it", async () => {
    clearChainIdCache();
    const { fetcher, calls } = fakeFetch(() => ({ json: { jsonrpc: "2.0", id: 1, result: "0x1a3a" } }));
    await expect(assertChain("https://rpc.anubispace.org", ANUBIS, { fetcher })).resolves.toBe(6714);
    await rpcChainId("https://rpc.anubispace.org", { fetcher });
    expect(calls).toHaveLength(1);
  });

  it("rejects a mismatched chainId with an explicit warning", async () => {
    clearChainIdCache();
    const { fetcher } = fakeFetch(() => ({ json: { jsonrpc: "2.0", id: 1, result: "0x1a3a" } }));
    await expect(assertChain("https://rpc.anubispace.org", BSC, { fetcher })).rejects.toThrow(/reports chainId 6714, but BNB Smart Chain \(56\) is selected/);
  });

  it("rejects malformed chainId results", async () => {
    clearChainIdCache();
    const { fetcher } = fakeFetch(() => ({ json: { jsonrpc: "2.0", id: 1, result: "0xzz" } }));
    await expect(rpcChainId("https://rpc.example.org", { fetcher })).rejects.toThrow(/invalid chainId/);
  });
});

describe("resolveBlockTag", () => {
  it("pins latest to a concrete block number", async () => {
    const { fetcher } = fakeFetch(() => ({ json: { jsonrpc: "2.0", id: 1, result: "0x1084133" } }));
    const resolved = await resolveBlockTag("https://rpc.anubispace.org", "latest", { fetcher });
    expect(resolved.blockTag).toBe("0x1084133");
    expect(resolved.blockNumber).toBe(17318195n);
    expect(resolved.requested).toBe("latest");
  });

  it("normalizes decimal block numbers to hex", async () => {
    const { fetcher } = fakeFetch(() => ({ json: {} }));
    const resolved = await resolveBlockTag("https://rpc.anubispace.org", "16777216", { fetcher });
    expect(resolved.blockTag).toBe("0x1000000");
    expect(resolved.blockNumber).toBe(16777216n);
  });

  it("passes through safe and finalized tags", async () => {
    const { fetcher } = fakeFetch(() => ({ json: {} }));
    expect((await resolveBlockTag("https://rpc.example.org", "finalized", { fetcher })).blockTag).toBe("finalized");
    expect((await resolveBlockTag("https://rpc.example.org", "earliest", { fetcher })).blockNumber).toBe(0n);
  });

  it("rejects non-block strings", async () => {
    const { fetcher } = fakeFetch(() => ({ json: {} }));
    await expect(resolveBlockTag("https://rpc.example.org", "yesterday", { fetcher })).rejects.toThrow(/Invalid block tag/);
  });
});
