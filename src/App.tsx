import {
  Boxes,
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
  Radio,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Terminal,
  ArrowRightLeft,
  TrendingUp,
} from "lucide-react";
import { ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button, Combobox, CommandInput, CopyButton, EmptyState, Field, IconButton, Input, Modal, Notice, Panel, ResultRows, Select, Tabs, Textarea, cn } from "./components/ui";
import { LanguageContext, useLang, useT, type Lang, type StringKey, t } from "./lib/i18n";
import {
  decodeParameters,
  decodeSingle,
  encodeCall,
  encodeParameters,
  formatAbiParameter,
  formatAbiType,
  isDynamic,
  looksLikeArchiveGap,
  parseAbiJson,
  parseAbiType,
  parseSignature,
  splitArgumentInput,
  staticByteSize,
  type AbiItem,
  type AbiParameter,
  type AbiSignature,
  type DecodedParameter,
} from "./lib/abi";
import { candidateTypeList, lookupSignature, type SignatureCandidate, type SignatureKind } from "./lib/signatures";
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
import { CURRENCIES, CURRENCY_BY_CODE, POPULAR_CODES, flagEmoji } from "./lib/currencies";
import { RATE_ATTRIBUTION, REFRESH_WINDOW_END, REFRESH_WINDOW_START, fetchDailyRates, fetchMastercardRates, fetchSourceRates, fetchUnionPayRates, fetchVisaRates, inRefreshWindow, todayKey, type RateCrossCheck } from "./lib/dailyRates";
import { type RateSortKey } from "./lib/rates";

type CategoryId = "reverse" | "crypto" | "developer" | "general" | "exchange";
type ToolId =
  | "storage-slot"
  | "source-layout"
  | "proxy-slot"
  | "eth-call"
  | "calldata-decoder"
  | "event-decoder"
  | "abi-codec"
  | "unit-converter"
  | "selector-finder"
  | "hash-suite"
  | "symmetric-encryption"
  | "jwt-inspector"
  | "json-studio"
  | "timestamp-pro"
  | "base-converter"
  | "text-compare"
  | "market-clock"
  | "exchange-rate";

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

const STATE_KEY = "timeminer-react-state";
const SETTINGS_KEY = "timeminer-tools-settings";
/** Pre-rename keys, read once so existing users keep their theme and language. */
const LEGACY_STATE_KEY = "linsea-react-state";
const LEGACY_SETTINGS_KEY = "linsea-tools-settings";

const categories: Array<{ id: CategoryId; name: string; zh: string }> = [
  { id: "reverse", name: "Reverse Security", zh: "逆向安全" },
  { id: "crypto", name: "Encoding & Crypto", zh: "编码与密码" },
  { id: "developer", name: "Developer", zh: "通用开发" },
  { id: "general", name: "General Tools", zh: "通用工具" },
  { id: "exchange", name: "Exchange Rate", zh: "汇率工具" },
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
  exchange: {
    stripe: "bg-family-general",
    text: "text-family-general",
    chip: "border-line bg-surface text-muted",
  },
};

const tools: Tool[] = [
  { id: "storage-slot", category: "reverse", name: "Storage Slot Inspector", zh: "存储槽检查器", description: { en: "Read raw slots and probe mapping keys with read-only RPC.", zh: "读取原始存储槽，并通过只读 RPC 探测 mapping 键。" }, keywords: ["slot", "storage", "mapping", "eth_getStorageAt", "存储槽", "槽位"], badges: { en: ["Raw read", "Mapping probe"], zh: ["原始读取", "mapping 探测"] }, icon: <Layers3 /> },
  { id: "source-layout", category: "reverse", name: "Source Layout Resolver", zh: "源码槽位解析器", description: { en: "Paste verified or decompiled Solidity source to resolve names into storage slots.", zh: "粘贴已验证或反编译的 Solidity 源码，将变量名解析为存储槽位。" }, keywords: ["source", "layout", "decompiled", "verified", "slot", "源码", "槽位"], badges: { en: ["Local first", "Layout aware"], zh: ["本地优先", "布局感知"] }, icon: <FileCode2 /> },
  { id: "proxy-slot", category: "reverse", name: "Proxy Slot Finder", zh: "代理槽探测器", description: { en: "Probe ERC-1967 implementation/admin/beacon slots.", zh: "探测 ERC-1967 的 implementation、admin 与 beacon 槽位。" }, keywords: ["proxy", "erc1967", "beacon", "implementation", "代理", "实现地址"], badges: { en: ["Read only", "RPC"], zh: ["只读", "RPC"] }, icon: <Route /> },
  { id: "eth-call", category: "reverse", name: "Read Contract (eth_call)", zh: "合约调用读取", description: { en: "Call any view function by signature and read the decoded result, with optional multi-block comparison.", zh: "按函数签名调用任意 view 函数并解码返回值，可选多区块对比。" }, keywords: ["eth_call", "call", "contract", "view", "abi", "getter", "调用", "读取", "合约", "合约调用"], badges: { en: ["eth_call", "Multi-block"], zh: ["eth_call", "多区块"] }, icon: <Terminal /> },
  { id: "calldata-decoder", category: "reverse", name: "Calldata Decoder", zh: "Calldata 解码器", description: { en: "Resolve the selector against public signature databases, then decode every argument into typed values.", zh: "用公开签名数据库反查 selector，再把每个参数解码为带类型的值。" }, keywords: ["calldata", "selector", "abi", "4byte", "signature", "解码", "签名"], badges: { en: ["Signature lookup", "Typed decode"], zh: ["签名反查", "类型解码"] }, icon: <Code2 /> },
  { id: "event-decoder", category: "reverse", name: "Event Log Decoder", zh: "事件日志解码器", description: { en: "Decode receipt logs: topic0 to signature, indexed topics, and the data payload.", zh: "解码 receipt 日志：topic0 反查签名、indexed topics 与 data 负载。" }, keywords: ["event", "log", "topic0", "receipt", "indexed", "事件", "日志"], badges: { en: ["topics", "indexed"], zh: ["topics", "indexed"] }, icon: <Radio /> },
  { id: "abi-codec", category: "reverse", name: "ABI Encoder / Decoder", zh: "ABI 编解码器", description: { en: "Encode calls and constructor arguments, or decode calldata and return data against a signature or full ABI.", zh: "编码调用与构造函数参数，或按签名 / 完整 ABI 解码 calldata 与返回数据。" }, keywords: ["abi", "encode", "decode", "calldata", "constructor", "tuple", "编码", "解码"], badges: { en: ["Full type system", "Local"], zh: ["完整类型系统", "本地"] }, icon: <Boxes /> },
  { id: "unit-converter", category: "reverse", name: "Unit Converter", zh: "单位转换器", description: { en: "Convert Wei, Gwei, Ether, and token decimals safely.", zh: "在 wei、gwei、ether 与代币精度之间安全换算。" }, keywords: ["wei", "gwei", "ether", "decimals", "单位", "精度"], badges: { en: ["BigInt", "Bidirectional"], zh: ["BigInt", "双向换算"] }, icon: <Calculator /> },
  { id: "selector-finder", category: "reverse", name: "4Byte / Selector Finder", zh: "4Byte / Selector 查询", description: { en: "Generate selectors and event topic0 locally.", zh: "本地生成函数 selector 与事件 topic0。" }, keywords: ["4byte", "selector", "topic0", "function", "函数", "事件"], badges: { en: ["Keccak", "Local"], zh: ["Keccak", "本地"] }, icon: <Fingerprint /> },
  { id: "hash-suite", category: "crypto", name: "Encoder / Hash Suite", zh: "编码与哈希套件", description: { en: "Hash, Base64, URL encode/decode, and Keccak utilities.", zh: "哈希、Base64、URL 编解码与 Keccak 工具。" }, keywords: ["hash", "sha256", "base64", "url", "哈希", "编码"], badges: { en: ["Crypto", "Local"], zh: ["哈希", "本地"] }, icon: <KeyRound /> },
  { id: "symmetric-encryption", category: "crypto", name: "Symmetric Encryption", zh: "对称加密", description: { en: "AES-GCM local encryption/decryption playground.", zh: "本地 AES-GCM 加解密试验台。" }, keywords: ["aes", "gcm", "encrypt", "decrypt", "加密", "解密"], badges: { en: ["Sensitive", "Local"], zh: ["敏感数据", "本地"] }, icon: <LockKeyhole /> },
  { id: "jwt-inspector", category: "crypto", name: "JWT Inspector", zh: "JWT 检查器", description: { en: "Decode JWT header and payload without sending it anywhere.", zh: "在本地解析 JWT 的 header 与 payload，不发送到任何地方。" }, keywords: ["jwt", "token", "exp", "payload", "令牌"], badges: { en: ["Local", "Auth"], zh: ["本地", "鉴权"] }, icon: <ShieldCheck /> },
  { id: "json-studio", category: "developer", name: "JSON Studio", zh: "JSON 工作台", description: { en: "Format, minify, validate, and infer TypeScript shapes.", zh: "格式化、压缩、校验 JSON，并推断 TypeScript 类型。" }, keywords: ["json", "format", "typescript", "格式化", "校验"], badges: { en: ["Formatter", "Local"], zh: ["格式化", "本地"] }, icon: <Braces /> },
  { id: "timestamp-pro", category: "developer", name: "Timestamp Pro", zh: "时间戳工具", description: { en: "Convert timestamps and dates across IANA timezones.", zh: "跨 IANA 时区转换时间戳与日期。" }, keywords: ["timestamp", "unix", "timezone", "时间戳", "时区"], badges: { en: ["IANA", "Date"], zh: ["IANA", "日期"] }, icon: <Clock3 /> },
  { id: "base-converter", category: "crypto", name: "Base Converter", zh: "进制转换器", description: { en: "Convert integers across binary, octal, decimal, hex, and custom bases.", zh: "在二进制、八进制、十进制、十六进制与自定义进制之间转换整数。" }, keywords: ["base", "radix", "binary", "hex", "decimal", "进制", "二进制", "十六进制"], badges: { en: ["BigInt", "2-36"], zh: ["BigInt", "2–36 进制"] }, icon: <Binary /> },
  { id: "text-compare", category: "developer", name: "Text Compare", zh: "文本对比", description: { en: "Compare two text versions with readable line-level diffs.", zh: "逐行比对两段文本，输出可读的差异。" }, keywords: ["diff", "text", "compare", "对比", "差异"], badges: { en: ["Diff", "Local"], zh: ["差异对比", "本地"] }, icon: <Contrast /> },
  { id: "exchange-rate", category: "exchange", name: "Exchange Rate Converter", zh: "汇率工具", description: { en: "USD-based rate table for all 154 ISO 4217 currencies, with UnionPay, Mastercard and Visa card rates alongside Google, Sina, XE, currency-api and ExchangeRate-API.", zh: "以美元为基准的 154 种法币汇率表，含银联、Mastercard、Visa 卡组织汇率，以及 Google、新浪、XE、currency-api、ExchangeRate-API 报价。" }, keywords: ["exchange", "rate", "currency", "forex", "fx", "convert", "usd", "cny", "eur", "jpy", "汇率", "汇率工具", "兑换", "货币", "换算", "美元", "人民币", "日元", "欧元", "银联", "visa", "mastercard", "万事达"], badges: { en: ["154 currencies", "Daily refresh"], zh: ["154 种法币", "每日更新"] }, icon: <TrendingUp /> },
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
    // Keep the document language in sync: it drives screen-reader pronunciation
    // and lets the error boundary render in the language the user chose.
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
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
          <BrandMark />
          <div>
            <div className="text-[15px] font-bold text-text">{tr("app.brand")}</div>
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
    case "eth-call": return <EthCallInspector settings={settings} />;
    case "calldata-decoder": return <CalldataDecoder settings={settings} />;
    case "event-decoder": return <EventLogDecoder settings={settings} />;
    case "abi-codec": return <AbiCodec />;
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
    case "exchange-rate": return <ExchangeRateTool settings={settings} />;
    default: return null;
  }
}

/**
 * The brand mark: a block whose face is a clock, hands knocked out with a mask.
 *
 * Same geometry as public/favicon.svg, kept in sync by hand because the favicon
 * has to stay a standalone file. Hand lengths are asymmetric so the mark reads
 * as a dial rather than the letter L; see the comment in the favicon for why
 * that matters at small sizes.
 *
 * The knocked-out hands reveal the shape painted underneath them, so that shape
 * is `fill-canvas` rather than the panel behind the SVG: a hand that matches the
 * surrounding card vanishes at 40px. Everything is a theme token, so the mark
 * needs no per-theme asset, and the mask id is unique per instance so React can
 * render it more than once.
 */
const BRAND_HEXAGON = "M32 11L50.19 21.5V42.5L32 53L13.81 42.5V21.5L32 11Z";

function BrandMark() {
  const maskId = `tm-hands-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-10 w-10 shrink-0">
      <defs>
        <mask id={maskId}>
          <rect width="64" height="64" fill="#fff" />
          <g stroke="#000" strokeWidth="4" strokeLinecap="round">
            <path d="M32 32V20.5" />
            <path d="M32 32H21" />
          </g>
          <circle cx="32" cy="32" r="2.9" fill="#000" />
        </mask>
      </defs>
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="15.25" className="fill-panel stroke-line" strokeWidth="1.5" />
      {/* Visible only through the hand cut-outs. */}
      <path d={BRAND_HEXAGON} className="fill-canvas" />
      <path d={BRAND_HEXAGON} className="fill-accent" mask={`url(#${maskId})`} />
    </svg>
  );
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
        const raw = requireHexWord(await rpcRequest(session.endpoint, "eth_getStorageAt", [contract, slot, session.blockTag]));
        setOutput(<RawStorageOutput contract={contract} session={session} slotIndex={slotIndex} slot={slot} raw={raw} decodeType={decodeType} />);
        return;
      }

      const layout = parseMappingDeclaration(declaration);
      if (!layout) throw new Error(tr("storage.err.declaration"));
      if (baseSlot) {
        const valueSlot = mappingSlotByType(mappingKey, layout.keyType, toSlotHex(baseSlot));
        const raw = requireHexWord(await rpcRequest(session.endpoint, "eth_getStorageAt", [contract, valueSlot, session.blockTag]));
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
  // Compute over the canonical form. Hashing the raw text makes any pasted
  // signature with spacing, parameter names, or `indexed` produce a selector
  // that exists nowhere on chain.
  const parsed = useMemo(() => {
    try {
      return { signature: parseSignature(input), error: "" };
    } catch (error) {
      return { signature: null, error: (error as Error).message };
    }
  }, [input]);
  const hash = parsed.signature ? keccak256Hex(parsed.signature.canonical) : "";
  return (
    <Workbench>
      <Panel title={tr("selector.panel")}>
        <div className="grid gap-4">
          <Field label={tr("field.signature")}>
            <Input className="mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="transfer(address,uint256)" />
          </Field>
          <Notice>{tr("selector.canonicalNote")}</Notice>
          {parsed.error ? <Notice tone="danger">{parsed.error}</Notice> : null}
        </div>
      </Panel>
      <Panel title={tr("panel.readout")}>
        <ResultRows
          rows={[
            [tr("row.signature"), parsed.signature?.canonical || tr("value.na")],
            [tr("row.functionSelector"), hash ? `0x${hash.slice(0, 8)}` : tr("value.na")],
            [tr("row.eventTopic"), hash ? `0x${hash}` : tr("value.na")],
          ]}
        />
      </Panel>
    </Workbench>
  );
}

/*
 * Shared selector/topic lookup control.
 *
 * The lookup is user-initiated on purpose: typing a hash must never leak an
 * address, a selector, or an in-progress investigation to a third party. The
 * candidate list shows every row the databases returned and never preselects
 * one, because a 4-byte selector legitimately collides across unrelated
 * functions.
 */
function SignaturePicker({
  hash,
  kind,
  settings,
  onPick,
  selected,
}: {
  hash: string;
  kind: SignatureKind;
  settings: Settings;
  onPick: (signature: AbiSignature, candidate: SignatureCandidate) => void;
  selected: string | null;
}) {
  const tr = useT();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ candidates: SignatureCandidate[]; sources: string[]; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      if (settings.privacyMode) throw new Error(tr("sig.privacy"));
      const found = await lookupSignature(hash, kind);
      setResult({ candidates: found.candidates, sources: found.sources, errors: found.errors });
    } catch (caught) {
      setResult(null);
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 rounded-tool border border-line bg-panel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{tr("sig.panel")}</span>
        <Button onClick={run} disabled={busy || !hash}>{busy ? tr("sig.lookingUp") : tr("sig.lookup")}</Button>
      </div>
      <Notice>{tr("sig.notice")}</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {result ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-faint">
            <span>{tr("sig.sources")}: {result.sources.join(", ")}</span>
            {result.errors.length ? <span className="text-warn">{tr("sig.partial", { errors: result.errors.join("; ") })}</span> : null}
          </div>
          {result.candidates.length === 0 ? <Notice>{tr("sig.empty")}</Notice> : null}
          {result.candidates.length === 1 ? <Notice>{tr("sig.single")}</Notice> : null}
          {result.candidates.length > 1 ? <Notice tone="warn">{tr("sig.ambiguous", { count: result.candidates.length })}</Notice> : null}
          {result.candidates.map((candidate, index) => {
            const active = selected !== null && candidate.canonical === selected;
            const usable = Boolean(candidate.signature);
            return (
              <div
                key={`${candidate.canonical}-${index}`}
                className={cn(
                  "grid gap-1.5 rounded-ui border p-2.5",
                  active ? "border-accent/50 bg-accent/10" : "border-line bg-surface",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <code className="min-w-0 break-all font-mono text-[12.5px] text-text">{candidate.canonical || candidate.text}</code>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <SignatureBadge tone={candidate.verified ? "ok" : "danger"}>
                      {candidate.verified ? tr("sig.verified") : tr("sig.unverified")}
                    </SignatureBadge>
                    {candidate.hasVerifiedContract ? <SignatureBadge tone="ok">{tr("sig.verifiedContract")}</SignatureBadge> : null}
                    {!usable ? <SignatureBadge tone="danger">{tr("sig.err.unparseable")}</SignatureBadge> : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-faint">
                    {candidate.source} · {candidateTypeList(candidate) || tr("common.none")}
                  </span>
                  {usable ? (
                    <Button
                      variant={active ? "ghost" : "default"}
                      onClick={() => onPick(candidate.signature!, candidate)}
                      disabled={active}
                    >
                      {active ? tr("sig.selected") : tr("sig.useThis")}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {result.candidates.length > 1 ? <Notice>{tr("sig.collisionWarning")}</Notice> : null}
        </div>
      ) : null}
    </div>
  );
}

function SignatureBadge({ children, tone }: { children: ReactNode; tone: "ok" | "danger" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
        tone === "ok" ? "border-ok/40 bg-ok/10 text-ok" : "border-danger/40 bg-danger/10 text-danger",
      )}
    >
      {children}
    </span>
  );
}

/** Renders decoded parameters, keeping the declared name and type visible. */
function DecodedList({ items }: { items: DecodedParameter[] }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-1">
      {items.map((item, index) => (
        <div key={index} className="grid gap-1 rounded-ui border border-line bg-panel px-3 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[11px] text-faint">
              [{index}] {formatAbiType(item.type)}{item.name ? ` ${item.name}` : ""}
            </span>
            <CopyButton value={item.value} />
          </div>
          <code className="break-all font-mono text-[13px] text-text">{item.value}</code>
        </div>
      ))}
    </div>
  );
}

function CalldataDecoder({ settings }: { settings: Settings }) {
  const tr = useT();
  const [input, setInput] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const clean = input.trim().replace(/^0x/, "");
  const selector = clean.length >= 8 ? clean.slice(0, 8).toLowerCase() : "";
  const body = clean.slice(8);

  // Manual signature input is a first-class path: an auditor often has the
  // source and does not want to tell anyone which selector they are looking at.
  const manual = useMemo(() => {
    if (!signatureText.trim()) return { signature: null, error: "" };
    try {
      return { signature: parseSignature(signatureText), error: "" };
    } catch (error) {
      return { signature: null, error: (error as Error).message };
    }
  }, [signatureText]);

  const decoded = useMemo(() => {
    if (!manual.signature || !selector) return null;
    try {
      return { items: decodeParameters(manual.signature.inputs, body), error: "" };
    } catch (error) {
      return { items: null, error: (error as Error).message };
    }
  }, [manual.signature, selector, body]);

  const words = body.match(/.{1,64}/g) || [];

  return (
    <Workbench>
      <Panel title={tr("calldata.panel")}>
        <div className="grid gap-4">
          <Field label={tr("calldata.panel")}>
            <Textarea className="mono min-h-[140px]" value={input} onChange={(e) => setInput(e.target.value)} placeholder={tr("calldata.placeholder")} />
          </Field>
          <Field label={tr("field.signature")}>
            <Input
              className="mono"
              value={signatureText}
              onChange={(e) => {
                setSignatureText(e.target.value);
                setPicked(null);
              }}
              placeholder="transfer(address,uint256)"
            />
          </Field>
          <Notice>{tr("sig.lookupHint")}</Notice>
          {manual.error ? <Notice tone="danger">{manual.error}</Notice> : null}
          {selector ? (
            <SignaturePicker
              hash={selector}
              kind="function"
              settings={settings}
              selected={picked}
              onPick={(signature, candidate) => {
                setSignatureText(signature.canonical);
                setPicked(candidate.canonical);
              }}
            />
          ) : null}
        </div>
      </Panel>
      <Panel title={tr("panel.readout")}>
        <div className="grid gap-4">
          <ResultRows
            rows={[
              [tr("row.selector"), selector ? `0x${selector}` : tr("value.na")],
              [tr("row.argWords"), words.length],
              [tr("row.signature"), manual.signature?.canonical || tr("common.none")],
            ]}
          />
          {decoded?.error ? <Notice tone="danger">{decoded.error}</Notice> : null}
          {decoded?.items ? <DecodedList items={decoded.items} /> : null}
          <div className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{tr("sig.rawWords")}</span>
            <pre className="max-h-[320px] overflow-auto rounded-tool border border-line bg-panel p-4 font-mono text-xs leading-6 text-muted">
              {words.map((word, i) => `${String(i).padStart(2, "0")}  0x${word.padEnd(64, " ")}`).join("\n") || tr("calldata.noWords")}
            </pre>
          </div>
        </div>
      </Panel>
    </Workbench>
  );
}

/**
 * Event log decoding. The one hard rule here: an indexed parameter with a
 * dynamic type is stored as keccak256(value), so the original value is gone.
 * Saying so explicitly is the difference between a tool and a trap.
 */
function EventLogDecoder({ settings }: { settings: Settings }) {
  const tr = useT();
  const [topicsText, setTopicsText] = useState("");
  const [dataText, setDataText] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const topics = useMemo(
    () =>
      topicsText
        .split(/[\s,]+/)
        .map((item) => item.trim().replace(/^0x/i, "").toLowerCase())
        .filter(Boolean),
    [topicsText],
  );
  const topic0 = topics.find((topic) => /^[0-9a-f]{64}$/.test(topic)) ?? "";

  const signature = useMemo(() => {
    if (!signatureText.trim()) return { value: null, error: "" };
    try {
      return { value: parseSignature(signatureText, "event"), error: "" };
    } catch (error) {
      return { value: null, error: (error as Error).message };
    }
  }, [signatureText]);

  const decoded = useMemo(() => {
    if (!signature.value) return null;
    try {
      const indexed = signature.value.inputs.filter((parameter) => parameter.indexed);
      const plain = signature.value.inputs.filter((parameter) => !parameter.indexed);
      const topicWords = topics.filter((topic) => /^[0-9a-f]{64}$/.test(topic));
      const expectedTopics = indexed.length + 1;
      if (topicWords.length < 1) throw new Error(tr("event.err.topics"));
      if (topicWords.length !== expectedTopics) {
        throw new Error(tr("event.err.count", { expected: expectedTopics, actual: topicWords.length }));
      }

      const rows: Array<{ label: string; type: string; value: string; note?: string }> = [];
      for (const [index, parameter] of indexed.entries()) {
        const topic = topicWords[index + 1];
        if (isDynamic(parameter.type)) {
          // The topic is the hash of the value, not the value itself.
          rows.push({
            label: formatAbiParameter(parameter),
            type: formatAbiType(parameter.type),
            value: `0x${topic}`,
            note: tr("event.dynamicIndexedWarning"),
          });
        } else {
          rows.push({
            label: formatAbiParameter(parameter),
            type: formatAbiType(parameter.type),
            value: decodeSingle(parameter.type, `0x${topic}`),
            note: tr("event.fromTopic", { index: index + 1 }),
          });
        }
      }
      if (plain.length) {
        const values = decodeParameters(plain, dataText.trim() || "0x");
        for (const value of values) {
          rows.push({
            label: value.name ? `${formatAbiType(value.type)} ${value.name}` : formatAbiType(value.type),
            type: formatAbiType(value.type),
            value: value.value,
            note: tr("event.fromData"),
          });
        }
      }
      return { rows, error: "" };
    } catch (error) {
      return { rows: null, error: (error as Error).message };
    }
  }, [signature.value, topics, dataText, tr]);

  return (
    <Workbench>
      <Panel title={tr("event.panel")}>
        <div className="grid gap-4">
          <Field label={tr("field.topics")}>
            <Textarea className="mono min-h-[120px]" value={topicsText} onChange={(e) => setTopicsText(e.target.value)} placeholder={`0xddf252ad...\n0x000000...`} />
          </Field>
          <Field label={tr("field.logData")}>
            <Textarea className="mono min-h-[90px]" value={dataText} onChange={(e) => setDataText(e.target.value)} placeholder="0x..." />
          </Field>
          <Field label={tr("field.signature")}>
            <Input
              className="mono"
              value={signatureText}
              onChange={(e) => {
                setSignatureText(e.target.value);
                setPicked(null);
              }}
              placeholder="Transfer(address indexed from, address indexed to, uint256 value)"
            />
          </Field>
          <Notice>{tr("event.notice")}</Notice>
          {signature.error ? <Notice tone="danger">{signature.error}</Notice> : null}
          {topic0 ? (
            <SignaturePicker
              hash={topic0}
              kind="event"
              settings={settings}
              selected={picked}
              onPick={(pickedSignature, candidate) => {
                // Re-derive `indexed` from the number of valid topics supplied,
                // since the database only gives us the canonical type list.
                const validTopics = topics.filter((topic) => /^[0-9a-f]{64}$/.test(topic)).length;
                const indexedCount = Math.max(validTopics - 1, 0);
                const inputs = pickedSignature.inputs.map((parameter, index) => ({
                  ...parameter,
                  ...(index < indexedCount ? { indexed: true } : {}),
                }));
                setSignatureText(
                  `${pickedSignature.name}(${inputs
                    .map((parameter) => `${formatAbiType(parameter.type)}${parameter.indexed ? " indexed" : ""}`)
                    .join(", ")})`,
                );
                setPicked(candidate.canonical);
              }}
            />
          ) : null}
        </div>
      </Panel>
      <Panel title={tr("panel.readout")}>
        <div className="grid gap-4">
          <ResultRows
            rows={[
              [tr("row.eventTopic"), topic0 ? `0x${topic0}` : tr("value.na")],
              [tr("event.topicCount"), Math.max(topics.filter((topic) => /^[0-9a-f]{64}$/.test(topic)).length - 1, 0)],
              [tr("event.dataWords"), (dataText.trim().replace(/^0x/i, "").match(/.{1,64}/g) || []).length],
            ]}
          />
          {decoded?.error ? <Notice tone="danger">{decoded.error}</Notice> : null}
          {decoded?.rows?.length ? (
            <div className="grid gap-1">
              {decoded.rows.map((row, index) => (
                <div key={index} className="grid gap-1 rounded-ui border border-line bg-panel px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] text-faint">{row.label}</span>
                    {row.note ? <span className="text-[10px] text-faint">{row.note}</span> : null}
                  </div>
                  <code className="break-all font-mono text-[13px] text-text">{row.value}</code>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Panel>
    </Workbench>
  );
}

/**
 * ABI encoder/decoder. Signature mode is enough for plain calls; ABI mode keeps
 * struct field names and lets the tool decode by selector without a signature.
 */
function AbiCodec() {
  const tr = useT();
  const [mode, setMode] = useState("encode");
  const [signatureText, setSignatureText] = useState("transfer(address,uint256)");
  const [argsText, setArgsText] = useState("");
  const [calldataText, setCalldataText] = useState("");
  const [abiText, setAbiText] = useState("");
  const [abiFn, setAbiFn] = useState("");
  const [output, setOutput] = useState<ReactNode>(<EmptyState title={tr("abiPanel.empty.title")} hint={tr("abiPanel.empty.hint")} />);

  const abiItems = useMemo(() => {
    if (!abiText.trim()) return { items: [] as AbiItem[], error: "" };
    try {
      return { items: parseAbiJson(abiText), error: "" };
    } catch (error) {
      return { items: [] as AbiItem[], error: (error as Error).message };
    }
  }, [abiText]);

  const abiFunctions = useMemo(
    () => abiItems.items.filter((item): item is Extract<AbiItem, { kind: "function" }> => item.kind === "function"),
    [abiItems.items],
  );
  const active = abiFunctions.find((item) => item.signature.canonical === abiFn) ?? abiFunctions[0];

  const run = () => {
    try {
      if (mode === "encode" || mode === "constructor") {
        const signature = parseSignature(signatureText);
        const args = splitArgumentInput(argsText, signature.inputs.map((parameter) => parameter.type));
        if (mode === "constructor") {
          setOutput(
            <div className="grid gap-3">
              <Notice>{tr("abiPanel.constructorNote")}</Notice>
              <ResultRows rows={[[tr("abiPanel.constructorData"), `0x${encodeParameters(signature.inputs, args)}`]]} />
            </div>,
          );
          return;
        }
        const encoded = encodeCall(signature, args, keccak256Hex(signature.canonical).slice(0, 8));
        setOutput(
          <div className="grid gap-3">
            <ResultRows
              rows={[
                [tr("abiPanel.selector"), encoded.selector],
                [tr("abiPanel.calldata"), encoded.calldata],
              ]}
            />
          </div>,
        );
        return;
      }

      if (mode === "decode") {
        const signature = parseSignature(signatureText);
        const body = calldataText.trim().replace(/^0x/i, "");
        if (body.length < 8) throw new Error(tr("abiPanel.err.pickFunction"));
        const providedSelector = body.slice(0, 8).toLowerCase();
        const expectedSelector = keccak256Hex(signature.canonical).slice(0, 8);
        if (providedSelector !== expectedSelector) {
          throw new Error(
            tr("abiPanel.err.selectorMismatch", {
              provided: providedSelector,
              signature: signature.canonical,
              expected: expectedSelector,
            }),
          );
        }
        setOutput(<DecodedList items={decodeParameters(signature.inputs, body.slice(8))} />);
        return;
      }

      // ABI mode: decode by the selector embedded in the calldata.
      if (!active) throw new Error(tr("abiPanel.err.abiJson"));
      const body = calldataText.trim().replace(/^0x/i, "");
      if (body.length < 8) throw new Error(tr("abiPanel.err.pickFunction"));
      const providedSelector = body.slice(0, 8).toLowerCase();
      const match = abiFunctions.find(
        (item) => keccak256Hex(item.signature.canonical).slice(0, 8) === providedSelector,
      );
      if (!match) throw new Error(tr("abiPanel.noMatch", { selector: providedSelector }));
      setOutput(
        <div className="grid gap-3">
          <Notice tone="ok">
            {tr("abiPanel.matchedFunction")}: <code className="font-mono">{match.signature.canonical}</code>
          </Notice>
          <DecodedList items={decodeParameters(match.inputs, body.slice(8))} />
        </div>,
      );
    } catch (error) {
      setOutput(<Notice tone="danger">{(error as Error).message}</Notice>);
    }
  };

  const modeOptions = [
    { value: "encode", label: tr("abiPanel.mode.encode") },
    { value: "decode", label: tr("abiPanel.mode.decode") },
    { value: "constructor", label: tr("abiPanel.mode.constructor") },
    { value: "abi", label: tr("abiPanel.mode.abi") },
  ];

  return (
    <Workbench>
      <Panel title={tr("abiPanel.title")}>
        <div className="grid gap-4">
          <Select value={mode} onChange={setMode} options={modeOptions} />
          {mode === "abi" ? (
            <>
              <Field label={tr("field.abiJson")}>
                <Textarea className="mono min-h-[200px]" value={abiText} onChange={(e) => setAbiText(e.target.value)} placeholder='[{"type":"function","name":"..."}]' />
              </Field>
              {abiItems.error ? <Notice tone="danger">{abiItems.error}</Notice> : null}
              <Field label={tr("field.calldataInput")}>
                <Textarea className="mono min-h-[90px]" value={calldataText} onChange={(e) => setCalldataText(e.target.value)} placeholder="0x..." />
              </Field>
              <Notice>{tr("abiPanel.abiNotice")}</Notice>
            </>
          ) : (
            <>
              <Field label={tr("field.signature")}>
                <Input className="mono" value={signatureText} onChange={(e) => setSignatureText(e.target.value)} placeholder="transfer(address,uint256)" />
              </Field>
              {mode === "decode" ? (
                <Field label={tr("field.calldataInput")}>
                  <Textarea className="mono min-h-[110px]" value={calldataText} onChange={(e) => setCalldataText(e.target.value)} placeholder="0xa9059cbb..." />
                </Field>
              ) : (
                <>
                  <Field label={tr("abiPanel.argsTitle")}>
                    <Textarea className="mono min-h-[110px]" value={argsText} onChange={(e) => setArgsText(e.target.value)} placeholder={tr("call.argsPlaceholder")} />
                  </Field>
                  <span className="text-[11px] leading-5 text-faint">{tr("abiPanel.argsHint")}</span>
                </>
              )}
              <Notice>{tr("abiPanel.notice")}</Notice>
            </>
          )}
          <Button variant="primary" onClick={run}>
            {mode === "decode" || mode === "abi" ? tr("abiPanel.action.decode") : tr("abiPanel.action.encode")}
          </Button>
        </div>
      </Panel>
      <Panel title={tr("panel.readout")}>{output}</Panel>
    </Workbench>
  );
}

function JsonStudio() {
  const tr = useT();
  const [input, setInput] = useState('{"name":"Timeminer","tools":17,"privacy":true}');
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
    // The decimal row comes from buildRadixRows below; listing it here as well
    // produced two rows with the same label, which React dedupes by key.
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
  const [input, setInput] = useState("hello timeminer");
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

function EthCallInspector({ settings }: { settings: Settings }) {
  const tr = useT();
  const lang = useLang();
  const [contract, setContract] = useState("");
  const [signatureText, setSignatureText] = useState("reflectionFromToken(uint256,bool)");
  const [argsText, setArgsText] = useState("1, false");
  const [blocksText, setBlocksText] = useState("");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<ReactNode>(
    <EmptyState title={tr("call.empty.title")} hint={tr("call.empty.hint")} />,
  );

  // Everything derived from the signature is computed here, so the selector and
  // the preview update while typing instead of only on submit.
  const parsed = useMemo(() => {
    try {
      const signature = parseSignature(signatureText);
      const selector = keccak256Hex(signature.canonical).slice(0, 8);
      // Argument boundaries come from the declared types. Splitting on commas
      // would cut a string argument in half at its first comma.
      const args = splitArgumentInput(argsText, signature.inputs.map((parameter) => parameter.type));
      const call = encodeCall(signature, args, selector);
      return { signature, selector, args, call, error: "" };
    } catch (error) {
      return { signature: null, selector: "", args: [], call: null, error: (error as Error).message };
    }
  }, [signatureText, argsText]);

  const blocks = useMemo(() => {
    const list = blocksText
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    return list.length ? list : ["latest"];
  }, [blocksText]);

  const run = async () => {
    setBusy(true);
    try {
      if (settings.privacyMode) throw new Error(tr("storage.err.privacy"));
      if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) throw new Error(tr("storage.err.address"));
      if (!parsed.signature || !parsed.call) throw new Error(parsed.error || tr("call.err.signature"));

      const readings: Array<{ block: string; raw: string; values: string[] }> = [];
      for (const blockTag of blocks) {
        const session = await openRpcSession(settings, blockTag);
        let raw: string;
        try {
          raw = await rpcRequest(session.endpoint, "eth_call", [{ to: contract, data: parsed.call.calldata }, session.blockTag]);
        } catch (error) {
          const message = (error as Error).message;
          // Public nodes answer historical blocks with a handful of specific
          // messages; say what they mean instead of echoing the node text.
          if (looksLikeArchiveGap(message)) {
            throw new Error(tr("call.err.archive", { block: session.blockNumber !== null ? `#${session.blockNumber}` : blockTag, message }));
          }
          throw error;
        }
        const values = parsed.signature.outputs.length
          ? decodeParameters(parsed.signature.outputs, raw).map((parameter) => parameter.value)
          : [];
        readings.push({ block: session.blockNumber !== null ? `#${session.blockNumber}` : session.blockTag, raw, values });
      }

      setOutput(
        <div className="grid gap-4">
          <ResultRows rows={[
            [tr("row.contract"), contract],
            [tr("row.signature"), parsed.signature.canonical],
            [tr("row.selector"), `0x${parsed.selector}`],
            [tr("row.arguments"), parsed.args.length ? parsed.args.join(", ") : tr("common.none")],
            [tr("row.returnTypes"), parsed.signature.outputs.length ? parsed.signature.outputs.map((parameter) => formatAbiType(parameter.type)).join(", ") : tr("common.none")],
          ]} />
          {readings.map((reading) => (
            <div key={reading.block} className="grid gap-2 rounded-tool border border-line bg-panel p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-[13px] font-semibold text-text">{reading.block}</span>
                <span className="text-[11px] text-faint">{tr("call.decodedCount", { count: reading.values.length })}</span>
              </div>
              {reading.values.length ? (
                <div className="grid gap-1">
                  {reading.values.map((value, index) => (
                    <div key={index} className="grid grid-cols-[minmax(0,90px)_minmax(0,1fr)_auto] items-center gap-2 max-sm:grid-cols-1">
                      <span className="font-mono text-[11px] text-faint">[{index}]</span>
                      <code className="break-all font-mono text-[13px] text-text">{value}</code>
                      <CopyButton value={value} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Notice>{tr("call.noOutput")}</Notice>
                  {/* Without declared return types there is nothing to decode,
                      but the caller still needs the number. Surface it as both
                      hex and decimal rather than burying it in raw data.
                      `BigInt("0x")` throws, so an empty return is handled
                      explicitly instead of crashing the render. */}
                  <div className="grid gap-1 rounded-ui border border-line bg-surface px-3 py-2">
                    <span className="text-[11px] text-faint">{tr("call.asUint")}</span>
                    <code className="break-all font-mono text-[13px] text-text">{asDecimal(reading.raw)}</code>
                    <code className="break-all font-mono text-[11px] text-muted">{reading.raw}</code>
                  </div>
                </div>
              )}
              <details className="text-[11px] text-faint">
                <summary className="cursor-pointer">{tr("call.rawData")}</summary>
                <code className="mt-1 block break-all font-mono">{reading.raw}</code>
              </details>
            </div>
          ))}
          {readings.length > 1 ? (
            <Notice tone={readings.every((r) => r.raw === readings[0].raw) ? "default" : "warn"}>
              {readings.every((r) => r.raw === readings[0].raw)
                ? tr("call.sameAcrossBlocks")
                : tr("call.differsAcrossBlocks")}
            </Notice>
          ) : null}
        </div>,
      );
    } catch (error) {
      setOutput(<Notice tone="danger">{(error as Error).message}</Notice>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Workbench>
      <Panel title={tr("call.panel")}>
        <div className="grid gap-4">
          <Field label={tr("field.contractAddress")}>
            <Input className="mono" value={contract} onChange={(event) => setContract(event.target.value)} placeholder="0x..." />
          </Field>
          <Field label={tr("field.signature")}>
            <Input className="mono" value={signatureText} onChange={(event) => setSignatureText(event.target.value)} placeholder="balanceOf(address) returns (uint256)" />
          </Field>
          <Field label={tr("field.arguments")}>
            <Textarea className="mono min-h-[90px]" value={argsText} onChange={(event) => setArgsText(event.target.value)} placeholder={tr("call.argsPlaceholder")} />
          </Field>
          <Field label={tr("field.blocks")}>
            <Textarea className="mono min-h-[70px]" value={blocksText} onChange={(event) => setBlocksText(event.target.value)} placeholder={tr("call.blocksPlaceholder")} />
          </Field>

          {parsed.error ? (
            <Notice tone="danger">{parsed.error}</Notice>
          ) : (
            <div className="grid gap-1.5 rounded-ui border border-line bg-panel p-3 text-[11px]">
              <span className="text-faint">{tr("row.selector")}</span>
              <code className="break-all font-mono text-accent">0x{parsed.selector}</code>
              <span className="mt-1 text-faint">{tr("call.calldataPreview")}</span>
              <code className="break-all font-mono text-muted">{parsed.call?.calldata}</code>
            </div>
          )}

          <Notice>{tr("call.notice")}</Notice>
          <Button variant="primary" onClick={run} disabled={busy || Boolean(parsed.error)}>
            {busy ? tr("call.action.running") : tr("call.action.run")}
          </Button>
        </div>
      </Panel>
      <Panel title={tr("panel.readout")}>{output}</Panel>
    </Workbench>
  );
}

function EncryptionTool() {
  const [mode, setMode] = useState("encrypt");
  const tr = useT();
  const [data, setData] = useState(() => tr("enc.sample.data"));
  const [password, setPassword] = useState("timeminer-demo");
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
  try {
    const current = localStorage.getItem(STATE_KEY);
    if (current) return JSON.parse(current);
    // First run after the rename: adopt the old snapshot so the user keeps
    // their theme, language, and recent tools instead of being reset.
    return JSON.parse(localStorage.getItem(LEGACY_STATE_KEY) || "{}");
  } catch { return {}; }
}
/** Renders raw return data as a decimal integer without throwing on empty hex. */
function asDecimal(raw: string) {
  const clean = raw.trim().replace(/^0x/i, "");
  if (!clean) return "0x (no return data)";
  try {
    return BigInt(`0x${clean}`).toString();
  } catch {
    return "not a hex integer";
  }
}

/**
 * RPC responses are untrusted input. A node that answers `0x`, `null`, or
 * non-hex text would otherwise blow up in JSX during render — and with no
 * error boundary that unmounts the whole app.
 */
function requireHexWord(value: string) {
  const clean = value.trim().replace(/^0x/i, "");
  // eth_getStorageAt must return one 32-byte word. An empty answer is not zero;
  // it means the node did not do what was asked, so say that instead of
  // rendering a comfortable-looking 0.
  if (!clean) throw new Error("RPC returned no storage value; the endpoint may not support this slot or block.");
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error(`RPC returned a non-hex storage value: ${value.slice(0, 80)}`);
  if (clean.length > 64) throw new Error("RPC returned a storage value longer than 32 bytes.");
  return `0x${clean.padStart(64, "0")}`;
}
function loadSettingsCache() {
  try {
    const current = localStorage.getItem(SETTINGS_KEY);
    if (current) return JSON.parse(current);
    return JSON.parse(localStorage.getItem(LEGACY_SETTINGS_KEY) || "{}");
  } catch { return {}; }
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

// ===== Exchange Rate tool (ported) =====

const RATE_STORAGE_KEY = "linsea-exchange-rates-v6";

type StoredRates = {
  rates: Record<string, number>;
  unionPay: Record<string, number>;
  google: Record<string, number>;
  sina: Record<string, number>;
  xe: Record<string, number>;
  date: string;
  unionPayDate: string;
  unionPayNote: string;
  source: string;
  rateSource: "primary" | "backup";
  backupRates: Record<string, number>;
  visa: Record<string, number>;
  visaEnv: string;
  mastercard: Record<string, number>;
  mastercardDate: string;
  crossCheck: RateCrossCheck | null;
  fetchedDay: string;
};

/**
 * Daily-refresh rate table.
 *
 * Fetches at most once per day, inside the 17:00-18:00 window:
 *   - reference rates for all 154 currencies (one CDN JSON file)
 *   - UnionPay's own official clearing rates (relayed, no CORS upstream)
 * The snapshot is cached in localStorage keyed by local calendar day.
 */
function useRateTable(enabled: boolean) {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [unionPay, setUnionPay] = useState<Record<string, number>>({});
  const [sourceProgress, setSourceProgress] = useState<{ done: number; total: number } | null>(null);
  const [google, setGoogle] = useState<Record<string, number>>({});
  const [sina, setSina] = useState<Record<string, number>>({});
  const [xe, setXe] = useState<Record<string, number>>({});
  const [unionPayDate, setUnionPayDate] = useState("");
  const [unionPayNote, setUnionPayNote] = useState("");
  const [status, setStatus] = useState<"loading" | "live" | "blocked" | "error">(enabled ? "loading" : "blocked");
  const [asOf, setAsOf] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [rateSource, setRateSource] = useState<"primary" | "backup">("primary");
  const [backupRates, setBackupRates] = useState<Record<string, number>>({});
  const [visa, setVisa] = useState<Record<string, number>>({});
  const [visaEnv, setVisaEnv] = useState("");
  const [mastercard, setMastercard] = useState<Record<string, number>>({});
  const [mastercardDate, setMastercardDate] = useState("");
  const [crossCheck, setCrossCheck] = useState<RateCrossCheck | null>(null);
  const [refreshedDay, setRefreshedDay] = useState("");

  const persist = useCallback((next: StoredRates) => {
    try {
      localStorage.setItem(RATE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled) {
        setStatus("blocked");
        return;
      }
      setStatus("loading");

      let fetchedRates: Record<string, number> | null = null;
      let fetchedDate = "";
      let fetchedSource = "";
      let fetchedCrossCheck: RateCrossCheck | null = null;
      let fetchedUsed: "primary" | "backup" = "primary";
      let fetchedBackupRates: Record<string, number> = {};

      // Run every feed concurrently. Each one writes its own column the moment it
      // arrives, so a slow source (Google/XE are paced at ~11s per currency) can
      // no longer hold back the fast ones.
      const targets = CURRENCIES.map((currency) => currency.code).filter((code) => code !== "USD");

      let nextUnionPay: Record<string, number> = {};
      let nextUnionPayDate = "";
      let nextUnionPayNote = "";
      let nextVisa: Record<string, number> = {};
      let nextVisaEnv = "";
      let nextMastercard: Record<string, number> = {};
      let nextMastercardDate = "";
      let nextGoogle: Record<string, number> = {};
      let nextSina: Record<string, number> = {};
      let nextXe: Record<string, number> = {};

      const referenceTask = (async () => {
        try {
          const daily = await fetchDailyRates();
          fetchedRates = daily.rates;
          fetchedDate = daily.date;
          fetchedSource = daily.source;
          fetchedCrossCheck = daily.crossCheck;
          fetchedUsed = daily.used;
          fetchedBackupRates = daily.backupRates || {};
          setBackupRates(fetchedBackupRates);
          setRates(daily.rates);
          setAsOf(daily.date);
          setSourceLabel(daily.source);
          setRateSource(daily.used);
          setCrossCheck(daily.crossCheck);
        } catch (error) {
          console.warn("reference rates failed:", (error as Error).message);
        }
      })();

      const unionPayTask = (async () => {
        try {
          const up = await fetchUnionPayRates();
          nextUnionPay = up.rates;
          nextUnionPayDate = up.date;
          nextUnionPayNote = up.note;
          setUnionPay(up.rates);
          setUnionPayDate(up.date);
          setUnionPayNote(up.note);
        } catch (error) {
          nextUnionPayNote = (error as Error).message;
          setUnionPayNote(nextUnionPayNote);
          console.warn("unionpay failed:", (error as Error).message);
        }
      })();

      const visaTask = (async () => {
        try {
          const visaResult = await fetchVisaRates(targets);
          nextVisa = visaResult.rates;
          nextVisaEnv = visaResult.env;
          setVisa(nextVisa);
          setVisaEnv(nextVisaEnv);
        } catch (error) {
          console.warn("visa rates failed:", (error as Error).message);
        }
      })();

      const mastercardTask = (async () => {
        try {
          const mc = await fetchMastercardRates(targets);
          nextMastercard = mc.rates;
          nextMastercardDate = mc.fxDate;
          setMastercard(nextMastercard);
          setMastercardDate(nextMastercardDate);
        } catch (error) {
          console.warn("mastercard rates failed:", (error as Error).message);
        }
      })();

      const sourcesTask = (async () => {
        try {
          setSourceProgress({ done: 0, total: targets.length });
          const sources = await fetchSourceRates(targets, {
            chunkSize: 6,
            onProgress: (done, total, partial) => {
              setSourceProgress({ done, total });
              setGoogle({ ...partial.rates.google });
              setSina({ ...partial.rates.sina });
              setXe({ ...partial.rates.xe });
            },
          });
          nextGoogle = sources.rates.google;
          nextSina = sources.rates.sina;
          nextXe = sources.rates.xe;
          setGoogle(nextGoogle);
          setSina(nextSina);
          setXe(nextXe);
        } catch (error) {
          console.warn("source rates failed:", (error as Error).message);
        } finally {
          setSourceProgress(null);
        }
      })();

      // Only the reference feed gates the persisted snapshot; the card and spot
      // feeds write incrementally and are saved with it.
      await Promise.all([referenceTask, unionPayTask, visaTask, mastercardTask, sourcesTask]);

      if (fetchedRates) {
        const day = todayKey();
        setRefreshedDay(day);
        persist({
          rates: fetchedRates,
          unionPay: nextUnionPay,
          google: nextGoogle,
          sina: nextSina,
          xe: nextXe,
          date: fetchedDate,
          unionPayDate: nextUnionPayDate,
          unionPayNote: nextUnionPayNote,
          source: fetchedSource,
          rateSource: fetchedUsed,
          backupRates: fetchedBackupRates,
          visa: nextVisa,
          visaEnv: nextVisaEnv,
          mastercard: nextMastercard,
          mastercardDate: nextMastercardDate,
          crossCheck: fetchedCrossCheck,
          fetchedDay: day,
        });
        setStatus("live");
      } else if (!force && Object.keys(rates).length) {
        setStatus("live");
      } else {
        setStatus("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, rates],
  );

  /**
   * Load the server-side daily snapshot. Returns true when it replaced the
   * local cache, so the caller knows whether a live sweep is still needed.
   */
  const loadServerSnapshot = useCallback(async () => {
    try {
      const response = await fetch("/api/snapshot");
      if (!response.ok) return false;
      const snap = (await response.json()) as {
        ok?: boolean;
        generatedAt?: string;
        unionPay?: Record<string, number>;
        unionPayDate?: string;
        unionPayNote?: string;
        google?: Record<string, number>;
        sina?: Record<string, number>;
        xe?: Record<string, number>;
        visa?: Record<string, number>;
        visaEnv?: string;
        mastercard?: Record<string, number>;
        mastercardDate?: string;
      };
      if (!snap.ok) return false;

      // The reference columns still come from currency-api; the snapshot only
      // carries the relays, so merge instead of replacing wholesale.
      setUnionPay(snap.unionPay || {});
      setUnionPayDate(snap.unionPayDate || "");
      setUnionPayNote(snap.unionPayNote || "");
      setGoogle(snap.google || {});
      setSina(snap.sina || {});
      setXe(snap.xe || {});
      setVisa(snap.visa || {});
      setVisaEnv(snap.visaEnv || "");
      setMastercard(snap.mastercard || {});
      setMastercardDate(snap.mastercardDate || "");

      const day = (snap.generatedAt || "").slice(0, 10) || todayKey();
      setRefreshedDay(day);
      setStatus("live");
      return true;
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("blocked");
      return;
    }
    let cached: StoredRates | null = null;
    try {
      const raw = localStorage.getItem(RATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.rates) {
          cached = {
            rates: parsed.rates,
            unionPay: parsed.unionPay || {},
            google: parsed.google || {},
            sina: parsed.sina || {},
            xe: parsed.xe || {},
            date: parsed.date || "",
            unionPayDate: parsed.unionPayDate || "",
            unionPayNote: parsed.unionPayNote || "",
            source: parsed.source || "",
            rateSource: parsed.rateSource === "backup" ? "backup" : "primary",
            backupRates: parsed.backupRates || {},
            visa: parsed.visa || {},
            visaEnv: parsed.visaEnv || "",
            mastercard: parsed.mastercard || {},
            mastercardDate: parsed.mastercardDate || "",
            crossCheck: parsed.crossCheck || null,
            fetchedDay: parsed.fetchedDay || "",
          };
        }
      }
    } catch {
      /* ignore corrupted cache */
    }

    if (cached && Object.keys(cached.rates).length) {
      setRates(cached.rates);
      setUnionPay(cached.unionPay);
      setGoogle(cached.google);
      setSina(cached.sina);
      setXe(cached.xe);
      setAsOf(cached.date);
      setUnionPayDate(cached.unionPayDate);
      setUnionPayNote(cached.unionPayNote);
      setSourceLabel(cached.source);
      setRateSource(cached.rateSource);
      setCrossCheck(cached.crossCheck);
      setBackupRates(cached.backupRates || {});
      setVisa(cached.visa || {});
      setVisaEnv(cached.visaEnv || "");
      setMastercard(cached.mastercard || {});
      setMastercardDate(cached.mastercardDate || "");
      setRefreshedDay(cached.fetchedDay);
      setStatus("live");
      // Serve the cached snapshot immediately, then top up from the server-side
      // snapshot if it is newer. A browser never starts a full sweep on its own.
      void loadServerSnapshot().then((applied) => {
        if (!applied && cached.fetchedDay !== todayKey() && inRefreshWindow()) void refresh();
      });
      return;
    }
    // First visit on this browser: use the server snapshot if one exists.
    void loadServerSnapshot().then((applied) => {
      if (!applied) void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // A page left open across the window still refreshes once.
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      if (refreshedDay !== todayKey() && inRefreshWindow()) void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled, refreshedDay, refresh]);

  const get = useCallback(
    (code: string) => {
      const value = rates[code];
      return typeof value === "number" && value > 0 ? value : null;
    },
    [rates],
  );
  const getVisa = useCallback(
    (code: string) => {
      const value = visa[code];
      return typeof value === "number" && value > 0 ? value : null;
    },
    [visa],
  );
  const getMastercard = useCallback(
    (code: string) => {
      const value = mastercard[code];
      return typeof value === "number" && value > 0 ? value : null;
    },
    [mastercard],
  );
  const getBackup = useCallback(
    (code: string) => {
      const value = backupRates[code];
      return typeof value === "number" && value > 0 ? value : null;
    },
    [backupRates],
  );
  const getUnionPay = useCallback(
    (code: string) => {
      const value = unionPay[code];
      return typeof value === "number" && value > 0 ? value : null;
    },
    [unionPay],
  );
  const pick = (map: Record<string, number>) => (code: string) => {
    const value = map[code];
    return typeof value === "number" && value > 0 ? value : null;
  };
  const getGoogle = useCallback(pick(google), [google]);
  const getSina = useCallback(pick(sina), [sina]);
  const getXe = useCallback(pick(xe), [xe]);
  const hasAny = useCallback(
    (code: string) => {
      if (code === "USD") return true;
      const value = rates[code];
      return typeof value === "number" && value > 0;
    },
    [rates],
  );
  const best = useCallback(
    (code: string, key: RateSortKey) => {
      if (code === "USD") return 1;
      if (key === "unionpay") return getUnionPay(code) ?? null;
      if (key === "google") return getGoogle(code) ?? null;
      if (key === "sina") return getSina(code) ?? null;
      if (key === "xe") return getXe(code) ?? null;
      if (key === "code") return null;
      return get(code);
    },
    [get, getUnionPay, getGoogle, getSina, getXe],
  );

  const loadedCount = CURRENCIES.filter((currency) => hasAny(currency.code)).length;
  const unionPayCount = CURRENCIES.filter((currency) => getUnionPay(currency.code) !== null).length;

  return {
    get,
    getUnionPay,
    getBackup,
    getVisa,
    getMastercard,
    mastercardDate,
    mastercardCount: Object.keys(mastercard).length,
    visaEnv,
    visaCount: Object.keys(visa).length,
    getGoogle,
    getSina,
    getXe,
    hasAny,
    best,
    refresh: () => refresh(true),
    status,
    asOf,
    sourceLabel,
    rateSource,
    crossCheck,
    refreshedDay,
    loadedCount,
    unionPayCount,
    sourceProgress,
    googleCount: Object.keys(google).length,
    sinaCount: Object.keys(sina).length,
    xeCount: Object.keys(xe).length,
    unionPayDate,
    unionPayNote,
  };
}

function RateCell({ value, origin, highlight, muted, real }: { value?: number | null; origin?: string; highlight?: boolean; muted?: boolean; real?: boolean }) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-faint">—</td>;
  }
  return (
    <td className="whitespace-nowrap px-4 py-2.5">
      <span className={cn("font-mono text-sm", highlight ? "font-bold text-accent" : real ? "font-semibold text-text" : muted ? "text-muted" : "text-text")}>{formatRate(value)}</span>
      {origin ? <span className="ml-1.5 text-[10px] text-faint">{origin}</span> : null}
    </td>
  );
}

function sortIndicator(active: RateSortKey, dir: "asc" | "desc", key: RateSortKey) {
  if (key === "code" && dir === "asc") return "";
  if (active !== key) return "";
  return dir === "asc" ? "▲" : "▼";
}

function currencySymbolOf(code: string) {
  return CURRENCY_BY_CODE[code]?.symbol ?? "";
}

function ExchangeRateTool({ settings }: { settings: Settings }) {
  const live = useRateTable(!settings.privacyMode);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState("25");
  const [sortKey, setSortKey] = useState<RateSortKey>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [onlyLoaded, setOnlyLoaded] = useState(false);
  const [amount, setAmount] = useState("100");
  const [convertTo, setConvertTo] = useState("CNY");

  const numericAmount = parseRateNumber(amount);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = CURRENCIES.filter((currency) => {
      if (!needle) return true;
      return (
        currency.code.toLowerCase().includes(needle) ||
        currency.en.toLowerCase().includes(needle) ||
        currency.zh.includes(needle)
      );
    });
    if (onlyLoaded) {
      list = list.filter((currency) => live.hasAny(currency.code));
    }
    const ranked = [...list].sort((a, b) => {
      const aPop = POPULAR_CODES.indexOf(a.code);
      const bPop = POPULAR_CODES.indexOf(b.code);
      if (aPop !== -1 || bPop !== -1) {
        if (aPop === -1) return 1;
        if (bPop === -1) return -1;
        return aPop - bPop;
      }
      return a.code.localeCompare(b.code);
    });
    return ranked;
  }, [query, onlyLoaded, live]);

  const sorted = useMemo(() => {
    // `filtered` already ranks popular currencies first. Sorting by code or by a
    // rate column should re-order everything, but popular rows stay pinned on
    // top so the spotlight sources are visible without hunting through pages.
    if (sortKey === "code" && sortDir === "asc" && !query.trim()) return filtered;
    const rows = [...filtered];
    const popularity = (code: string) => {
      const index = POPULAR_CODES.indexOf(code);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "code") return a.code.localeCompare(b.code) * dir;
      const av = live.best(a.code, sortKey);
      const bv = live.best(b.code, sortKey);
      if (av === null && bv === null) return popularity(a.code) - popularity(b.code) || a.code.localeCompare(b.code);
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * dir;
    });
    return rows;
  }, [filtered, sortKey, sortDir, live, query]);

  const size = pageSize === "all" ? sorted.length || 1 : Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(sorted.length / size));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * size, safePage * size + size);

  const convertRate = live.best(convertTo, "google") ?? live.best(convertTo, "xe") ?? live.best(convertTo, "sina");
  const converted = numericAmount && convertRate ? numericAmount * convertRate : 0;

  const toggleSort = (key: RateSortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  return (
    <div className="grid gap-4">
      <Panel title="汇率表 Exchange Rate Table">
        <div className="grid gap-4">
          <div className={cn("rounded-2xl border px-4 py-3 text-sm", live.status === "live" && "border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300", live.status === "loading" && "border-line bg-panel text-muted", live.status === "blocked" && "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300", live.status === "error" && "border-red-400/40 bg-red-500/10 text-red-600 dark:text-red-300")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">
                {live.status === "loading" && "正在获取每日汇率…"}
                {live.status === "live" && `每日汇率 · ${live.loadedCount} / ${CURRENCIES.length} 个币种`}
                {live.status === "blocked" && "隐私模式已开启，未发起外部请求"}
                {live.status === "error" && "汇率获取失败，请检查网络后重试"}
              </span>
              <span className="font-mono text-[11px] text-faint">
                {live.asOf ? `数据日期 ${live.asOf}` : ""}
                {live.refreshedDay ? ` · 本地更新于 ${live.refreshedDay}` : ""}
              </span>
            </div>
            <div className="mt-1 text-xs text-faint">
              {live.sourceLabel ? `来源：${live.sourceLabel}` : ""}
              {live.rateSource === "backup" ? " · 主源不可用，已切换备用源" : ""}
              {live.crossCheck
                ? ` · 交叉校验 ${live.crossCheck.compared} 个币种，中位偏差 ${live.crossCheck.medianDeviation.toFixed(2)}%`
                : ""}
              {" · "}
              每天 {REFRESH_WINDOW_START}–{REFRESH_WINDOW_END} 之间自动更新一次
              {live.sourceProgress
                ? ` · 正在抓取 Google/新浪/XE ${live.sourceProgress.done}/${live.sourceProgress.total}`
                : live.googleCount || live.sinaCount || live.xeCount
                  ? ` · 已抓取 Google ${live.googleCount} / 新浪 ${live.sinaCount} / XE ${live.xeCount}`
                  : ""}
            </div>
            {live.rateSource === "backup" ? (
              <div className="mt-1 text-xs leading-5">主数据源（currency-api）本次无法访问，已自动切换到备用源。两者均为每日更新，可继续正常使用。</div>
            ) : null}
            {live.crossCheck && live.crossCheck.outliers.length ? (
              <div className="mt-1 text-xs leading-5">
                两个数据源在 {live.crossCheck.outliers.map((item) => item.code).join("、")} 上差异较大（最多 {live.crossCheck.maxDeviation.toFixed(0)}%），
                通常是这些国家发生过币制改革或汇率重定，使用前建议单独核对。
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="搜索币种代码 / 英文名 / 中文名，如 CNY、人民币、Euro" />
            <Select value={pageSize} onChange={(value) => { setPageSize(value); setPage(0); }} options={[{ value: "25", label: "25 / 页" }, { value: "50", label: "50 / 页" }, { value: "100", label: "100 / 页" }, { value: "all", label: "全部" }]} />
            <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface/80 px-3 text-xs font-semibold text-muted">
              <input type="checkbox" checked={onlyLoaded} onChange={(event) => { setOnlyLoaded(event.target.checked); setPage(0); }} />
              仅显示已有数据
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[1240px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface/70 text-left">
                  <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-black uppercase tracking-wide text-muted" onClick={() => toggleSort("code")}>
                    币种名称 {sortIndicator(sortKey, sortDir, "code")}
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-muted">符号</th>
                  <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-black uppercase tracking-wide text-muted" title="银联官方每日清算汇率" onClick={() => toggleSort("unionpay")}>
                    银联 {sortIndicator(sortKey, sortDir, "unionpay")}
                  </th>
                  <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-black uppercase tracking-wide text-muted" title={live.mastercardCount > 0 ? `Mastercard 官方持卡人账单汇率（mastercard.com 公开接口，汇率日期 ${live.mastercardDate || "未知"}）` : "Mastercard 官方接口尚未返回数据"} onClick={() => toggleSort("mastercard")}>
                    MASTERCARD {sortIndicator(sortKey, sortDir, "mastercard")}
                  </th>
                  <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-black uppercase tracking-wide text-muted" title={live.visaEnv === "production" ? "Visa 官方外汇接口（生产环境，真实清算汇率）" : "Visa 官方外汇接口 · SANDBOX 沙箱模拟数据，仅供接口验证，不是真实汇率"} onClick={() => toggleSort("visa")}>
                    VISA{" "}
                    {live.visaEnv !== "production" ? (
                      <span className="ml-1 rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-300">SANDBOX</span>
                    ) : null}
                    {sortIndicator(sortKey, sortDir, "visa")}
                  </th>
                  <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-black uppercase tracking-wide text-accent" onClick={() => toggleSort("google")}>
                    平行市场 Google {sortIndicator(sortKey, sortDir, "google")}
                  </th>
                  <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-black uppercase tracking-wide text-accent" onClick={() => toggleSort("sina")}>
                    官方① 新浪 {sortIndicator(sortKey, sortDir, "sina")}
                  </th>
                  <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-black uppercase tracking-wide text-accent" onClick={() => toggleSort("xe")}>
                    官方② XE {sortIndicator(sortKey, sortDir, "xe")}
                  </th>
                  <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-black uppercase tracking-wide text-muted" title="currency-api 每日快照（主数据源）" onClick={() => toggleSort("google")}>
                    currency-api {sortIndicator(sortKey, sortDir, "code")}
                  </th>
                  <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-black uppercase tracking-wide text-muted" title="ExchangeRate-API 开放接口（备用数据源，同时用于交叉校验）">
                    ExchangeRate-API
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((currency) => {
                  return (
                    <tr key={currency.code} className="border-t border-line transition hover:bg-accent/5">
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className="mr-2">{flagEmoji(currency.flag)}</span>
                        <span className="font-semibold text-text">{currency.zh}</span>
                        <span className="ml-2 font-mono text-xs text-faint">{currency.code}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted">{currency.symbol}</td>
                      <RateCell value={live.getUnionPay(currency.code)} real />
                      <RateCell value={live.getMastercard(currency.code)} real />
                      <RateCell value={live.getVisa(currency.code)} real />
                      <RateCell value={live.getGoogle(currency.code)} highlight />
                      <RateCell value={live.getSina(currency.code)} highlight />
                      <RateCell value={live.getXe(currency.code)} highlight />
                      <RateCell value={live.get(currency.code)} real />
                      <RateCell value={live.getBackup(currency.code)} muted />
                    </tr>
                  );
                })}
                {!pageRows.length ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">
                      {settings.privacyMode ? "隐私模式下不加载汇率。关闭 Privacy First Mode 后刷新。" : "没有匹配的币种。"}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted">
              共 {sorted.length} 个币种 · 第 {sorted.length ? safePage + 1 : 0} / {pageCount} 页
            </span>
            <div className="flex items-center gap-2">
              <Button variant="default" onClick={() => setPage(0)} disabled={safePage === 0}>首页</Button>
              <Button variant="default" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}>上一页</Button>
              <Button variant="default" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1}>下一页</Button>
              <Button variant="default" onClick={() => setPage(pageCount - 1)} disabled={safePage >= pageCount - 1}>末页</Button>
            </div>
          </div>

          <Notice>
            汇率口径：<strong>1 美元 (USD) = X 本币</strong>，每天 {REFRESH_WINDOW_START}–{REFRESH_WINDOW_END} 之间自动更新一次。
            列名即数据出处，各列独立抓取、互不替代：
            <br />
            <strong>currency-api</strong>：<a className="underline hover:text-accent" href="https://github.com/fawazahmed0/currency-api" target="_blank" rel="noreferrer noopener">fawazahmed0/currency-api</a>（经 jsDelivr CDN）每日快照，覆盖全部 154 种法币，为主数据源。
            <br />
            <strong>ExchangeRate-API</strong>：{" "}
            <a className="underline hover:text-accent" href={RATE_ATTRIBUTION.href} target="_blank" rel="noreferrer noopener">
              {RATE_ATTRIBUTION.label}
            </a>{" "}
            开放接口（无需 Key），每日更新；作为备用数据源，同时用于与主源交叉校验。主源不可用时自动切换。
            <br />
            <strong>平行市场 Google</strong>：Google Finance 报价页（USD-XXX 实时行情）。
            <br />
            <strong>官方① 新浪</strong>：新浪财经外汇接口 <code>hq.sinajs.cn</code>（在岸/离岸报价）。
            <br />
            <strong>官方② XE</strong>：<a className="underline hover:text-accent" href="https://www.xe.com/currencyconverter/" target="_blank" rel="noreferrer noopener">XE.com</a> 货币转换页中间价。
            <br />
            <strong>银联</strong>：银联国际公布的每日清算汇率（周一至周五更新，周末沿用周五汇率）。
            <br />
            <strong>VISA</strong>：{live.visaCount > 0
              ? live.visaEnv === "production"
                ? `Visa Developer Platform 官方外汇接口（生产环境），Visa 信用卡清算汇率，覆盖 ${live.visaCount} 个常用币种`
                : `Visa Developer Platform 官方外汇接口 · SANDBOX 沙箱环境，覆盖 ${live.visaCount} 个常用币种。沙箱返回的是模拟数据，与真实市场汇率差距可达 40%，仅供接口连通性验证，不要用于实际换算`
              : "Visa 官方接口暂未返回数据，该列显示为空（不再使用任何推算值）"}。Visa 官网本身有 Cloudflare 人机验证，无法直接抓取。
            <br />
            <strong>MASTERCARD</strong>：{live.mastercardCount > 0
              ? `取自 mastercard.com 官网货币转换器的公开接口，是 Mastercard 公布的持卡人账单汇率，覆盖 ${live.mastercardCount} 个常用币种，汇率日期 ${live.mastercardDate || "未知"}`
              : "Mastercard 接口暂未返回数据，该列显示为空（不再使用任何推算值）"}。该接口不需要 API Key，但无 CORS 头，经由本地转发服务读取。
          </Notice>
        </div>
      </Panel>

      <Panel title="美元换算 USD Converter">
        <div className="grid gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3 max-md:grid-cols-1">
            <Field label="美元金额 (USD)">
              <Input className="mono" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="100" />
            </Field>
            <div className="grid h-11 place-items-center px-2 font-mono text-sm text-faint">=</div>
            <Field label="目标币种">
              <Select
                value={convertTo}
                onChange={setConvertTo}
                options={CURRENCIES.map((item) => ({ value: item.code, label: `${item.code} · ${item.zh}`, hint: item.en }))}
              />
            </Field>
          </div>
          <Metric
            label={`${formatAmount(numericAmount || 0)} USD`}
            value={convertRate ? `${currencySymbolOf(convertTo)} ${formatAmount(converted)} ${convertTo}` : "—"}
            hint={convertRate ? `1 USD = ${formatRate(convertRate)} ${convertTo}` : "该币种暂无可用汇率。"}
          />
        </div>
      </Panel>
    </div>
  );
}

function parseRateNumber(input: string) {
  const raw = input.trim().replace(/,/g, "");
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatRate(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1000) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(4);
  return value.toFixed(6);
}

function formatAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(2);
  return value.toPrecision(6).replace(/0+$/, "");
}


