import {
  Braces,
  Calculator,
  Clock3,
  Code2,
  Command,
  Contrast,
  FileCode2,
  Fingerprint,
  Globe2,
  KeyRound,
  Layers3,
  LockKeyhole,
  Moon,
  Binary,
  Route,
  Search,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Button, Combobox, CommandInput, CopyButton, Field, IconButton, Input, Modal, Notice, Panel, ResultRows, Select, Tabs, Textarea, cn } from "./components/ui";
import {
  decodeStorageValue,
  findStorageEntry,
  keccak256Hex,
  mappingSlotByType,
  parseMappingDeclaration,
  parseSlotIndex,
  parseSourceLayout,
  toSlotHex,
} from "./lib/evm";
import { CHAINS, CUSTOM_CHAIN_ID, chainSelectOptions, parseChainIdInput, resolveRpc, validateRpcSettings } from "./lib/chains";
import { openRpcSession, rpcBatch, rpcRequest, type RpcSession } from "./lib/rpc";

type CategoryId = "reverse" | "developer" | "general";
type ToolId =
  | "storage-slot"
  | "source-layout"
  | "proxy-slot"
  | "calldata-decoder"
  | "unit-converter"
  | "selector-finder"
  | "hash-suite"
  | "symmetric-encryption"
  | "jwt-inspector"
  | "json-studio"
  | "timestamp-pro"
  | "base-converter"
  | "text-compare"
  | "market-clock";

type Tool = {
  id: ToolId;
  category: CategoryId;
  name: string;
  zh: string;
  description: string;
  keywords: string[];
  badges: string[];
  icon: ReactNode;
};

type Settings = {
  alchemyKey: string;
  infuraKey: string;
  defaultChain: string;
  customRpcUrl: string;
  customChainId: string;
  customChainLabel: string;
  privacyMode: boolean;
};

const STATE_KEY = "linsea-react-state";
const SETTINGS_KEY = "linsea-tools-settings";

const categories: Array<{ id: CategoryId; name: string; zh: string }> = [
  { id: "reverse", name: "Reverse Security", zh: "逆向安全" },
  { id: "developer", name: "Developer", zh: "通用开发" },
  { id: "general", name: "General Tools", zh: "通用工具" },
];

const tools: Tool[] = [
  { id: "storage-slot", category: "reverse", name: "Storage Slot Inspector", zh: "存储槽检查器", description: "Read raw slots and probe mapping keys with read-only RPC.", keywords: ["slot", "storage", "mapping", "eth_getStorageAt"], badges: ["Raw read", "Mapping probe"], icon: <Layers3 /> },
  { id: "source-layout", category: "reverse", name: "Source Layout Resolver", zh: "源码槽位解析器", description: "Paste verified or decompiled Solidity source to resolve names into storage slots.", keywords: ["source", "layout", "decompiled", "verified", "slot"], badges: ["Local first", "Layout aware"], icon: <FileCode2 /> },
  { id: "proxy-slot", category: "reverse", name: "Proxy Slot Finder", zh: "代理槽探测器", description: "Probe ERC-1967 implementation/admin/beacon slots.", keywords: ["proxy", "erc1967", "beacon", "implementation"], badges: ["Read only", "RPC"], icon: <Route /> },
  { id: "calldata-decoder", category: "reverse", name: "Calldata Decoder", zh: "Calldata 解码器", description: "Split selector and ABI words, then inspect calldata structure.", keywords: ["calldata", "selector", "abi"], badges: ["Local", "ABI words"], icon: <Code2 /> },
  { id: "unit-converter", category: "reverse", name: "Unit Converter", zh: "单位转换器", description: "Convert Wei, Gwei, Ether, and token decimals safely.", keywords: ["wei", "gwei", "ether", "decimals"], badges: ["BigInt", "Bidirectional"], icon: <Calculator /> },
  { id: "selector-finder", category: "reverse", name: "4Byte / Selector Finder", zh: "4Byte / Selector 查询", description: "Generate selectors and event topic0 locally.", keywords: ["4byte", "selector", "topic0", "function"], badges: ["Keccak", "Local"], icon: <Fingerprint /> },
  { id: "hash-suite", category: "reverse", name: "Encoder / Hash Suite", zh: "编码与哈希套件", description: "Hash, Base64, URL encode/decode, and Keccak utilities.", keywords: ["hash", "sha256", "base64", "url"], badges: ["Crypto", "Local"], icon: <KeyRound /> },
  { id: "symmetric-encryption", category: "reverse", name: "Symmetric Encryption", zh: "对称加密", description: "AES-GCM local encryption/decryption playground.", keywords: ["aes", "gcm", "encrypt", "decrypt"], badges: ["Sensitive", "Local"], icon: <LockKeyhole /> },
  { id: "jwt-inspector", category: "reverse", name: "JWT Inspector", zh: "JWT 检查器", description: "Decode JWT header and payload without sending it anywhere.", keywords: ["jwt", "token", "exp", "payload"], badges: ["Local", "Auth"], icon: <ShieldCheck /> },
  { id: "json-studio", category: "developer", name: "JSON Studio", zh: "JSON 工作台", description: "Format, minify, validate, and infer TypeScript shapes.", keywords: ["json", "format", "typescript"], badges: ["Formatter", "Local"], icon: <Braces /> },
  { id: "timestamp-pro", category: "developer", name: "Timestamp Pro", zh: "时间戳工具", description: "Convert timestamps and dates across IANA timezones.", keywords: ["timestamp", "unix", "timezone"], badges: ["IANA", "Date"], icon: <Clock3 /> },
  { id: "base-converter", category: "developer", name: "Base Converter", zh: "进制转换器", description: "Convert integers across binary, octal, decimal, hex, and custom bases.", keywords: ["base", "radix", "binary", "hex", "decimal", "进制", "二进制", "十六进制"], badges: ["BigInt", "2-36"], icon: <Binary /> },
  { id: "text-compare", category: "developer", name: "Text Compare", zh: "文本对比", description: "Compare two text versions with readable line-level diffs.", keywords: ["diff", "text", "compare"], badges: ["Diff", "Local"], icon: <Contrast /> },
  { id: "market-clock", category: "general", name: "Market Clock", zh: "时间看盘", description: "Live Beijing / Hong Kong / New York clocks with US DST state and trading-session status for US, A-share, and HK markets.", keywords: ["market", "clock", "timezone", "trading", "dst", "开盘", "收盘", "夏令时", "冬令时", "美股", "港股", "A股", "时间"], badges: ["Live clock", "DST aware", "Trading hours"], icon: <Globe2 /> },
];

const defaultSettings: Settings = { alchemyKey: "", infuraKey: "", defaultChain: "ethereum", customRpcUrl: "", customChainId: "", customChainLabel: "", privacyMode: false };

export function App() {
  const boot = loadState();
  const bootTool = tools.find((tool) => tool.id === boot.tool) || tools[0];
  const [activeCategory, setActiveCategory] = useState<CategoryId>(bootTool.category);
  const [activeToolId, setActiveToolId] = useState<ToolId>(bootTool.id);
  const [theme, setTheme] = useState<"light" | "dark">(boot.theme || "dark");
  const [language, setLanguage] = useState<"en" | "zh">(boot.language || "en");
  const [settings, setSettings] = useState<Settings>({ ...defaultSettings, ...loadSettingsCache(), ...(boot.settings || {}) });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [recent, setRecent] = useState<ToolId[]>(boot.recent || []);

  const activeTool = tools.find((tool) => tool.id === activeToolId) || tools[0];
  const visibleTools = tools.filter((tool) => tool.category === activeCategory);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STATE_KEY, JSON.stringify({ category: activeCategory, tool: activeToolId, theme, language, settings, recent }));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [activeCategory, activeToolId, theme, language, settings, recent]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const selectTool = (id: ToolId) => {
    const next = tools.find((tool) => tool.id === id) || tools[0];
    setActiveToolId(next.id);
    setActiveCategory(next.category);
    setRecent((items) => [next.id, ...items.filter((item) => item !== next.id)].slice(0, 8));
    setCommandOpen(false);
    setCommandQuery("");
  };

  return (
    <div className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)] gap-4 p-4 max-lg:grid-cols-1">
      <aside className="tech-card sticky top-4 flex h-[calc(100vh-2rem)] flex-col p-3 max-lg:static max-lg:h-auto">
        <div className="mb-4 flex items-center gap-3 border-b border-line pb-4">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-accent/35 bg-accent/10 font-black text-accent">L</div>
          <div>
            <div className="font-black text-text">Linsea Tools</div>
            <div className="text-xs text-muted">Security workbench</div>
          </div>
        </div>
        <nav className="grid gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                setActiveCategory(category.id);
                selectTool(tools.find((tool) => tool.category === category.id)?.id || activeToolId);
              }}
              className={cn(
                "flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-sm font-bold transition",
                activeCategory === category.id ? "border-accent/45 bg-accent/10 text-text" : "border-transparent text-muted hover:bg-panel hover:text-text",
              )}
            >
              <span>{language === "zh" ? category.zh : category.name}</span>
              <span className="text-xs text-faint">{tools.filter((tool) => tool.category === category.id).length}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 border-t border-line pt-4">
          <Button variant="default" onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
          <p className="text-xs leading-5 text-faint">Local-first utilities for serious debugging.</p>
        </div>
      </aside>

      <main className="front-canvas min-w-0">
        <header className="tech-card sticky top-4 z-20 mb-4 flex items-center gap-3 p-2 max-md:static max-md:flex-col">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="flex h-12 flex-1 items-center justify-between rounded-2xl border border-line bg-panel px-4 text-left text-muted transition hover:border-accent/45 hover:text-text max-md:w-full"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 text-accent" />
              {language === "zh" ? "搜索工具或操作" : "Search tools or actions"}
            </span>
            <kbd className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px]">Ctrl K</kbd>
          </button>
          <div className="flex gap-2 max-md:w-full max-md:grid max-md:grid-cols-4">
            <span className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-surface px-3 text-xs font-bold text-muted">{settings.privacyMode ? "Privacy on" : "Privacy off"}</span>
            <IconButton onClick={() => setLanguage((item) => (item === "en" ? "zh" : "en"))}>{language.toUpperCase()}</IconButton>
            <IconButton onClick={() => setTheme((item) => (item === "dark" ? "light" : "dark"))}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</IconButton>
            <IconButton onClick={() => setSettingsOpen(true)}>Settings</IconButton>
          </div>
        </header>

        <section className="mb-4 flex items-end justify-between gap-4 px-1 max-md:block">
          <div>
            <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted">
              <span className="rounded-full border border-line bg-surface px-2 py-1">{categoryLabel(activeTool.category, language)}</span>
              <span className="rounded-full border border-line bg-surface px-2 py-1">{activeTool.id}</span>
              <span className="rounded-full border border-accent/35 bg-accent/10 px-2 py-1 text-accent">{chainSummary(settings)}</span>
            </div>
            <h1 className="text-4xl font-black tracking-normal text-text max-md:text-3xl">{language === "zh" ? activeTool.zh : activeTool.name}</h1>
            <p className="mt-2 max-w-3xl text-base text-muted">{activeTool.description}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 max-md:mt-3 max-md:justify-start">
            {activeTool.badges.map((badge) => (
              <span key={badge} className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted">{badge}</span>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-4 max-xl:grid-cols-1">
          <ToolWorkbench tool={activeTool} settings={settings} />
          <aside className="grid content-start gap-4">
            <Panel title="Tools">
              <div className="grid gap-2">
                {visibleTools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => selectTool(tool.id)}
                    className={cn("grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-xl border p-3 text-left transition", activeToolId === tool.id ? "border-accent/50 bg-accent/10" : "border-line bg-surface hover:border-accent/40 hover:bg-panel")}
                  >
                    <span className="text-accent [&_svg]:h-5 [&_svg]:w-5">{tool.icon}</span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-text">{language === "zh" ? tool.zh : tool.name}</strong>
                      <small className="block truncate text-xs text-faint">{tool.keywords.slice(0, 4).join(" / ")}</small>
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="Recent">
              <div className="grid gap-2">
                {recent.length ? recent.slice(0, 5).map((id) => {
                  const tool = tools.find((item) => item.id === id);
                  return tool ? <Button key={id} variant="ghost" className="justify-start" onClick={() => selectTool(id)}>{language === "zh" ? tool.zh : tool.name}</Button> : null;
                }) : <Notice>No recent tools yet.</Notice>}
              </div>
            </Panel>
            <div className={cn("tech-card grid min-h-[250px] place-items-center border-dashed p-6 text-center", settings.privacyMode && "opacity-55")}>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-faint">Advertisement</div>
                <div className="mt-2 font-bold text-muted">Reserved 300 x 250</div>
                <div className="mt-1 text-xs text-faint">Disabled in Privacy First Mode</div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <SettingsModal open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onSave={setSettings} />
      <CommandPalette open={commandOpen} query={commandQuery} setQuery={setCommandQuery} language={language} onClose={() => setCommandOpen(false)} onSelect={selectTool} />
    </div>
  );
}

function ToolWorkbench({ tool, settings }: { tool: Tool; settings: Settings }) {
  switch (tool.id) {
    case "storage-slot": return <StorageSlotInspector settings={settings} />;
    case "source-layout": return <SourceLayoutResolver />;
    case "proxy-slot": return <ProxySlotFinder settings={settings} />;
    case "calldata-decoder": return <CalldataDecoder />;
    case "unit-converter": return <UnitConverter />;
    case "selector-finder": return <SelectorFinder />;
    case "hash-suite": return <HashSuite />;
    case "symmetric-encryption": return <EncryptionTool />;
    case "jwt-inspector": return <JwtInspector />;
    case "json-studio": return <JsonStudio />;
    case "timestamp-pro": return <TimestampPro />;
    case "base-converter": return <BaseConverter />;
    case "text-compare": return <TextCompare />;
    case "market-clock": return <MarketClock />;
    default: return null;
  }
}

function Workbench({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={cn("grid gap-4", wide ? "grid-cols-1" : "grid-cols-[minmax(330px,.9fr)_minmax(430px,1.1fr)] max-lg:grid-cols-1")}>{children}</div>;
}

function StorageSlotInspector({ settings }: { settings: Settings }) {
  const [mode, setMode] = useState("raw");
  const [contract, setContract] = useState("");
  const [blockTag, setBlockTag] = useState("latest");
  const [slotIndex, setSlotIndex] = useState("");
  const [decodeType, setDecodeType] = useState("bytes32");
  const [declaration, setDeclaration] = useState("mapping(address => bool) public _feeWhiteList;");
  const [mappingKey, setMappingKey] = useState("");
  const [baseSlot, setBaseSlot] = useState("");
  const [scanLimit, setScanLimit] = useState("80");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [output, setOutput] = useState<ReactNode>(<Notice>Enter a slot index or mapping probe parameters.</Notice>);

  const read = async () => {
    setBusy(true);
    setProgress("");
    try {
      if (settings.privacyMode) throw new Error("Privacy First Mode blocks RPC requests.");
      if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) throw new Error("Enter a valid contract address.");
      const session = await openRpcSession(settings, blockTag);
      if (mode === "raw") {
        const slot = toSlotHex(slotIndex);
        const raw = await rpcRequest(session.endpoint, "eth_getStorageAt", [contract, slot, session.blockTag]);
        setOutput(<RawStorageOutput contract={contract} session={session} slotIndex={slotIndex} slot={slot} raw={raw} decodeType={decodeType} />);
        return;
      }

      const layout = parseMappingDeclaration(declaration);
      if (!layout) throw new Error("Enter a mapping declaration such as mapping(address => bool) public flags;");
      if (baseSlot) {
        const valueSlot = mappingSlotByType(mappingKey, layout.keyType, toSlotHex(baseSlot));
        const raw = await rpcRequest(session.endpoint, "eth_getStorageAt", [contract, valueSlot, session.blockTag]);
        setOutput(<MappingReadOutput baseSlot={baseSlot} valueSlot={valueSlot} raw={raw} valueType={layout.valueType} session={session} />);
        return;
      }

      const max = scanLimitValue(scanLimit);
      const matches: MappingMatch[] = [];
      const failures: string[] = [];
      let attempted = 0;
      let scannedTo = -1;
      const chunkSize = 20;
      for (let start = 0; start <= max && matches.length < MAPPING_MATCH_LIMIT; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, max);
        setProgress(`Scanning base slots ${start}–${end} of 0–${max} against block ${session.blockNumber !== null ? `#${session.blockNumber}` : session.blockTag}…`);
        const calls: Array<{ method: string; params: unknown[] }> = [];
        for (let index = start; index <= end; index += 1) {
          calls.push({ method: "eth_getStorageAt", params: [contract, mappingSlotByType(mappingKey, layout.keyType, toSlotHex(BigInt(index))), session.blockTag] });
        }
        attempted += calls.length;
        const results = await rpcBatch(session.endpoint, calls, { fallbackToSequential: true });
        results.forEach((result, index) => {
          if (!result.ok) {
            failures.push(result.error.message);
            return;
          }
          if (BigInt(result.result) !== 0n) matches.push({ base: start + index, slot: String(calls[index].params[1]), raw: result.result });
        });
        scannedTo = end;
      }

      if (!matches.length && attempted > 0 && failures.length === attempted) {
        throw new Error(`All ${attempted} storage reads failed: ${failures[0]}`);
      }
      setOutput(
        <div className="grid gap-4">
          <RpcProvenance session={session} />
          {matches.length
            ? <MappingScanOutput matches={matches} scannedTo={scannedTo} max={max} failures={failures.length} />
            : <Notice tone="warn">{failures.length ? `${failures.length} of ${attempted} reads failed, so this scan is incomplete. ` : ""}No non-zero candidate found in base slots 0–${max}. Zero/false cannot prove a mapping base slot.</Notice>}
        </div>,
      );
    } catch (error) {
      setOutput(<Notice tone="danger">{(error as Error).message}</Notice>);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <Workbench>
      <Panel title="Storage Workbench">
        <div className="grid gap-4">
          <Tabs value={mode} onChange={setMode} options={[{ value: "raw", label: "Raw slot read" }, { value: "mapping", label: "Mapping probe" }]} />
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Field label="Contract address"><Input className="mono" value={contract} onChange={(event) => setContract(event.target.value)} placeholder="0x..." /></Field>
            <Field label="Block tag"><Input className="mono" value={blockTag} onChange={(event) => setBlockTag(event.target.value)} /></Field>
          </div>
          {mode === "raw" ? (
            <>
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <Field label="Slot index"><Input className="mono" value={slotIndex} onChange={(event) => setSlotIndex(event.target.value)} placeholder="23 or 0x17" /></Field>
                <Field label="Decode focus"><Select value={decodeType} onChange={setDecodeType} options={["bytes32", "bool", "uint256", "int256", "address"].map((item) => ({ value: item, label: item }))} /></Field>
              </div>
              <Notice>Reads exactly one storage word with <code>eth_getStorageAt</code>. If Source Layout Resolver says slot #8, enter <code>8</code> here.</Notice>
            </>
          ) : (
            <>
              <Field label="Mapping declaration"><Input className="mono" value={declaration} onChange={(event) => setDeclaration(event.target.value)} /></Field>
              <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
                <Field label="Mapping key"><Input className="mono" value={mappingKey} onChange={(event) => setMappingKey(event.target.value)} placeholder="20666 or 0xaddress" /></Field>
                <Field label="Known base slot"><Input className="mono" value={baseSlot} onChange={(event) => setBaseSlot(event.target.value)} placeholder="optional" /></Field>
                <Field label="Scan range"><Input className="mono" value={scanLimit} onChange={(event) => setScanLimit(event.target.value)} /></Field>
              </div>
              <Notice tone="warn">A scan is evidence, not proof. If the expected value is false/zero, chain storage cannot distinguish it from an unset key.</Notice>
            </>
          )}
          {busy && progress ? <Notice>{progress}</Notice> : null}
          <Button variant="primary" onClick={read} disabled={busy}>{busy ? "Reading…" : "Read storage"}</Button>
        </div>
      </Panel>
      <Panel title="Readout">{output}</Panel>
    </Workbench>
  );
}

type MappingMatch = { base: number; slot: string; raw: string };

const MAPPING_MATCH_LIMIT = 24;

function RpcProvenance({ session }: { session: RpcSession }) {
  return (
    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      <Metric label="Chain" value={session.chain.label} hint={`chainId ${session.chain.chainId} · verified via eth_chainId`} />
      <Metric label="Block" value={session.blockNumber !== null ? `#${session.blockNumber}` : session.blockTag} hint={`${session.sourceLabel} · ${session.host}`} />
    </div>
  );
}

function RawStorageOutput({ contract, session, slotIndex, slot, raw, decodeType }: { contract: string; session: RpcSession; slotIndex: string; slot: string; raw: string; decodeType: string }) {
  return (
    <div className="grid gap-4">
      <RpcProvenance session={session} />
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Metric label="Raw slot" value={slotIndex || String(parseSlotIndex(slot))} />
        <Metric label="RPC method" value="eth_getStorageAt" />
      </div>
      <ResultRows rows={[
        ["Contract", contract],
        ["Chain", `${session.chain.label} (${session.chain.chainId})`],
        ["RPC source", `${session.sourceLabel} · ${session.host}`],
        ["Block requested", session.requestedBlockTag],
        ["Block read", session.blockNumber !== null ? `#${session.blockNumber} (${session.blockTag})` : session.blockTag],
        ["Slot hex", slot],
        ["Raw bytes32", raw],
        [`Decoded ${decodeType}`, decodeStorageValue(raw, decodeType)],
        ["uint256 view", BigInt(raw).toString()],
        ["address view", decodeStorageValue(raw, "address")],
      ]} />
    </div>
  );
}

function MappingReadOutput({ baseSlot, valueSlot, raw, valueType, session }: { baseSlot: string; valueSlot: string; raw: string; valueType: string; session: RpcSession }) {
  return (
    <div className="grid gap-4">
      <RpcProvenance session={session} />
      <ResultRows rows={[
        ["Chain", `${session.chain.label} (${session.chain.chainId})`],
        ["Block read", session.blockNumber !== null ? `#${session.blockNumber}` : session.blockTag],
        ["Base slot", `#${parseSlotIndex(baseSlot).toString()}`],
        ["Value slot", valueSlot],
        ["Raw bytes32", raw],
        [`Decoded ${valueType}`, decodeStorageValue(raw, valueType)],
      ]} />
    </div>
  );
}

function MappingScanOutput({ matches, scannedTo, max, failures }: { matches: MappingMatch[]; scannedTo: number; max: number; failures: number }) {
  return (
    <div className="grid gap-4">
      <ResultRows rows={[
        ["Scanned", `base slots 0–${scannedTo} of 0–${max}`],
        ["Non-zero matches", String(matches.length)],
        ["Failed reads", String(failures)],
        ["Stopped early", matches.length >= MAPPING_MATCH_LIMIT ? `${MAPPING_MATCH_LIMIT} match limit reached` : "scan range exhausted"],
      ]} />
      <div className="grid gap-3">{matches.map((match) => <div key={match.base} className="rounded-2xl border border-line bg-panel p-3"><div className="font-black text-accent">Base slot #{match.base}</div><div className="mt-2 break-all font-mono text-xs text-muted">{match.slot}</div><div className="mt-2 break-all font-mono text-xs text-text">{match.raw}</div></div>)}</div>
      {failures ? <Notice tone="warn">{failures} storage reads failed; treat this scan as incomplete.</Notice> : null}
    </div>
  );
}

function SourceLayoutResolver() {
  const [mode, setMode] = useState("verified");
  const [target, setTarget] = useState("");
  const [contract, setContract] = useState("");
  const [key, setKey] = useState("");
  const [source, setSource] = useState("");
  const result = useMemo(() => {
    if (!source.trim()) return <Notice>Paste verified source or Dedaub decompiled source, then type a variable/getter name.</Notice>;
    try {
      const layout = parseSourceLayout(source, contract, mode === "decompiled" ? "decompiled source" : "verified source");
      if (!target.trim()) return <LayoutList layout={layout} />;
      const match = findStorageEntry(layout.entries, target);
      if (!match.entry) return <div className="grid gap-4"><Notice tone="warn">No name match for <code>{target}</code>.</Notice><LayoutList layout={layout} /></div>;
      const entry = match.entry;
      const valueSlot = entry.kind === "mapping" && key && entry.slot !== null ? mappingSlotByType(key, entry.keyType || "address", toSlotHex(entry.slot)) : "";
      return <ResolvedStorage layout={layout} entry={entry} reason={match.reason} valueSlot={valueSlot} mappingKey={key} />;
    } catch (error) {
      return <Notice tone="danger">{(error as Error).message}</Notice>;
    }
  }, [source, contract, mode, target, key]);

  return (
    <Workbench>
      <Panel title="Source Layout">
        <div className="grid gap-4">
          <Tabs value={mode} onChange={setMode} options={[{ value: "verified", label: "Paste verified source" }, { value: "decompiled", label: "Paste decompiled" }]} />
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            <Field label="Target name"><Input className="mono" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="totalSupply, _totalSupply, owner" /></Field>
            <Field label="Contract name"><Input className="mono" value={contract} onChange={(event) => setContract(event.target.value)} placeholder="optional, but safer" /></Field>
            <Field label="Mapping key"><Input className="mono" value={key} onChange={(event) => setKey(event.target.value)} placeholder="only for mapping value" /></Field>
          </div>
          <Field label={mode === "verified" ? "Verified source" : "Dedaub decompiled source"}>
            <Textarea className="mono min-h-[340px]" value={source} onChange={(event) => setSource(event.target.value)} placeholder={mode === "verified" ? "Paste verified Solidity source here." : "Paste Dedaub decompiled source here."} />
          </Field>
          <Notice>Only top-level state variables are counted. Function bodies are skipped. In multi-contract files, fill Contract name for the final token contract.</Notice>
        </div>
      </Panel>
      <Panel title="Readout">{result}</Panel>
    </Workbench>
  );
}

function ResolvedStorage({ layout, entry, reason, valueSlot, mappingKey }: { layout: ReturnType<typeof parseSourceLayout>; entry: ReturnType<typeof findStorageEntry>["entry"]; reason: string; valueSlot: string; mappingKey: string }) {
  if (!entry) return null;
  const noSlot = entry.slot === null;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[1.15fr_.85fr] gap-3 max-sm:grid-cols-1">
        <Metric label={entry.kind === "mapping" && valueSlot ? "Mapping value slot" : noSlot ? "Resolved result" : "Resolved slot"} value={entry.kind === "mapping" && valueSlot ? "Value slot ready" : noSlot ? "No storage slot" : `Slot #${entry.slot?.toString()}`} hint={entry.kind === "mapping" && valueSlot ? valueSlot : noSlot ? "constant / immutable does not live in storage" : `Raw slot read -> ${entry.slot?.toString()}`} />
        <Metric label="Variable" value={entry.name} hint={`${entry.type} | ${reason}`} />
      </div>
      <ResultRows rows={[
        ["Source", layout.sourceType],
        ["Contract", layout.contractName || "n/a"],
        ["Target", entry.name],
        ["Type", entry.type],
        ["Slot number", noSlot ? "not stored on-chain" : `#${entry.slot?.toString()}`],
        ["Slot hex", noSlot ? "not stored on-chain" : toSlotHex(entry.slot!)],
        ["Byte offset", entry.offset === null ? "n/a" : String(entry.offset)],
        ["Storage form", entry.note],
        ...(entry.kind === "mapping" ? [["Mapping key", mappingKey || "n/a"], ["Value slot", valueSlot || "enter key to calculate"]] as Array<[string, string]> : []),
      ]} />
    </div>
  );
}

function LayoutList({ layout }: { layout: ReturnType<typeof parseSourceLayout> }) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Metric label="Source" value={layout.sourceType} />
        <Metric label="Contract" value={layout.contractName || "n/a"} hint={layout.selectionNote} />
      </div>
      <div className="grid gap-2">
        {layout.entries.length ? layout.entries.map((entry) => (
          <div key={`${entry.name}-${String(entry.slot)}-${entry.offset}`} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-line bg-panel p-3 max-sm:grid-cols-1">
            <span className="font-black text-accent">{entry.slot === null ? "N/A" : `#${entry.slot}`}</span>
            <code className="min-w-0 break-words text-sm text-text">{entry.name} : {entry.type}<br /><span className="text-faint">{entry.note}</span></code>
            {entry.slot !== null ? <CopyButton value={entry.slot.toString()} /> : null}
          </div>
        )) : <Notice tone="warn">No storage declarations were parsed.</Notice>}
      </div>
    </div>
  );
}

function UnitConverter() {
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState("ether");
  const [to, setTo] = useState("wei");
  const [decimals, setDecimals] = useState("18");
  const result = useMemo(() => {
    try {
      const d = Number(decimals);
      const base = decimalToBase(amount, unitDecimals(from, d));
      const converted = baseToDecimal(base, unitDecimals(to, d));
      return <ResultRows rows={[["Input", `${amount} ${from}`], ["Output", `${converted} ${to}`], ["Base units", base.toString()]]} />;
    } catch (error) {
      return <Notice tone="danger">{(error as Error).message}</Notice>;
    }
  }, [amount, from, to, decimals]);
  const unitOptions = ["wei", "gwei", "ether", "token"].map((item) => ({ value: item, label: item }));
  return <Workbench><Panel title="Converter"><div className="grid gap-4"><Field label="Amount"><Input className="mono" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1"><Field label="From"><Select value={from} onChange={setFrom} options={unitOptions} /></Field><Field label="To"><Select value={to} onChange={setTo} options={unitOptions} /></Field><Field label="Token decimals"><Input className="mono" value={decimals} onChange={(e) => setDecimals(e.target.value)} /></Field></div></div></Panel><Panel title="Readout">{result}</Panel></Workbench>;
}

function SelectorFinder() {
  const [input, setInput] = useState("transfer(address,uint256)");
  const hash = input.trim() && !input.trim().startsWith("0x") ? keccak256Hex(input.trim()) : "";
  return <Workbench><Panel title="Signature"><Field label="Function or event signature"><Input className="mono" value={input} onChange={(e) => setInput(e.target.value)} /></Field></Panel><Panel title="Readout"><ResultRows rows={[["Signature", input], ["Function selector", hash ? `0x${hash.slice(0, 8)}` : "n/a"], ["Event topic0", hash ? `0x${hash}` : "n/a"]]} /></Panel></Workbench>;
}

function CalldataDecoder() {
  const [input, setInput] = useState("");
  const clean = input.trim().replace(/^0x/, "");
  const selector = clean.length >= 8 ? `0x${clean.slice(0, 8)}` : "n/a";
  const words = clean.slice(8).match(/.{1,64}/g) || [];
  return <Workbench><Panel title="Input"><Textarea className="mono min-h-[280px]" value={input} onChange={(e) => setInput(e.target.value)} placeholder="0xa9059cbb..." /></Panel><Panel title="Readout"><ResultRows rows={[["Selector", selector], ["Argument words", words.length]]} /><pre className="mt-4 max-h-[420px] overflow-auto rounded-2xl border border-line bg-panel p-4 font-mono text-xs leading-6 text-muted">{words.map((word, i) => `${String(i).padStart(2, "0")}  0x${word.padEnd(64, " ")}`).join("\n") || "No ABI words yet."}</pre></Panel></Workbench>;
}

function JsonStudio() {
  const [input, setInput] = useState('{"name":"Linsea","tools":18,"privacy":true}');
  const [mode, setMode] = useState("format");
  const output = useMemo(() => {
    try {
      const parsed = JSON.parse(input);
      if (mode === "minify") return JSON.stringify(parsed);
      if (mode === "ts") return inferTs("Root", parsed);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      return `Error: ${(error as Error).message}`;
    }
  }, [input, mode]);
  return <Workbench><Panel title="JSON"><Textarea className="mono min-h-[360px]" value={input} onChange={(e) => setInput(e.target.value)} /></Panel><Panel title="Output"><div className="mb-3"><Select value={mode} onChange={setMode} options={[{ value: "format", label: "Format" }, { value: "minify", label: "Minify" }, { value: "ts", label: "TypeScript" }]} /></div><pre className="min-h-[320px] overflow-auto rounded-2xl border border-line bg-panel p-4 font-mono text-sm leading-6 text-text">{output}</pre></Panel></Workbench>;
}

function TimestampPro() {
  const zones = useMemo(() => (typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"]), []);
  const zoneOptions = useMemo(() => zones.map((item) => ({ value: item, label: item })), [zones]);
  const [workspace, setWorkspace] = useState("single");
  const [clockUnit, setClockUnit] = useState("seconds");
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [input, setInput] = useState(String(Math.floor(Date.now() / 1000)));
  const [unit, setUnit] = useState("auto");
  const [zone, setZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [batchMode, setBatchMode] = useState("timestamps");
  const [batchUnit, setBatchUnit] = useState("auto");
  const [batchInput, setBatchInput] = useState("1787063731\n1787063731000\n2026-08-18 22:27:31");

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setNow(new Date()), clockUnit === "milliseconds" ? 125 : 1000);
    return () => window.clearInterval(timer);
  }, [clockUnit, paused]);

  const unitOptions = [
    { value: "auto", label: "Auto detect" },
    { value: "seconds", label: "Seconds" },
    { value: "milliseconds", label: "Milliseconds" },
    { value: "microseconds", label: "Microseconds" },
    { value: "nanoseconds", label: "Nanoseconds" },
  ];
  const currentValue = clockUnit === "seconds" ? String(Math.floor(now.getTime() / 1000)) : String(now.getTime());
  const safeZone = isValidTimeZone(zone) ? zone : "UTC";

  const single = useMemo(() => {
    try {
      const parsed = parseTimeInput(input, unit, safeZone);
      return <TimestampReadout date={parsed.date} zone={safeZone} source={parsed.source} />;
    } catch (error) {
      return <Notice tone="danger">{(error as Error).message}</Notice>;
    }
  }, [input, unit, safeZone]);

  const batch = useMemo(() => batchConvert(batchInput, batchMode, batchUnit, safeZone), [batchInput, batchMode, batchUnit, safeZone]);

  return (
    <div className="grid gap-4">
      <Panel title="Epoch Clock">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="rounded-2xl border border-accent/25 bg-[linear-gradient(135deg,hsl(var(--accent)/0.14),hsl(var(--cyan)/0.08)_45%,transparent)] p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-faint">Current Unix Time</div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <span className="break-all font-mono text-4xl font-black text-text max-sm:text-3xl">{currentValue}</span>
              <span className="rounded-full border border-accent/35 bg-accent/10 px-2 py-1 text-xs font-black text-accent">{clockUnit === "seconds" ? "s" : "ms"}</span>
            </div>
            <div className="mt-2 text-sm text-muted">{formatInZone(now, safeZone)} · {safeZone}</div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="default" onClick={() => setClockUnit((item) => (item === "seconds" ? "milliseconds" : "seconds"))}>Switch unit</Button>
            <CopyButton value={currentValue} />
            <Button variant={paused ? "primary" : "default"} onClick={() => setPaused((item) => !item)}>{paused ? "Resume" : "Pause"}</Button>
          </div>
        </div>
      </Panel>

      <Tabs value={workspace} onChange={setWorkspace} options={[{ value: "single", label: "Single parse" }, { value: "batch", label: "Batch convert" }]} />

      {workspace === "single" ? (
        <Workbench>
          <Panel title="Input">
            <div className="grid gap-4">
              <Field label="Timestamp or date">
                <Input className="mono" value={input} onChange={(event) => setInput(event.target.value)} placeholder="1787063731, 1787063731000, 2026-08-18 22:27:31, ISO/RFC date" />
              </Field>
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <Field label="Input unit"><Select value={unit} onChange={setUnit} options={unitOptions} /></Field>
                <Field label="Timezone search"><Combobox value={safeZone} onChange={setZone} options={zoneOptions} maxItems={zoneOptions.length} placeholder="Type UTC, Shanghai, New_York..." emptyText="No timezone match" /></Field>
              </div>
              <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
                <Button variant="default" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>Now s</Button>
                <Button variant="default" onClick={() => setInput(String(Date.now()))}>Now ms</Button>
                <Button variant="default" onClick={() => setInput(formatEditableDate(new Date(), safeZone))}>Now date</Button>
                <Button variant="ghost" onClick={() => setInput("")}>Clear</Button>
              </div>
              <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
                {[-86400, -3600, 3600, 86400].map((seconds) => {
                  const label = Math.abs(seconds) === 86400 ? `${seconds > 0 ? "+" : "-"}1d` : `${seconds > 0 ? "+" : ""}${seconds / 3600}h`;
                  return <Button key={seconds} variant="ghost" onClick={() => setInput(shiftTimeInput(input, unit, safeZone, seconds))}>{label}</Button>;
                })}
              </div>
            </div>
          </Panel>
          <Panel title="Readout">{single}</Panel>
        </Workbench>
      ) : (
        <Workbench wide>
          <Panel title="Batch Timeline">
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
                <Field label="Batch mode"><Select value={batchMode} onChange={setBatchMode} options={[{ value: "timestamps", label: "Timestamp -> date" }, { value: "dates", label: "Date -> timestamp" }]} /></Field>
                <Field label="Input unit"><Select value={batchUnit} onChange={setBatchUnit} options={unitOptions} /></Field>
                <Field label="Timezone search"><Combobox value={safeZone} onChange={setZone} options={zoneOptions} maxItems={zoneOptions.length} placeholder="Type UTC, Shanghai, New_York..." emptyText="No timezone match" /></Field>
              </div>
              <Field label="Values, one per line or pasted from logs">
                <Textarea className="mono min-h-[220px]" value={batchInput} onChange={(event) => setBatchInput(event.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={batch.csv} />
                <Button variant="ghost" onClick={() => setBatchInput("")}>Clear batch</Button>
              </div>
              <div className="max-h-[520px] overflow-auto rounded-2xl border border-line bg-panel">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-surface/95 text-[11px] uppercase tracking-[0.12em] text-faint backdrop-blur">
                    <tr>{batch.headers.map((header) => <th key={header} className="border-b border-line px-3 py-3">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {batch.rows.length ? batch.rows.map((row, index) => (
                      <tr key={`${row.input}-${index}`} className="border-b border-line last:border-b-0">
                        {row.values.map((value, valueIndex) => <td key={valueIndex} className="px-3 py-3 font-mono text-xs text-text">{value}</td>)}
                      </tr>
                    )) : (
                      <tr><td className="px-3 py-4 text-muted" colSpan={batch.headers.length}>Paste values to convert.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>
        </Workbench>
      )}
    </div>
  );
}

function TimestampReadout({ date, zone, source }: { date: Date; zone: string; source: string }) {
  const seconds = Math.floor(date.getTime() / 1000);
  const milliseconds = date.getTime();
  const iso = date.toISOString();
  const sqlUtc = iso.replace("T", " ").replace(/\.\d{3}Z$/, "");
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Metric label="Detected input" value={source} />
        <Metric label="Relative" value={relativeTime(date)} />
      </div>
      <ResultRows rows={[
        ["Unix seconds", seconds],
        ["Unix milliseconds", milliseconds],
        ["Unix microseconds", `${milliseconds}000`],
        ["Unix nanoseconds", `${milliseconds}000000`],
        ["ISO 8601 UTC", iso],
        ["SQL UTC", sqlUtc],
        [`${zone} time`, formatInZone(date, zone)],
        ["Local time", formatInZone(date, Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")],
        ["Day of year", dayOfYear(date, zone)],
        ["ISO week", isoWeek(date, zone)],
      ]} />
    </div>
  );
}

function BaseConverter() {
  const [input, setInput] = useState("0x1a2b3c");
  const [fromBase, setFromBase] = useState("16");
  const [toBase, setToBase] = useState("10");
  const [uppercase, setUppercase] = useState(true);
  const [grouped, setGrouped] = useState(true);
  const baseOptions = [
    { value: "2", label: "Binary (base 2)" },
    { value: "8", label: "Octal (base 8)" },
    { value: "10", label: "Decimal (base 10)" },
    { value: "16", label: "Hexadecimal (base 16)" },
    { value: "36", label: "Base36 (0-9A-Z)" },
  ];
  const parsed = useMemo(() => {
    try {
      const base = Number(fromBase);
      const target = Number(toBase);
      const value = parseRadixInteger(input, base);
      return { value, output: formatRadixInteger(value, target, uppercase), error: "" };
    } catch (error) {
      return { value: 0n, output: "", error: (error as Error).message };
    }
  }, [fromBase, input, toBase, uppercase]);
  const resultRows = parsed.error ? [] : [
    { label: "Input base", value: fromBase },
    { label: "Output base", value: toBase },
    { label: "Converted", value: parsed.output },
    { label: "Decimal (base 10)", value: parsed.value.toString() },
    { label: "Hexadecimal prefixed", value: `${parsed.value < 0n ? "-" : ""}0x${formatRadixInteger(absBigInt(parsed.value), 16, uppercase)}` },
    { label: "Binary prefixed", value: `${parsed.value < 0n ? "-" : ""}0b${formatGroupedRadix(absBigInt(parsed.value), 2, uppercase, grouped)}` },
    ...buildRadixRows(parsed.value, uppercase, grouped),
  ];

  return (
    <Workbench wide>
      <Panel title="Radix Input">
        <div className="grid gap-5">
          <Field label="Integer">
            <Input className="mono" value={input} onChange={(event) => setInput(event.target.value)} placeholder="0x1a2b3c, 110101, 755, -42" />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-end gap-3 max-md:grid-cols-1">
            <Field label="From base"><Select value={fromBase} onChange={setFromBase} options={baseOptions} /></Field>
            <Button className="h-11 px-2" variant="ghost" onClick={() => { setFromBase(toBase); setToBase(fromBase); }}>Swap</Button>
            <Field label="To base"><Select value={toBase} onChange={setToBase} options={baseOptions} /></Field>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-end gap-3 max-md:grid-cols-1">
            <Field label="Custom from"><Input className="mono" value={fromBase} onChange={(event) => setFromBase(event.target.value)} /></Field>
            <div className="hidden max-md:hidden md:block" />
            <Field label="Custom to"><Input className="mono" value={toBase} onChange={(event) => setToBase(event.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="min-w-28" variant="default" onClick={() => { setInput("0x1a2b3c"); setFromBase("16"); setToBase("10"); }}>Hex to Dec</Button>
            <Button className="min-w-28" variant="default" onClick={() => { setInput("255"); setFromBase("10"); setToBase("16"); }}>Dec to Hex</Button>
            <Button className="min-w-28" variant="default" onClick={() => { setInput("11111111"); setFromBase("2"); setToBase("10"); }}>Bin to Dec</Button>
            <Button className="min-w-24" variant="ghost" onClick={() => setInput("")}>Clear</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-3 text-sm font-semibold text-text">
              Uppercase output
              <input type="checkbox" checked={uppercase} onChange={(event) => setUppercase(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-3 text-sm font-semibold text-text">
              Group binary/hex
              <input type="checkbox" checked={grouped} onChange={(event) => setGrouped(event.target.checked)} />
            </label>
          </div>
          <Notice>Supports bases 2-36. Prefixes <code>0x</code>, <code>0b</code>, and <code>0o</code> are accepted when they match the input base.</Notice>
        </div>
      </Panel>
      <Panel title="Readout">
        {parsed.error ? (
          <Notice tone="danger">{parsed.error}</Notice>
        ) : (
          <div className="grid gap-4">
            <Metric label={`Base ${toBase} output`} value={<code className="block break-all text-xl">{parsed.output}</code>} hint={`${input || "0"} from base ${fromBase}`} />
            <div className="overflow-hidden rounded-2xl border border-line bg-panel">
              {resultRows.map((row) => (
                <div key={row.label} className="grid min-h-14 grid-cols-[220px_minmax(0,1fr)_104px] items-center gap-4 border-b border-line px-4 py-3 last:border-b-0 max-md:grid-cols-[minmax(120px,180px)_minmax(0,1fr)_92px] max-sm:grid-cols-1">
                  <span className="min-w-0 text-sm font-semibold leading-5 text-muted">{row.label}</span>
                  <code className="min-w-0 break-all text-sm leading-6 text-text">{row.value}</code>
                  <div className="justify-self-end max-sm:justify-self-start">
                    <CopyButton value={row.value} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </Workbench>
  );
}

function TextCompare() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const rows = useMemo(() => lineDiff(left.split(/\r?\n/), right.split(/\r?\n/)), [left, right]);
  return <Workbench wide><Panel title="Compare"><div className="grid grid-cols-2 gap-4 max-md:grid-cols-1"><Field label="Original"><Textarea className="mono min-h-[320px]" value={left} onChange={(e) => setLeft(e.target.value)} /></Field><Field label="Changed"><Textarea className="mono min-h-[320px]" value={right} onChange={(e) => setRight(e.target.value)} /></Field></div><pre className="mt-4 max-h-[480px] overflow-auto rounded-2xl border border-line bg-panel p-4 font-mono text-sm leading-6">{rows.map((row, i) => <div key={i} className={cn(row.type === "add" && "text-emerald-500", row.type === "remove" && "text-red-500", row.type === "same" && "text-muted")}>{row.type === "add" ? "+" : row.type === "remove" ? "-" : " "} {row.text}</div>)}</pre></Panel></Workbench>;
}

function MarketClock() {
  const now = useTicker(1000);
  const dst = usDstInfo(now);
  return (
    <div className="grid gap-4">
      <Panel title="World Clock">
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
          <ClockTile city="北京" en="Beijing" zone="Asia/Shanghai" badge="UTC+8" now={now} />
          <ClockTile city="香港" en="Hong Kong" zone="Asia/Hong_Kong" badge="UTC+8" now={now} />
          <ClockTile city="纽约" en="New York" zone="America/New_York" badge={`${dst.abbr} · ${dst.offset}`} now={now} tone={dst.inDst ? "dst" : "std"} />
        </div>
      </Panel>

      <Panel title="Market Sessions">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SessionLegend />
            <span className="font-mono text-[11px] font-bold text-faint">刷新 {formatInZone(now, "Asia/Shanghai").slice(11)} 北京</span>
          </div>
          <UsDstBanner now={now} />
          <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
            {MARKETS.map((market) => <MarketCard key={market.id} market={market} now={now} />)}
          </div>
          <Notice tone="warn">节假日（美国感恩节、A 股春节/国庆等）与临时休市未纳入判断，仅按周一至周五与常规交易时段计算。时间基于浏览器 IANA 时区数据库，夏令时自动切换。</Notice>
        </div>
      </Panel>
    </div>
  );
}

function ClockTile({ city, en, zone, badge, now, tone }: { city: string; en: string; zone: string; badge: string; now: Date; tone?: "dst" | "std" }) {
  const parts = zoneParts(now, zone);
  const daytime = parts.hour >= 6 && parts.hour < 18;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-panel/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("grid h-9 w-9 place-items-center rounded-xl border", daytime ? "border-amber-400/40 bg-amber-400/10 text-amber-500" : "border-cyan/40 bg-cyan/10 text-cyan")}>
            {daytime ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </span>
          <div>
            <div className="text-sm font-black text-text">{city}</div>
            <div className="text-[11px] text-faint">{en}</div>
          </div>
        </div>
        <span className={cn("rounded-full border px-2 py-1 text-[11px] font-bold", tone === "dst" ? "border-amber-400/45 bg-amber-400/10 text-amber-600 dark:text-amber-300" : tone === "std" ? "border-cyan/45 bg-cyan/10 text-cyan" : "border-line bg-surface text-muted")}>{badge}</span>
      </div>
      <div className="mt-4 font-mono text-3xl font-black tabular-nums tracking-tight text-text max-sm:text-2xl">{formatInZone(now, zone).slice(11)}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span>{formatInZone(now, zone).slice(0, 10)}</span>
        <span className="text-faint">·</span>
        <span>{WEEKDAY_ZH[parts.weekday]}</span>
      </div>
      <div className="mt-1 text-[11px] text-faint">{zone}</div>
    </div>
  );
}

function MarketCard({ market, now }: { market: MarketDef; now: Date }) {
  const state = useMemo(() => computeMarket(market, now), [market, now]);
  const toneClass = {
    open: "border-emerald-400/45 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    break: "border-amber-400/45 bg-amber-400/10 text-amber-700 dark:text-amber-300",
    pre: "border-cyan/45 bg-cyan/10 text-cyan",
    closed: "border-line bg-panel text-muted",
  }[state.tone];
  return (
    <div className="tech-card flex flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-accent/35 bg-accent/10 text-sm font-black tracking-wide text-accent">{market.mark}</span>
          <div>
            <div className="font-black text-text">{market.zh}</div>
            <div className="text-[11px] text-faint">{market.exchange}</div>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-black", toneClass)}>
          {state.tone === "open" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> : null}
          {state.statusLabel}
        </span>
      </header>

      <div className="rounded-2xl border border-accent/25 bg-[linear-gradient(135deg,hsl(var(--accent)/0.10),transparent_60%)] px-4 py-3">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-faint">{state.countdownLabel}</div>
        <div className="mt-1 font-mono text-2xl font-black tabular-nums text-text">{state.countdownText}</div>
        <div className="mt-1 text-xs text-muted">{state.targetText}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="开盘" value={state.openText} hint={market.id === "us" ? `北京 ${state.beijingOpen}` : "当地交易时段"} />
        <MiniStat label="收盘" value={state.closeText} hint={market.id === "us" ? `北京 ${state.beijingClose}` : "当地交易时段"} />
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-faint">
          <span>当地 {state.nowTime}（{market.zoneLabel}）</span>
          {state.isWeekend ? <span className="text-amber-600 dark:text-amber-300">周末休市</span> : null}
        </div>
        <SessionBar segments={market.segments} minute={state.minute} />
      </div>

      <div className="mt-auto grid gap-2 border-t border-line pt-3 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 font-bold text-faint">交易时段</span>
          <span className="min-w-0 text-right font-mono text-text">{state.sessionText}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 font-bold text-faint">{state.footerLabel}</span>
          <span className="min-w-0 text-right font-mono text-text">{state.footerText}</span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel/50 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-black tabular-nums text-text">{value}</div>
      {hint ? <div className="mt-0.5 truncate text-[10px] text-faint">{hint}</div> : null}
    </div>
  );
}

function SessionBar({ segments, minute }: { segments: MarketSegment[]; minute: number }) {
  const kindClass: Record<MarketKind, string> = { pre: "bg-cyan/45", regular: "bg-accent/80", after: "bg-amber-400/50" };
  const marker = (Math.min(Math.max(minute, 0), 1439) / 1440) * 100;
  return (
    <div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full border border-line bg-panel">
          {segments.map((segment) => (
            <span key={segment.id} className={cn("absolute inset-y-0", kindClass[segment.kind])} style={{ left: `${(segment.start / 1440) * 100}%`, width: `${((segment.end - segment.start) / 1440) * 100}%` }} />
          ))}
        </div>
        <div className="absolute top-0 h-6 w-0.5 -translate-x-1/2 rounded-full bg-text shadow-soft" style={{ left: `${marker}%` }} />
      </div>
      <div className="mt-0.5 flex justify-between font-mono text-[9px] font-bold text-faint">
        {["00", "06", "12", "18", "24"].map((tick) => <span key={tick}>{tick}</span>)}
      </div>
    </div>
  );
}

function SessionLegend() {
  const items: Array<[string, string]> = [["交易中", "bg-accent/80"], ["盘前", "bg-cyan/45"], ["盘后", "bg-amber-400/50"]];
  return (
    <div className="flex flex-wrap gap-3">
      {items.map(([label, cls]) => (
        <span key={label} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted">
          <span className={cn("h-2 w-4 rounded-full", cls)} />
          {label}
        </span>
      ))}
    </div>
  );
}

function UsDstBanner({ now }: { now: Date }) {
  const dst = usDstInfo(now);
  const date = formatInZone(dst.next, "America/New_York").slice(0, 10);
  const beijing = formatInZone(dst.next, "Asia/Shanghai").slice(0, 16);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3", dst.inDst ? "border-amber-400/40 bg-amber-400/10" : "border-cyan/35 bg-cyan/5")}>
      <span className="inline-flex items-center gap-2 text-sm font-black text-text">
        <span className={cn("grid h-6 w-6 place-items-center rounded-lg border", dst.inDst ? "border-amber-400/45 bg-amber-400/15 text-amber-600 dark:text-amber-300" : "border-cyan/45 bg-cyan/10 text-cyan")}>
          {dst.inDst ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </span>
        美国当前：{dst.inDst ? "夏令时" : "冬令时"}
      </span>
      <span className="rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[11px] font-bold text-muted">{dst.abbr} · {dst.offset}</span>
      <span className="min-w-0 flex-1 text-xs leading-5 text-muted max-sm:flex-none">
        {dst.inDst ? "夏令时结束" : "夏令时开始"}：{date} 02:00 美东（北京时间 {beijing}），时钟{dst.inDst ? "回拨 1 小时" : "前拨 1 小时"}
      </span>
    </div>
  );
}

function HashSuite() {
  const [input, setInput] = useState("hello linsea");
  const [mode, setMode] = useState("keccak");
  const [output, setOutput] = useState("");
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const value = await runHashMode(input, mode);
        if (live) setOutput(value);
      } catch (error) {
        if (live) setOutput(`Error: ${(error as Error).message}`);
      }
    })();
    return () => { live = false; };
  }, [input, mode]);
  return <Workbench><Panel title="Input"><div className="grid gap-4"><Textarea className="mono min-h-[260px]" value={input} onChange={(e) => setInput(e.target.value)} /><Select value={mode} onChange={setMode} options={[{ value: "keccak", label: "Keccak256" }, { value: "sha256", label: "SHA-256" }, { value: "sha1", label: "SHA-1" }, { value: "base64e", label: "Base64 encode" }, { value: "base64d", label: "Base64 decode" }, { value: "urle", label: "URL encode" }, { value: "urld", label: "URL decode" }]} /></div></Panel><Panel title="Output"><pre className="min-h-[240px] whitespace-pre-wrap break-words rounded-2xl border border-line bg-panel p-4 font-mono text-sm text-text">{output}</pre></Panel></Workbench>;
}

function JwtInspector() {
  const [token, setToken] = useState("");
  const result = useMemo(() => {
    try {
      const [h, p] = token.split(".");
      if (!h || !p) return <Notice>Paste a JWT to decode it locally.</Notice>;
      const header = JSON.parse(base64UrlDecode(h));
      const payload = JSON.parse(base64UrlDecode(p));
      return <div className="grid gap-4"><ResultRows rows={[["Algorithm", header.alg || "unknown"], ["Expires at", payload.exp ? new Date(payload.exp * 1000).toISOString() : "n/a"], ["Status", payload.exp && payload.exp * 1000 < Date.now() ? "Expired" : "Active / unknown"]]} /><pre className="rounded-2xl border border-line bg-panel p-4 font-mono text-sm">{JSON.stringify({ header, payload }, null, 2)}</pre></div>;
    } catch (error) {
      return <Notice tone="danger">{(error as Error).message}</Notice>;
    }
  }, [token]);
  return <Workbench><Panel title="JWT"><Textarea className="mono min-h-[300px]" value={token} onChange={(e) => setToken(e.target.value)} placeholder="eyJhbGci..." /></Panel><Panel title="Readout">{result}</Panel></Workbench>;
}

function ProxySlotFinder({ settings }: { settings: Settings }) {
  const [address, setAddress] = useState("");
  const [output, setOutput] = useState<ReactNode>(<Notice>Enter a proxy address and run a read-only probe.</Notice>);
  const probe = async () => {
    try {
      if (settings.privacyMode) throw new Error("Privacy First Mode blocks RPC.");
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("Enter a valid proxy address.");
      const session = await openRpcSession(settings, "latest");
      const implementationSlot = eip1967Slot("eip1967.proxy.implementation");
      const adminSlot = eip1967Slot("eip1967.proxy.admin");
      const beaconSlot = eip1967Slot("eip1967.proxy.beacon");
      const results = await rpcBatch(session.endpoint, [implementationSlot, adminSlot, beaconSlot].map((slot) => ({ method: "eth_getStorageAt", params: [address, slot, session.blockTag] })), { fallbackToSequential: true });
      const failed = results.find((result) => !result.ok);
      if (failed && !failed.ok) throw new Error(failed.error.message);
      const [implementation, admin, beacon] = results.map((result) => (result.ok ? result.result : "0x0"));
      setOutput(
        <div className="grid gap-4">
          <RpcProvenance session={session} />
          <ResultRows rows={[
            ["Chain", `${session.chain.label} (${session.chain.chainId})`],
            ["Block read", session.blockNumber !== null ? `#${session.blockNumber}` : session.blockTag],
            ["Implementation slot", implementationSlot],
            ["Implementation", storageAddress(implementation) || "not set"],
            ["Admin", storageAddress(admin) || "not set"],
            ["Beacon", storageAddress(beacon) || "not set"],
          ]} />
        </div>,
      );
    } catch (error) {
      setOutput(<Notice tone="danger">{(error as Error).message}</Notice>);
    }
  };
  return <Workbench><Panel title="Proxy"><div className="grid gap-4"><Field label="Proxy address"><Input className="mono" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." /></Field><Notice>Probes ERC-1967 implementation, admin, and beacon slots on the selected chain. Results always show the chainId and block that was read.</Notice><Button variant="primary" onClick={probe}>Probe proxy slots</Button></div></Panel><Panel title="Readout">{output}</Panel></Workbench>;
}

function EncryptionTool() {
  const [mode, setMode] = useState("encrypt");
  const [data, setData] = useState("local secrets only");
  const [password, setPassword] = useState("linsea-demo");
  const [output, setOutput] = useState<ReactNode>(<Notice>Choose a mode and run AES-GCM locally.</Notice>);
  const run = async () => {
    try {
      if (!password) throw new Error("Enter a password.");
      if (mode === "decrypt") {
        const bundle = JSON.parse(data) as { v: number; alg: string; iv: string; salt: string; data: string };
        if (bundle.v !== 1 || bundle.alg !== "AES-GCM") throw new Error("Paste a version 1 AES-GCM bundle from this tool.");
        const key = await deriveAesKey(password, base64ToBytes(bundle.salt), ["decrypt"]);
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(bundle.iv) }, key, base64ToBytes(bundle.data));
        const text = new TextDecoder().decode(plain);
        setOutput(<ResultRows rows={[["Plaintext", text], ["Algorithm", "AES-GCM / PBKDF2-SHA-256"]]} />);
        return;
      }
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveAesKey(password, salt, ["encrypt"]);
      const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(data));
      const bundle = JSON.stringify({ v: 1, alg: "AES-GCM", kdf: "PBKDF2-SHA-256", iterations: 100000, iv: bytesToBase64(iv), salt: bytesToBase64(salt), data: bytesToBase64(new Uint8Array(cipher)) }, null, 2);
      setOutput(<pre className="whitespace-pre-wrap break-words rounded-2xl border border-line bg-panel p-4 font-mono text-sm text-text">{bundle}</pre>);
    } catch (error) {
      setOutput(<Notice tone="danger">{(error as Error).message}</Notice>);
    }
  };
  return <Workbench><Panel title="Cipher"><div className="grid gap-4"><Field label="Mode"><Select value={mode} onChange={setMode} options={[{ value: "encrypt", label: "Encrypt AES-GCM" }, { value: "decrypt", label: "Decrypt AES-GCM bundle" }]} /></Field><Field label="Data"><Textarea className="mono min-h-[260px]" value={data} onChange={(e) => setData(e.target.value)} /></Field><Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field><Button variant="primary" onClick={run}>{mode === "encrypt" ? "Encrypt locally" : "Decrypt locally"}</Button></div></Panel><Panel title="Output">{output}</Panel></Workbench>;
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return <div className="rounded-2xl border border-accent/30 bg-[linear-gradient(135deg,hsl(var(--accent)/0.12),transparent_58%)] p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-faint">{label}</div><div className="mt-2 break-words text-2xl font-black text-accent">{value}</div>{hint ? <div className="mt-2 break-words text-sm leading-6 text-muted">{hint}</div> : null}</div>;
}

function SettingsModal({ open, settings, onClose, onSave }: { open: boolean; settings: Settings; onClose: () => void; onSave: (settings: Settings) => void }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings, open]);
  const isCustom = draft.defaultChain === CUSTOM_CHAIN_ID;
  const validationError = validateRpcSettings(draft);
  const preview = (() => {
    if (validationError) return null;
    try {
      return resolveRpc(draft);
    } catch {
      return null;
    }
  })();
  return (
    <Modal open={open} title="Settings" description="API keys and preferences are stored in this browser only." onClose={onClose}>
      <div className="grid gap-4">
        <Field label="Default chain"><Select value={draft.defaultChain} onChange={(value) => setDraft({ ...draft, defaultChain: value })} options={chainSelectOptions()} /></Field>
        {isCustom ? (
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Field label="Custom chain ID"><Input className="mono" value={draft.customChainId} onChange={(e) => setDraft({ ...draft, customChainId: e.target.value })} placeholder="6714" /></Field>
            <Field label="Custom chain label"><Input value={draft.customChainLabel} onChange={(e) => setDraft({ ...draft, customChainLabel: e.target.value })} placeholder="optional" /></Field>
          </div>
        ) : null}
        <Field label="RPC URL override">
          <Input className="mono" value={draft.customRpcUrl} onChange={(e) => setDraft({ ...draft, customRpcUrl: e.target.value })} placeholder={chainByIdOrDefault(draft.defaultChain)?.rpcUrl || "https://rpc.example.org"} />
        </Field>
        {preview ? (
          <Notice tone="ok">Reads will use <strong>{preview.sourceLabel}</strong> at <code>{preview.host}</code>, expected chainId <strong>{preview.chain.chainId}</strong>. Every read verifies eth_chainId first.</Notice>
        ) : validationError ? (
          <Notice tone="warn">{validationError}</Notice>
        ) : (
          <Notice tone="warn">This chain has no bundled public RPC. Add a non-empty RPC URL override to read it directly from the browser.</Notice>
        )}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Alchemy API Key"><Input type="password" value={draft.alchemyKey} onChange={(e) => setDraft({ ...draft, alchemyKey: e.target.value })} placeholder="Optional BYOK key" /></Field>
          <Field label="Infura API Key"><Input type="password" value={draft.infuraKey} onChange={(e) => setDraft({ ...draft, infuraKey: e.target.value })} placeholder="Optional BYOK key" /></Field>
        </div>
        <Notice>Endpoint priority: RPC URL override → bundled public RPC → Alchemy key → Infura key. A provider key is never used on a chain it does not serve.</Notice>
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-4"><span><strong className="block text-sm text-text">Privacy First Mode</strong><small className="text-muted">Disable third-party requests, ads, RPC, and remote lookups.</small></span><input type="checkbox" checked={draft.privacyMode} onChange={(e) => setDraft({ ...draft, privacyMode: e.target.checked })} /></label>
        <Button variant="primary" onClick={() => { onSave(draft); onClose(); }} disabled={Boolean(validationError)}>Save preferences</Button>
      </div>
    </Modal>
  );
}

function CommandPalette({ open, query, setQuery, language, onClose, onSelect }: { open: boolean; query: string; setQuery: (value: string) => void; language: "en" | "zh"; onClose: () => void; onSelect: (id: ToolId) => void }) {
  const matches = tools.filter((tool) => `${tool.name} ${tool.zh} ${tool.keywords.join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
  const isZh = language === "zh";
  return (
    <Modal open={open} title={isZh ? "命令菜单" : "Command Menu"} description={isZh ? "输入关键词快速跳转工具。" : "Type keywords to jump between tools."} onClose={onClose}>
      <div className="grid gap-3">
        <CommandInput autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isZh ? "输入 slot、json、luhn、时间戳..." : "Type slot, json, luhn, timestamp..."} />
        {matches.length ? matches.map((tool) => (
          <button key={tool.id} type="button" onClick={() => onSelect(tool.id)} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-accent/45 hover:bg-panel">
            <span className="text-accent [&_svg]:h-5 [&_svg]:w-5">{tool.icon}</span>
            <span>
              <strong className="block text-text">{isZh ? tool.zh : tool.name}</strong>
              <small className="text-muted">{tool.keywords.join(" / ")}</small>
            </span>
          </button>
        )) : <Notice>{isZh ? "没有匹配的工具。" : "No matching tools."}</Notice>}
      </div>
    </Modal>
  );
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); } catch { return {}; }
}
function loadSettingsCache() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch { return {}; }
}
function categoryLabel(id: CategoryId, lang: "en" | "zh") {
  const category = categories.find((item) => item.id === id);
  return category ? (lang === "zh" ? category.zh : category.name) : id;
}
function chainSummary(settings: Settings) {
  if (settings.defaultChain === CUSTOM_CHAIN_ID) {
    const label = settings.customChainLabel.trim() || "Custom chain";
    try {
      return `${label} · ${parseChainIdInput(settings.customChainId)}`;
    } catch {
      return `${label} · chainId missing`;
    }
  }
  const chain = CHAINS.find((item) => item.id === settings.defaultChain);
  return chain ? `${chain.shortLabel} · ${chain.chainId}` : `Unknown chain · ${settings.defaultChain}`;
}
function chainByIdOrDefault(id: string) {
  return CHAINS.find((item) => item.id === id);
}
function scanLimitValue(input: string) {
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed < 0) return 80;
  return Math.min(parsed, 500);
}
function eip1967Slot(name: string) {
  return toSlotHex(BigInt(`0x${keccak256Hex(name)}`) - 1n);
}
function storageAddress(value: string) {
  const address = `0x${value.replace(/^0x/, "").slice(-40)}`;
  return /^0x0{40}$/.test(address) ? "" : address;
}
function decimalToBase(value: string, decimals: number) {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error("Enter a positive decimal number.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error(`Too many decimal places for ${decimals} decimals.`);
  return BigInt(`${whole}${fraction.padEnd(decimals, "0")}`);
}
function baseToDecimal(value: bigint, decimals: number) {
  const raw = value.toString().padStart(decimals + 1, "0");
  const whole = raw.slice(0, -decimals) || "0";
  const fraction = decimals ? raw.slice(-decimals).replace(/0+$/, "") : "";
  return fraction ? `${whole}.${fraction}` : whole;
}
function unitDecimals(unit: string, tokenDecimals: number) {
  if (unit === "wei") return 0;
  if (unit === "gwei") return 9;
  if (unit === "ether") return 18;
  return tokenDecimals;
}
function parseRadixInteger(input: string, radix: number) {
  const base = normalizeBase(radix);
  const raw = input.trim().replace(/_/g, "");
  if (!raw) throw new Error("Enter an integer to convert.");
  const negative = raw.startsWith("-");
  const unsigned = raw.replace(/^[+-]/, "");
  const body = unsigned.replace(/^0[xX]/, "").replace(/^0[bB]/, "").replace(/^0[oO]/, "");
  const expectedPrefix = base === 16 ? /^0[xX]/ : base === 2 ? /^0[bB]/ : base === 8 ? /^0[oO]/ : null;
  const hasKnownPrefix = /^0[xX]|^0[bB]|^0[oO]/.test(unsigned);
  if (hasKnownPrefix && expectedPrefix && !expectedPrefix.test(unsigned)) throw new Error(`Input prefix does not match base ${base}.`);
  if (hasKnownPrefix && !expectedPrefix) throw new Error(`Remove the prefix or change input base to match it.`);
  if (!body) throw new Error("Enter digits after the prefix.");
  let value = 0n;
  for (const char of body.toLowerCase()) {
    const digit = digitValue(char);
    if (digit < 0 || digit >= base) throw new Error(`Digit "${char}" is invalid for base ${base}.`);
    value = value * BigInt(base) + BigInt(digit);
  }
  return negative ? -value : value;
}
function normalizeBase(value: number) {
  if (!Number.isInteger(value) || value < 2 || value > 36) throw new Error("Base must be an integer from 2 to 36.");
  return value;
}
function digitValue(char: string) {
  const code = char.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 97 && code <= 122) return code - 87;
  return -1;
}
function formatRadixInteger(value: bigint, radix: number, uppercase: boolean) {
  const base = normalizeBase(radix);
  const negative = value < 0n;
  const raw = absBigInt(value).toString(base);
  const cased = uppercase ? raw.toUpperCase() : raw;
  return negative ? `-${cased}` : cased;
}
function formatGroupedRadix(value: bigint, radix: number, uppercase: boolean, grouped: boolean) {
  const output = formatRadixInteger(value, radix, uppercase);
  if (!grouped) return output;
  if (radix === 2) return groupFromRight(output, 4);
  if (radix === 16) return groupFromRight(output, 2);
  return output;
}
function groupFromRight(value: string, size: number) {
  const negative = value.startsWith("-");
  const body = negative ? value.slice(1) : value;
  const grouped = body.replace(new RegExp(`\\B(?=(?:[0-9A-Z]{${size}})+(?![0-9A-Z]))`, "gi"), "_");
  return negative ? `-${grouped}` : grouped;
}
function buildRadixRows(value: bigint, uppercase: boolean, grouped: boolean) {
  return [
    { label: "Binary (base 2)", value: formatGroupedRadix(value, 2, uppercase, grouped) },
    { label: "Octal (base 8)", value: formatRadixInteger(value, 8, uppercase) },
    { label: "Decimal (base 10)", value: value.toString() },
    { label: "Hexadecimal (base 16)", value: formatGroupedRadix(value, 16, uppercase, grouped) },
    { label: "Base36 (0-9A-Z)", value: formatRadixInteger(value, 36, uppercase) },
  ];
}
function absBigInt(value: bigint) {
  return value < 0n ? -value : value;
}
function parseTimeInput(value: string, unit: string, zone: string): { date: Date; source: string } {
  const text = value.trim();
  if (!text) throw new Error("Enter a timestamp or date/time.");
  if (/^-?\d+$/.test(text)) {
    const detected = unit === "auto" ? detectTimestampUnit(text) : unit;
    return { date: timestampNumberToDate(text, detected), source: detected };
  }
  return { date: parseDateInZone(text, zone), source: "date/time string" };
}
function detectTimestampUnit(value: string) {
  const length = value.replace(/^-/, "").length;
  if (length <= 10) return "seconds";
  if (length <= 13) return "milliseconds";
  if (length <= 16) return "microseconds";
  return "nanoseconds";
}
function timestampNumberToDate(value: string, unit: string) {
  const n = BigInt(value);
  let milliseconds: bigint;
  if (unit === "seconds") milliseconds = n * 1000n;
  else if (unit === "milliseconds") milliseconds = n;
  else if (unit === "microseconds") milliseconds = n / 1000n;
  else if (unit === "nanoseconds") milliseconds = n / 1000000n;
  else throw new Error("Unsupported timestamp unit.");
  const jsMilliseconds = Number(milliseconds);
  if (!Number.isSafeInteger(jsMilliseconds)) throw new Error("Timestamp is outside the safe JavaScript Date range.");
  return ensureDate(new Date(jsMilliseconds));
}
function parseDateInZone(value: string, zone: string) {
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value.trim())) return ensureDate(new Date(value));
  const normalized = value.trim().replace(/\//g, "-").replace("T", " ");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?)?$/);
  if (!match) return ensureDate(new Date(value));
  const [, y, m, d, hh = "0", mm = "0", ss = "0", ms = "0"] = match;
  return zonedPartsToDate(Number(y), Number(m), Number(d), Number(hh), Number(mm), Number(ss), Number(ms.padEnd(3, "0")), zone);
}
function zonedPartsToDate(year: number, month: number, day: number, hour: number, minute: number, second: number, millisecond: number, zone: string) {
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const first = utc - timeZoneOffsetMs(new Date(utc), zone);
  const secondPass = utc - timeZoneOffsetMs(new Date(first), zone);
  return ensureDate(new Date(secondPass));
}
function timeZoneOffsetMs(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const asUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  return asUtc - date.getTime();
}
function ensureDate(date: Date) {
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date/time.");
  return date;
}
function isValidTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
function formatInZone(date: Date, zone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date).replace(",", "");
}
function formatEditableDate(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}:${value.second}`;
}
function shiftTimeInput(value: string, unit: string, zone: string, seconds: number) {
  try {
    const parsed = parseTimeInput(value, unit, zone).date;
    const shifted = new Date(parsed.getTime() + seconds * 1000);
    if (/^-?\d+$/.test(value.trim())) {
      const resolvedUnit = unit === "auto" ? detectTimestampUnit(value.trim()) : unit;
      return formatTimestampByUnit(shifted, resolvedUnit);
    }
    return formatEditableDate(shifted, zone);
  } catch {
    return String(Math.floor((Date.now() + seconds * 1000) / 1000));
  }
}
function formatTimestampByUnit(date: Date, unit: string) {
  const milliseconds = date.getTime();
  if (unit === "milliseconds") return String(milliseconds);
  if (unit === "microseconds") return `${milliseconds}000`;
  if (unit === "nanoseconds") return `${milliseconds}000000`;
  return String(Math.floor(milliseconds / 1000));
}
function relativeTime(date: Date) {
  const delta = date.getTime() - Date.now();
  const abs = Math.abs(delta);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31536000000], ["month", 2592000000], ["day", 86400000], ["hour", 3600000], ["minute", 60000], ["second", 1000]];
  const [unit, size] = units.find(([, size]) => abs >= size) || ["second", 1000];
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(delta / size), unit);
}
function dayOfYear(date: Date, zone: string) {
  const ymd = zoneYmd(date, zone);
  const start = zonedPartsToDate(ymd.year, 1, 1, 0, 0, 0, 0, zone);
  return Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;
}
function isoWeek(date: Date, zone: string) {
  const { year, month, day } = zoneYmd(date, zone);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function zoneYmd(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return { year: value.year, month: value.month, day: value.day };
}
function batchConvert(input: string, mode: string, unit: string, zone: string) {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headers = mode === "timestamps" ? ["Input", "Detected", "UTC ISO", zone, "Relative"] : ["Input", "Unix s", "Unix ms", "UTC ISO", "Relative"];
  const rows = lines.map((line) => {
    try {
      const parsed = mode === "timestamps" ? parseTimeInput(line, unit, zone) : { date: parseDateInZone(line, zone), source: "date/time string" };
      const ms = parsed.date.getTime();
      const values = mode === "timestamps"
        ? [line, parsed.source, parsed.date.toISOString(), formatInZone(parsed.date, zone), relativeTime(parsed.date)]
        : [line, String(Math.floor(ms / 1000)), String(ms), parsed.date.toISOString(), relativeTime(parsed.date)];
      return { input: line, values };
    } catch (error) {
      return { input: line, values: [line, `Error: ${(error as Error).message}`, "", "", ""] };
    }
  });
  const csv = [headers, ...rows.map((row) => row.values)].map((row) => row.map(csvCell).join(",")).join("\n");
  return { headers, rows, csv };
}
function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
}
function lineDiff(left: string[], right: string[]) {
  const matrix = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) for (let j = right.length - 1; j >= 0; j -= 1) matrix[i][j] = left[i] === right[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
  const rows: Array<{ type: "same" | "add" | "remove"; text: string }> = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { rows.push({ type: "same", text: left[i++] }); j += 1; }
    else if (matrix[i + 1][j] >= matrix[i][j + 1]) rows.push({ type: "remove", text: left[i++] });
    else rows.push({ type: "add", text: right[j++] });
  }
  while (i < left.length) rows.push({ type: "remove", text: left[i++] });
  while (j < right.length) rows.push({ type: "add", text: right[j++] });
  return rows;
}
async function runHashMode(input: string, mode: string) {
  if (mode === "keccak") return `0x${keccak256Hex(input)}`;
  if (mode === "base64e") return btoa(unescape(encodeURIComponent(input)));
  if (mode === "base64d") return decodeURIComponent(escape(atob(input)));
  if (mode === "urle") return encodeURIComponent(input);
  if (mode === "urld") return decodeURIComponent(input);
  const digest = await crypto.subtle.digest(mode === "sha1" ? "SHA-1" : "SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function deriveAesKey(password: string, salt: Uint8Array, usages: KeyUsage[]) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const stableSalt = salt.slice().buffer as ArrayBuffer;
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: stableSalt, iterations: 100000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, usages);
}
function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
function base64UrlDecode(value: string) {
  return decodeURIComponent(escape(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="))));
}
function inferTs(name: string, value: unknown): string {
  if (Array.isArray(value)) return `${inferTs(name, value[0] ?? {})}[]`;
  if (value && typeof value === "object") return `interface ${name} {\n${Object.entries(value).map(([key, val]) => `  ${/^[a-zA-Z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${Array.isArray(val) ? `${inferValue(val[0])}[]` : inferValue(val)};`).join("\n")}\n}`;
  return inferValue(value);
}
function inferValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `${inferValue(value[0])}[]`;
  if (typeof value === "object") return "{ [key: string]: unknown }";
  return typeof value;
}

type MarketKind = "regular" | "pre" | "after";
type MarketSegment = { id: string; start: number; end: number; kind: MarketKind };
type MarketDef = { id: "us" | "cn" | "hk"; zh: string; mark: string; exchange: string; zone: string; zoneLabel: string; segments: MarketSegment[]; gapText?: string };
type ZoneParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const WEEKDAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const MARKETS: MarketDef[] = [
  {
    id: "us",
    zh: "美股",
    mark: "US",
    exchange: "NYSE · NASDAQ",
    zone: "America/New_York",
    zoneLabel: "美东",
    segments: [
      { id: "pre", start: 240, end: 570, kind: "pre" },
      { id: "regular", start: 570, end: 960, kind: "regular" },
      { id: "after", start: 960, end: 1200, kind: "after" },
    ],
  },
  {
    id: "cn",
    zh: "A股",
    mark: "CN",
    exchange: "上交所 · 深交所",
    zone: "Asia/Shanghai",
    zoneLabel: "北京",
    gapText: "11:30 – 13:00",
    segments: [
      { id: "morning", start: 570, end: 690, kind: "regular" },
      { id: "afternoon", start: 780, end: 900, kind: "regular" },
    ],
  },
  {
    id: "hk",
    zh: "港股",
    mark: "HK",
    exchange: "香港交易所",
    zone: "Asia/Hong_Kong",
    zoneLabel: "香港",
    gapText: "12:00 – 13:00",
    segments: [
      { id: "pre", start: 540, end: 570, kind: "pre" },
      { id: "morning", start: 570, end: 720, kind: "regular" },
      { id: "afternoon", start: 780, end: 960, kind: "regular" },
    ],
  },
];

function useTicker(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function zoneParts(date: Date, zone: string): ZoneParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") values[part.type] = part.value;
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second), weekday: weekdays[values.weekday] ?? 0 };
}

function two(value: number) {
  return String(value).padStart(2, "0");
}

function hhmm(minuteOfDay: number) {
  return `${two(Math.floor(minuteOfDay / 60))}:${two(minuteOfDay % 60)}`;
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const core = `${two(Math.floor((total % 86400) / 3600))}:${two(Math.floor((total % 3600) / 60))}:${two(total % 60)}`;
  return days > 0 ? `${days}天 ${core}` : core;
}

function segmentInstant(market: MarketDef, parts: ZoneParts, minuteOfDay: number) {
  const dayOffset = Math.floor(minuteOfDay / 1440);
  const minute = minuteOfDay % 1440;
  const cursor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  return zonedPartsToDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate(), Math.floor(minute / 60), minute % 60, 0, 0, market.zone);
}

function nextOpenInstant(market: MarketDef, now: Date, parts: ZoneParts) {
  const regulars = market.segments.filter((segment) => segment.kind === "regular");
  const base = Date.UTC(parts.year, parts.month - 1, parts.day);
  for (let i = 0; i < 10; i += 1) {
    const cursor = new Date(base + i * 86400000);
    const weekday = cursor.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const segment of regulars) {
      const instant = zonedPartsToDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate(), Math.floor(segment.start / 60), segment.start % 60, 0, 0, market.zone);
      if (instant.getTime() > now.getTime() + 500) return instant;
    }
  }
  return now;
}

function computeMarket(market: MarketDef, now: Date) {
  const parts = zoneParts(now, market.zone);
  const minute = parts.hour * 60 + parts.minute;
  const isWeekend = parts.weekday === 0 || parts.weekday === 6;
  const regulars = market.segments.filter((segment) => segment.kind === "regular");
  const extended = market.segments.filter((segment) => segment.kind !== "regular");
  const current = market.segments.find((segment) => minute >= segment.start && minute < segment.end);

  let phase: "open" | "pre" | "after" | "lunch" | "closed" = "closed";
  let statusLabel = "已收盘";
  let tone: "open" | "break" | "pre" | "closed" = "closed";
  if (isWeekend) {
    statusLabel = "周末休市";
  } else if (current?.kind === "regular") {
    phase = "open";
    statusLabel = "交易中";
    tone = "open";
  } else if (current?.kind === "pre") {
    phase = "pre";
    statusLabel = "盘前";
    tone = "pre";
  } else if (current?.kind === "after") {
    phase = "after";
    statusLabel = "盘后";
    tone = "pre";
  } else if (minute < market.segments[0].start) {
    phase = "pre";
    statusLabel = "未开盘";
    tone = "pre";
  } else if (minute >= market.segments[market.segments.length - 1].end) {
    phase = "after";
  } else {
    phase = "lunch";
    statusLabel = "午间休市";
    tone = "break";
  }

  const openInstant = segmentInstant(market, parts, regulars[0].start);
  const closeInstant = segmentInstant(market, parts, regulars[regulars.length - 1].end);
  const beijingOpen = formatInZone(openInstant, "Asia/Shanghai").slice(11, 16);
  const beijingClose = formatInZone(closeInstant, "Asia/Shanghai").slice(11, 16);
  const crossesDay = formatInZone(closeInstant, "Asia/Shanghai").slice(0, 10) !== formatInZone(openInstant, "Asia/Shanghai").slice(0, 10);

  const targetKind: "open" | "close" = phase === "open" && current ? "close" : "open";
  const target = targetKind === "close" && current ? segmentInstant(market, parts, current.end) : nextOpenInstant(market, now, parts);
  const targetParts = zoneParts(target, market.zone);
  const sameDay = targetParts.year === parts.year && targetParts.month === parts.month && targetParts.day === parts.day;
  const targetLocal = formatInZone(target, market.zone).slice(11, 16);
  const targetBeijing = formatInZone(target, "Asia/Shanghai").slice(11, 16);
  const dayTag = sameDay ? "" : `${WEEKDAY_ZH[targetParts.weekday]} `;

  return {
    minute,
    isWeekend,
    statusLabel,
    tone,
    nowTime: hhmm(minute),
    countdownLabel: targetKind === "close" ? "距收盘" : "距开盘",
    countdownText: formatDuration(target.getTime() - now.getTime()),
    targetText: `${dayTag}${targetLocal}${targetKind === "close" ? " 收盘" : " 开盘"}（北京时间 ${targetBeijing}）`,
    openText: hhmm(regulars[0].start),
    closeText: hhmm(regulars[regulars.length - 1].end),
    beijingOpen,
    beijingClose: `${beijingClose}${crossesDay ? "（次日）" : ""}`,
    sessionText: regulars.map((segment) => `${hhmm(segment.start)} – ${hhmm(segment.end)}`).join(" · "),
    footerLabel: extended.length ? (extended.every((segment) => segment.kind === "pre") ? "盘前" : extended.every((segment) => segment.kind === "after") ? "盘后" : "盘前 / 盘后") : "午间休市",
    footerText: extended.length ? extended.map((segment) => `${hhmm(segment.start)} – ${hhmm(segment.end)}`).join(" · ") : market.gapText || "—",
  };
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function usDstInfo(now: Date) {
  const year = zoneParts(now, "America/New_York").year;
  // DST: 2nd Sunday of March 02:00 EST (07:00 UTC) -> 1st Sunday of November 02:00 EDT (06:00 UTC).
  const start = new Date(Date.UTC(year, 2, nthWeekdayOfMonth(year, 3, 0, 2), 7, 0, 0));
  const end = new Date(Date.UTC(year, 10, nthWeekdayOfMonth(year, 11, 0, 1), 6, 0, 0));
  const inDst = now.getTime() >= start.getTime() && now.getTime() < end.getTime();
  const next = now.getTime() < start.getTime() ? start : inDst ? end : new Date(Date.UTC(year + 1, 2, nthWeekdayOfMonth(year + 1, 3, 0, 2), 7, 0, 0));
  return { inDst, next, abbr: inDst ? "EDT" : "EST", offset: inDst ? "UTC-4" : "UTC-5" };
}
