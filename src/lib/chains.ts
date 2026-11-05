/**
 * A publicly reachable, keyless RPC endpoint.
 *
 * `archive` marks endpoints verified to serve historical state. Everything
 * below was probed with eth_chainId and an eth_call at a recent block; the
 * archive flag additionally required a successful eth_call at an old block.
 * Endpoints drift, so the UI lets the user pick and reports failures plainly.
 */
export type FreeEndpoint = {
  url: string;
  label: string;
  archive: boolean;
  note: { en: string; zh: string };
};

export type ChainConfig = {
  id: string;
  chainId: number;
  label: string;
  shortLabel: string;
  rpcUrl?: string;
  alchemy?: string;
  infura?: string;
  explorer?: string;
  nativeSymbol: string;
  freeEndpoints: readonly FreeEndpoint[];
};

export type EndpointSource = "custom" | "chain" | "alchemy" | "infura";

export type ResolvedRpc = {
  url: string;
  source: EndpointSource;
  sourceLabel: string;
  host: string;
  chain: ChainConfig;
};

export type RpcSettings = {
  defaultChain: string;
  customRpcUrl: string;
  customChainId: string;
  customChainLabel: string;
  alchemyKey: string;
  infuraKey: string;
};

export const CUSTOM_CHAIN_ID = "custom";

export const CHAINS: readonly ChainConfig[] = [
  {
    id: "ethereum",
    chainId: 1,
    label: "Ethereum Mainnet",
    shortLabel: "Ethereum",
    alchemy: "eth-mainnet",
    infura: "mainnet",
    explorer: "https://etherscan.io",
    nativeSymbol: "ETH",
    freeEndpoints: [
      { url: "https://ethereum-rpc.publicnode.com", label: "PublicNode", archive: false, note: { en: "Live state only; historical blocks need archive", zh: "仅最新状态，历史区块需 archive 节点" } },
      { url: "https://eth.drpc.org", label: "dRPC", archive: true, note: { en: "Serves historical state; public rate limit", zh: "支持历史状态，公共端点有限流" } },
      { url: "https://cloudflare-eth.com", label: "Cloudflare", archive: false, note: { en: "Fast, but rejects some eth_call requests", zh: "速度快，但部分 eth_call 会被拒绝" } },
      { url: "https://eth-mainnet.public.blastapi.io", label: "Blast", archive: true, note: { en: "Serves historical state; rate limited", zh: "支持历史状态，有限流" } },
    ],
  },
  {
    id: "sepolia",
    chainId: 11155111,
    label: "Sepolia Testnet",
    shortLabel: "Sepolia",
    alchemy: "eth-sepolia",
    infura: "sepolia",
    explorer: "https://sepolia.etherscan.io",
    nativeSymbol: "ETH",
    freeEndpoints: [
      { url: "https://ethereum-sepolia-rpc.publicnode.com", label: "PublicNode", archive: false, note: { en: "Live state only", zh: "仅最新状态" } },
    ],
  },
  {
    id: "polygon",
    chainId: 137,
    label: "Polygon Mainnet",
    shortLabel: "Polygon",
    alchemy: "polygon-mainnet",
    infura: "polygon-mainnet",
    explorer: "https://polygonscan.com",
    nativeSymbol: "POL",
    freeEndpoints: [
      { url: "https://polygon-bor-rpc.publicnode.com", label: "PublicNode", archive: false, note: { en: "Live state only", zh: "仅最新状态" } },
      { url: "https://polygon.drpc.org", label: "dRPC", archive: false, note: { en: "Public rate limit", zh: "公共端点有限流" } },
    ],
  },
  {
    id: "bsc",
    chainId: 56,
    label: "BNB Smart Chain",
    shortLabel: "BSC",
    alchemy: "bnb-mainnet",
    explorer: "https://bscscan.com",
    nativeSymbol: "BNB",
    freeEndpoints: [
      { url: "https://bsc-dataseed1.bnbchain.org", label: "BSC Dataseed 1", archive: false, note: { en: "Official BNB Chain seed node; live state only", zh: "BNB Chain 官方种子节点，仅最新状态" } },
      { url: "https://bsc-dataseed2.bnbchain.org", label: "BSC Dataseed 2", archive: false, note: { en: "Official BNB Chain seed node; live state only", zh: "BNB Chain 官方种子节点，仅最新状态" } },
      { url: "https://rpc.48.club", label: "48.club", archive: false, note: { en: "Community node; live state only", zh: "社区节点，仅最新状态" } },
      { url: "https://bsc-rpc.publicnode.com", label: "PublicNode", archive: false, note: { en: "Live state only; archive needs a token", zh: "仅最新状态，archive 需令牌" } },
      { url: "https://bsc-mainnet.public.blastapi.io", label: "Blast", archive: true, note: { en: "Serves historical state; rate limited", zh: "支持历史状态，有限流" } },
      { url: "https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3", label: "NodeReal (shared key)", archive: true, note: { en: "Public demo key; historical state works", zh: "公共演示 Key，支持历史状态" } },
    ],
  },
  {
    id: "anubis",
    chainId: 6714,
    label: "Anubis Mainnet",
    shortLabel: "Anubis",
    rpcUrl: "https://rpc.anubispace.org",
    explorer: "https://browser.anubispace.org",
    nativeSymbol: "DAI",
    freeEndpoints: [
      { url: "https://rpc.anubispace.org", label: "Anubis official", archive: false, note: { en: "Official keyless endpoint", zh: "官方端点，无需 Key" } },
    ],
  },
] as const;

const SOURCE_LABELS: Record<EndpointSource, string> = {
  custom: "custom RPC override",
  chain: "public chain RPC",
  alchemy: "Alchemy BYOK",
  infura: "Infura BYOK",
};

export function chainById(id: string) {
  return CHAINS.find((chain) => chain.id === id);
}

export function chainSelectOptions() {
  return [
    ...CHAINS.map((chain) => ({ value: chain.id, label: chain.label, hint: `chainId ${chain.chainId} · ${chain.nativeSymbol}` })),
    { value: CUSTOM_CHAIN_ID, label: "Custom EVM chain", hint: "requires chainId and RPC URL" },
  ];
}

export function parseChainIdInput(value: string) {
  const input = value.trim();
  if (!input) throw new Error("Custom chain ID is required.");
  if (!/^(0x[a-fA-F0-9]+|\d+)$/.test(input)) throw new Error("Custom chain ID must be decimal or 0x hex.");
  const parsed = BigInt(input);
  if (parsed <= 0n || parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Custom chain ID is out of range.");
  return Number(parsed);
}

export function normalizeRpcUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Custom RPC URL must be a valid http(s) URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Custom RPC URL must use http or https.");
  if (parsed.username || parsed.password) throw new Error("Custom RPC URL must not embed credentials. Put provider keys in the path instead.");
  return trimmed;
}

export function endpointHost(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  } catch {
    return url;
  }
}

export function validateRpcSettings(settings: RpcSettings) {
  try {
    if (settings.defaultChain !== CUSTOM_CHAIN_ID && !chainById(settings.defaultChain)) {
      throw new Error(`Unknown chain "${settings.defaultChain}". Pick a chain from Settings.`);
    }
    if (settings.defaultChain === CUSTOM_CHAIN_ID) {
      parseChainIdInput(settings.customChainId);
    }
    normalizeRpcUrl(settings.customRpcUrl || "");
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

export function resolveRpc(settings: RpcSettings): ResolvedRpc {
  const chain = settings.defaultChain === CUSTOM_CHAIN_ID ? customChain(settings) : chainById(settings.defaultChain);
  if (!chain) throw new Error(`Unknown chain "${settings.defaultChain}". Pick a chain from Settings.`);

  const customUrl = normalizeRpcUrl(settings.customRpcUrl || "");
  if (customUrl) return resolved(customUrl, "custom", chain);

  if (chain.rpcUrl) return resolved(chain.rpcUrl, "chain", chain);

  const alchemyKey = settings.alchemyKey.trim();
  if (alchemyKey && chain.alchemy) return resolved(`https://${chain.alchemy}.g.alchemy.com/v2/${alchemyKey}`, "alchemy", chain);

  const infuraKey = settings.infuraKey.trim();
  if (infuraKey && chain.infura) return resolved(`https://${chain.infura}.infura.io/v3/${infuraKey}`, "infura", chain);

  const providers = [chain.alchemy ? "an Alchemy key" : "", chain.infura ? "an Infura key" : ""].filter(Boolean).join(" or ");
  throw new Error(`No RPC endpoint for ${chain.label} (${chain.chainId}). Add a custom RPC URL in Settings${providers ? ` or configure ${providers}` : ""}.`);
}

function customChain(settings: RpcSettings): ChainConfig {
  return {
    id: CUSTOM_CHAIN_ID,
    chainId: parseChainIdInput(settings.customChainId),
    label: settings.customChainLabel.trim() || "Custom EVM chain",
    shortLabel: "Custom",
    nativeSymbol: "native",
    freeEndpoints: [],
  };
}

function resolved(url: string, source: EndpointSource, chain: ChainConfig): ResolvedRpc {
  return { url, source, sourceLabel: SOURCE_LABELS[source], host: endpointHost(url), chain };
}
