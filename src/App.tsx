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
  Settings2,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Button, Combobox, CommandInput, CopyButton, EmptyState, Field, IconButton, Input, Modal, Notice, Panel, ResultRows, Select, Tabs, Textarea, cn } from "./components/ui";
import { LanguageContext, useLang, useT, type Lang, type StringKey, t } from "./lib/i18n";
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

type CategoryId = "reverse" | "crypto" | "developer" | "general";
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
  description: { en: string; zh: string };
  keywords: string[];
  badges: { en: string[]; zh: string[] };
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
  { id: "crypto", name: "Encoding & Crypto", zh: "编码与密码" },
  { id: "developer", name: "Developer", zh: "通用开发" },
  { id: "general", name: "General Tools", zh: "通用工具" },
];

/*
 * Identity colour, in the only three places it is allowed to appear: the rail
 * stripe, the tool icon, and the category chip. Nothing else may use it — no
 * card fills, no gradients, no shadows. "General" deliberately has no hue:
 * a catch-all section should not compete with the two real ones.
 */
const familyTone: Record<CategoryId, { stripe: string; text: string; chip: string }> = {
  reverse: {
    stripe: "bg-family-reverse",
    text: "text-family-reverse",
    chip: "border-family-reverse/35 bg-family-reverse/10 text-family-reverse",
  },
  crypto: {
    stripe: "bg-family-dev",
    text: "text-family-dev",
    chip: "border-family-dev/35 bg-family-dev/10 text-family-dev",
  },
  developer: {
    stripe: "bg-family-general",
    text: "text-family-general",
    chip: "border-line bg-surface text-muted",
  },
  general: {
    stripe: "bg-family-general",
    text: "text-family-general",
    chip: "border-line bg-surface text-muted",
  },
};

const tools: Tool[] = [
  { id: "storage-slot", category: "reverse", name: "Storage Slot Inspector", zh: "存储槽检查器", description: { en: "Read raw slots and probe mapping keys with read-only RPC.", zh: "读取原始存储槽，并通过只读 RPC 探测 mapping 键。" }, keywords: ["slot", "storage", "mapping", "eth_getStorageAt", "存储槽", "槽位"], badges: { en: ["Raw read", "Mapping probe"], zh: ["原始读取", "mapping 探测"] }, icon: <Layers3 /> },
  { id: "source-layout", category: "reverse", name: "Source Layout Resolver", zh: "源码槽位解析器", description: { en: "Paste verified or decompiled Solidity source to resolve names into storage slots.", zh: "粘贴已验证或反编译的 Solidity 源码，将变量名解析为存储槽位。" }, keywords: ["source", "layout", "decompiled", "verified", "slot", "源码", "槽位"], badges: { en: ["Local first", "Layout aware"], zh: ["本地优先", "布局感知"] }, icon: <FileCode2 /> },
  { id: "proxy-slot", category: "reverse", name: "Proxy Slot Finder", zh: "代理槽探测器", description: { en: "Probe ERC-1967 implementation/admin/beacon slots.", zh: "探测 ERC-1967 的 implementation、admin 与 beacon 槽位。" }, keywords: ["proxy", "erc1967", "beacon", "implementation", "代理", "实现地址"], badges: { en: ["Read only", "RPC"], zh: ["只读", "RPC"] }, icon: <Route /> },
  { id: "calldata-decoder", category: "reverse", name: "Calldata Decoder", zh: "Calldata 解码器", description: { en: "Split selector and ABI words, then inspect calldata structure.", zh: "拆分 selector 与 ABI 参数，查看 calldata 结构。" }, keywords: ["calldata", "selector", "abi"], badges: { en: ["Local", "ABI words"], zh: ["本地", "ABI 参数"] }, icon: <Code2 /> },
  { id: "unit-converter", category: "reverse", name: "Unit Converter", zh: "单位转换器", description: { en: "Convert Wei, Gwei, Ether, and token decimals safely.", zh: "在 wei、gwei、ether 与代币精度之间安全换算。" }, keywords: ["wei", "gwei", "ether", "decimals", "单位", "精度"], badges: { en: ["BigInt", "Bidirectional"], zh: ["BigInt", "双向换算"] }, icon: <Calculator /> },
  { id: "selector-finder", category: "reverse", name: "4Byte / Selector Finder", zh: "4Byte / Selector 查询", description: { en: "Generate selectors and event topic0 locally.", zh: "本地生成函数 selector 与事件 topic0。" }, keywords: ["4byte", "selector", "topic0", "function", "函数", "事件"], badges: { en: ["Keccak", "Local"], zh: ["Keccak", "本地"] }, icon: <Fingerprint /> },
  { id: "hash-suite", category: "crypto", name: "Encoder / Hash Suite", zh: "编码与哈希套件", description: { en: "Hash, Base64, URL encode/decode, and Keccak utilities.", zh: "哈希、Base64、URL 编解码与 Keccak 工具。" }, keywords: ["hash", "sha256", "base64", "url", "哈希", "编码"], badges: { en: ["Crypto", "Local"], zh: ["哈希", "本地"] }, icon: <KeyRound /> },
  { id: "symmetric-encryption", category: "crypto", name: "Symmetric Encryption", zh: "对称加密", description: { en: "AES-GCM local encryption/decryption playground.", zh: "本地 AES-GCM 加解密试验台。" }, keywords: ["aes", "gcm", "encrypt", "decrypt", "加密", "解密"], badges: { en: ["Sensitive", "Local"], zh: ["敏感数据", "本地"] }, icon: <LockKeyhole /> },
  { id: "jwt-inspector", category: "crypto", name: "JWT Inspector", zh: "JWT 检查器", description: { en: "Decode JWT header and payload without sending it anywhere.", zh: "在本地解析 JWT 的 header 与 payload，不发送到任何地方。" }, keywords: ["jwt", "token", "exp", "payload", "令牌"], badges: { en: ["Local", "Auth"], zh: ["本地", "鉴权"] }, icon: <ShieldCheck /> },
  { id: "json-studio", category: "developer", name: "JSON Studio", zh: "JSON 工作台", description: { en: "Format, minify, validate, and infer TypeScript shapes.", zh: "格式化、压缩、校验 JSON，并推断 TypeScript 类型。" }, keywords: ["json", "format", "typescript", "格式化", "校验"], badges: { en: ["Formatter", "Local"], zh: ["格式化", "本地"] }, icon: <Braces /> },
  { id: "timestamp-pro", category: "developer", name: "Timestamp Pro", zh: "时间戳工具", description: { en: "Convert timestamps and dates across IANA timezones.", zh: "跨 IANA 时区转换时间戳与日期。" }, keywords: ["timestamp", "unix", "timezone", "时间戳", "时区"], badges: { en: ["IANA", "Date"], zh: ["IANA", "日期"] }, icon: <Clock3 /> },
  { id: "base-converter", category: "crypto", name: "Base Converter", zh: "进制转换器", description: { en: "Convert integers across binary, octal, decimal, hex, and custom bases.", zh: "在二进制、八进制、十进制、十六进制与自定义进制之间转换整数。" }, keywords: ["base", "radix", "binary", "hex", "decimal", "进制", "二进制", "十六进制"], badges: { en: ["BigInt", "2-36"], zh: ["BigInt", "2–36 进制"] }, icon: <Binary /> },
  { id: "text-compare", category: "developer", name: "Text Compare", zh: "文本对比", description: { en: "Compare two text versions with readable line-level diffs.", zh: "逐行比对两段文本，输出可读的差异。" }, keywords: ["diff", "text", "compare", "对比", "差异"], badges: { en: ["Diff", "Local"], zh: ["差异对比", "本地"] }, icon: <Contrast /> },
  { id: "market-clock", category: "general", name: "Market Clock", zh: "时间看盘", description: { en: "Live Beijing / Hong Kong / New York clocks with US DST state and trading-session status for US, A-share, and HK markets.", zh: "北京、香港、纽约实时时钟，含美国夏令时状态与美股、A 股、港股的交易时段。" }, keywords: ["market", "clock", "timezone", "trading", "dst", "开盘", "收盘", "夏令时", "冬令时", "美股", "港股", "A股", "时间", "看盘"], badges: { en: ["Live clock", "DST aware", "Trading hours"], zh: ["实时时钟", "夏令时", "交易时段"] }, icon: <Globe2 /> },
];

const defaultSettings: Settings = { alchemyKey: "", infuraKey: "", defaultChain: "ethereum", customRpcUrl: "", customChainId: "", customChainLabel: "", privacyMode: false };

export function App() {
  const boot = loadState();
  const bootTool = tools.find((tool) => tool.id === boot.tool) || tools[0];
  const [activeCategory, setActiveCategory] = useState<CategoryId>(bootTool.category);
  const [activeToolId, setActiveToolId] = useState<ToolId>(bootTool.id);
  const [theme, setTheme] = useState<"light" | "dark">(boot.theme || "dark");
  const [language, setLanguage] = useState<Lang>(boot.language || "en");
  const [settings, setSettings] = useState<Settings>({ ...defaultSettings, ...loadSettingsCache(), ...(boot.settings || {}) });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [recent, setRecent] = useState<ToolId[]>(boot.recent || []);

  const activeTool = tools.find((tool) => tool.id === activeToolId) || tools[0];
  const visibleTools = tools.filter((tool) => tool.category === activeCategory);
  const tr = (key: StringKey, vars?: Record<string, string | number>) => t(language, key, vars);

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

  const selectCategory = (id: CategoryId) => {
    setActiveCategory(id);
    const next = tools.find((tool) => tool.category === id);
    if (next) {
      setActiveToolId(next.id);
      setRecent((items) => [next.id, ...items.filter((item) => item !== next.id)].slice(0, 8));
    }
  };

  return (
    <LanguageContext.Provider value={language}>
    <div className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)] gap-4 p-4 max-lg:grid-cols-1">
      <aside className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-tool border border-line bg-surface p-3 max-lg:static max-lg:h-auto">
        <div className="mb-4 flex items-center gap-3 border-b border-line pb-4">
          <div className="grid h-10 w-10 place-items-center rounded-ui border border-accent/35 bg-accent/10 text-base font-bold text-accent">L</div>
          <div>
            <div className="text-[15px] font-bold text-text">Linsea Tools</div>
            <div className="text-xs text-muted">{tr("app.tagline")}</div>
          </div>
        </div>
        <nav className="grid gap-1.5 overflow-y-auto">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => selectCategory(category.id)}
              className={cn(
                "relative flex min-h-11 items-center justify-between overflow-hidden rounded-ui border pl-3.5 pr-3 text-left text-sm font-semibold transition-colors",
                activeCategory === category.id
                  ? "border-accent/45 bg-accent/10 text-text"
                  : "border-transparent text-muted hover:bg-panel hover:text-text",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-1.5 left-1 w-[2px] rounded-full transition-opacity",
                  familyTone[category.id].stripe,
                  activeCategory === category.id ? "opacity-100" : "opacity-45",
                )}
              />
              <span>{language === "zh" ? category.zh : category.name}</span>
              <span className="font-mono text-[11px] text-faint">{tools.filter((tool) => tool.category === category.id).length}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 border-t border-line pt-4">
          <Button variant="default" onClick={() => setSettingsOpen(true)}>
            {tr("action.settings")}
          </Button>
          <p className="text-xs leading-5 text-faint">{tr("app.footer")}</p>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-4 z-20 mb-4 flex items-center gap-2.5 rounded-tool border border-line bg-surface p-2 max-md:static max-md:flex-col">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="flex h-11 flex-1 items-center justify-between gap-3 rounded-ui border border-line bg-panel px-3.5 text-left text-sm text-muted transition-colors hover:border-accent/45 hover:text-text max-md:w-full max-md:flex-none"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-accent" />
              <span className="truncate">{tr("search.placeholder")}</span>
            </span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint">⌘K</kbd>
          </button>
          <div className="flex shrink-0 items-center gap-1.5 max-md:w-full max-md:grid max-md:grid-cols-4">
            <span
              className={cn(
                "inline-flex h-11 items-center justify-center gap-1.5 rounded-ui border px-2.5 text-xs font-semibold",
                settings.privacyMode ? "border-ok/40 bg-ok/10 text-ok" : "border-line bg-surface text-muted",
              )}
              title={settings.privacyMode ? tr("privacy.on.hint") : tr("privacy.off.hint")}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", settings.privacyMode ? "bg-ok" : "bg-faint")} />
              <span className="max-sm:hidden">{settings.privacyMode ? tr("privacy.on") : tr("privacy.off")}</span>
            </span>
            <IconButton onClick={() => setLanguage((item) => (item === "en" ? "zh" : "en"))} aria-label={tr("action.switchLanguage")}>
              {language.toUpperCase()}
            </IconButton>
            <IconButton onClick={() => setTheme((item) => (item === "dark" ? "light" : "dark"))} aria-label={theme === "dark" ? tr("action.switchToLight") : tr("action.switchToDark")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </IconButton>
            <IconButton onClick={() => setSettingsOpen(true)} aria-label={tr("action.settings")}>
              <Settings2 className="h-4 w-4" />
            </IconButton>
          </div>
        </header>

        <section className="mb-4 flex items-end justify-between gap-4 px-1 max-md:block">
          <div>
            <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] text-muted">
              <span className={cn("rounded-full border px-2 py-1", familyTone[activeTool.category].chip)}>{categoryLabel(activeTool.category, language)}</span>
              <span className="rounded-full border border-line bg-surface px-2 py-1 font-mono">{activeTool.id}</span>
              <span className="rounded-full border border-line bg-surface px-2 py-1 font-mono text-muted">{chainSummary(settings)}</span>
            </div>
            <h1 className="text-[32px] font-bold leading-tight tracking-[-0.015em] text-text max-md:text-3xl">{language === "zh" ? activeTool.zh : activeTool.name}</h1>
            <p className="mt-2 max-w-3xl text-[15px] leading-7 text-muted">{activeTool.description[language]}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 max-md:mt-3 max-md:justify-start">
            {activeTool.badges[language].map((badge) => (
              <span key={badge} className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-muted">{badge}</span>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)_284px] gap-4 max-xl:grid-cols-1">
          <ToolWorkbench tool={activeTool} settings={settings} />
          <aside className="grid content-start gap-4">
            <Panel title={tr("panel.tools")}>
              <div className="grid gap-1.5">
                {visibleTools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => selectTool(tool.id)}
                    className={cn(
                      "grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-ui border p-2.5 text-left transition-colors",
                      activeToolId === tool.id
                        ? "border-accent/50 bg-accent/10"
                        : "border-line bg-surface hover:border-accent/40 hover:bg-panel",
                    )}
                  >
                    <span
                      className={cn(
                        "[&_svg]:h-[18px] [&_svg]:w-[18px]",
                        activeToolId === tool.id ? familyTone[tool.category].text : "text-faint",
                      )}
                    >
                      {tool.icon}
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-[13px] font-semibold text-text">{language === "zh" ? tool.zh : tool.name}</strong>
                      <small className="block truncate text-[11px] text-faint">{keywordsFor(tool, language).join(" / ")}</small>
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title={tr("panel.recent")}>
              <div className="grid gap-1">
                {recent.length ? (
                  recent.slice(0, 5).map((id) => {
                    const tool = tools.find((item) => item.id === id);
                    return tool ? (
                      <button
                        key={id}
                        type="button"
                        onClick={() => selectTool(id)}
                        className="truncate rounded-ui px-2 py-1.5 text-left text-[13px] text-muted transition-colors hover:bg-panel hover:text-text"
                      >
                        {language === "zh" ? tool.zh : tool.name}
                      </button>
                    ) : null;
                  })
                ) : (
                  <Notice>{tr("recent.empty")}</Notice>
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </main>

      <SettingsModal open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onSave={setSettings} />
      <CommandPalette open={commandOpen} query={commandQuery} setQuery={setCommandQuery} language={language} onClose={() => setCommandOpen(false)} onSelect={selectTool} />
    </div>
    </LanguageContext.Provider>
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
  return (
    <div className={cn("grid gap-4", wide ? "grid-cols-1" : "grid-cols-[minmax(330px,.9fr)_minmax(430px,1.1fr)] max-lg:grid-cols-1")}>
      {children}
    </div>
  );
}

function StorageSlotInspector({ settings }: { settings: Settings }) {
  const tr = useT();
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
  const [output, setOutput] = useState<ReactNode>(<EmptyState title={tr("storage.empty.title")} hint={tr("storage.empty.hint")} />);

  const read = async () => {
    setBusy(true);
    setProgress("");
    try {
      if (settings.privacyMode) throw new Error(tr("storage.err.privacy"));
      if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) throw new Error(tr("storage.err.address"));
      const session = await openRpcSession(settings, blockTag);
      if (mode === "raw") {
        const slot = toSlotHex(slotIndex);
        const raw = await rpcRequest(session.endpoint, "eth_getStorageAt", [contract, slot, session.blockTag]);
        setOutput(<RawStorageOutput contract={contract} session={session} slotIndex={slotIndex} slot={slot} raw={raw} decodeType={decodeType} />);
        return;
      }

      const layout = parseMappingDeclaration(declaration);
      if (!layout) throw new Error(tr("storage.err.declaration"));
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
        setProgress(tr("storage.scanning", { start, end, max, block: session.blockNumber !== null ? `#${session.blockNumber}` : session.blockTag }));
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
        throw new Error(tr("storage.scan.allFailed", { attempted, reason: failures[0] }));
      }
      setOutput(
        <div className="grid gap-4">
          <RpcProvenance session={session} />
          {matches.length
            ? <MappingScanOutput matches={matches} scannedTo={scannedTo} max={max} failures={failures.length} />
            : <Notice tone="warn">{failures.length ? tr("storage.scan.partial", { failed: failures.length, attempted }) : ""}{tr("storage.scan.none", { max })}</Notice>}
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
      <Panel title={tr("storage.panel")}>
        <div className="grid gap-4">
          <Tabs value={mode} onChange={setMode} options={[{ value: "raw", label: tr("storage.tab.raw") }, { value: "mapping", label: tr("storage.tab.mapping") }]} />
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Field label={tr("field.contractAddress")}><Input className="mono" value={contract} onChange={(event) => setContract(event.target.value)} placeholder="0x..." /></Field>
            <Field label={tr("field.blockTag")}><Input className="mono" value={blockTag} onChange={(event) => setBlockTag(event.target.value)} /></Field>
          </div>
          {mode === "raw" ? (
            <>
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <Field label={tr("field.slotIndex")}><Input className="mono" value={slotIndex} onChange={(event) => setSlotIndex(event.target.value)} placeholder={tr("storage.placeholder.slot")} /></Field>
                <Field label={tr("field.decodeFocus")}><Select value={decodeType} onChange={setDecodeType} options={["bytes32", "bool", "uint256", "int256", "address"].map((item) => ({ value: item, label: item }))} /></Field>
              </div>
              <Notice>{tr("storage.hint.raw")}</Notice>
            </>
          ) : (
            <>
              <Field label={tr("field.mappingDeclaration")}><Input className="mono" value={declaration} onChange={(event) => setDeclaration(event.target.value)} /></Field>
              <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
                <Field label={tr("field.mappingKey")}><Input className="mono" value={mappingKey} onChange={(event) => setMappingKey(event.target.value)} placeholder="20666 or 0xaddress" /></Field>
                <Field label={tr("field.knownBaseSlot")}><Input className="mono" value={baseSlot} onChange={(event) => setBaseSlot(event.target.value)} placeholder={tr("common.optional")} /></Field>
                <Field label={tr("field.scanRange")}><Input className="mono" value={scanLimit} onChange={(event) => setScanLimit(event.target.value)} /></Field>
              </div>
              <Notice tone="warn">{tr("storage.hint.mapping")}</Notice>
            </>
          )}
          {busy && progress ? <Notice>{progress}</Notice> : null}
          <Button variant="primary" onClick={read} disabled={busy}>{busy ? tr("storage.action.reading") : tr("storage.action.read")}</Button>
        </div>
      </Panel>
      <Panel title={tr("panel.readout")}>{output}</Panel>
    </Workbench>
  );
}

type MappingMatch = { base: number; slot: string; raw: string };

const MAPPING_MATCH_LIMIT = 24;

function RpcProvenance({ session }: { session: RpcSession }) {
  const tr = useT();
  return (
    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      <Metric label={tr("row.chain")} value={session.chain.label} hint={tr("storage.blockVerified", { chainId: session.chain.chainId })} />
      <Metric label={tr("row.blockRead")} value={session.blockNumber !== null ? `#${session.blockNumber}` : session.blockTag} hint={`${session.sourceLabel} · ${session.host}`} />
    </div>
  );
}

function RawStorageOutput({ contract, session, slotIndex, slot, raw, decodeType }: { contract: string; session: RpcSession; slotIndex: string; slot: string; raw: string; decodeType: string }) {
  const tr = useT();
  return (
    <div className="grid gap-4">
      <RpcProvenance session={session} />
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Metric label={tr("row.rawSlot")} value={slotIndex || String(parseSlotIndex(slot))} />
        <Metric label={tr("row.rpcMethod")} value="eth_getStorageAt" />
      </div>
      <ResultRows rows={[
        [tr("row.contract"), contract],
        [tr("row.chain"), `${session.chain.label} (${session.chain.chainId})`],
        [tr("row.rpcSource"), `${session.sourceLabel} · ${session.host}`],
        [tr("row.blockRequested"), session.requestedBlockTag],
        [tr("row.blockRead"), session.blockNumber !== null ? `#${session.blockNumber} (${session.blockTag})` : session.blockTag],
        [tr("row.slotHex"), slot],
        [tr("row.rawBytes32"), raw],
        [tr("storage.decodeColumn", { type: decodeType }), decodeStorageValue(raw, decodeType)],
        [tr("row.uint256View"), BigInt(raw).toString()],
        [tr("row.addressView"), decodeStorageValue(raw, "address")],
      ]} />
    </div>
  );
}

function MappingReadOutput({ baseSlot, valueSlot, raw, valueType, session }: { baseSlot: string; valueSlot: string; raw: string; valueType: string; session: RpcSession }) {
  const tr = useT();
  return (
    <div className="grid gap-4">
      <RpcProvenance session={session} />
      <ResultRows rows={[
        [tr("row.chain"), `${session.chain.label} (${session.chain.chainId})`],
        ["Block read", session.blockNumber !== null ? `#${session.blockNumber}` : session.blockTag],
        [tr("row.baseSlot"), `#${parseSlotIndex(baseSlot).toString()}`],
        [tr("row.valueSlot"), valueSlot],
        [tr("row.rawBytes32"), raw],
        [tr("storage.decodeColumn", { type: valueType }), decodeStorageValue(raw, valueType)],
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
      <div className="grid gap-3">{matches.map((match) => <div key={match.base} className="rounded-tool border border-line bg-panel p-3"><div className="font-mono text-[13px] font-semibold text-text">Base slot #{match.base}</div><div className="mt-2 break-all font-mono text-xs text-muted">{match.slot}</div><div className="mt-2 break-all font-mono text-xs text-text">{match.raw}</div></div>)}</div>
      {failures ? <Notice tone="warn">{failures} storage reads failed; treat this scan as incomplete.</Notice> : null}
    </div>
  );
}

function SourceLayoutResolver() {
  const [mode, setMode] = useState("verified");
  const tr = useT();
  const [target, setTarget] = useState("");
  const [contract, setContract] = useState("");
  const [key, setKey] = useState("");
  const [source, setSource] = useState("");
  const result = useMemo(() => {
    if (!source.trim()) return <EmptyState title={tr("layout.empty.title")} hint={tr("layout.empty.hint")} />;
    try {
      const layout = parseSourceLayout(source, contract, mode === "decompiled" ? "decompiled source" : "verified source");
      if (!target.trim()) return <LayoutList layout={layout} />;
      const match = findStorageEntry(layout.entries, target);
      if (!match.entry) return <div className="grid gap-4"><Notice tone="warn">{tr("layout.noMatch")} <code>{target}</code>.</Notice><LayoutList layout={layout} /></div>;
      const entry = match.entry;
      // A nested mapping cannot be probed from a single key: the derived slot
      // addresses the inner mapping object, which is never materialised on
      // chain. Deriving it anyway would return a confident, wrong zero.
      const valueSlot =
        entry.kind === "mapping" && key && entry.slot !== null && !entry.nestedMapping
          ? mappingSlotByType(key, entry.keyType || "address", toSlotHex(entry.slot))
          : "";
      return <ResolvedStorage layout={layout} entry={entry} reason={match.reason} valueSlot={valueSlot} mappingKey={key} />;
    } catch (error) {
      return <Notice tone="danger">{(error as Error).message}</Notice>;
    }
  }, [source, contract, mode, target, key]);

  return (
    <Workbench>
      <Panel title={tr("layout.panel")}>
        <div className="grid gap-4">
          <Tabs value={mode} onChange={setMode} options={[{ value: "verified", label: tr("layout.tab.verified") }, { value: "decompiled", label: tr("layout.tab.decompiled") }]} />
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            <Field label={tr("field.targetName")}><Input className="mono" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="totalSupply, _totalSupply, owner" /></Field>
            <Field label={tr("field.contractName")}><Input className="mono" value={contract} onChange={(event) => setContract(event.target.value)} placeholder={tr("layout.placeholder.contractName")} /></Field>
            <Field label={tr("field.mappingKey")}><Input className="mono" value={key} onChange={(event) => setKey(event.target.value)} placeholder={tr("layout.placeholder.mappingKey")} /></Field>
          </div>
          <Field label={mode === "verified" ? tr("field.verifiedSource") : tr("field.decompiledSource")}>
            <Textarea className="mono min-h-[340px]" value={source} onChange={(event) => setSource(event.target.value)} placeholder={mode === "verified" ? tr("layout.placeholder.verified") : tr("layout.placeholder.decompiled")} />
          </Field>
          <Notice>{tr("layout.notice")}</Notice>
        </div>
      </Panel>
      <Panel title={tr("panel.readout")}>{result}</Panel>
    </Workbench>
  );
}

function ResolvedStorage({ layout, entry, reason, valueSlot, mappingKey }: { layout: ReturnType<typeof parseSourceLayout>; entry: ReturnType<typeof findStorageEntry>["entry"]; reason: string; valueSlot: string; mappingKey: string }) {
  const tr = useT();
  if (!entry) return null;
  const noSlot = entry.slot === null;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[1.15fr_.85fr] gap-3 max-sm:grid-cols-1">
        <Metric
          label={entry.kind === "mapping" && valueSlot ? tr("storage.mappingValueSlot") : noSlot ? tr("storage.resolvedSlot") : tr("storage.resolvedSlot")}
          value={entry.kind === "mapping" && valueSlot ? tr("storage.mappingValueReady") : noSlot ? tr("storage.notOnChain") : `#${entry.slot?.toString()}`}
          hint={entry.kind === "mapping" && valueSlot ? valueSlot : noSlot ? tr("storage.constantNote") : tr("storage.rawSlotPath", { slot: entry.slot?.toString() ?? "" })}
        />
        <Metric label={tr("storage.variable")} value={entry.name} hint={`${entry.type} | ${reason}`} />
      </div>
      <ResultRows rows={[
        [tr("row.source"), layout.sourceType],
        [tr("row.contract"), layout.contractName || tr("value.na")],
        [tr("row.target"), entry.name],
        [tr("row.type"), entry.type],
        [tr("row.slotNumber"), noSlot ? tr("storage.notOnChain") : `#${entry.slot?.toString()}`],
        [tr("row.slotHex"), noSlot ? tr("storage.notOnChain") : toSlotHex(entry.slot!)],
        [tr("row.byteOffset"), entry.offset === null ? tr("value.na") : String(entry.offset)],
        [tr("row.storageForm"), tr(entry.noteKey, entry.noteParams)],
        ...(entry.kind === "mapping" && !entry.nestedMapping
          ? [[tr("row.mappingKey"), mappingKey || tr("value.na")], [tr("row.valueSlot"), valueSlot || tr("storage.valueSlotPlaceholder")]] as Array<[string, string]>
          : []),
      ]} />
      {entry.nestedMapping ? <Notice tone="warn">{tr("storage.warn.nestedMapping")}</Notice> : null}
      {!entry.reliable ? <Notice tone="warn">{tr("storage.note.unreliable")}</Notice> : null}
    </div>
  );
}

function LayoutList({ layout }: { layout: ReturnType<typeof parseSourceLayout> }) {
  const tr = useT();
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Metric label={tr("row.source")} value={layout.sourceType} />
        <Metric label={tr("row.contract")} value={layout.contractName || tr("value.na")} hint={layout.selectionNote} />
      </div>
      <div className="grid gap-2">
        {layout.hasUnknownSpans ? (
          <Notice tone="warn">{tr("storage.warn.unreliable", { count: layout.entries.filter((entry) => !entry.reliable).length })}</Notice>
        ) : null}
        {layout.entries.length ? layout.entries.map((entry) => (
          <div key={`${entry.name}-${String(entry.slot)}-${entry.offset}`} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-tool border border-line bg-panel p-3 max-sm:grid-cols-1">
            <span className={cn("font-mono text-sm font-semibold", entry.reliable ? "text-text" : "text-warn")}>
              {entry.slot === null ? "N/A" : `#${entry.slot}`}
            </span>
            <code className="min-w-0 break-words text-sm text-text">
              {entry.name} : {entry.type}
              <br />
              <span className="text-faint">{tr(entry.noteKey, entry.noteParams)}</span>
            </code>
            {entry.slot !== null ? <CopyButton value={entry.slot.toString()} /> : null}
          </div>
        )) : <Notice tone="warn">{tr("layout.noDeclarations")}</Notice>}
      </div>
    </div>
  );
}

function UnitConverter() {
  const tr = useT();
  const lang = useLang();
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState("ether");
  const [to, setTo] = useState("wei");
  const [decimals, setDecimals] = useState("18");
  const result = useMemo(() => {
    try {
      const d = Number(decimals);
      const base = decimalToBase(amount, unitDecimals(from, d), lang);
      const converted = baseToDecimal(base, unitDecimals(to, d));
      return <ResultRows rows={[[tr("row.input"), `${amount} ${from}`], [tr("row.output"), `${converted} ${to}`], [tr("row.baseUnits"), base.toString()]]} />;
    } catch (error) {
      return <Notice tone="danger">{(error as Error).message}</Notice>;
    }
  }, [amount, from, to, decimals]);
  const unitOptions = ["wei", "gwei", "ether", tr("unit.token")].map((item) => ({ value: item, label: item }));
  return <Workbench><Panel title={tr("unit.panel")}><div className="grid gap-4"><Field label={tr("field.amount")}><Input className="mono" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1"><Field label={tr("field.fromUnit")}><Select value={from} onChange={setFrom} options={unitOptions} /></Field><Field label={tr("field.toUnit")}><Select value={to} onChange={setTo} options={unitOptions} /></Field><Field label={tr("field.tokenDecimals")}><Input className="mono" value={decimals} onChange={(e) => setDecimals(e.target.value)} /></Field></div></div></Panel><Panel title={tr("panel.readout")}>{result}</Panel></Workbench>;
}

function SelectorFinder() {
  const [input, setInput] = useState("transfer(address,uint256)");
  const tr = useT();
  const hash = input.trim() && !input.trim().startsWith("0x") ? keccak256Hex(input.trim()) : "";
  return <Workbench><Panel title={tr("selector.panel")}><Field label={tr("field.signature")}><Input className="mono" value={input} onChange={(e) => setInput(e.target.value)} /></Field></Panel><Panel title={tr("panel.readout")}><ResultRows rows={[[tr("row.signature"), input], [tr("row.functionSelector"), hash ? `0x${hash.slice(0, 8)}` : tr("value.na")], [tr("row.eventTopic"), hash ? `0x${hash}` : tr("value.na")]]} /></Panel></Workbench>;
}

function CalldataDecoder() {
  const [input, setInput] = useState("");
  const tr = useT();
  const clean = input.trim().replace(/^0x/, "");
  const selector = clean.length >= 8 ? `0x${clean.slice(0, 8)}` : tr("value.na");
  const words = clean.slice(8).match(/.{1,64}/g) || [];
  return <Workbench><Panel title={tr("panel.input")}><Textarea className="mono min-h-[280px]" value={input} onChange={(e) => setInput(e.target.value)} placeholder="0xa9059cbb..." /></Panel><Panel title={tr("panel.readout")}><ResultRows rows={[[tr("row.selector"), selector], [tr("row.argWords"), words.length]]} /><pre className="mt-4 max-h-[420px] overflow-auto rounded-tool border border-line bg-panel p-4 font-mono text-xs leading-6 text-muted">{words.map((word, i) => `${String(i).padStart(2, "0")}  0x${word.padEnd(64, " ")}`).join("\n") || tr("calldata.noWords")}</pre></Panel></Workbench>;
}

function JsonStudio() {
  const tr = useT();
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
  return <Workbench><Panel title={tr("json.panel")}><Textarea className="mono min-h-[360px]" value={input} onChange={(e) => setInput(e.target.value)} /></Panel><Panel title={tr("panel.output")}><div className="mb-3"><Select value={mode} onChange={setMode} options={[{ value: "format", label: tr("json.mode.format") }, { value: "minify", label: tr("json.mode.minify") }, { value: "ts", label: tr("json.mode.ts") }]} /></div><pre className="min-h-[320px] overflow-auto rounded-tool border border-line bg-panel p-4 font-mono text-sm leading-6 text-text">{output}</pre></Panel></Workbench>;
}

function TimestampPro() {
  const tr = useT();
  const lang = useLang();
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
    { value: "auto", label: tr("ts.unit.auto") },
    { value: "seconds", label: tr("ts.unit.seconds") },
    { value: "milliseconds", label: tr("ts.unit.milliseconds") },
    { value: "microseconds", label: tr("ts.unit.microseconds") },
    { value: "nanoseconds", label: tr("ts.unit.nanoseconds") },
  ];
  const currentValue = clockUnit === "seconds" ? String(Math.floor(now.getTime() / 1000)) : String(now.getTime());
  const safeZone = isValidTimeZone(zone) ? zone : "UTC";

  const single = useMemo(() => {
    try {
      const parsed = parseTimeInput(input, unit, safeZone, lang);
      return <TimestampReadout date={parsed.date} zone={safeZone} source={parsed.source} />;
    } catch (error) {
      return <Notice tone="danger">{(error as Error).message}</Notice>;
    }
  }, [input, unit, safeZone]);

  const batch = useMemo(() => batchConvert(batchInput, batchMode, batchUnit, safeZone, lang), [batchInput, batchMode, batchUnit, safeZone, lang]);

  return (
    <div className="grid gap-4">
      <Panel title={tr("ts.clockPanel")}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="rounded-tool border border-line bg-panel p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">{tr("ts.currentUnix")}</div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <span className="break-all font-mono text-4xl font-bold text-text max-sm:text-3xl">{currentValue}</span>
              <span className="rounded-full border border-line bg-panel px-2 py-1 font-mono text-xs font-semibold text-muted">{tr(clockUnit === "seconds" ? "ts.unit.shortSeconds" : "ts.unit.shortMillis")}</span>
            </div>
            <div className="mt-2 text-sm text-muted">{formatInZone(now, safeZone)} · {safeZone}</div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="default" onClick={() => setClockUnit((item) => (item === "seconds" ? "milliseconds" : "seconds"))}>{tr("ts.action.switchUnit")}</Button>
            <CopyButton value={currentValue} />
            <Button variant={paused ? "primary" : "default"} onClick={() => setPaused((item) => !item)}>{paused ? tr("ts.action.resume") : tr("ts.action.pause")}</Button>
          </div>
        </div>
      </Panel>

      <Tabs value={workspace} onChange={setWorkspace} options={[{ value: "single", label: tr("ts.tab.single") }, { value: "batch", label: tr("ts.tab.batch") }]} />

      {workspace === "single" ? (
        <Workbench>
          <Panel title={tr("panel.input")}>
            <div className="grid gap-4">
              <Field label={tr("field.timestampOrDate")}>
                <Input className="mono" value={input} onChange={(event) => setInput(event.target.value)} placeholder={tr("ts.placeholder")} />
              </Field>
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <Field label={tr("field.inputUnit")}><Select value={unit} onChange={setUnit} options={unitOptions} /></Field>
                <Field label={tr("field.timezone")}><Combobox value={safeZone} onChange={setZone} options={zoneOptions} maxItems={zoneOptions.length} placeholder={tr("ts.tzPlaceholder")} emptyText={tr("ts.noTimezone")} /></Field>
              </div>
              <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
                <Button className="whitespace-nowrap px-2" variant="default" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>{tr("ts.action.nowSeconds")}</Button>
                <Button className="whitespace-nowrap px-2" variant="default" onClick={() => setInput(String(Date.now()))}>{tr("ts.action.nowMillis")}</Button>
                <Button className="whitespace-nowrap px-2" variant="default" onClick={() => setInput(formatEditableDate(new Date(), safeZone))}>{tr("ts.action.nowDate")}</Button>
                <Button variant="ghost" onClick={() => setInput("")}>{tr("ts.action.clear")}</Button>
              </div>
              <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
                {[-86400, -3600, 3600, 86400].map((seconds) => {
                  const label = Math.abs(seconds) === 86400 ? `${seconds > 0 ? "+" : "-"}${t(lang, "ts.shift.day")}` : `${seconds > 0 ? "+" : ""}${seconds / 3600}${t(lang, "ts.shift.hour")}`;
                  return <Button key={seconds} className="whitespace-nowrap px-2" variant="ghost" onClick={() => setInput(shiftTimeInput(input, unit, safeZone, seconds, lang))}>{label}</Button>;
                })}
              </div>
            </div>
          </Panel>
          <Panel title={tr("panel.readout")}>{single}</Panel>
        </Workbench>
      ) : (
        <Workbench wide>
          <Panel title={tr("ts.batchPanel")}>
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
                <Field label={tr("field.batchMode")}><Select value={batchMode} onChange={setBatchMode} options={[{ value: "timestamps", label: tr("ts.batch.timestamps") }, { value: "dates", label: tr("ts.batch.dates") }]} /></Field>
                <Field label={tr("field.inputUnit")}><Select value={batchUnit} onChange={setBatchUnit} options={unitOptions} /></Field>
                <Field label={tr("field.timezone")}><Combobox value={safeZone} onChange={setZone} options={zoneOptions} maxItems={zoneOptions.length} placeholder={tr("ts.tzPlaceholder")} emptyText={tr("ts.noTimezone")} /></Field>
              </div>
              <Field label={tr("field.batchValues")}>
                <Textarea className="mono min-h-[220px]" value={batchInput} onChange={(event) => setBatchInput(event.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={batch.csv} />
                <Button variant="ghost" onClick={() => setBatchInput("")}>{tr("ts.action.clearBatch")}</Button>
              </div>
              <div className="max-h-[520px] overflow-auto rounded-tool border border-line bg-panel">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-[0.12em] text-faint">
                    <tr>{batch.headers.map((header) => <th key={header} className="border-b border-line px-3 py-3">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {batch.rows.length ? batch.rows.map((row, index) => (
                      <tr key={`${row.input}-${index}`} className="border-b border-line last:border-b-0">
                        {row.values.map((value, valueIndex) => <td key={valueIndex} className="px-3 py-3 font-mono text-xs text-text">{value}</td>)}
                      </tr>
                    )) : (
                      <tr><td className="px-3 py-4 text-muted" colSpan={batch.headers.length}>{tr("ts.batch.paste")}</td></tr>
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
  const tr = useT();
  const lang = useLang();
  const seconds = Math.floor(date.getTime() / 1000);
  const milliseconds = date.getTime();
  const iso = date.toISOString();
  const sqlUtc = iso.replace("T", " ").replace(/\.\d{3}Z$/, "");
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Metric label={tr("row.detectedInput")} value={source} />
        <Metric label={tr("row.relative")} value={relativeTime(date, lang)} />
      </div>
      <ResultRows rows={[
        [tr("row.unixSeconds"), seconds],
        [tr("row.unixMillis"), milliseconds],
        [tr("row.unixMicros"), `${milliseconds}000`],
        [tr("row.unixNanos"), `${milliseconds}000000`],
        [tr("row.isoUtc"), iso],
        [tr("row.sqlUtc"), sqlUtc],
        [`${zone}`, formatInZone(date, zone)],
        [tr("row.localTime"), formatInZone(date, Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")],
        [tr("row.dayOfYear"), dayOfYear(date, zone)],
        [tr("row.isoWeek"), isoWeek(date, zone)],
      ]} />
    </div>
  );
}

function BaseConverter() {
  const tr = useT();
  const lang = useLang();
  const [input, setInput] = useState("0x1a2b3c");
  const [fromBase, setFromBase] = useState("16");
  const [toBase, setToBase] = useState("10");
  const [uppercase, setUppercase] = useState(true);
  const [grouped, setGrouped] = useState(true);
  const baseOptions = [
    { value: "2", label: tr("base.base2") },
    { value: "8", label: tr("base.base8") },
    { value: "10", label: tr("base.base10") },
    { value: "16", label: tr("base.base16") },
    { value: "36", label: tr("base.base36") },
  ];
  const parsed = useMemo(() => {
    try {
      const base = Number(fromBase);
      const target = Number(toBase);
      const value = parseRadixInteger(input, base, lang);
      return { value, output: formatRadixInteger(value, target, uppercase), error: "" };
    } catch (error) {
      return { value: 0n, output: "", error: (error as Error).message };
    }
  }, [fromBase, input, toBase, uppercase]);
  const resultRows = parsed.error ? [] : [
    { label: tr("row.inputBase"), value: fromBase },
    { label: tr("row.outputBase"), value: toBase },
    { label: tr("row.converted"), value: parsed.output },
    { label: tr("row.decimal"), value: parsed.value.toString() },
    { label: tr("row.hexPrefixed"), value: `${parsed.value < 0n ? "-" : ""}0x${formatRadixInteger(absBigInt(parsed.value), 16, uppercase)}` },
    { label: tr("row.binaryPrefixed"), value: `${parsed.value < 0n ? "-" : ""}0b${formatGroupedRadix(absBigInt(parsed.value), 2, uppercase, grouped)}` },
    ...buildRadixRows(parsed.value, uppercase, grouped, tr),
  ];

  return (
    <Workbench wide>
      <Panel title={tr("base.panel")}>
        <div className="grid gap-5">
          <Field label={tr("field.integer")}>
            <Input className="mono" value={input} onChange={(event) => setInput(event.target.value)} placeholder={tr("base.placeholder")} />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-end gap-3 max-md:grid-cols-1">
            <Field label={tr("field.fromBase")}><Select value={fromBase} onChange={setFromBase} options={baseOptions} /></Field>
            <Button className="h-11 px-2" variant="ghost" onClick={() => { setFromBase(toBase); setToBase(fromBase); }}>{tr("base.action.swap")}</Button>
            <Field label={tr("field.toBase")}><Select value={toBase} onChange={setToBase} options={baseOptions} /></Field>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-end gap-3 max-md:grid-cols-1">
            <Field label={tr("field.customFrom")}><Input className="mono" value={fromBase} onChange={(event) => setFromBase(event.target.value)} /></Field>
            <div className="hidden max-md:hidden md:block" />
            <Field label={tr("field.customTo")}><Input className="mono" value={toBase} onChange={(event) => setToBase(event.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="min-w-28" variant="default" onClick={() => { setInput("0x1a2b3c"); setFromBase("16"); setToBase("10"); }}>{tr("base.action.hexToDec")}</Button>
            <Button className="min-w-28" variant="default" onClick={() => { setInput("255"); setFromBase("10"); setToBase("16"); }}>{tr("base.action.decToHex")}</Button>
            <Button className="min-w-28" variant="default" onClick={() => { setInput("11111111"); setFromBase("2"); setToBase("10"); }}>{tr("base.action.binToDec")}</Button>
            <Button className="min-w-24" variant="ghost" onClick={() => setInput("")}>{tr("ts.action.clear")}</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className="flex items-center justify-between gap-3 rounded-tool border border-line bg-panel p-3 text-sm font-semibold text-text">
              {tr("base.toggle.uppercase")}
              <input type="checkbox" checked={uppercase} onChange={(event) => setUppercase(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-tool border border-line bg-panel p-3 text-sm font-semibold text-text">
              {tr("base.toggle.grouped")}
              <input type="checkbox" checked={grouped} onChange={(event) => setGrouped(event.target.checked)} />
            </label>
          </div>
          <Notice>{tr("base.notice")}</Notice>
        </div>
      </Panel>
      <Panel title={tr("panel.readout")}>
        {parsed.error ? (
          <Notice tone="danger">{parsed.error}</Notice>
        ) : (
          <div className="grid gap-4">
            <Metric label={tr("base.outputMetric", { base: toBase })} value={<code className="block break-all text-xl">{parsed.output}</code>} hint={tr("base.outputHint", { value: input || "0", base: fromBase })} />
            <div className="overflow-hidden rounded-tool border border-line bg-panel">
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
  const tr = useT();
  const [right, setRight] = useState("");
  const rows = useMemo(() => lineDiff(left.split(/\r?\n/), right.split(/\r?\n/)), [left, right]);
  return <Workbench wide><Panel title={tr("diff.panel")}><div className="grid grid-cols-2 gap-4 max-md:grid-cols-1"><Field label={tr("field.original")}><Textarea className="mono min-h-[320px]" value={left} onChange={(e) => setLeft(e.target.value)} /></Field><Field label={tr("field.changed")}><Textarea className="mono min-h-[320px]" value={right} onChange={(e) => setRight(e.target.value)} /></Field></div><pre className="mt-4 max-h-[480px] overflow-auto rounded-tool border border-line bg-panel p-4 font-mono text-sm leading-6">{rows.map((row, i) => <div key={i} className={cn(row.type === "add" && "text-ok", row.type === "remove" && "text-danger", row.type === "same" && "text-muted")}>{row.type === "add" ? "+" : row.type === "remove" ? "-" : " "} {row.text}</div>)}</pre></Panel></Workbench>;
}

function MarketClock() {
  const tr = useT();
  const lang = useLang();
  const now = useTicker(1000);
  const dst = usDstInfo(now);
  return (
    <div className="grid gap-4">
      <Panel title={tr("market.clockPanel")}>
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
          <ClockTile city={tr("market.city.beijing")} en="Beijing" zone="Asia/Shanghai" badge="UTC+8" now={now} />
          <ClockTile city={tr("market.city.hongKong")} en="Hong Kong" zone="Asia/Hong_Kong" badge="UTC+8" now={now} />
          <ClockTile city={tr("market.city.newYork")} en="New York" zone="America/New_York" badge={`${dst.abbr} · ${dst.offset}`} now={now} tone={dst.inDst ? "dst" : "std"} />
        </div>
      </Panel>

      <Panel title={tr("market.sessionPanel")}>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SessionLegend />
            <span className="font-mono text-[11px] font-semibold text-faint">{tr("market.refreshedAt")} {formatInZone(now, "Asia/Shanghai").slice(11)} {t(lang, "market.beijing")}</span>
          </div>
          <UsDstBanner now={now} />
          <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
            {MARKETS.map((market) => <MarketCard key={market.id} market={market} now={now} />)}
          </div>
          <Notice tone="warn">{tr("market.notice")}</Notice>
        </div>
      </Panel>
    </div>
  );
}

function ClockTile({ city, en, zone, badge, now, tone }: { city: string; en: string; zone: string; badge: string; now: Date; tone?: "dst" | "std" }) {
  const tr = useT();
  const lang = useLang();
  const parts = zoneParts(now, zone);
  const daytime = parts.hour >= 6 && parts.hour < 18;
  return (
    <div className="relative overflow-hidden rounded-tool border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("grid h-9 w-9 place-items-center rounded-xl border", daytime ? "border-warn/40 bg-warn/10 text-warn" : "border-line bg-panel text-faint")}>
            {daytime ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </span>
          <div>
            <div className="text-sm font-bold text-text">{city}</div>
            {city !== en ? <div className="text-[11px] text-faint">{en}</div> : null}
          </div>
        </div>
        <span className={cn("rounded-full border px-2 py-1 text-[11px] font-bold", tone === "dst" ? "border-warn/45 bg-warn/10 text-warn" : tone === "std" ? "border-line bg-panel text-muted" : "border-line bg-surface text-muted")}>{badge}</span>
      </div>
      <div className="mt-4 font-mono text-3xl font-bold tabular-nums tracking-tight text-text max-sm:text-2xl">{formatInZone(now, zone).slice(11)}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span>{formatInZone(now, zone).slice(0, 10)}</span>
        <span className="text-faint">·</span>
        <span>{WEEKDAYS[lang][parts.weekday]}</span>
      </div>
      <div className="mt-1 text-[11px] text-faint">{zone}</div>
    </div>
  );
}

function MarketCard({ market, now }: { market: MarketDef; now: Date }) {
  const tr = useT();
  const lang = useLang();
  const state = useMemo(() => computeMarket(market, now, lang), [market, now, lang]);
  const toneClass = {
    open: "border-ok/45 bg-ok/10 text-ok",
    break: "border-warn/45 bg-warn/10 text-warn",
    pre: "border-line bg-panel text-muted",
    closed: "border-line bg-panel text-muted",
  }[state.tone];
  return (
    <div className="flex flex-col gap-4 rounded-tool border border-line bg-surface p-4">
      {/* The exchange mark used to sit here, but it only repeated the market
          name and squeezed both to two lines in a 250px card. The status pill
          now shares the row instead. */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-bold text-text">{market.name[lang]}</div>
          <div className="truncate text-[11px] text-faint">{market.exchange}</div>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold", toneClass)}>
          {state.tone === "open" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" /> : null}
          {state.statusLabel}
        </span>
      </header>

      <div className="rounded-ui border border-line bg-panel px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{state.countdownLabel}</div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-text">{state.countdownText}</div>
        <div className="mt-1 text-xs text-muted">{state.targetText}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label={tr("market.field.open")} value={state.openText} hint={market.id === "us" ? tr("market.beijingHint", { time: state.beijingOpen }) : tr("market.localSession")} />
        <MiniStat label={tr("market.field.close")} value={state.closeText} hint={market.id === "us" ? tr("market.beijingHint", { time: state.beijingClose }) : tr("market.localSession")} />
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-faint">
          <span>{tr("market.localNow", { time: state.nowTime, zone: market.zoneLabel[lang] })}</span>
          {state.isWeekend ? <span className="text-warn">{tr("market.weekend")}</span> : null}
        </div>
        <SessionBar segments={market.segments} minute={state.minute} />
      </div>

      <div className="mt-auto grid gap-2 border-t border-line pt-3 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 font-bold text-faint">{tr("market.row.session")}</span>
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
  const tr = useT();
  return (
    <div className="rounded-xl border border-line bg-panel/50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-text">{value}</div>
      {hint ? <div className="mt-0.5 truncate text-[10px] text-faint">{hint}</div> : null}
    </div>
  );
}

function SessionBar({ segments, minute }: { segments: MarketSegment[]; minute: number }) {
  const tr = useT();
  const kindClass: Record<MarketKind, string> = { pre: "bg-faint/60", regular: "bg-ok/75", after: "bg-warn/55" };
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
  const tr = useT();
  const items: Array<[string, string]> = [[tr("market.legend.open"), "bg-ok/75"], [tr("market.legend.pre"), "bg-faint/60"], [tr("market.legend.after"), "bg-warn/55"]];
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
  const tr = useT();
  const lang = useLang();
  const dst = usDstInfo(now);
  const date = formatInZone(dst.next, "America/New_York").slice(0, 10);
  const beijing = formatInZone(dst.next, "Asia/Shanghai").slice(0, 16);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-tool border px-4 py-3", dst.inDst ? "border-warn/40 bg-warn/10" : "border-line bg-panel")}>
      <span className="inline-flex items-center gap-2 text-sm font-bold text-text">
        <span className={cn("grid h-6 w-6 place-items-center rounded-lg border", dst.inDst ? "border-warn/45 bg-warn/10 text-warn" : "border-line bg-surface text-muted")}>
          {dst.inDst ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </span>
        {dst.inDst ? tr("market.dst.in") : tr("market.dst.out")}
      </span>
      <span className="rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[11px] font-bold text-muted">{dst.abbr} · {dst.offset}</span>
      <span className="min-w-0 flex-1 text-xs leading-5 text-muted max-sm:flex-none">
        {dst.inDst ? tr("market.dst.ends") : tr("market.dst.starts")}: {date} 02:00 {t(lang, "market.zoneEastern")} ({t(lang, "market.beijing")} {beijing}), {dst.inDst ? tr("market.dst.back") : tr("market.dst.forward")}
      </span>
    </div>
  );
}

function HashSuite() {
  const [input, setInput] = useState("hello linsea");
  const tr = useT();
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
  return <Workbench><Panel title={tr("hash.inputLabel")}><div className="grid gap-4"><Textarea className="mono min-h-[260px]" value={input} onChange={(e) => setInput(e.target.value)} /><Select value={mode} onChange={setMode} options={[{ value: "keccak", label: "Keccak256" }, { value: "sha256", label: "SHA-256" }, { value: "sha1", label: "SHA-1" }, { value: "base64e", label: "Base64 encode" }, { value: "base64d", label: "Base64 decode" }, { value: "urle", label: "URL encode" }, { value: "urld", label: "URL decode" }]} /></div></Panel><Panel title={tr("hash.outputLabel")}><pre className="min-h-[240px] whitespace-pre-wrap break-words rounded-tool border border-line bg-panel p-4 font-mono text-sm text-text">{output}</pre></Panel></Workbench>;
}

function JwtInspector() {
  const [token, setToken] = useState("");
  const tr = useT();
  const result = useMemo(() => {
    try {
      const [h, p] = token.split(".");
      if (!h || !p) return <EmptyState title={tr("jwt.empty.title")} hint={tr("jwt.empty.hint")} />;
      const header = JSON.parse(base64UrlDecode(h));
      const payload = JSON.parse(base64UrlDecode(p));
      return <div className="grid gap-4"><ResultRows rows={[[tr("row.algorithmShort"), header.alg || "unknown"], [tr("row.expiresAt"), payload.exp ? new Date(payload.exp * 1000).toISOString() : tr("value.na")], [tr("row.status"), payload.exp && payload.exp * 1000 < Date.now() ? tr("value.expired") : tr("value.active")]]} /><pre className="rounded-tool border border-line bg-panel p-4 font-mono text-sm">{JSON.stringify({ header, payload }, null, 2)}</pre></div>;
    } catch (error) {
      return <Notice tone="danger">{(error as Error).message}</Notice>;
    }
  }, [token]);
  return <Workbench><Panel title={tr("jwt.panel")}><Textarea className="mono min-h-[300px]" value={token} onChange={(e) => setToken(e.target.value)} placeholder="eyJhbGci..." /></Panel><Panel title={tr("panel.readout")}>{result}</Panel></Workbench>;
}

function ProxySlotFinder({ settings }: { settings: Settings }) {
  const [address, setAddress] = useState("");
  const tr = useT();
  const [output, setOutput] = useState<ReactNode>(<EmptyState title={tr("proxy.empty.title")} hint={tr("proxy.empty.hint")} />);
  const probe = async () => {
    try {
      if (settings.privacyMode) throw new Error(tr("proxy.err.privacy"));
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error(tr("proxy.err.address"));
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
            [tr("row.chain"), `${session.chain.label} (${session.chain.chainId})`],
            [tr("row.blockRead"), session.blockNumber !== null ? `#${session.blockNumber}` : session.blockTag],
            [tr("row.implementationSlot"), implementationSlot],
            [tr("row.implementation"), storageAddress(implementation) || tr("value.notSet")],
            [tr("row.admin"), storageAddress(admin) || tr("value.notSet")],
            [tr("row.beacon"), storageAddress(beacon) || tr("value.notSet")],
          ]} />
        </div>,
      );
    } catch (error) {
      setOutput(<Notice tone="danger">{(error as Error).message}</Notice>);
    }
  };
  return <Workbench><Panel title={tr("proxy.panel")}><div className="grid gap-4"><Field label={tr("field.proxyAddress")}><Input className="mono" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." /></Field><Notice>{tr("proxy.notice")}</Notice><Button variant="primary" onClick={probe}>{tr("proxy.action.probe")}</Button></div></Panel><Panel title={tr("panel.readout")}>{output}</Panel></Workbench>;
}

function EncryptionTool() {
  const [mode, setMode] = useState("encrypt");
  const tr = useT();
  const [data, setData] = useState(() => tr("enc.sample.data"));
  const [password, setPassword] = useState("linsea-demo");
  const [output, setOutput] = useState<ReactNode>(<EmptyState title={tr("enc.empty.title")} hint={tr("enc.empty.hint")} />);
  const run = async () => {
    try {
      if (!password) throw new Error(tr("enc.err.password"));
      if (mode === "decrypt") {
        const bundle = JSON.parse(data) as { v: number; alg: string; iv: string; salt: string; data: string };
        if (bundle.v !== 1 || bundle.alg !== "AES-GCM") throw new Error(tr("enc.err.bundle"));
        const key = await deriveAesKey(password, base64ToBytes(bundle.salt), ["decrypt"]);
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(bundle.iv) }, key, base64ToBytes(bundle.data));
        const text = new TextDecoder().decode(plain);
        setOutput(<ResultRows rows={[[tr("row.plaintext"), text], [tr("row.algorithm"), "AES-GCM / PBKDF2-SHA-256"]]} />);
        return;
      }
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveAesKey(password, salt, ["encrypt"]);
      const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(data));
      const bundle = JSON.stringify({ v: 1, alg: "AES-GCM", kdf: "PBKDF2-SHA-256", iterations: 100000, iv: bytesToBase64(iv), salt: bytesToBase64(salt), data: bytesToBase64(new Uint8Array(cipher)) }, null, 2);
      setOutput(<pre className="whitespace-pre-wrap break-words rounded-tool border border-line bg-panel p-4 font-mono text-sm text-text">{bundle}</pre>);
    } catch (error) {
      setOutput(<Notice tone="danger">{(error as Error).message}</Notice>);
    }
  };
  return <Workbench><Panel title={tr("enc.panel")}><div className="grid gap-4"><Field label={tr("field.mode")}><Select value={mode} onChange={setMode} options={[{ value: "encrypt", label: tr("enc.mode.encrypt") }, { value: "decrypt", label: tr("enc.mode.decrypt") }]} /></Field><Field label={tr("field.data")}><Textarea className="mono min-h-[260px]" value={data} onChange={(e) => setData(e.target.value)} /></Field><Field label={tr("field.password")}><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field><Button variant="primary" onClick={run}>{mode === "encrypt" ? tr("enc.action.encrypt") : tr("enc.action.decrypt")}</Button></div></Panel><Panel title={tr("panel.output")}>{output}</Panel></Workbench>;
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  const tr = useT();
  return <div className="rounded-tool border border-line bg-panel p-4"><div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{label}</div><div className="mt-2 break-words text-xl font-semibold text-text">{value}</div>{hint ? <div className="mt-2 break-words text-sm leading-6 text-muted">{hint}</div> : null}</div>;
}

function SettingsModal({ open, settings, onClose, onSave }: { open: boolean; settings: Settings; onClose: () => void; onSave: (settings: Settings) => void }) {
  const [draft, setDraft] = useState(settings);
  const tr = useT();
  const language = useLang();
  useEffect(() => setDraft(settings), [settings, open]);
  const isCustom = draft.defaultChain === CUSTOM_CHAIN_ID;
  const freeEndpoints = chainByIdOrDefault(draft.defaultChain)?.freeEndpoints ?? [];
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
    <Modal open={open} title={tr("settings.title")} description={tr("settings.description")} onClose={onClose}>
      <div className="grid gap-4">
        <Field label={tr("field.defaultChain")}><Select value={draft.defaultChain} onChange={(value) => setDraft({ ...draft, defaultChain: value })} options={chainSelectOptions()} /></Field>
        {isCustom ? (
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Field label={tr("field.customChainId")}><Input className="mono" value={draft.customChainId} onChange={(e) => setDraft({ ...draft, customChainId: e.target.value })} placeholder="6714" /></Field>
            <Field label={tr("field.customChainLabel")}><Input value={draft.customChainLabel} onChange={(e) => setDraft({ ...draft, customChainLabel: e.target.value })} placeholder={tr("common.optional")} /></Field>
          </div>
        ) : null}
        {freeEndpoints.length ? (
          <div className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{tr("settings.freeEndpoints")}</span>
            <div className="grid gap-1.5">
              {freeEndpoints.map((endpoint) => {
                const selected = draft.customRpcUrl.trim().replace(/\/+$/, "") === endpoint.url;
                return (
                  <button
                    key={endpoint.url}
                    type="button"
                    onClick={() => setDraft({ ...draft, customRpcUrl: endpoint.url })}
                    className={cn(
                      "grid gap-1 rounded-ui border p-2.5 text-left transition-colors",
                      selected ? "border-accent/50 bg-accent/10" : "border-line bg-surface hover:border-accent/40 hover:bg-panel",
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <strong className="text-[13px] font-semibold text-text">{endpoint.label}</strong>
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                          endpoint.archive ? "border-ok/40 bg-ok/10 text-ok" : "border-line text-faint",
                        )}
                      >
                        {endpoint.archive ? tr("settings.archiveYes") : tr("settings.archiveNo")}
                      </span>
                    </span>
                    <code className="break-all font-mono text-[11px] text-muted">{endpoint.url}</code>
                    <span className="text-[11px] leading-4 text-faint">{endpoint.note[language]}</span>
                  </button>
                );
              })}
            </div>
            {draft.customRpcUrl.trim() ? (
              <button type="button" onClick={() => setDraft({ ...draft, customRpcUrl: "" })} className="justify-self-start text-[11px] text-muted underline hover:text-text">
                {tr("settings.clearEndpoint")}
              </button>
            ) : null}
          </div>
        ) : null}
        <Field label={tr("field.rpcOverride")}>
          <Input className="mono" value={draft.customRpcUrl} onChange={(e) => setDraft({ ...draft, customRpcUrl: e.target.value })} placeholder={chainByIdOrDefault(draft.defaultChain)?.rpcUrl || "https://rpc.example.org"} />
        </Field>
        {preview ? (
          <Notice tone="ok">{tr("settings.rpcPreview")} <strong>{preview.sourceLabel}</strong> @ <code>{preview.host}</code> · {tr("settings.rpcPreviewTail")} <strong>{preview.chain.chainId}</strong>. {tr("settings.chainVerified")}</Notice>
        ) : validationError ? (
          <Notice tone="warn">{validationError}</Notice>
        ) : (
          <Notice tone="warn">{tr("settings.noRpc")}</Notice>
        )}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label={tr("field.alchemyKey")}><Input type="password" value={draft.alchemyKey} onChange={(e) => setDraft({ ...draft, alchemyKey: e.target.value })} placeholder={tr("settings.keyPlaceholder")} /></Field>
          <Field label={tr("field.infuraKey")}><Input type="password" value={draft.infuraKey} onChange={(e) => setDraft({ ...draft, infuraKey: e.target.value })} placeholder={tr("settings.keyPlaceholder")} /></Field>
        </div>
        <Notice>{tr("settings.priority")}</Notice>
        <label className="flex items-center justify-between gap-4 rounded-tool border border-line bg-panel p-4"><span><strong className="block text-sm text-text">{tr("settings.privacy.title")}</strong><small className="text-muted">{tr("settings.privacy.hint")}</small></span><input type="checkbox" checked={draft.privacyMode} onChange={(e) => setDraft({ ...draft, privacyMode: e.target.checked })} /></label>
        <Button variant="primary" onClick={() => { onSave(draft); onClose(); }} disabled={Boolean(validationError)}>{tr("action.save")}</Button>
      </div>
    </Modal>
  );
}

function CommandPalette({ open, query, setQuery, language, onClose, onSelect }: { open: boolean; query: string; setQuery: (value: string) => void; language: "en" | "zh"; onClose: () => void; onSelect: (id: ToolId) => void }) {
  const tr = useT();
  const matches = tools.filter((tool) => `${tool.name} ${tool.zh} ${tool.keywords.join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
  const isZh = language === "zh";
  return (
    <Modal open={open} title={tr("command.title")} description={tr("command.description")} onClose={onClose}>
      <div className="grid gap-3">
        <CommandInput autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("command.placeholder")} />
        {matches.length ? matches.map((tool) => (
          <button key={tool.id} type="button" onClick={() => onSelect(tool.id)} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-ui border border-transparent p-2.5 text-left transition-colors hover:bg-panel">
            <span className={cn("[&_svg]:h-[18px] [&_svg]:w-[18px]", familyTone[tool.category].text)}>{tool.icon}</span>
            <span>
              <strong className="block text-text">{isZh ? tool.zh : tool.name}</strong>
              <small className="text-muted">{tool.keywords.join(" / ")}</small>
            </span>
          </button>
        )) : <Notice>{tr("command.empty")}</Notice>}
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
/*
 * Keywords exist for search, so both scripts are indexed. Display, however,
 * should stay in one language: showing "json / format / 格式化" under a Chinese
 * tool name reads as an unfinished translation.
 */
function keywordsFor(tool: Tool, lang: Lang) {
  const cjk = /[\u4e00-\u9fff]/;
  const wanted = tool.keywords.filter((word) => (lang === "zh" ? cjk.test(word) : !cjk.test(word)));
  return (wanted.length ? wanted : tool.keywords).slice(0, 4);
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
function decimalToBase(value: string, decimals: number, lang: Lang) {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error(t(lang, "unit.err.invalid"));
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error(t(lang, "unit.err.decimals", { decimals }));
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
function parseRadixInteger(input: string, radix: number, lang: Lang) {
  const base = normalizeBase(radix, lang);
  const raw = input.trim().replace(/_/g, "");
  if (!raw) throw new Error(t(lang, "base.err.empty"));
  const negative = raw.startsWith("-");
  const unsigned = raw.replace(/^[+-]/, "");
  const body = unsigned.replace(/^0[xX]/, "").replace(/^0[bB]/, "").replace(/^0[oO]/, "");
  const expectedPrefix = base === 16 ? /^0[xX]/ : base === 2 ? /^0[bB]/ : base === 8 ? /^0[oO]/ : null;
  const hasKnownPrefix = /^0[xX]|^0[bB]|^0[oO]/.test(unsigned);
  if (hasKnownPrefix && expectedPrefix && !expectedPrefix.test(unsigned)) throw new Error(t(lang, "base.err.prefixMismatch", { base }));
  if (hasKnownPrefix && !expectedPrefix) throw new Error(t(lang, "base.err.prefixExtra"));
  if (!body) throw new Error(t(lang, "base.err.noDigits"));
  let value = 0n;
  for (const char of body.toLowerCase()) {
    const digit = digitValue(char);
    if (digit < 0 || digit >= base) throw new Error(t(lang, "base.err.digit", { char, base }));
    value = value * BigInt(base) + BigInt(digit);
  }
  return negative ? -value : value;
}
function normalizeBase(value: number, lang: Lang) {
  if (!Number.isInteger(value) || value < 2 || value > 36) throw new Error(t(lang, "base.err.radix"));
  return value;
}
function digitValue(char: string) {
  const code = char.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 97 && code <= 122) return code - 87;
  return -1;
}
function formatRadixInteger(value: bigint, radix: number, uppercase: boolean, lang: Lang = "en") {
  const base = normalizeBase(radix, lang);
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
function buildRadixRows(value: bigint, uppercase: boolean, grouped: boolean, tr: (key: StringKey) => string) {
  return [
    { label: tr("row.binary"), value: formatGroupedRadix(value, 2, uppercase, grouped) },
    { label: tr("row.octal"), value: formatRadixInteger(value, 8, uppercase) },
    { label: tr("row.decimal"), value: value.toString() },
    { label: tr("row.hex"), value: formatGroupedRadix(value, 16, uppercase, grouped) },
    { label: tr("row.base36"), value: formatRadixInteger(value, 36, uppercase) },
  ];
}
function absBigInt(value: bigint) {
  return value < 0n ? -value : value;
}
function parseTimeInput(value: string, unit: string, zone: string, lang: Lang): { date: Date; source: string } {
  const text = value.trim();
  if (!text) throw new Error(t(lang, "ts.err.empty"));
  if (/^-?\d+$/.test(text)) {
    const detected = unit === "auto" ? detectTimestampUnit(text) : unit;
    return { date: timestampNumberToDate(text, detected, lang), source: unitLabel(detected, lang) };
  }
  return { date: parseDateInZone(text, zone, lang), source: t(lang, "ts.source.dateString") };
}
function detectTimestampUnit(value: string) {
  const length = value.replace(/^-/, "").length;
  if (length <= 10) return "seconds";
  if (length <= 13) return "milliseconds";
  if (length <= 16) return "microseconds";
  return "nanoseconds";
}
function unitLabel(unit: string, lang: Lang) {
  const key = unit === "seconds" ? "ts.unit.seconds" : unit === "milliseconds" ? "ts.unit.milliseconds" : unit === "microseconds" ? "ts.unit.microseconds" : "ts.unit.nanoseconds";
  return t(lang, key);
}
function timestampNumberToDate(value: string, unit: string, lang: Lang) {
  const n = BigInt(value);
  let milliseconds: bigint;
  if (unit === "seconds") milliseconds = n * 1000n;
  else if (unit === "milliseconds") milliseconds = n;
  else if (unit === "microseconds") milliseconds = n / 1000n;
  else if (unit === "nanoseconds") milliseconds = n / 1000000n;
  else throw new Error(t(lang, "ts.err.unit"));
  const jsMilliseconds = Number(milliseconds);
  if (!Number.isSafeInteger(jsMilliseconds)) throw new Error(t(lang, "ts.err.range"));
  return ensureDate(new Date(jsMilliseconds), lang);
}
function parseDateInZone(value: string, zone: string, lang: Lang) {
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value.trim())) return ensureDate(new Date(value), lang);
  const normalized = value.trim().replace(/\//g, "-").replace("T", " ");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?)?$/);
  if (!match) return ensureDate(new Date(value), lang);
  const [, y, m, d, hh = "0", mm = "0", ss = "0", ms = "0"] = match;
  return zonedPartsToDate(Number(y), Number(m), Number(d), Number(hh), Number(mm), Number(ss), Number(ms.padEnd(3, "0")), zone);
}
function zonedPartsToDate(year: number, month: number, day: number, hour: number, minute: number, second: number, millisecond: number, zone: string, lang: Lang = "en") {
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const first = utc - timeZoneOffsetMs(new Date(utc), zone);
  const secondPass = utc - timeZoneOffsetMs(new Date(first), zone);
  return ensureDate(new Date(secondPass), lang);
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
function ensureDate(date: Date, lang: Lang) {
  if (Number.isNaN(date.getTime())) throw new Error(t(lang, "ts.err.invalidDate"));
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
function shiftTimeInput(value: string, unit: string, zone: string, seconds: number, lang: Lang) {
  try {
    const parsed = parseTimeInput(value, unit, zone, lang).date;
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
function relativeTime(date: Date, lang: Lang) {
  const delta = date.getTime() - Date.now();
  const abs = Math.abs(delta);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31536000000], ["month", 2592000000], ["day", 86400000], ["hour", 3600000], ["minute", 60000], ["second", 1000]];
  const [unit, size] = units.find(([, size]) => abs >= size) || ["second", 1000];
  return new Intl.RelativeTimeFormat(lang === "zh" ? "zh-CN" : "en", { numeric: "auto" }).format(Math.round(delta / size), unit);
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
function batchConvert(input: string, mode: string, unit: string, zone: string, lang: Lang) {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headers = mode === "timestamps"
    ? [t(lang, "row.input"), t(lang, "row.detectedInput"), "UTC ISO", zone, t(lang, "row.relative")]
    : [t(lang, "row.input"), t(lang, "row.unixSeconds"), t(lang, "row.unixMillis"), "UTC ISO", t(lang, "row.relative")];
  const rows = lines.map((line) => {
    try {
      const parsed = mode === "timestamps" ? parseTimeInput(line, unit, zone, lang) : { date: parseDateInZone(line, zone, lang), source: t(lang, "ts.source.dateString") };
      const ms = parsed.date.getTime();
      const values = mode === "timestamps"
        ? [line, parsed.source, parsed.date.toISOString(), formatInZone(parsed.date, zone), relativeTime(parsed.date, lang)]
        : [line, String(Math.floor(ms / 1000)), String(ms), parsed.date.toISOString(), relativeTime(parsed.date, lang)];
      return { input: line, values };
    } catch (error) {
      return { input: line, values: [line, t(lang, "common.errorPrefix", { message: (error as Error).message }), "", "", ""] };
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
type MarketDef = {
  id: "us" | "cn" | "hk";
  name: { en: string; zh: string };
  mark: string;
  exchange: string;
  zone: string;
  zoneLabel: { en: string; zh: string };
  segments: MarketSegment[];
  gapText?: string;
};
type ZoneParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const WEEKDAYS: Record<Lang, string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  zh: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
};

const MARKETS: MarketDef[] = [
  {
    id: "us",
    name: { en: "US stocks", zh: "美股" },
    mark: "US",
    exchange: "NYSE · NASDAQ",
    zone: "America/New_York",
    zoneLabel: { en: "US Eastern", zh: "美东" },
    segments: [
      { id: "pre", start: 240, end: 570, kind: "pre" },
      { id: "regular", start: 570, end: 960, kind: "regular" },
      { id: "after", start: 960, end: 1200, kind: "after" },
    ],
  },
  {
    id: "cn",
    name: { en: "A-shares", zh: "A 股" },
    mark: "CN",
    exchange: "SSE · SZSE",
    zone: "Asia/Shanghai",
    zoneLabel: { en: "Beijing", zh: "北京" },
    gapText: "11:30 – 13:00",
    segments: [
      { id: "morning", start: 570, end: 690, kind: "regular" },
      { id: "afternoon", start: 780, end: 900, kind: "regular" },
    ],
  },
  {
    id: "hk",
    name: { en: "HK stocks", zh: "港股" },
    mark: "HK",
    exchange: "HKEX",
    zone: "Asia/Hong_Kong",
    zoneLabel: { en: "Hong Kong", zh: "香港" },
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

function formatDuration(ms: number, lang: Lang) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const core = `${two(Math.floor((total % 86400) / 3600))}:${two(Math.floor((total % 3600) / 60))}:${two(total % 60)}`;
  return days > 0 ? `${days}${lang === "zh" ? "天" : "d"} ${core}` : core;
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

function computeMarket(market: MarketDef, now: Date, lang: Lang) {
  const tr = (key: StringKey) => t(lang, key);
  const parts = zoneParts(now, market.zone);
  const minute = parts.hour * 60 + parts.minute;
  const isWeekend = parts.weekday === 0 || parts.weekday === 6;
  const regulars = market.segments.filter((segment) => segment.kind === "regular");
  const extended = market.segments.filter((segment) => segment.kind !== "regular");
  const current = market.segments.find((segment) => minute >= segment.start && minute < segment.end);

  let phase: "open" | "pre" | "after" | "lunch" | "closed" = "closed";
  let statusLabel = tr("market.status.closed");
  let tone: "open" | "break" | "pre" | "closed" = "closed";
  if (isWeekend) {
    statusLabel = tr("market.status.weekend");
  } else if (current?.kind === "regular") {
    phase = "open";
    statusLabel = tr("market.status.open");
    tone = "open";
  } else if (current?.kind === "pre") {
    phase = "pre";
    statusLabel = tr("market.status.pre");
    tone = "pre";
  } else if (current?.kind === "after") {
    phase = "after";
    statusLabel = tr("market.status.after");
    tone = "pre";
  } else if (minute < market.segments[0].start) {
    phase = "pre";
    statusLabel = tr("market.status.beforeOpen");
    tone = "pre";
  } else if (minute >= market.segments[market.segments.length - 1].end) {
    phase = "after";
  } else {
    phase = "lunch";
    statusLabel = tr("market.status.lunch");
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
  const dayTag = sameDay ? "" : `${WEEKDAYS[lang][targetParts.weekday]} `;

  return {
    minute,
    isWeekend,
    statusLabel,
    tone,
    nowTime: hhmm(minute),
    countdownLabel: targetKind === "close" ? tr("market.countdownToClose") : tr("market.countdownToOpen"),
    countdownText: formatDuration(target.getTime() - now.getTime(), lang),
    targetText: t(lang, "market.targetText", {
      dayTag,
      time: targetLocal,
      action: targetKind === "close" ? tr("market.field.close") : tr("market.field.open"),
      beijing: targetBeijing,
    }),
    openText: hhmm(regulars[0].start),
    closeText: hhmm(regulars[regulars.length - 1].end),
    beijingOpen,
    beijingClose: crossesDay ? t(lang, "market.nextDaySuffix", { time: beijingClose }) : beijingClose,
    sessionText: regulars.map((segment) => `${hhmm(segment.start)} – ${hhmm(segment.end)}`).join(" · "),
    footerLabel: extended.length
      ? extended.every((segment) => segment.kind === "pre")
        ? tr("market.row.extendedPre")
        : extended.every((segment) => segment.kind === "after")
          ? tr("market.row.extendedAfter")
          : tr("market.row.extendedBoth")
      : tr("market.row.lunch"),
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
