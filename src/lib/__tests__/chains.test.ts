import { describe, expect, it } from "vitest";
import {
  CHAINS,
  CUSTOM_CHAIN_ID,
  chainSelectOptions,
  endpointHost,
  normalizeRpcUrl,
  parseChainIdInput,
  resolveRpc,
  validateRpcSettings,
  type RpcSettings,
} from "../chains";

const base: RpcSettings = {
  defaultChain: "ethereum",
  customRpcUrl: "",
  customChainId: "",
  customChainLabel: "",
  alchemyKey: "",
  infuraKey: "",
};

describe("chain registry", () => {
  it("includes Anubis mainnet with chainId 6714 and a public RPC", () => {
    const anubis = CHAINS.find((chain) => chain.id === "anubis");
    expect(anubis).toBeDefined();
    expect(anubis?.chainId).toBe(6714);
    expect(anubis?.rpcUrl).toBe("https://rpc.anubispace.org");
    expect(anubis?.nativeSymbol).toBe("DAI");
  });

  it("keeps every chain id unique", () => {
    const ids = CHAINS.map((chain) => chain.chainId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exposes a custom chain option in the settings dropdown", () => {
    const options = chainSelectOptions();
    expect(options.some((option) => option.value === CUSTOM_CHAIN_ID)).toBe(true);
    expect(options.some((option) => option.value === "anubis")).toBe(true);
  });
});

describe("parseChainIdInput", () => {
  it("accepts decimal and hex", () => {
    expect(parseChainIdInput("6714")).toBe(6714);
    expect(parseChainIdInput("0x1a3a")).toBe(6714);
  });

  it("rejects empty, negative, zero, and garbage input", () => {
    expect(() => parseChainIdInput("")).toThrow(/required/i);
    expect(() => parseChainIdInput("0")).toThrow(/out of range/i);
    expect(() => parseChainIdInput("-1")).toThrow(/decimal or 0x hex/i);
    expect(() => parseChainIdInput("anubis")).toThrow(/decimal or 0x hex/i);
  });
});

describe("normalizeRpcUrl", () => {
  it("trims trailing slashes and keeps http endpoints", () => {
    expect(normalizeRpcUrl("https://rpc.anubispace.org/")).toBe("https://rpc.anubispace.org");
    expect(normalizeRpcUrl("http://127.0.0.1:8545")).toBe("http://127.0.0.1:8545");
  });

  it("treats an empty override as absent", () => {
    expect(normalizeRpcUrl("   ")).toBe("");
  });

  it("rejects non-http protocols and embedded credentials", () => {
    expect(() => normalizeRpcUrl("ws://rpc.example.org")).toThrow(/http/i);
    expect(() => normalizeRpcUrl("ftp://rpc.example.org")).toThrow(/http/i);
    expect(() => normalizeRpcUrl("https://user:pass@rpc.example.org")).toThrow(/credentials/i);
    expect(() => normalizeRpcUrl("rpc.anubispace.org")).toThrow(/valid http/i);
  });
});

describe("resolveRpc priority", () => {
  it("uses a bundled public RPC for Anubis without any API key", () => {
    const resolved = resolveRpc({ ...base, defaultChain: "anubis" });
    expect(resolved.url).toBe("https://rpc.anubispace.org");
    expect(resolved.source).toBe("chain");
    expect(resolved.chain.chainId).toBe(6714);
  });

  it("prefers an explicit RPC override over the bundled endpoint", () => {
    const resolved = resolveRpc({ ...base, defaultChain: "anubis", customRpcUrl: "https://my-anubis-node.example.org" });
    expect(resolved.url).toBe("https://my-anubis-node.example.org");
    expect(resolved.source).toBe("custom");
    expect(resolved.chain.chainId).toBe(6714);
  });

  it("uses Alchemy for chains Alchemy serves", () => {
    const resolved = resolveRpc({ ...base, defaultChain: "bsc", alchemyKey: "key-123" });
    expect(resolved.url).toBe("https://bnb-mainnet.g.alchemy.com/v2/key-123");
    expect(resolved.source).toBe("alchemy");
  });

  it("uses Infura only where Infura has a slug", () => {
    const resolved = resolveRpc({ ...base, defaultChain: "polygon", infuraKey: "key-456" });
    expect(resolved.url).toBe("https://polygon-mainnet.infura.io/v3/key-456");
    expect(resolved.source).toBe("infura");
  });

  it("never silently falls back to Ethereum mainnet for an unsupported provider", () => {
    expect(() => resolveRpc({ ...base, defaultChain: "bsc", infuraKey: "key-456" })).toThrow(/No RPC endpoint for BNB Smart Chain \(56\)/);
  });

  it("builds a custom chain from user input", () => {
    const resolved = resolveRpc({ ...base, defaultChain: CUSTOM_CHAIN_ID, customChainId: "0x1a3a", customChainLabel: "Anubis (private)", customRpcUrl: "https://rpc.anubispace.org" });
    expect(resolved.chain.chainId).toBe(6714);
    expect(resolved.chain.label).toBe("Anubis (private)");
    expect(resolved.source).toBe("custom");
  });

  it("rejects a custom chain with no RPC override", () => {
    expect(() => resolveRpc({ ...base, defaultChain: CUSTOM_CHAIN_ID, customChainId: "6714" })).toThrow(/No RPC endpoint for/);
  });

  it("rejects unknown chain ids", () => {
    expect(() => resolveRpc({ ...base, defaultChain: "solana" })).toThrow(/Unknown chain/);
  });
});

describe("validateRpcSettings", () => {
  it("returns null for a valid Anubis configuration", () => {
    expect(validateRpcSettings({ ...base, defaultChain: "anubis" })).toBeNull();
  });

  it("reports a missing custom chain id", () => {
    expect(validateRpcSettings({ ...base, defaultChain: CUSTOM_CHAIN_ID, customRpcUrl: "https://rpc.anubispace.org" })).toMatch(/chain ID is required/i);
  });

  it("reports a malformed RPC override", () => {
    expect(validateRpcSettings({ ...base, defaultChain: "anubis", customRpcUrl: "rpc.anubispace.org" })).toMatch(/valid http/i);
  });
});

describe("endpointHost", () => {
  it("prints host names without leaking path secrets", () => {
    expect(endpointHost("https://rpc.anubispace.org")).toBe("rpc.anubispace.org");
    expect(endpointHost("https://eth-mainnet.g.alchemy.com/v2/secret-key")).toBe("eth-mainnet.g.alchemy.com");
    expect(endpointHost("http://127.0.0.1:8545")).toBe("127.0.0.1:8545");
  });
});
