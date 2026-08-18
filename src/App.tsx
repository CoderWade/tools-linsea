import {
  Braces,
  Calculator,
  Clock3,
  Code2,
  Command,
  Contrast,
  FileCode2,
  Fingerprint,
  KeyRound,
  Layers3,
  LockKeyhole,
  Moon,
  PackageCheck,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Truck,
  UserRound,
} from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Button, Combobox, CommandInput, CopyButton, Field, IconButton, Input, Modal, Notice, Panel, ResultRows, Select, Tabs, Textarea, cn } from "./components/ui";
import {
  decodeStorageValue,
  findStorageEntry,
  keccak256Hex,
  mappingSlotByType,
  normalizeAbiWord,
  parseMappingDeclaration,
  parseSlotIndex,
  parseSourceLayout,
  rpcRequest,
  toSlotHex,
} from "./lib/evm";

type CategoryId = "reverse" | "developer" | "commerce" | "risk";
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
  | "text-compare"
  | "fba-calculator"
  | "listing-cleaner"
  | "white-bg"
  | "shipping-tracker"
  | "card-bin";

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
  privacyMode: boolean;
};

const STATE_KEY = "linsea-react-state";
const SETTINGS_KEY = "linsea-tools-settings";

const categories: Array<{ id: CategoryId; name: string; zh: string }> = [
  { id: "reverse", name: "Reverse Security", zh: "逆向安全" },
  { id: "developer", name: "Developer", zh: "通用开发" },
  { id: "commerce", name: "Commerce", zh: "跨境运营" },
  { id: "risk", name: "Risk Testing", zh: "风控测试" },
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
  { id: "text-compare", category: "developer", name: "Text Compare", zh: "文本对比", description: "Compare two text versions with readable line-level diffs.", keywords: ["diff", "text", "compare"], badges: ["Diff", "Local"], icon: <Contrast /> },
  { id: "fba-calculator", category: "commerce", name: "FBA & Landed Cost Calculator", zh: "FBA 到岸成本计算器", description: "Estimate margin, ROI, platform fees, and landed cost.", keywords: ["fba", "amazon", "margin"], badges: ["Estimator", "Local"], icon: <PackageCheck /> },
  { id: "listing-cleaner", category: "commerce", name: "Listing Text Cleaner", zh: "Listing 文本清洗", description: "Strip HTML, normalize whitespace, and export clean copy.", keywords: ["listing", "html", "clean"], badges: ["Text", "Local"], icon: <Sparkles /> },
  { id: "white-bg", category: "commerce", name: "Product Pure White BG", zh: "产品白底图", description: "Client-side white background helper for product photos.", keywords: ["image", "white", "background"], badges: ["Canvas", "Local"], icon: <Sparkles /> },
  { id: "shipping-tracker", category: "commerce", name: "Global Shipping Tracker", zh: "全球物流追踪", description: "Guess carrier tracking links from common tracking formats.", keywords: ["tracking", "shipping", "carrier"], badges: ["Outbound", "Link"], icon: <Truck /> },
  { id: "card-bin", category: "risk", name: "Card & BIN Tester", zh: "卡号与 BIN 测试", description: "Validate Luhn and generate sandbox-only test card numbers.", keywords: ["luhn", "bin", "card", "sandbox"], badges: ["Compliance", "Test"], icon: <UserRound /> },
];

const defaultSettings: Settings = { alchemyKey: "", infuraKey: "", defaultChain: "ethereum", privacyMode: false };

export function App() {
  const boot = loadState();
  const [activeCategory, setActiveCategory] = useState<CategoryId>(boot.category || "reverse");
  const [activeToolId, setActiveToolId] = useState<ToolId>(boot.tool || "storage-slot");
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
    case "text-compare": return <TextCompare />;
    case "fba-calculator": return <FbaCalculator />;
    case "listing-cleaner": return <ListingCleaner />;
    case "white-bg": return <WhiteBgTool />;
    case "shipping-tracker": return <ShippingTracker />;
    case "card-bin": return <CardTester />;
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
  const [output, setOutput] = useState<ReactNode>(<Notice>Enter a slot index or mapping probe parameters.</Notice>);

  const read = async () => {
    try {
      if (settings.privacyMode) throw new Error("Privacy First Mode blocks RPC requests.");
      if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) throw new Error("Enter a valid contract address.");
      const endpoint = rpcEndpoint(settings);
      if (!endpoint) throw new Error("Configure Alchemy or Infura key in Settings.");
      if (mode === "raw") {
        const slot = toSlotHex(slotIndex);
        const raw = await rpcRequest(endpoint, "eth_getStorageAt", [contract, slot, blockTag || "latest"]);
        setOutput(<RawStorageOutput contract={contract} blockTag={blockTag} slotIndex={slotIndex} slot={slot} raw={raw} decodeType={decodeType} />);
      } else {
        const layout = parseMappingDeclaration(declaration);
        if (!layout) throw new Error("Enter a mapping declaration such as mapping(address => bool) public flags;");
        if (!baseSlot) {
          const max = Math.min(Math.max(Number(scanLimit) || 80, 0), 500);
          const matches: Array<{ base: number; slot: string; raw: string }> = [];
          for (let i = 0; i <= max; i += 1) {
            const valueSlot = mappingSlotByType(mappingKey, layout.keyType, toSlotHex(BigInt(i)));
            const raw = await rpcRequest(endpoint, "eth_getStorageAt", [contract, valueSlot, blockTag || "latest"]);
            if (BigInt(raw) !== 0n) matches.push({ base: i, slot: valueSlot, raw });
            if (matches.length >= 24) break;
          }
          setOutput(matches.length ? <MappingScanOutput matches={matches} /> : <Notice tone="warn">No non-zero candidate found. Zero/false cannot prove a mapping base slot.</Notice>);
          return;
        }
        const valueSlot = mappingSlotByType(mappingKey, layout.keyType, toSlotHex(baseSlot));
        const raw = await rpcRequest(endpoint, "eth_getStorageAt", [contract, valueSlot, blockTag || "latest"]);
        setOutput(<MappingReadOutput baseSlot={baseSlot} valueSlot={valueSlot} raw={raw} valueType={layout.valueType} />);
      }
    } catch (error) {
      setOutput(<Notice tone="danger">{(error as Error).message}</Notice>);
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
          <Button variant="primary" onClick={read}>Read storage</Button>
        </div>
      </Panel>
      <Panel title="Readout">{output}</Panel>
    </Workbench>
  );
}

function RawStorageOutput({ contract, blockTag, slotIndex, slot, raw, decodeType }: { contract: string; blockTag: string; slotIndex: string; slot: string; raw: string; decodeType: string }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Metric label="Raw slot" value={slotIndex || String(parseSlotIndex(slot))} />
        <Metric label="RPC method" value="eth_getStorageAt" />
      </div>
      <ResultRows rows={[
        ["Contract", contract],
        ["Block tag", blockTag],
        ["Slot hex", slot],
        ["Raw bytes32", raw],
        [`Decoded ${decodeType}`, decodeStorageValue(raw, decodeType)],
        ["uint256 view", BigInt(raw).toString()],
        ["address view", decodeStorageValue(raw, "address")],
      ]} />
    </div>
  );
}

function MappingReadOutput({ baseSlot, valueSlot, raw, valueType }: { baseSlot: string; valueSlot: string; raw: string; valueType: string }) {
  return <ResultRows rows={[["Base slot", `#${parseSlotIndex(baseSlot).toString()}`], ["Value slot", valueSlot], ["Raw bytes32", raw], [`Decoded ${valueType}`, decodeStorageValue(raw, valueType)]]} />;
}

function MappingScanOutput({ matches }: { matches: Array<{ base: number; slot: string; raw: string }> }) {
  return <div className="grid gap-3">{matches.map((match) => <div key={match.base} className="rounded-2xl border border-line bg-panel p-3"><div className="font-black text-accent">Base slot #{match.base}</div><div className="mt-2 break-all font-mono text-xs text-muted">{match.slot}</div><div className="mt-2 break-all font-mono text-xs text-text">{match.raw}</div></div>)}</div>;
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

function TextCompare() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const rows = useMemo(() => lineDiff(left.split(/\r?\n/), right.split(/\r?\n/)), [left, right]);
  return <Workbench wide><Panel title="Compare"><div className="grid grid-cols-2 gap-4 max-md:grid-cols-1"><Field label="Original"><Textarea className="mono min-h-[320px]" value={left} onChange={(e) => setLeft(e.target.value)} /></Field><Field label="Changed"><Textarea className="mono min-h-[320px]" value={right} onChange={(e) => setRight(e.target.value)} /></Field></div><pre className="mt-4 max-h-[480px] overflow-auto rounded-2xl border border-line bg-panel p-4 font-mono text-sm leading-6">{rows.map((row, i) => <div key={i} className={cn(row.type === "add" && "text-emerald-500", row.type === "remove" && "text-red-500", row.type === "same" && "text-muted")}>{row.type === "add" ? "+" : row.type === "remove" ? "-" : " "} {row.text}</div>)}</pre></Panel></Workbench>;
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
      const endpoint = rpcEndpoint(settings);
      if (!endpoint) throw new Error("Configure Alchemy or Infura key.");
      const implementationSlot = eip1967Slot("eip1967.proxy.implementation");
      const adminSlot = eip1967Slot("eip1967.proxy.admin");
      const beaconSlot = eip1967Slot("eip1967.proxy.beacon");
      const [implementation, admin, beacon] = await Promise.all([
        rpcRequest(endpoint, "eth_getStorageAt", [address, implementationSlot, "latest"]),
        rpcRequest(endpoint, "eth_getStorageAt", [address, adminSlot, "latest"]),
        rpcRequest(endpoint, "eth_getStorageAt", [address, beaconSlot, "latest"]),
      ]);
      setOutput(<ResultRows rows={[["Implementation slot", implementationSlot], ["Implementation", storageAddress(implementation) || "not set"], ["Admin", storageAddress(admin) || "not set"], ["Beacon", storageAddress(beacon) || "not set"]]} />);
    } catch (error) {
      setOutput(<Notice tone="danger">{(error as Error).message}</Notice>);
    }
  };
  return <Workbench><Panel title="Proxy"><div className="grid gap-4"><Field label="Proxy address"><Input className="mono" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." /></Field><Button variant="primary" onClick={probe}>Probe proxy slots</Button></div></Panel><Panel title="Readout">{output}</Panel></Workbench>;
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

function WhiteBgTool() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [threshold, setThreshold] = useState("222");
  const [status, setStatus] = useState("Upload a product image to preview white background processing.");
  const draw = (nextThreshold = Number(threshold)) => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const maxWidth = 880;
    const scale = Math.min(1, maxWidth / image.width);
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < frame.data.length; i += 4) {
      const r = frame.data[i], g = frame.data[i + 1], b = frame.data[i + 2];
      if (r > nextThreshold && g > nextThreshold && b > nextThreshold) {
        frame.data[i] = 255;
        frame.data[i + 1] = 255;
        frame.data[i + 2] = 255;
      }
    }
    context.putImageData(frame, 0, 0);
    setStatus(`Processed ${canvas.width} x ${canvas.height}.`);
  };
  const loadFile = (file?: File) => {
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      draw();
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  };
  return <Workbench><Panel title="Image Input"><div className="grid gap-4"><Field label="Product image"><Input type="file" accept="image/*" onChange={(e) => loadFile(e.target.files?.[0])} /></Field><Field label="White threshold"><Input type="range" min="180" max="252" value={threshold} onChange={(e) => { setThreshold(e.target.value); draw(Number(e.target.value)); }} /></Field><Notice>{status}</Notice></div></Panel><Panel title="Preview"><canvas ref={canvasRef} className="min-h-[280px] w-full rounded-2xl border border-line bg-white object-contain" /></Panel></Workbench>;
}

function FbaCalculator() {
  const [price, setPrice] = useState("29.99");
  const [cost, setCost] = useState("8.50");
  const [ship, setShip] = useState("3.20");
  const [fee, setFee] = useState("15");
  const p = Number(price), c = Number(cost), s = Number(ship), f = Number(fee) / 100;
  const platform = p * f;
  const profit = p - c - s - platform;
  return <Workbench><Panel title="Inputs"><div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1"><Field label="Sale price"><Input value={price} onChange={(e) => setPrice(e.target.value)} /></Field><Field label="Product cost"><Input value={cost} onChange={(e) => setCost(e.target.value)} /></Field><Field label="Shipping"><Input value={ship} onChange={(e) => setShip(e.target.value)} /></Field><Field label="Platform fee %"><Input value={fee} onChange={(e) => setFee(e.target.value)} /></Field></div></Panel><Panel title="Readout"><ResultRows rows={[["Platform fee", money(platform)], ["Profit", money(profit)], ["Margin", `${((profit / p) * 100 || 0).toFixed(2)}%`], ["ROI", `${((profit / c) * 100 || 0).toFixed(2)}%`]]} /></Panel></Workbench>;
}

function ListingCleaner() {
  const [text, setText] = useState("<h1>Product</h1>\n\nFast&nbsp;shipping");
  const cleaned = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return <Workbench><Panel title="Listing"><Textarea value={text} onChange={(e) => setText(e.target.value)} /></Panel><Panel title="Clean Copy"><pre className="rounded-2xl border border-line bg-panel p-4 text-sm">{cleaned}</pre><ResultRows rows={[["Characters", cleaned.length], ["Words", cleaned ? cleaned.split(/\s+/).length : 0]]} /></Panel></Workbench>;
}

function ShippingTracker() {
  const [track, setTrack] = useState("1Z999AA10123456784");
  const url = /^1Z/i.test(track) ? `https://www.ups.com/track?tracknum=${encodeURIComponent(track)}` : `https://www.google.com/search?q=${encodeURIComponent(`${track} tracking`)}`;
  return <Workbench><Panel title="Tracking"><Field label="Tracking number"><Input className="mono" value={track} onChange={(e) => setTrack(e.target.value)} /></Field></Panel><Panel title="Readout"><ResultRows rows={[["Tracking number", track], ["Tracking URL", url]]} /><a className="mt-4 inline-flex rounded-xl border border-line px-3 py-2 text-sm font-bold text-accent" href={url} target="_blank" rel="noreferrer">Open tracking</a></Panel></Workbench>;
}

function CardTester() {
  const [number, setNumber] = useState("4242424242424242");
  const clean = number.replace(/\D/g, "");
  const valid = clean.length >= 12 && luhn(clean);
  return <Workbench><Panel title="Compliance"><Notice tone="warn">Sandbox and QA use only. This validates format and Luhn checksum; it does not query or generate real cards.</Notice><Field label="Card number"><Input className="mono mt-4" value={number} onChange={(e) => setNumber(e.target.value)} /></Field></Panel><Panel title="Readout"><ResultRows rows={[["Normalized", clean], ["Network", network(clean)], ["Luhn", valid ? "Valid" : "Invalid"], ["Length", clean.length]]} /></Panel></Workbench>;
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return <Workbench><Panel title={title}><Notice>{body}</Notice></Panel><Panel title="Readout"><Notice>Componentized React migration placeholder.</Notice></Panel></Workbench>;
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return <div className="rounded-2xl border border-accent/30 bg-[linear-gradient(135deg,hsl(var(--accent)/0.12),transparent_58%)] p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-faint">{label}</div><div className="mt-2 break-words text-2xl font-black text-accent">{value}</div>{hint ? <div className="mt-2 break-words text-sm leading-6 text-muted">{hint}</div> : null}</div>;
}

function SettingsModal({ open, settings, onClose, onSave }: { open: boolean; settings: Settings; onClose: () => void; onSave: (settings: Settings) => void }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings, open]);
  return <Modal open={open} title="Settings" description="API keys and preferences are stored in this browser only." onClose={onClose}><div className="grid gap-4"><Field label="Alchemy API Key"><Input type="password" value={draft.alchemyKey} onChange={(e) => setDraft({ ...draft, alchemyKey: e.target.value })} placeholder="Optional BYOK key" /></Field><Field label="Infura API Key"><Input type="password" value={draft.infuraKey} onChange={(e) => setDraft({ ...draft, infuraKey: e.target.value })} placeholder="Optional BYOK key" /></Field><Field label="Default chain"><Select value={draft.defaultChain} onChange={(value) => setDraft({ ...draft, defaultChain: value })} options={[{ value: "ethereum", label: "Ethereum Mainnet" }, { value: "sepolia", label: "Sepolia" }, { value: "polygon", label: "Polygon" }, { value: "bsc", label: "BNB Smart Chain" }]} /></Field><label className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-4"><span><strong className="block text-sm text-text">Privacy First Mode</strong><small className="text-muted">Disable third-party requests, ads, RPC, and remote lookups.</small></span><input type="checkbox" checked={draft.privacyMode} onChange={(e) => setDraft({ ...draft, privacyMode: e.target.checked })} /></label><Button variant="primary" onClick={() => { onSave(draft); onClose(); }}>Save preferences</Button></div></Modal>;
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
function rpcEndpoint(settings: Settings) {
  if (settings.alchemyKey) {
    const chain = settings.defaultChain === "polygon" ? "polygon-mainnet" : settings.defaultChain === "bsc" ? "bnb-mainnet" : settings.defaultChain === "sepolia" ? "eth-sepolia" : "eth-mainnet";
    return `https://${chain}.g.alchemy.com/v2/${settings.alchemyKey}`;
  }
  if (settings.infuraKey) {
    const chain = settings.defaultChain === "sepolia" ? "sepolia" : "mainnet";
    return `https://${chain}.infura.io/v3/${settings.infuraKey}`;
  }
  return "";
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
function timestampToDate(value: string) {
  if (!/^-?\d+$/.test(value.trim())) throw new Error("Timestamp must be an integer.");
  const n = Number(value);
  return new Date(Math.abs(n) > 1e12 ? n : n * 1000);
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
function money(value: number) { return Number.isFinite(value) ? `$${value.toFixed(2)}` : "n/a"; }
function luhn(number: string) {
  let sum = 0, double = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit; double = !double;
  }
  return sum % 10 === 0;
}
function network(number: string) {
  if (/^4/.test(number)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(number)) return "Mastercard";
  if (/^3[47]/.test(number)) return "American Express";
  if (/^6(?:011|5)/.test(number)) return "Discover";
  return "Unknown";
}
