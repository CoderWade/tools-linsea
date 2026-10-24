import { endpointHost, resolveRpc, type ChainConfig, type RpcSettings } from "./chains";

export type RpcOptions = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type RpcCall = { method: string; params: unknown[] };

export type RpcFailure = { code?: number; message: string; data?: unknown };

export type RpcBatchResult = { ok: true; result: string } | { ok: false; error: RpcFailure };

export type RpcSession = {
  chain: ChainConfig;
  endpoint: string;
  source: string;
  sourceLabel: string;
  host: string;
  requestedBlockTag: string;
  blockTag: string;
  blockNumber: bigint | null;
};

const DEFAULT_TIMEOUT_MS = 20000;
const CHAIN_ID_TTL_MS = 5 * 60 * 1000;
const chainIdCache = new Map<string, { value: number; at: number }>();

type JsonRpcPayload = {
  jsonrpc?: string;
  id?: number;
  result?: unknown;
  error?: RpcFailure;
};

export function clearChainIdCache() {
  chainIdCache.clear();
}

export async function rpcRequest(endpoint: string, method: string, params: unknown[], options: RpcOptions = {}) {
  const payload = await postJson<JsonRpcPayload>(endpoint, { jsonrpc: "2.0", id: Math.floor(Math.random() * 1e9), method, params }, options);
  if (payload.error) throw new Error(payload.error.message || "RPC request failed.");
  if (typeof payload.result !== "string") throw new Error(`RPC method ${method} did not return a string result.`);
  return payload.result;
}

export async function rpcBatch(endpoint: string, calls: RpcCall[], options: RpcOptions & { fallbackToSequential?: boolean } = {}): Promise<RpcBatchResult[]> {
  if (!calls.length) return [];
  const payloads = calls.map((call, index) => ({ jsonrpc: "2.0", id: index + 1, method: call.method, params: call.params }));
  let payload: JsonRpcPayload | JsonRpcPayload[];
  try {
    payload = await postJson<JsonRpcPayload | JsonRpcPayload[]>(endpoint, payloads, options);
  } catch (error) {
    if (!options.fallbackToSequential) throw error;
    return sequential(endpoint, calls, options);
  }
  if (!Array.isArray(payload)) {
    if (options.fallbackToSequential) return sequential(endpoint, calls, options);
    throw new Error(payload.error?.message || "RPC endpoint did not return a JSON-RPC batch response.");
  }
  const byId = new Map(payload.map((item) => [item.id, item]));
  return calls.map((_, index) => {
    const item = byId.get(index + 1);
    if (!item) return { ok: false, error: { message: "RPC batch response is missing this call." } };
    if (item.error) return { ok: false, error: item.error };
    if (typeof item.result !== "string") return { ok: false, error: { message: "RPC batch result is not a string." } };
    return { ok: true, result: item.result };
  });
}

export async function rpcChainId(endpoint: string, options: RpcOptions = {}) {
  const cached = chainIdCache.get(endpoint);
  if (cached && Date.now() - cached.at < CHAIN_ID_TTL_MS) return cached.value;
  const raw = await rpcRequest(endpoint, "eth_chainId", [], options);
  if (!/^(0x[a-fA-F0-9]+|\d+)$/.test(raw.trim())) throw new Error(`RPC endpoint returned an invalid chainId: ${raw}`);
  const chainId = Number(BigInt(raw.trim()));
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error(`RPC endpoint returned an invalid chainId: ${raw}`);
  chainIdCache.set(endpoint, { value: chainId, at: Date.now() });
  return chainId;
}

export async function assertChain(endpoint: string, chain: ChainConfig, options: RpcOptions = {}) {
  const actual = await rpcChainId(endpoint, options);
  if (actual !== chain.chainId) {
    throw new Error(`RPC endpoint reports chainId ${actual}, but ${chain.label} (${chain.chainId}) is selected. Check Settings and the custom RPC URL before trusting any result.`);
  }
  return actual;
}

export async function resolveBlockTag(endpoint: string, input: string, options: RpcOptions = {}) {
  const requested = input.trim() || "latest";
  const normalized = requested.toLowerCase();
  if (normalized === "latest") {
    const raw = await rpcRequest(endpoint, "eth_blockNumber", [], options);
    const blockNumber = parseBlockNumber(raw);
    return { requested, blockTag: `0x${blockNumber.toString(16)}`, blockNumber };
  }
  if (["pending", "safe", "finalized", "earliest"].includes(normalized)) {
    return { requested, blockTag: normalized, blockNumber: normalized === "earliest" ? 0n : null };
  }
  if (/^(0x[a-fA-F0-9]+|\d+)$/.test(requested)) {
    const blockNumber = parseBlockNumber(requested);
    return { requested, blockTag: `0x${blockNumber.toString(16)}`, blockNumber };
  }
  throw new Error(`Invalid block tag "${input}". Use latest, earliest, safe, finalized, a decimal block number, or 0x hex.`);
}

export async function openRpcSession(settings: RpcSettings, requestedBlockTag = "latest", options: RpcOptions = {}): Promise<RpcSession> {
  const target = resolveRpc(settings);
  await assertChain(target.url, target.chain, options);
  const block = await resolveBlockTag(target.url, requestedBlockTag, options);
  return {
    chain: target.chain,
    endpoint: target.url,
    source: target.source,
    sourceLabel: target.sourceLabel,
    host: target.host,
    requestedBlockTag: block.requested,
    blockTag: block.blockTag,
    blockNumber: block.blockNumber,
  };
}

function parseBlockNumber(raw: string) {
  if (!/^(0x[a-fA-F0-9]+|\d+)$/.test(raw.trim())) throw new Error(`RPC returned an invalid block number: ${raw}`);
  const blockNumber = BigInt(raw.trim());
  if (blockNumber < 0n || blockNumber >= (1n << 64n)) throw new Error(`RPC block number is out of range: ${raw}`);
  return blockNumber;
}

async function sequential(endpoint: string, calls: RpcCall[], options: RpcOptions): Promise<RpcBatchResult[]> {
  const results: RpcBatchResult[] = [];
  for (const call of calls) {
    try {
      results.push({ ok: true, result: await rpcRequest(endpoint, call.method, call.params, options) });
    } catch (error) {
      results.push({ ok: false, error: { message: (error as Error).message } });
    }
  }
  return results;
}

async function postJson<T>(endpoint: string, body: unknown, options: RpcOptions): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", forwardAbort, { once: true });
  }
  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`RPC endpoint returned non-JSON (HTTP ${response.status}): ${text.slice(0, 120)}`);
    }
    if (!response.ok) {
      const failure = payload as JsonRpcPayload;
      throw new Error(`RPC endpoint HTTP ${response.status}: ${failure.error?.message || text.slice(0, 120)}`);
    }
    return payload as T;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(options.signal?.aborted ? "RPC request cancelled." : `RPC request timed out after ${timeoutMs}ms.`);
    }
    if (isTransportError(error)) {
      throw new Error(`Could not reach ${endpointHost(endpoint)}. Check the RPC URL, DNS, and whether the endpoint allows browser CORS requests. (${(error as Error).message})`);
    }
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", forwardAbort);
  }
}

function isTransportError(error: unknown) {
  if (!(error instanceof TypeError)) return false;
  return /failed to fetch|networkerror|load failed|network request failed/i.test(error.message);
}
