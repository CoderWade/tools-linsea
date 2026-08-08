const STORAGE_KEY = "linsea-tools-state";
const SETTINGS_KEY = "linsea-tools-settings";

const categories = [
  { id: "reverse", name: "Reverse Security", zh: "逆向安全" },
  { id: "developer", name: "Developer", zh: "通用开发" },
  { id: "commerce", name: "Commerce", zh: "跨境运营" },
  { id: "risk", name: "Risk Testing", zh: "风控测试" },
];

const tools = [
  {
    id: "storage-slot",
    category: "reverse",
    name: "Storage Slot Inspector",
    zh: "存储槽检查器",
    description: "Read raw storage slots and probe mapping keys through an optional read-only RPC.",
    keywords: ["slot", "storage", "mapping", "erc1967", "solidity"],
    badges: ["Raw read", "Mapping probe"],
    renderer: renderStorageSlot,
  },
  {
    id: "source-layout",
    category: "reverse",
    name: "Source Layout Resolver",
    zh: "源码槽位解析器",
    description: "Paste verified or decompiled source to resolve Solidity names into storage slots.",
    keywords: ["layout", "source", "decompiled", "verified", "slot", "solidity"],
    badges: ["Local first", "Layout aware"],
    renderer: renderSourceLayoutResolver,
  },
  {
    id: "proxy-slot",
    category: "reverse",
    name: "Proxy Slot Finder",
    zh: "代理槽探测器",
    description: "Probe ERC-1967, beacon, and UUPS proxy implementation slots.",
    keywords: ["proxy", "erc1967", "beacon", "uups", "implementation"],
    badges: ["Network required", "Read only"],
    renderer: renderProxySlot,
  },
  {
    id: "calldata-decoder",
    category: "reverse",
    name: "Calldata Decoder",
    zh: "Calldata 解码器",
    description: "Extract selectors and decode calldata with local ABI or remote signature lookup.",
    keywords: ["calldata", "selector", "abi", "4byte"],
    badges: ["Privacy sensitive", "ABI"],
    renderer: renderCalldata,
  },
  {
    id: "unit-converter",
    category: "reverse",
    name: "Unit Converter",
    zh: "单位转换器",
    description: "Convert Wei, Gwei, Ether, and token decimals without floating point drift.",
    keywords: ["wei", "gwei", "ether", "decimals", "token"],
    badges: ["Local only", "BigInt"],
    renderer: renderUnitConverter,
  },
  {
    id: "selector-finder",
    category: "reverse",
    name: "4Byte / Selector Finder",
    zh: "4Byte / Selector 查询",
    description: "Generate hashes from signatures or look up selector candidates from a public signature database.",
    keywords: ["selector", "4byte", "topic0", "function", "event"],
    badges: ["Local hash", "Lookup optional"],
    renderer: renderSelectorFinder,
  },
  {
    id: "hash-suite",
    category: "reverse",
    name: "Encoder / Hash Suite",
    zh: "编码与哈希套件",
    description: "Encode, decode, and hash text using browser-native cryptography where available.",
    keywords: ["hash", "sha256", "sha1", "base64", "url", "md5", "keccak"],
    badges: ["Local only", "Crypto"],
    renderer: renderHashSuite,
  },
  {
    id: "symmetric-encryption",
    category: "reverse",
    name: "Symmetric Encryption",
    zh: "对称加密",
    description: "AES-GCM encryption playground with legacy algorithm warnings.",
    keywords: ["aes", "gcm", "des", "encrypt", "decrypt"],
    badges: ["Local only", "Sensitive"],
    renderer: renderEncryption,
  },
  {
    id: "jwt-inspector",
    category: "reverse",
    name: "JWT Inspector",
    zh: "JWT 检查器",
    description: "Decode JWT header and payload, then inspect expiration and time claims.",
    keywords: ["jwt", "token", "payload", "exp", "auth"],
    badges: ["Local only", "Sensitive"],
    renderer: renderJwtInspector,
  },
  {
    id: "json-studio",
    category: "developer",
    name: "JSON Studio",
    zh: "JSON 工作台",
    description: "Format, minify, validate, and draft TypeScript interfaces from JSON.",
    keywords: ["json", "format", "typescript", "go", "sql"],
    badges: ["Local only", "Formatter"],
    renderer: renderJsonStudio,
  },
  {
    id: "timestamp-pro",
    category: "developer",
    name: "Timestamp Pro",
    zh: "时间戳工具",
    description: "Convert Unix timestamps, ISO dates, and relative time expressions.",
    keywords: ["timestamp", "unix", "time", "timezone", "block"],
    badges: ["Local only", "Time"],
    renderer: renderTimestamp,
  },
  {
    id: "text-compare",
    category: "developer",
    name: "Text Compare",
    zh: "文本对比",
    description: "Compare two text versions locally with readable line-level differences.",
    keywords: ["text", "diff", "compare", "difference"],
    badges: ["Local only", "Diff"],
    renderer: renderTextCompare,
  },
  {
    id: "fba-calculator",
    category: "commerce",
    name: "FBA & Landed Cost Calculator",
    zh: "FBA 到岸成本计算器",
    description: "Estimate landed cost, margin, ROI, and fee sensitivity.",
    keywords: ["fba", "landed", "profit", "margin", "amazon"],
    badges: ["Local only", "Estimator"],
    renderer: renderFbaCalculator,
  },
  {
    id: "listing-cleaner",
    category: "commerce",
    name: "Listing Text Cleaner",
    zh: "Listing 文本清洗",
    description: "Strip HTML, normalize spacing, and export clean product copy.",
    keywords: ["listing", "html", "text", "clean"],
    badges: ["Local only", "Text"],
    renderer: renderListingCleaner,
  },
  {
    id: "white-bg",
    category: "commerce",
    name: "Product Pure White BG",
    zh: "商品白底图",
    description: "Prepare a local canvas workflow for white-background product images.",
    keywords: ["image", "background", "white", "product"],
    badges: ["Local MVP", "Canvas"],
    renderer: renderWhiteBackground,
  },
  {
    id: "shipping-tracker",
    category: "commerce",
    name: "Global Shipping Tracker",
    zh: "全球物流追踪",
    description: "Identify tracking numbers and jump to carrier tracking pages.",
    keywords: ["shipping", "tracking", "dhl", "fedex", "ups"],
    badges: ["External link", "Logistics"],
    renderer: renderShippingTracker,
  },
  {
    id: "card-bin",
    category: "risk",
    name: "Card & BIN Tester",
    zh: "卡号与 BIN 测试器",
    description: "Validate Luhn numbers, identify card networks, and generate sandbox test numbers.",
    keywords: ["card", "bin", "luhn", "visa", "mastercard", "sandbox"],
    badges: ["Compliance", "Local Luhn"],
    renderer: renderCardTester,
  },
];

const state = loadState();
let activeCategory = state.category || "reverse";
let activeToolId = state.tool || "storage-slot";
let language = state.language || "en";
let theme = state.theme || "light";
let settings = {
  alchemyKey: "",
  infuraKey: "",
  defaultChain: "ethereum",
  privacyMode: false,
  ...(loadSettingsCache()),
  ...(state.settings || {}),
};
let recent = state.recent || [];

const $ = (selector) => document.querySelector(selector);
const elements = {
  categoryNav: $("#categoryNav"),
  toolList: $("#toolList"),
  recentList: $("#recentList"),
  toolTitle: $("#toolTitle"),
  toolDescription: $("#toolDescription"),
  toolMeta: $("#toolMeta"),
  toolBadges: $("#toolBadges"),
  toolPanel: $("#toolPanel"),
  toolCount: $("#toolCount"),
  privacyPill: $("#privacyPill"),
  adSlot: $("#adSlot"),
  commandOverlay: $("#commandOverlay"),
  commandInput: $("#commandInput"),
  commandResults: $("#commandResults"),
  settingsOverlay: $("#settingsOverlay"),
};

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      category: activeCategory,
      tool: activeToolId,
      language,
      theme,
      settings,
      recent,
    }),
  );
  saveSettingsCache();
}

function loadSettingsCache() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSettingsCache() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function t(tool) {
  return language === "zh" ? tool.zh : tool.name;
}

function mount() {
  document.documentElement.dataset.theme = theme;
  bindGlobalEvents();
  renderShell();
  selectTool(activeToolId, false);
}

function bindGlobalEvents() {
  $("#commandButton").addEventListener("click", openCommand);
  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#languageToggle").addEventListener("click", toggleLanguage);
  $("#openSettingsTop").addEventListener("click", openSettings);
  $("#openSettingsSide").addEventListener("click", openSettings);
  $("#closeSettings").addEventListener("click", closeSettings);
  $("#saveSettings").addEventListener("click", handleSaveSettings);
  elements.commandOverlay.addEventListener("click", (event) => {
    if (event.target === elements.commandOverlay) closeCommand();
  });
  elements.settingsOverlay.addEventListener("click", (event) => {
    if (event.target === elements.settingsOverlay) closeSettings();
  });
  elements.commandInput.addEventListener("input", () => renderCommandResults(elements.commandInput.value));
  document.addEventListener("keydown", handleHotkeys);
}

function handleHotkeys(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommand();
  }
  if (event.key === "Escape") {
    closeCommand();
    closeSettings();
  }
}

function renderShell() {
  elements.categoryNav.innerHTML = categories
    .map((category) => {
      const count = tools.filter((tool) => tool.category === category.id).length;
      return `<button class="category-button ${category.id === activeCategory ? "active" : ""}" data-category="${category.id}" type="button">
        <strong>${language === "zh" ? category.zh : category.name}</strong>
        <span>${count}</span>
      </button>`;
    })
    .join("");

  elements.categoryNav.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      const firstTool = tools.find((tool) => tool.category === activeCategory);
      if (firstTool) selectTool(firstTool.id);
    });
  });

  $("#languageToggle").textContent = language.toUpperCase();
  $("#themeToggle").textContent = theme === "dark" ? "Dark" : "Light";
  elements.privacyPill.textContent = settings.privacyMode ? "Privacy on" : "Privacy off";
  elements.privacyPill.style.borderColor = settings.privacyMode ? "var(--line-strong)" : "var(--line)";
  elements.adSlot.classList.toggle("disabled", settings.privacyMode);
}

function renderToolList() {
  const visibleTools = tools.filter((tool) => tool.category === activeCategory);
  elements.toolCount.textContent = `${visibleTools.length} items`;
  elements.toolList.innerHTML = visibleTools
    .map(
      (tool) => `<button class="tool-row ${tool.id === activeToolId ? "active" : ""}" data-tool="${tool.id}" type="button">
        <strong>${t(tool)}</strong>
        <span>${tool.keywords.slice(0, 5).join(" / ")}</span>
      </button>`,
    )
    .join("");
  elements.toolList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => selectTool(button.dataset.tool));
  });
}

function renderRecent() {
  elements.recentList.innerHTML =
    recent.length === 0
      ? `<div class="notice">No recent tools yet.</div>`
      : recent
          .slice(0, 5)
          .map((id) => {
            const tool = tools.find((item) => item.id === id);
            if (!tool) return "";
            return `<button class="tool-row" data-tool="${tool.id}" type="button">
              <strong>${t(tool)}</strong>
              <span>${tool.category}</span>
            </button>`;
          })
          .join("");
  elements.recentList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => selectTool(button.dataset.tool));
  });
}

function selectTool(toolId, persist = true) {
  const tool = tools.find((item) => item.id === toolId) || tools[0];
  activeToolId = tool.id;
  activeCategory = tool.category;
  recent = [tool.id, ...recent.filter((id) => id !== tool.id)].slice(0, 8);
  elements.toolTitle.textContent = t(tool);
  elements.toolDescription.textContent = tool.description;
  elements.toolMeta.innerHTML = `<span>${categoryName(tool.category)}</span><span>${tool.id}</span>`;
  elements.toolBadges.innerHTML = tool.badges.map((badge) => `<span class="chip">${badge}</span>`).join("");
  elements.toolPanel.className = "tool-panel";
  tool.renderer(tool);
  renderShell();
  renderToolList();
  renderRecent();
  if (persist) saveState();
}

function categoryName(categoryId) {
  const category = categories.find((item) => item.id === categoryId);
  return category ? (language === "zh" ? category.zh : category.name) : categoryId;
}

function panel(title, body, action = "") {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `<section class="panel-band panel-${slug}">
    <div class="band-header"><strong>${title}</strong>${action}</div>
    <div class="band-body">${body}</div>
  </section>`;
}

function copyButton(value) {
  return `<button class="copy-button" data-copy="${escapeHtml(value)}" type="button">Copy</button>`;
}

function bindCopyButtons(scope = document) {
  scope.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(button.dataset.copy || "");
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 900);
    });
  });
}

function resultRows(rows) {
  return `<div class="result-grid">${rows
    .map(
      ([label, value]) => `<div class="result-row">
        <div class="result-label">${label}</div>
        <div class="result-value">${escapeHtml(String(value))}</div>
        ${copyButton(String(value))}
      </div>`,
    )
    .join("")}</div>`;
}

function setWorkbench(name) {
  elements.toolPanel.classList.add(`workbench-${name}`);
}

/* ====== SETTINGS OVERLAY ====== */

function openSettings() {
  $("#settingsStatus").textContent = "";
  $("#settingsStatus").className = "notice hidden";
  $("#alchemyKey").value = settings.alchemyKey || "";
  $("#infuraKey").value = settings.infuraKey || "";
  $("#defaultChain").value = settings.defaultChain || "ethereum";
  $("#privacyMode").checked = Boolean(settings.privacyMode);
  elements.settingsOverlay.classList.remove("hidden");
}

function closeSettings() {
  elements.settingsOverlay.classList.add("hidden");
}

function handleSaveSettings() {
  settings = {
    alchemyKey: $("#alchemyKey").value.trim(),
    infuraKey: $("#infuraKey").value.trim(),
    defaultChain: $("#defaultChain").value,
    privacyMode: $("#privacyMode").checked,
  };
  saveSettingsCache();
  saveState();
  renderShell();
  const node = $("#settingsStatus");
  node.textContent = "Preferences saved locally.";
  node.className = "notice";
}

/* ====== TOOL RENDERERS ====== */

function renderUnitConverter() {
  setWorkbench("converter");
  elements.toolPanel.innerHTML =
    panel(
      "Input",
      `<div class="input-grid">
        <label class="field"><span>Amount</span><input id="unitAmount" class="mono" value="1" /></label>
        <label class="field"><span>From unit</span><select id="unitFrom">
          <option value="ether">Ether</option>
          <option value="gwei">Gwei</option>
          <option value="wei">Wei</option>
          <option value="token">Token decimals</option>
        </select></label>
        <label class="field"><span>To unit</span><select id="unitTo">
          <option value="ether">Ether</option>
          <option value="gwei">Gwei</option>
          <option value="wei">Wei</option>
          <option value="token">Token decimals</option>
        </select></label>
        <label class="field"><span>Token decimals</span><input id="unitDecimals" class="mono" value="18" /></label>
      </div>`,
    ) + panel("Output", `<div id="unitOutput"></div>`);

  ["#unitAmount", "#unitFrom", "#unitTo", "#unitDecimals"].forEach((selector) => {
    $(selector).addEventListener("input", updateUnitConverter);
  });
  ["#unitFrom", "#unitTo"].forEach((selector) => $(selector).addEventListener("change", updateUnitConverter));
  updateUnitConverter();
}

function updateUnitConverter() {
  const amount = $("#unitAmount").value.trim();
  const from = $("#unitFrom").value;
  const to = $("#unitTo").value;
  const decimals = Number($("#unitDecimals").value || "18");
  const output = $("#unitOutput");
  try {
    const unitDecimals = (unit) => (unit === "wei" ? 0 : unit === "gwei" ? 9 : unit === "ether" ? 18 : decimals);
    const wei = decimalToBaseUnits(amount, unitDecimals(from));
    output.innerHTML = resultRows([
      [`${from} -> ${to}`, formatBaseUnits(wei, unitDecimals(to))],
      ["Wei", wei.toString()],
      ["Gwei", formatBaseUnits(wei, 9)],
      ["Ether", formatBaseUnits(wei, 18)],
      [`Token (${decimals})`, formatBaseUnits(wei, decimals)],
    ]);
    bindCopyButtons(output);
  } catch (error) {
    output.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`;
  }
}

function decimalToBaseUnits(value, decimals) {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error("Enter a positive decimal number.");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error("Decimals must be 0 to 36.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new Error(`Too many decimal places for ${decimals} decimals.`);
  }
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(`${whole}${padded}`);
}

function formatBaseUnits(value, decimals) {
  if (decimals === 0) return value.toString();
  const negative = value < 0n;
  const raw = (negative ? -value : value).toString().padStart(decimals + 1, "0");
  const whole = raw.slice(0, -decimals) || "0";
  const fraction = decimals === 0 ? "" : raw.slice(-decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function renderHashSuite() {
  setWorkbench("transform");
  elements.toolPanel.innerHTML =
    panel(
      "Input",
      `<label class="field"><span>Text</span><textarea id="hashInput" class="mono">hello linsea</textarea></label>
      <div class="toolbar">
        <select id="hashMode">
          <option value="sha-256">SHA-256</option>
          <option value="sha-1">SHA-1</option>
          <option value="keccak-256">Keccak256</option>
          <option value="base64-encode">Base64 encode</option>
          <option value="base64-decode">Base64 decode</option>
          <option value="url-encode">URL encode</option>
          <option value="url-decode">URL decode</option>
        </select>
        <button id="runHash" class="primary-button" type="button">Run</button>
      </div>
      <div class="notice warn">MD5 is intentionally disabled in this build. Use SHA-256 or Keccak256 for modern workflows.</div>`,
    ) + panel("Output", `<div id="hashOutput"></div>`);
  $("#runHash").addEventListener("click", updateHashSuite);
  $("#hashInput").addEventListener("input", debounce(updateHashSuite, 160));
  $("#hashMode").addEventListener("change", updateHashSuite);
  updateHashSuite();
}

async function updateHashSuite() {
  const input = $("#hashInput").value;
  const mode = $("#hashMode").value;
  const out = $("#hashOutput");
  try {
    let value = "";
    if (mode === "sha-256" || mode === "sha-1") value = await digestText(mode.toUpperCase(), input);
    if (mode === "keccak-256") value = keccak256Hex(new TextEncoder().encode(input));
    if (mode === "base64-encode") value = btoa(unescape(encodeURIComponent(input)));
    if (mode === "base64-decode") value = decodeURIComponent(escape(atob(input)));
    if (mode === "url-encode") value = encodeURIComponent(input);
    if (mode === "url-decode") value = decodeURIComponent(input);
    out.innerHTML = resultRows([["Result", value], ["Length", value.length]]);
    bindCopyButtons(out);
  } catch (error) {
    out.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`;
  }
}

async function digestText(algorithm, text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest(algorithm, bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const MASK_64 = (1n << 64n) - 1n;
const KECCAK_ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const KECCAK_ROTATION = [
  [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56], [27, 20, 39, 8, 14],
];

function rotate64(value, shift) {
  const bits = BigInt(shift % 64);
  if (bits === 0n) return value & MASK_64;
  return ((value << bits) | (value >> (64n - bits))) & MASK_64;
}

function keccakF(state) {
  for (const rc of KECCAK_ROUND_CONSTANTS) {
    const c = new Array(5).fill(0n);
    const d = new Array(5).fill(0n);
    for (let x = 0; x < 5; x += 1) c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    for (let x = 0; x < 5; x += 1) d[x] = c[(x + 4) % 5] ^ rotate64(c[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) state[x + 5 * y] = (state[x + 5 * y] ^ d[x]) & MASK_64;
    const b = new Array(25).fill(0n);
    for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotate64(state[x + 5 * y], KECCAK_ROTATION[x][y]);
    for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) state[x + 5 * y] = (b[x + 5 * y] ^ ((~b[((x + 1) % 5) + 5 * y] & MASK_64) & b[((x + 2) % 5) + 5 * y])) & MASK_64;
    state[0] = (state[0] ^ rc) & MASK_64;
  }
}

function keccak256Hex(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const rate = 136;
  const state = new Array(25).fill(0n);
  const padded = Array.from(bytes);
  padded.push(0x01);
  while (padded.length % rate !== rate - 1) padded.push(0);
  padded.push(0x80);
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let i = 0; i < rate; i += 1) state[Math.floor(i / 8)] ^= BigInt(padded[offset + i]) << BigInt((i % 8) * 8);
    keccakF(state);
  }
  const out = [];
  for (let i = 0; i < 32; i += 1) out.push(Number((state[Math.floor(i / 8)] >> BigInt((i % 8) * 8)) & 0xffn));
  return out.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  return bytes;
}

function normalizeAbiWord(value) {
  const input = value.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(input)) return input.slice(2).toLowerCase().padStart(64, "0");
  if (/^0x[a-fA-F0-9]{64}$/.test(input)) return input.slice(2).toLowerCase();
  if (/^\d+$/.test(input)) return BigInt(input).toString(16).padStart(64, "0");
  if (/^0x[a-fA-F0-9]+$/.test(input) && input.length <= 66) return input.slice(2).toLowerCase().padStart(64, "0");
  throw new Error("Mapping key must be an address, uint, or bytes32 hex value.");
}

function mappingSlot(key, slotHex) {
  const keyWord = normalizeAbiWord(key);
  const slotWord = slotHex.replace(/^0x/, "").padStart(64, "0");
  const bytes = hexToBytes(`${keyWord}${slotWord}`);
  return `0x${keccak256Hex(bytes)}`;
}

function renderJwtInspector() {
  setWorkbench("token");
  elements.toolPanel.innerHTML =
    panel("Input", `<label class="field"><span>JWT token</span><textarea id="jwtInput" class="mono" placeholder="eyJhbGci..."></textarea></label>`) +
    panel("Decoded", `<div id="jwtOutput"></div>`);
  $("#jwtInput").addEventListener("input", debounce(updateJwt, 120));
  updateJwt();
}

function updateJwt() {
  const token = $("#jwtInput").value.trim();
  const out = $("#jwtOutput");
  if (!token) { out.innerHTML = `<div class="notice">Paste a JWT to decode header and payload locally.</div>`; return; }
  try {
    const parts = token.split(".");
    if (parts.length < 2) throw new Error("JWT must contain at least header and payload.");
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    const exp = typeof payload.exp === "number" ? payload.exp : null;
    const status = exp ? (exp < now ? "Expired" : `Valid for ${formatDuration(exp - now)}`) : "No exp claim";
    out.innerHTML = resultRows([["Algorithm", header.alg || "unknown"], ["Status", status], ["Expires at", exp ? new Date(exp * 1000).toISOString() : "n/a"]]) +
      `<pre class="notice mono">${escapeHtml(JSON.stringify({ header, payload }, null, 2))}</pre>`;
    bindCopyButtons(out);
  } catch (error) { out.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`; }
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return decodeURIComponent(escape(atob(normalized)));
}

function formatDuration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function renderJsonStudio() {
  setWorkbench("editor");
  elements.toolPanel.innerHTML =
    panel("Input", `<label class="field"><span>JSON</span><textarea id="jsonInput" class="mono">{"name":"Linsea","tools":18,"privacy":true}</textarea></label>
      <div class="toolbar"><button id="jsonFormat" class="primary-button" type="button">Format</button><button id="jsonMinify" class="ghost-button" type="button">Minify</button><button id="jsonTypes" class="ghost-button" type="button">TypeScript</button></div>`) +
    panel("Output", `<div id="jsonOutput"></div>`);
  $("#jsonFormat").addEventListener("click", () => updateJson("format"));
  $("#jsonMinify").addEventListener("click", () => updateJson("minify"));
  $("#jsonTypes").addEventListener("click", () => updateJson("types"));
  updateJson("format");
}

function updateJson(mode) {
  const out = $("#jsonOutput");
  try {
    const parsed = JSON.parse($("#jsonInput").value);
    const value = mode === "minify" ? JSON.stringify(parsed) : mode === "types" ? inferTypeScript("Root", parsed) : JSON.stringify(parsed, null, 2);
    out.innerHTML = `<pre class="notice mono">${escapeHtml(value)}</pre>${copyButton(value)}`;
    bindCopyButtons(out);
  } catch (error) { out.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`; }
}

function inferTypeScript(name, value) {
  if (Array.isArray(value)) return `type ${name} = ${inferValue(value[0]) || "unknown"}[];`;
  if (!value || typeof value !== "object") return `type ${name} = ${inferValue(value)};`;
  const lines = Object.entries(value).map(([key, item]) => `  ${safeKey(key)}: ${inferValue(item)};`);
  return `interface ${name} {\n${lines.join("\n")}\n}`;
}

function inferValue(value) {
  if (Array.isArray(value)) return `${inferValue(value[0]) || "unknown"}[]`;
  if (value === null) return "null";
  if (typeof value === "object") return "{ " + Object.entries(value).map(([key, item]) => `${safeKey(key)}: ${inferValue(item)}`).join("; ") + " }";
  return typeof value;
}

function safeKey(key) { return /^[a-zA-Z_$][\w$]*$/.test(key) ? key : JSON.stringify(key); }

function renderTimestamp() {
  setWorkbench("time");
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];
  const zoneOptions = ["UTC", ...zones.filter((zone) => zone !== "UTC")].map((zone) => `<option value="${zone}"></option>`).join("");
  elements.toolPanel.innerHTML =
    panel("Input", `<div class="timestamp-form">
        <label class="field timestamp-mode"><span>Conversion</span><select id="timeMode"><option value="timestamp">Timestamp -> date</option><option value="datetime">Date -> timestamp</option></select></label>
        <div class="input-grid timestamp-fields">
          <label id="timeInputWrap" class="field"><span>Timestamp (seconds or milliseconds)</span><input id="timeInput" class="mono" value="${Math.floor(Date.now() / 1000)}" /></label>
          <label id="timeDateWrap" class="field hidden"><span>Date and time</span><input id="timeDate" type="datetime-local" /></label>
          <label class="field"><span>Timezone</span><input id="timeZone" class="mono" list="timeZoneOptions" value="UTC" placeholder="Type UTC, Shanghai, New_York..." /><datalist id="timeZoneOptions">${zoneOptions}</datalist></label>
        </div></div>`) +
    panel("Output", `<div id="timeOutput"></div>`);
  $("#timeInput").addEventListener("input", updateTimestamp);
  $("#timeDate").addEventListener("input", updateTimestamp);
  $("#timeMode").addEventListener("change", updateTimestamp);
  $("#timeZone").addEventListener("input", debounce(updateTimestamp, 120));
  syncTimestampMode();
  updateTimestamp();
}

function updateTimestamp() {
  const mode = $("#timeMode").value;
  const input = $("#timeInput").value.trim();
  const tz = $("#timeZone").value;
  const out = $("#timeOutput");
  try {
    syncTimestampMode();
    if (!isValidTimeZone(tz)) throw new Error("Choose a valid IANA timezone from the suggestions.");
    const date = mode === "timestamp" ? timestampToDate(input) : zonedDateTimeToDate($("#timeDate").value, tz);
    if (Number.isNaN(date.getTime())) throw new Error("Enter a Unix timestamp or parseable date.");
    out.innerHTML = resultRows([["Unix seconds", Math.floor(date.getTime() / 1000)], ["Unix milliseconds", date.getTime()], ["ISO", date.toISOString()],
      [tz, new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "long", timeZone: tz }).format(date)]]);
    bindCopyButtons(out);
  } catch (error) { out.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`; }
}

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function syncTimestampMode() {
  const isTimestamp = $("#timeMode").value === "timestamp";
  $("#timeInputWrap").classList.toggle("hidden", !isTimestamp);
  $("#timeDateWrap").classList.toggle("hidden", isTimestamp);
}

function timestampToDate(value) {
  if (!/^-?\d+$/.test(value)) throw new Error("Enter seconds or milliseconds as an integer.");
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric)) throw new Error("Timestamp is outside the supported integer range.");
  return new Date(Math.abs(numeric) >= 100_000_000_000 ? numeric : numeric * 1000);
}

function zonedDateTimeToDate(value, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Choose a date and time.");
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = timeZoneOffset(timeZone, new Date(naiveUtc));
  const corrected = new Date(naiveUtc - firstOffset);
  return new Date(naiveUtc - timeZoneOffset(timeZone, corrected));
}

function timeZoneOffset(timeZone, date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) - date.getTime();
}

function renderTextCompare() {
  setWorkbench("compare");
  elements.toolPanel.classList.add("tool-panel-wide");
  elements.toolPanel.innerHTML =
    panel("Versions", `<div class="text-compare-inputs">
        <label class="field"><span>Original text</span><textarea id="diffLeft" class="mono" placeholder="Paste the original version"></textarea></label>
        <label class="field"><span>Changed text</span><textarea id="diffRight" class="mono" placeholder="Paste the changed version"></textarea></label>
      </div><div class="toolbar"><button id="runDiff" class="primary-button" type="button">Compare text</button></div>`) +
    panel("Review", `<div id="diffOutput"><div class="notice">Paste two versions to inspect additions, removals, and unchanged lines.</div></div>`);
  $("#runDiff").addEventListener("click", updateTextCompare);
}

function updateTextCompare() {
  const left = $("#diffLeft").value.replace(/\r\n/g, "\n").split("\n");
  const right = $("#diffRight").value.replace(/\r\n/g, "\n").split("\n");
  if (left.length > 450 || right.length > 450) { $("#diffOutput").innerHTML = `<div class="notice danger">For this local preview, compare up to 450 lines per side.</div>`; return; }
  const rows = lineDiff(left, right);
  const added = rows.filter((row) => row.type === "add").length;
  const removed = rows.filter((row) => row.type === "remove").length;
  $("#diffOutput").innerHTML = resultRows([["Unchanged lines", rows.filter((row) => row.type === "same").length], ["Added lines", added], ["Removed lines", removed]]) +
    `<pre class="notice mono diff-view">${rows.map((row) => `<span class="diff-${row.type}">${escapeHtml(`${row.type === "add" ? "+" : row.type === "remove" ? "-" : " "} ${row.text}`)}</span>`).join("\n")}</pre>`;
}

function lineDiff(left, right) {
  const matrix = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i -= 1) for (let j = right.length - 1; j >= 0; j -= 1) matrix[i][j] = left[i] === right[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
  const rows = []; let i = 0; let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { rows.push({ type: "same", text: left[i] }); i += 1; j += 1; }
    else if (matrix[i + 1][j] >= matrix[i][j + 1]) { rows.push({ type: "remove", text: left[i++] }); }
    else { rows.push({ type: "add", text: right[j++] }); }
  }
  while (i < left.length) rows.push({ type: "remove", text: left[i++] });
  while (j < right.length) rows.push({ type: "add", text: right[j++] });
  return rows;
}

function renderCardTester() {
  setWorkbench("risk");
  elements.toolPanel.innerHTML =
    panel("Compliance", `<div class="notice warn">Sandbox and QA use only. This tool validates number format and can generate non-real test numbers from a supplied test BIN.</div>`) +
    panel("Input", `<div class="input-grid">
        <label class="field"><span>Card number</span><input id="cardInput" class="mono" value="4242424242424242" /></label>
        <label class="field"><span>Sandbox BIN</span><input id="binInput" class="mono" value="424242" maxlength="12" /></label>
      </div><div class="toolbar"><button id="generateCard" class="primary-button" type="button">Generate sandbox number</button></div>`) +
    panel("Output", `<div id="cardOutput"></div>`);
  $("#cardInput").addEventListener("input", updateCard);
  $("#generateCard").addEventListener("click", generateCard);
  updateCard();
}

function updateCard() {
  const number = $("#cardInput").value.replace(/\D/g, "");
  const network = detectCardNetwork(number);
  const valid = number.length >= 12 && luhnCheck(number);
  const out = $("#cardOutput");
  out.innerHTML = resultRows([["Normalized", number || "n/a"], ["Network", network], ["Luhn", valid ? "Valid" : "Invalid"], ["Length", number.length]]);
  bindCopyButtons(out);
}

function generateCard() {
  const prefix = $("#binInput").value.replace(/\D/g, "").slice(0, 12);
  const length = prefix.startsWith("34") || prefix.startsWith("37") ? 15 : 16;
  let body = prefix;
  while (body.length < length - 1) body += Math.floor(Math.random() * 10);
  for (let digit = 0; digit <= 9; digit += 1) { const candidate = `${body}${digit}`; if (luhnCheck(candidate)) { $("#cardInput").value = candidate; updateCard(); return; } }
}

function luhnCheck(number) {
  let sum = 0; let doubleDigit = false;
  for (let index = number.length - 1; index >= 0; index -= 1) { let digit = Number(number[index]); if (doubleDigit) { digit *= 2; if (digit > 9) digit -= 9; } sum += digit; doubleDigit = !doubleDigit; }
  return sum % 10 === 0;
}

function detectCardNetwork(number) {
  if (/^4/.test(number)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(number)) return "Mastercard";
  if (/^3[47]/.test(number)) return "American Express";
  if (/^6(?:011|5)/.test(number)) return "Discover";
  if (/^35/.test(number)) return "JCB";
  if (/^62/.test(number)) return "UnionPay";
  return "Unknown";
}

function renderStorageSlot() {
  setWorkbench("chain");
  elements.toolPanel.innerHTML =
    panel("Storage workbench", `<div class="storage-mode-switch" role="tablist" aria-label="Storage mode">
        <button class="storage-mode-button active" data-storage-mode="raw" type="button">Raw slot read</button>
        <button class="storage-mode-button" data-storage-mode="mapping" type="button">Mapping probe</button>
      </div>
      <div class="input-grid storage-common-fields">
        <label class="field"><span>Contract address</span><input id="slotContract" class="mono" placeholder="0x..." /></label>
        <label class="field"><span>Block tag</span><input id="slotBlock" class="mono" value="latest" /></label>
      </div>
      <div id="rawSlotFields" class="storage-mode-panel">
        <div class="input-grid">
          <label class="field"><span>Slot index</span><input id="rawSlotIndex" class="mono" placeholder="23 or 0x17" /></label>
          <label class="field"><span>Decode focus</span><select id="rawDecodeType">
            <option value="bytes32">bytes32</option>
            <option value="bool">bool</option>
            <option value="uint256">uint256</option>
            <option value="int256">int256</option>
            <option value="address">address</option>
          </select></label>
        </div>
        <div class="notice">Use this for the exact workflow: contract address + slot index -> <code>eth_getStorageAt</code>. For example, slot <code>23</code> is read directly as slot <code>0x17</code>, not as a mapping base slot.</div>
      </div>
      <div id="mappingSlotFields" class="storage-mode-panel hidden">
        <div class="input-grid">
          <label class="field"><span>Mapping declaration</span><input id="slotDeclaration" class="mono" placeholder="mapping(uint256 => bool) public flags;" /></label>
          <label class="field"><span>Mapping key</span><input id="slotKey" class="mono" placeholder="20666, 0xabc..., or bytes32" /></label>
          <label class="field"><span>Known base slot</span><input id="slotBaseIndex" class="mono" placeholder="optional: 3 or 0x03" /></label>
          <label class="field"><span>Scan candidate base slots</span><input id="slotScanLimit" class="mono" value="80" /></label>
          <label class="field"><span>Scan filter</span><select id="slotExpected"><option value="nonzero">non-zero / bool true</option><option value="any">return every scanned value</option></select></label>
        </div>
        <div class="notice warn">Solidity variable names are not stored on-chain. Without source/storageLayout, a blank base slot can only scan candidates and report evidence. A false/zero mapping value cannot prove the base slot, because empty storage is also zero.</div>
      </div>
      <div class="toolbar"><button id="readStorage" class="primary-button" type="button">Read storage</button></div>`) +
    panel("Readout", `<div id="slotOutput"></div>`);
  document.querySelectorAll("[data-storage-mode]").forEach((button) => button.addEventListener("click", () => setStorageMode(button.dataset.storageMode)));
  ["#rawSlotIndex", "#rawDecodeType", "#slotDeclaration", "#slotKey", "#slotBaseIndex", "#slotScanLimit", "#slotExpected", "#slotBlock"].forEach((s) => $(s).addEventListener("input", updateStorageSlot));
  ["#rawDecodeType", "#slotExpected"].forEach((s) => $(s).addEventListener("change", updateStorageSlot));
  $("#readStorage").addEventListener("click", readStorageSlot);
  updateStorageSlot();
}

function renderSourceLayoutResolver() {
  setWorkbench("chain");
  elements.toolPanel.innerHTML =
    panel("Source layout", `<div class="storage-mode-switch" role="tablist" aria-label="Source mode">
        <button class="storage-mode-button active" data-source-mode="verified" type="button">Paste verified source</button>
        <button class="storage-mode-button" data-source-mode="decompiled" type="button">Paste decompiled</button>
      </div>
      <div class="input-grid storage-common-fields">
        <label class="field"><span>Target name</span><input id="sourceTargetName" class="mono" placeholder="totalSupply, _feeWhiteList, owner" /></label>
        <label class="field"><span>Contract name (optional)</span><input id="sourceContractName" class="mono" placeholder="auto: most-derived contract" /></label>
        <label class="field"><span>Mapping key (optional)</span><input id="sourceTargetKey" class="mono" placeholder="only for mapping values" /></label>
      </div>
      <label class="field"><span id="sourceInputLabel">Verified source</span><textarea id="sourceInput" class="mono" placeholder="Paste verified Solidity source here."></textarea></label>
      <div class="notice">This page resolves a variable or getter name into a slot. Verified source is exact; decompiled source is best-effort. It does not read chain data. Use Storage Slot Inspector afterward to read the slot value.</div>`) +
    panel("Readout", `<div id="sourceOutput"></div>`);
  document.querySelectorAll("[data-source-mode]").forEach((button) => button.addEventListener("click", () => setSourceMode(button.dataset.sourceMode)));
  ["#sourceInput", "#sourceTargetName", "#sourceContractName", "#sourceTargetKey"].forEach((selector) => $(selector).addEventListener("input", updateSourceLayoutResolver));
  updateSourceLayoutResolver();
}

function setSourceMode(mode) {
  document.querySelectorAll("[data-source-mode]").forEach((button) => button.classList.toggle("active", button.dataset.sourceMode === mode));
  $("#sourceInputLabel").textContent = mode === "verified" ? "Verified source" : "Decompiled source";
  $("#sourceInput").placeholder = mode === "verified"
    ? "Paste verified Solidity source here."
    : "Paste Dedaub decompiled source here.";
  updateSourceLayoutResolver();
}

function currentSourceMode() {
  return document.querySelector("[data-source-mode].active")?.dataset.sourceMode || "verified";
}

function updateSourceLayoutResolver() {
  const out = $("#sourceOutput");
  const source = $("#sourceInput").value.trim();
  if (!source) {
    out.innerHTML = `<div class="notice">Paste source or decompiled output to resolve storage slots.</div>`;
    return;
  }
  try {
    const layout = resolveSourceLayoutText(currentSourceMode(), source, $("#sourceContractName").value.trim());
    const report = resolveStorageName(layout, $("#sourceTargetName").value.trim(), $("#sourceTargetKey").value.trim());
    out.innerHTML = report.html;
    bindCopyButtons(out);
  } catch (error) {
    out.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`;
  }
}

function setStorageMode(mode) {
  document.querySelectorAll("[data-storage-mode]").forEach((button) => button.classList.toggle("active", button.dataset.storageMode === mode));
  $("#rawSlotFields").classList.toggle("hidden", mode !== "raw");
  $("#mappingSlotFields").classList.toggle("hidden", mode !== "mapping");
  updateStorageSlot();
}

function currentStorageMode() {
  return document.querySelector("[data-storage-mode].active")?.dataset.storageMode || "raw";
}

function updateStorageSlot() {
  const out = $("#slotOutput");
  try {
    const mode = currentStorageMode();
    if (mode === "raw") {
      const slot = $("#rawSlotIndex").value.trim();
      if (!slot) {
        out.innerHTML = `<div class="notice">Enter a contract address and a slot index to read the exact 32-byte storage word.</div>`;
        return;
      }
      const query = rawSlotQuery(slot);
      out.innerHTML = storageRawSummary(query) + resultRows([
        ["Mode", "Direct eth_getStorageAt"],
        ["Slot index", query.indexText],
        ["Slot hex", query.storageSlot],
        ["Decode focus", $("#rawDecodeType").value],
      ]);
      bindCopyButtons(out);
      return;
    }
    if (mode === "mapping") {
      const declaration = $("#slotDeclaration").value.trim();
      const key = $("#slotKey").value.trim();
      const baseSlot = $("#slotBaseIndex").value.trim();
      if (!declaration) {
        out.innerHTML = `<div class="notice">Enter a mapping declaration such as <code>mapping(uint256 => bool) public flags;</code>. The name is only documentation; key/value types drive the calculation.</div>`;
        return;
      }
      const layout = parseStorageDeclaration(declaration);
      if (layout.kind !== "mapping") throw new Error("Mapping probe needs a mapping(...) declaration.");
      const rows = storagePlanRows(layout, baseSlot, key);
      out.innerHTML = storageLayoutSummary(layout) + resultRows(rows);
      bindCopyButtons(out);
      return;
    }
    throw new Error("Unsupported storage mode.");
  } catch (error) { out.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`; }
}

async function readStorageSlot() {
  const contract = $("#slotContract").value.trim();
  const blockTag = $("#slotBlock").value.trim() || "latest";
  const out = $("#slotOutput");
  if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) { out.innerHTML = `<div class="notice danger">Enter a valid 20-byte contract address.</div>`; return; }
  if (!/^(latest|earliest|pending|safe|finalized|0x[a-fA-F0-9]+)$/i.test(blockTag)) { out.innerHTML = `<div class="notice danger">Use a block tag such as latest, safe, finalized, or a hexadecimal block number.</div>`; return; }
  if (settings.privacyMode) { out.innerHTML = `<div class="notice warn">Privacy First Mode is active. Turn it off in Settings to allow this read-only RPC request.</div>`; return; }
  const endpoint = rpcEndpoint();
  if (!endpoint) { out.innerHTML = `<div class="notice">Add an Alchemy or Infura API key in Settings before reading contract storage.</div>`; return; }
  try {
    const mode = currentStorageMode();
    if (mode === "raw") {
      const query = rawSlotQuery($("#rawSlotIndex").value.trim());
      out.innerHTML = `<div class="notice">Reading slot <code>${escapeHtml(query.storageSlot)}</code>...</div>`;
      const rawValue = await rpcRequest(endpoint, "eth_getStorageAt", [contract, query.storageSlot, blockTag]);
      out.innerHTML = rawStorageReadView(query, rawValue, $("#rawDecodeType").value, [["Contract", contract], ["Block tag", blockTag]]);
      bindCopyButtons(out);
      return;
    }
    if (mode === "mapping") {
      const declaration = $("#slotDeclaration").value.trim();
      if (!declaration) throw new Error("Enter a mapping declaration before probing.");
      const layout = parseStorageDeclaration(declaration);
      if (layout.kind !== "mapping") throw new Error("Mapping probe needs a mapping(...) declaration.");
      const key = $("#slotKey").value.trim();
      const baseSlot = $("#slotBaseIndex").value.trim();
      if (!baseSlot) {
        await scanMappingBaseSlots(endpoint, contract, layout, key, blockTag, out);
        return;
      }
      const query = storageQueryFromLayout(layout, baseSlot, key);
      out.innerHTML = `<div class="notice">Reading mapping value slot <code>${escapeHtml(query.storageSlot)}</code>...</div>`;
      const rawValue = await rpcRequest(endpoint, "eth_getStorageAt", [contract, query.storageSlot, blockTag]);
      out.innerHTML = storageReadView(layout, query, rawValue, [["Contract", contract], ["Block tag", blockTag]]);
      bindCopyButtons(out);
      return;
    }
    throw new Error("Unsupported storage mode.");
  } catch (error) { out.innerHTML = `<div class="notice danger">${escapeHtml(error.message || "Storage read failed.")}</div>`; }
}

function parseStorageDeclaration(input) {
  const text = input.trim().replace(/\s+/g, " ");
  const mapping = extractMappingDeclaration(text);
  if (mapping) {
    return mapping;
  }
  const simple = text.match(/^([A-Za-z0-9_\[\]]+)\s*(?:public|private|internal|external)?\s*([A-Za-z_$][\w$]*)?/i);
  if (simple) return { kind: "value", valueType: normalizeSolidityType(simple[1]), name: simple[2] || "value" };
  return { kind: "value", valueType: "bytes32", name: "raw" };
}

function resolveStorageLayoutSource(input) {
  const text = input.trim();
  const jsonLayout = tryParseStorageLayoutJson(text);
  if (jsonLayout) return jsonLayout;
  return parseSolidityStorageDeclarations(text);
}

function resolveSourceLayoutText(mode, input, contractName = "") {
  const text = input.trim();
  const jsonLayout = tryParseStorageLayoutJson(text);
  if (jsonLayout) return jsonLayout;
  const layout = parseSolidityStorageDeclarations(text, contractName);
  return {
    ...layout,
    sourceType: mode === "decompiled" ? "decompiled source" : "verified source",
  };
}

function tryParseStorageLayoutJson(text) {
  try {
    const payload = JSON.parse(text);
    if (!payload || !Array.isArray(payload.storage)) return null;
    const types = payload.types || {};
    const entries = payload.storage
      .map((entry) => {
        const typeInfo = describeStorageLayoutType(types[entry.type], entry.type);
        const kindInfo = classifyStorageLayoutType(typeInfo.label);
        return {
          name: entry.label || "slot",
          kind: kindInfo.kind,
          type: typeInfo.label,
          keyType: kindInfo.keyType,
          valueType: kindInfo.valueType || typeInfo.label,
          slot: BigInt(entry.slot || "0"),
          offset: Number(entry.offset || 0),
          slotSpan: kindInfo.slotSpan,
          constant: false,
          immutable: false,
          source: "storageLayout",
          note: kindInfo.note || typeInfo.encoding || "compiler layout",
        };
      })
      .sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : a.offset - b.offset));
    return { sourceType: "storageLayout", entries };
  } catch {
    return null;
  }
}

function splitMappingTypes(text) {
  const normalized = normalizeSolidityType(text);
  const start = normalized.match(/^mapping\((.*)\)$/i);
  if (!start) return null;
  const inner = start[1];
  let depth = 0;
  for (let index = 0; index < inner.length - 1; index += 1) {
    const char = inner[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(depth - 1, 0);
    else if (char === "=" && inner[index + 1] === ">" && depth === 0) {
      return [inner.slice(0, index), inner.slice(index + 2)];
    }
  }
  return null;
}

function extractMappingDeclaration(text) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ");
  if (!/^mapping\s*\(/i.test(normalized)) return null;
  const openIndex = normalized.indexOf("(");
  const closeIndex = findMatchingParenIndex(normalized, openIndex);
  if (closeIndex < 0) return null;
  const type = normalized.slice(0, closeIndex + 1);
  const mappingTypes = splitMappingTypes(type);
  if (!mappingTypes) return null;
  const tail = normalized.slice(closeIndex + 1).replace(/\s+(?:public|private|internal|external|constant|immutable|virtual|override|storage|memory|calldata|view|pure)\s*/gi, " ").trim();
  const namePart = tail.split("=")[0].trim();
  const nameTokens = namePart.split(/\s+/).filter(Boolean);
  const name = nameTokens[nameTokens.length - 1] || "mapping";
  return { kind: "mapping", keyType: normalizeSolidityType(mappingTypes[0]), valueType: normalizeSolidityType(mappingTypes[1]), name };
}

function findMatchingParenIndex(text, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findMatchingBraceIndex(text, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function describeStorageLayoutType(typeInfo, fallbackLabel) {
  if (!typeInfo) return { label: fallbackLabel || "unknown", encoding: "unknown" };
  return {
    label: typeInfo.label || fallbackLabel || "unknown",
    encoding: typeInfo.encoding || "unknown",
  };
}

function classifyStorageLayoutType(typeLabel) {
  const normalized = normalizeSolidityType(typeLabel);
  const mappingTypes = splitMappingTypes(normalized);
  if (mappingTypes) {
    return {
      kind: "mapping",
      keyType: normalizeSolidityType(mappingTypes[0]),
      valueType: normalizeSolidityType(mappingTypes[1]),
      slotSpan: 1n,
      note: "mapping value lives at keccak256(abi.encode(key, baseSlot))",
    };
  }
  if (/^(bytes|string)$/i.test(normalized)) {
    return { kind: "dynamic", slotSpan: 1n, note: "length/pointer slot; data is stored separately" };
  }
  if (/^\w+\[\]$/.test(normalized)) {
    return { kind: "dynamic-array", slotSpan: 1n, note: "array length is in the slot; elements start at keccak256(slot)" };
  }
  const fixedArray = normalized.match(/^(.+?)\[(\d+)\]$/);
  if (fixedArray) {
    const element = classifyStorageLayoutType(fixedArray[1]);
    const length = BigInt(fixedArray[2]);
    let slotSpan = length;
    if (element.kind === "static" && typeof element.sizeBytes === "number") {
      const totalBytes = element.sizeBytes * Number(length);
      slotSpan = BigInt(Math.ceil(totalBytes / 32));
    } else if (element.slotSpan && element.slotSpan > 0n) {
      slotSpan = element.slotSpan * length;
    }
    return {
      kind: "fixed-array",
      slotSpan,
      note: `fixed array of ${fixedArray[2]} element(s)`,
    };
  }
  const sizeBytes = storageValueSizeBytes(normalized);
  if (sizeBytes !== null) {
    return {
      kind: "static",
      sizeBytes,
      slotSpan: sizeBytes === 32 ? 1n : 0n,
      note: sizeBytes < 32 ? `packed in ${sizeBytes} byte(s)` : "full 32-byte slot",
    };
  }
  return { kind: "complex", slotSpan: 1n, note: "complex type; use storageLayout JSON for exact nested layout" };
}

function parseSolidityStorageDeclarations(text, requestedContract = "") {
  const clean = stripSolidityComments(text);
  const contracts = parseSolidityContracts(clean);
  if (contracts.length) {
    return parseContractStorageDeclarations(contracts, requestedContract);
  }
  const statements = splitTopLevelStatements(clean);
  return buildStorageLayoutFromStatements(statements, "declarations");
}

function parseSolidityContracts(clean) {
  const contracts = [];
  const matcher = /\b(?:abstract\s+)?(contract|interface|library)\s+([A-Za-z_$][\w$]*)\s*([^{};]*)\{/gi;
  let match;
  while ((match = matcher.exec(clean))) {
    const openIndex = matcher.lastIndex - 1;
    const closeIndex = findMatchingBraceIndex(clean, openIndex);
    if (closeIndex < 0) continue;
    const header = match[3] || "";
    const body = clean.slice(openIndex + 1, closeIndex);
    contracts.push({
      kind: match[1].toLowerCase(),
      name: match[2],
      bases: parseBaseContracts(header),
      body,
      statements: splitTopLevelStatements(body),
      order: contracts.length,
    });
    matcher.lastIndex = closeIndex + 1;
  }
  return contracts;
}

function parseBaseContracts(header) {
  const inheritance = header.match(/\bis\s+([\s\S]+)$/i);
  if (!inheritance) return [];
  return splitTopLevelComma(inheritance[1])
    .map((item) => item.trim().match(/^([A-Za-z_$][\w$]*)/)?.[1])
    .filter(Boolean);
}

function splitTopLevelComma(text) {
  const parts = [];
  let start = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(parenDepth - 1, 0);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(bracketDepth - 1, 0);
    else if (char === "," && parenDepth === 0 && bracketDepth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function splitTopLevelStatements(body) {
  const statements = [];
  let current = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(parenDepth - 1, 0);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(bracketDepth - 1, 0);

    if (char === "{" && parenDepth === 0 && bracketDepth === 0) {
      const closeIndex = findMatchingBraceIndex(body, index);
      if (closeIndex < 0) break;
      current = "";
      index = closeIndex;
      continue;
    }
    if (char === ";" && parenDepth === 0 && bracketDepth === 0) {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }
    current += char;
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function parseContractStorageDeclarations(contracts, requestedContract = "") {
  const contractMap = new Map(contracts.map((contract) => [contract.name, contract]));
  const selected = selectStorageContract(contracts, requestedContract);
  if (!selected) {
    const available = contracts.map((contract) => contract.name).join(", ");
    throw new Error(`Contract "${requestedContract}" was not found. Available contracts: ${available || "none"}.`);
  }
  const inheritedNames = new Set(contracts.flatMap((contract) => contract.bases));
  const leafContracts = contracts.filter((contract) => contract.kind === "contract" && !inheritedNames.has(contract.name));
  const orderedStatements = collectInheritedStorageStatements(selected, contractMap, new Set());
  const layout = buildStorageLayoutFromStatements(orderedStatements, selected.name);
  return {
    ...layout,
    contractName: selected.name,
    selectionNote: requestedContract.trim()
      ? `requested contract: ${selected.name}`
      : leafContracts.length > 1
        ? `auto-selected ${selected.name}; candidates: ${leafContracts.map((contract) => contract.name).join(", ")}`
        : `auto-selected ${selected.name}`,
    availableContracts: contracts.map((contract) => contract.name),
  };
}

function selectStorageContract(contracts, requestedContract = "") {
  const requested = requestedContract.trim();
  if (requested) return contracts.find((contract) => contract.name === requested) || null;
  const inheritedNames = new Set(contracts.flatMap((contract) => contract.bases));
  const candidates = contracts.filter((contract) => contract.kind === "contract" && !inheritedNames.has(contract.name));
  return candidates[candidates.length - 1] || contracts.filter((contract) => contract.kind === "contract").at(-1) || contracts.at(-1) || null;
}

function collectInheritedStorageStatements(contract, contractMap, visiting) {
  if (visiting.has(contract.name)) return [];
  visiting.add(contract.name);
  const inherited = contract.bases.flatMap((baseName) => {
    const base = contractMap.get(baseName);
    return base ? collectInheritedStorageStatements(base, contractMap, visiting) : [];
  });
  visiting.delete(contract.name);
  return [...inherited, ...contract.statements];
}

function buildStorageLayoutFromStatements(statements, sourceLabel) {
  const entries = [];
  let cursorSlot = 0n;
  let cursorOffset = 0;
  for (const statement of statements) {
    const parsed = parseSolidityStorageStatement(statement);
    if (!parsed) continue;
    const layout = classifyStorageLayoutType(parsed.type);
    if (parsed.constant || parsed.immutable) {
      entries.push({
        ...parsed,
        ...layout,
        slot: null,
        offset: null,
        slotSpan: 0n,
        note: parsed.constant ? "constant: not stored on-chain" : "immutable: stored in bytecode, not storage",
        source: "declaration",
      });
      continue;
    }
    const slotPlacement = placeStorageEntry(cursorSlot, cursorOffset, layout);
    cursorSlot = slotPlacement.nextSlot;
    cursorOffset = slotPlacement.nextOffset;
    entries.push({
      ...parsed,
      ...layout,
      slot: slotPlacement.slot,
      offset: slotPlacement.offset,
      slotSpan: slotPlacement.span,
      source: "declaration",
    });
  }
  return { sourceType: sourceLabel, entries };
}

function stripSolidityComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
}

function parseSolidityStorageStatement(statement) {
  const text = statement.trim().replace(/\s+/g, " ");
  if (!text) return null;
  if (/^(function|constructor|fallback|receive|modifier|event|error|struct|enum|using|import|pragma|contract|interface|library|assembly)\b/i.test(text)) return null;
  const constant = /\bconstant\b/i.test(text);
  const immutable = /\bimmutable\b/i.test(text);
  const mapping = extractMappingDeclaration(text);
  if (mapping) return { name: mapping.name, type: `mapping(${mapping.keyType} => ${mapping.valueType})`, constant, immutable };
  const beforeInitializer = text.split("=")[0].trim();
  if (/[(){}]/.test(beforeInitializer)) return null;
  const nameMatch = beforeInitializer.match(/([A-Za-z_$][\w$]*)$/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  let prefix = beforeInitializer.slice(0, nameMatch.index).trim();
  prefix = prefix.replace(/\b(?:public|private|internal|external|constant|immutable|virtual|override|storage|memory|calldata|view|pure)\b/gi, " ").replace(/\s+/g, " ").trim();
  const type = prefix;
  if (!type) return null;
  if (/\b(?:return|if|else|for|while|do|emit|delete|new|require|assert|revert|unchecked)\b/i.test(type)) return null;
  if (/[+\-*/%!<>&|?:]/.test(type)) return null;
  return { name, type, constant, immutable };
}

function placeStorageEntry(cursorSlot, cursorOffset, layout) {
  if (layout.kind === "mapping" || layout.kind === "dynamic" || layout.kind === "dynamic-array" || layout.kind === "complex") {
    if (cursorOffset > 0) cursorSlot += 1n;
    return { slot: cursorSlot, offset: 0, nextSlot: cursorSlot + layout.slotSpan, nextOffset: 0, span: layout.slotSpan };
  }
  if (layout.kind === "fixed-array") {
    if (cursorOffset > 0) cursorSlot += 1n;
    return { slot: cursorSlot, offset: 0, nextSlot: cursorSlot + layout.slotSpan, nextOffset: 0, span: layout.slotSpan };
  }
  const sizeBytes = layout.sizeBytes || 32;
  if (cursorOffset + sizeBytes > 32) {
    cursorSlot += 1n;
    cursorOffset = 0;
  }
  const slot = cursorSlot;
  const offset = cursorOffset;
  const nextOffset = offset + sizeBytes;
  if (sizeBytes === 32 || nextOffset === 32) {
    return { slot, offset, nextSlot: slot + 1n, nextOffset: 0, span: 1n };
  }
  return { slot, offset, nextSlot: slot, nextOffset, span: 0n };
}

function storageValueSizeBytes(type) {
  const normalized = normalizeSolidityType(type);
  if (normalized === "bool") return 1;
  if (normalized === "address" || normalized === "addresspayable") return 20;
  const bytes = normalized.match(/^bytes(\d+)$/i);
  if (bytes) {
    const size = Number(bytes[1]);
    if (size >= 1 && size <= 32) return size;
    return null;
  }
  const integer = normalized.match(/^(u?int)(\d+)$/i);
  if (integer) {
    const bits = Number(integer[2]);
    if (!Number.isInteger(bits) || bits <= 0 || bits > 256 || bits % 8 !== 0) return null;
    return bits / 8;
  }
  if (normalized === "byte") return 1;
  if (/^(enum|uint|int)$/i.test(normalized)) return 32;
  return null;
}

function layoutSlotHex(slot) {
  return `0x${BigInt(slot || 0).toString(16).padStart(64, "0")}`;
}

function normalizeStorageTargetName(name) {
  return String(name || "").trim().replace(/\(\s*\)$/, "");
}

function storageLookupKey(name) {
  return normalizeStorageTargetName(name).replace(/^_+/, "").toLowerCase();
}

function findStorageEntryByName(entries, target) {
  const normalizedTarget = normalizeStorageTargetName(target);
  const exact = entries.find((item) => normalizeStorageTargetName(item.name) === normalizedTarget);
  if (exact) return { entry: exact, reason: "exact name match" };
  const aliasTarget = storageLookupKey(normalizedTarget);
  const aliasMatches = entries.filter((item) => storageLookupKey(item.name) === aliasTarget);
  if (aliasMatches.length === 1) return { entry: aliasMatches[0], reason: `getter alias match: ${normalizedTarget} -> ${aliasMatches[0].name}` };
  const scored = entries
    .map((entry) => ({ entry, distance: levenshtein(aliasTarget, storageLookupKey(entry.name)) }))
    .filter((item) => item.distance <= 2)
    .sort((a, b) => a.distance - b.distance);
  if (scored.length === 1 || (scored[0] && scored[1] && scored[0].distance < scored[1].distance)) {
    return { entry: scored[0].entry, reason: `fuzzy match: ${normalizedTarget} -> ${scored[0].entry.name}` };
  }
  return { entry: null, reason: "", suggestions: scored.slice(0, 4).map((item) => item.entry.name) };
}

function levenshtein(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function resolveStorageName(layout, targetName, targetKey = "") {
  const target = normalizeStorageTargetName(targetName);
  if (!layout?.entries?.length) throw new Error("No storage entries were parsed.");
  if (target) {
    const match = findStorageEntryByName(layout.entries, target);
    const entry = match.entry;
    if (!entry) {
      const suggestionText = match.suggestions?.length ? ` Possible match: ${match.suggestions.map((item) => `<code>${escapeHtml(item)}</code>`).join(", ")}.` : "";
      return {
        html: storageNameSummary(layout, target) + `<div class="notice warn">No name match for <code>${escapeHtml(target)}</code>.${suggestionText}</div>` + storageLayoutEntryList(layout.entries, target),
        layout,
        entry: null,
        readableSlot: "",
      };
    }
    const viewLayout = entryViewLayout(entry);
    const rows = [
      ["Target", entry.name],
      ["Match", match.reason],
      ["Type", entry.type],
      ["Status", entry.constant ? "Constant" : entry.immutable ? "Immutable" : "Stored"],
      ["Slot number", entry.slot === null ? "not stored on-chain" : `#${entry.slot.toString()}`],
      ["Slot hex", entry.slot === null ? "not stored on-chain" : layoutSlotHex(entry.slot)],
      ["Byte offset", entry.offset === null ? "n/a" : `${entry.offset}`],
      ["Storage form", entry.note || "n/a"],
    ];
    if (entry.kind === "mapping") {
      rows.push(["Value formula", "keccak256(abi.encode(key, base slot))"]);
      rows.push(["Base slot number", entry.slot === null ? "n/a" : `#${entry.slot.toString()}`]);
      rows.push(["Base slot hex", entry.slot === null ? "n/a" : layoutSlotHex(entry.slot)]);
      if (targetKey) {
        const valueSlot = mappingSlotByType(targetKey, entry.keyType, layoutSlotHex(entry.slot));
        rows.push(["Mapping key", targetKey]);
        rows.push(["Value slot", valueSlot]);
      return {
        html: storageResolutionHero(entry, match.reason, targetKey, valueSlot) + storageNameSummary(layout, target) + resultRows(rows),
        layout,
        entry,
        viewLayout,
        query: { baseSlotHex: layoutSlotHex(entry.slot), storageSlot: valueSlot, formula: `keccak256(abi.encode(${entry.keyType} key, baseSlot))` },
        readableSlot: valueSlot,
      };
      }
      return {
        html: storageResolutionHero(entry, match.reason, "") + storageNameSummary(layout, target) + resultRows(rows),
        layout,
        entry,
        viewLayout,
        query: { baseSlotHex: layoutSlotHex(entry.slot), storageSlot: layoutSlotHex(entry.slot), formula: "mapping base slot; value needs a key" },
        readableSlot: "",
      };
    } else if (entry.constant || entry.immutable) {
      rows.push(["Readability", "No storage slot exists"]);
      return {
        html: storageResolutionHero(entry, match.reason, "") + storageNameSummary(layout, target) + resultRows(rows),
        layout,
        entry,
        viewLayout,
        readableSlot: "",
      };
    }
    const readableSlot = entry.slot === null ? "" : layoutSlotHex(entry.slot);
    return {
      html: storageResolutionHero(entry, match.reason, "") + storageNameSummary(layout, target) + resultRows(rows),
      layout,
      entry,
      viewLayout,
      query: entry.slot === null ? null : { baseSlotHex: layoutSlotHex(entry.slot), storageSlot: readableSlot, formula: entry.kind === "mapping" ? `keccak256(abi.encode(${entry.keyType} key, baseSlot))` : "direct slot read" },
      readableSlot,
    };
  }
  return {
    html: storageNameSummary(layout, "") + `<div class="notice">Type a target name to resolve one slot, or use the list below to inspect the whole layout.</div>` + storageLayoutEntryList(layout.entries, ""),
    layout,
    entry: null,
    viewLayout: null,
    readableSlot: "",
  };
}

function storageResolutionHero(entry, matchReason, targetKey = "", valueSlot = "") {
  if (entry.constant || entry.immutable || entry.slot === null) {
    return `<div class="slot-resolution">
      <div class="slot-resolution-primary">
        <span>Resolved result</span>
        <strong>No storage slot</strong>
        <small>${escapeHtml(entry.name)} is ${entry.constant ? "constant" : "immutable"} and is not stored in contract storage.</small>
      </div>
      <div class="slot-resolution-secondary">
        <span>Match</span>
        <strong>${escapeHtml(matchReason)}</strong>
        <small>Nothing to read with Raw slot read.</small>
      </div>
    </div>`;
  }
  if (entry.kind === "mapping") {
    const hasKey = Boolean(targetKey && valueSlot);
    return `<div class="slot-resolution">
      <div class="slot-resolution-primary">
        <span>${hasKey ? "Mapping value slot" : "Mapping base slot"}</span>
        <strong>${hasKey ? "Value slot ready" : `Base slot #${entry.slot.toString()}`}</strong>
        <small>${hasKey ? escapeHtml(valueSlot) : `Use base slot ${entry.slot.toString()} with a mapping key to calculate the value slot.`}</small>
      </div>
      <div class="slot-resolution-secondary">
        <span>Variable</span>
        <strong>${escapeHtml(entry.name)}</strong>
        <small>type: mapping(${escapeHtml(entry.keyType)} => ${escapeHtml(entry.valueType)})</small>
      </div>
    </div>`;
  }
  return `<div class="slot-resolution">
    <div class="slot-resolution-primary">
      <span>Resolved slot</span>
      <strong>Slot #${entry.slot.toString()}</strong>
      <small>Use Storage Slot Inspector -> Raw slot read -> slot index ${entry.slot.toString()}.</small>
    </div>
    <div class="slot-resolution-secondary">
      <span>Variable</span>
      <strong>${escapeHtml(entry.name)}</strong>
      <small>${escapeHtml(entry.type)} | offset ${entry.offset === null ? "n/a" : entry.offset} | ${escapeHtml(matchReason)}</small>
    </div>
  </div>`;
}

function entryViewLayout(entry) {
  if (!entry) return null;
  if (entry.kind === "mapping") return { kind: "mapping", name: entry.name, keyType: entry.keyType, valueType: entry.valueType };
  return { kind: "value", name: entry.name, valueType: entry.type || "bytes32" };
}

function storageNameSummary(layout, target) {
  const sourceNote = layout.sourceType === "storageLayout"
    ? "compiler exact layout"
    : layout.contractName
      ? "top-level declarations only; inherited state variables included"
      : "best-effort declaration order; paste full layout for contract-accurate slots";
  const contractCard = layout.contractName
    ? `<div class="storage-card"><span>Contract</span><strong>${escapeHtml(layout.contractName)}</strong><small>${escapeHtml(layout.selectionNote || "selected contract")}</small></div>`
    : "";
  return `<div class="storage-summary">
    <div class="storage-card"><span>Source</span><strong>${escapeHtml(layout.sourceType || "unknown")}</strong><small>${escapeHtml(sourceNote)}</small></div>
    ${contractCard}
    <div class="storage-card"><span>How to use</span><strong>resolve name first</strong><small>then switch to Raw slot read for the exact bytes32 value</small></div>
  </div>`;
}

function storageLayoutEntryList(entries, target = "") {
  if (!entries.length) return `<div class="notice warn">No storage declarations were parsed.</div>`;
  return `<div class="candidate-list">${entries.map((entry) => {
    const matched = target && normalizeStorageTargetName(entry.name) === target;
    const slotText = entry.slot === null ? "not stored on-chain" : layoutSlotHex(entry.slot);
    const slotLabel = entry.slot === null ? "not stored on-chain" : `slot #${entry.slot.toString()} (${slotText})`;
    const detail = [
      `name=${entry.name}`,
      `type=${entry.type}`,
      `slot=${slotLabel}`,
      entry.offset === null ? "" : `offset=${entry.offset}`,
      entry.note ? `note=${entry.note}` : "",
    ].filter(Boolean).join("\n");
    return `<div class="selector-candidate storage-layout-candidate ${matched ? "is-target" : ""}">
      <span>${entry.constant ? "C" : entry.immutable ? "I" : entry.kind === "mapping" ? "M" : String(entry.slot ?? "").padStart(2, "0")}</span>
      <code>${escapeHtml(detail)}</code>
      ${entry.slot === null ? "" : copyButton(slotText)}
    </div>`;
  }).join("")}</div>`;
}

function storageEntryReadView(entry, query, rawValue, prefixRows = []) {
  const layout = entryViewLayout(entry);
  return storageLayoutSummary(layout) + resultRows([
    ...prefixRows,
    ["Target", entry.name],
    ["Match", entry.kind === "mapping" ? "mapping value" : "resolved slot"],
    ["Type", entry.type],
    ["Slot", query.storageSlot],
    ["Byte offset", entry.offset === null ? "n/a" : `${entry.offset}`],
    ["Formula", query.formula],
    ["Raw bytes32", rawValue],
    [`Decoded ${entry.kind === "mapping" ? entry.valueType : entry.type}`, entry.kind === "mapping" ? decodeStorageValue(rawValue, entry.valueType) : decodeStorageValue(rawValue, entry.type)],
    ["uint256 view", BigInt(rawValue).toString()],
  ]);
}

function normalizeSolidityType(type) {
  return type.trim().replace(/\s/g, "").replace(/^uint$/, "uint256").replace(/^int$/, "int256");
}

function parseSlotIndex(value, label = "Slot") {
  const input = String(value || "").trim();
  if (!input) throw new Error(`${label} is required.`);
  if (!/^(0x[a-fA-F0-9]+|\d+)$/.test(input)) throw new Error(`${label} must be a decimal number or 0x hex value.`);
  const parsed = BigInt(input);
  if (parsed < 0n || parsed >= (1n << 256n)) throw new Error(`${label} must fit in uint256.`);
  return parsed;
}

function toSlotHex(value) {
  const slot = typeof value === "bigint" ? value : parseSlotIndex(value);
  return `0x${slot.toString(16).padStart(64, "0")}`;
}

function rawSlotQuery(index) {
  const slot = parseSlotIndex(index, "Slot index");
  return { indexText: index.trim(), slotNumber: slot, storageSlot: toSlotHex(slot), formula: "direct slot read" };
}

function storageLayoutSummary(layout) {
  const body = layout.kind === "mapping"
    ? `<div class="storage-card"><span>Parsed mapping</span><strong>${escapeHtml(layout.name)}</strong><small>key: ${escapeHtml(layout.keyType)} | value: ${escapeHtml(layout.valueType)}</small></div>
       <div class="storage-card"><span>Value location</span><strong>keccak256(key, baseSlot)</strong><small>mapping values live in hashed slots, not at the key number itself</small></div>`
    : `<div class="storage-card"><span>Variable</span><strong>${escapeHtml(layout.name)}</strong><small>stored as ${escapeHtml(layout.valueType)} in the selected slot</small></div>`;
  return `<div class="storage-summary">${body}</div>`;
}

function storageRawSummary(query) {
  return `<div class="storage-summary">
    <div class="storage-card"><span>Raw slot</span><strong>${escapeHtml(query.indexText)}</strong><small>direct slot index supplied by you</small></div>
    <div class="storage-card"><span>RPC method</span><strong>eth_getStorageAt</strong><small>reads exactly one bytes32 storage word</small></div>
  </div>`;
}

function storagePlanRows(layout, index, key) {
  const rows = [["Declaration type", layout.kind === "mapping" ? `mapping(${layout.keyType} => ${layout.valueType})` : layout.valueType]];
  if (!index && layout.kind === "mapping") {
    rows.push(["Mode", "Scan candidate base slots"]);
    rows.push(["Required key", key || "enter an address/uint/bytes32 key"]);
    rows.push(["Scan range", `0 to ${Number($("#slotScanLimit")?.value || 80)}`]);
    rows.push(["Important limit", "zero/false cannot prove a mapping base slot"]);
    return rows;
  }
  if (!index) {
    rows.push(["Mode", "Enter base slot to calculate exact mapping value slot"]);
    return rows;
  }
  const query = storageQueryFromLayout(layout, index, key);
  rows.push(["Base slot", query.baseSlotHex]);
  rows.push(["Storage slot", query.storageSlot]);
  rows.push(["Storage formula", query.formula]);
  rows.push(["Value decode", decodeHint(layout)]);
  return rows;
}

function storageQueryFromLayout(layout, index, key) {
  const baseSlot = parseSlotIndex(index || "0", "Base slot");
  const baseSlotHex = toSlotHex(baseSlot);
  if (layout.kind === "mapping") {
    if (!key) throw new Error("Enter a mapping key to calculate/read a mapping value.");
    return {
      baseSlotHex,
      storageSlot: mappingSlotByType(key, layout.keyType, baseSlotHex),
      formula: `keccak256(abi.encode(${layout.keyType} key, baseSlot))`,
    };
  }
  return { baseSlotHex, storageSlot: baseSlotHex, formula: "direct slot read" };
}

function mappingSlotByType(key, keyType, slotHex) {
  const keyWord = normalizeAbiWordByType(key, keyType);
  const slotWord = slotHex.replace(/^0x/, "").padStart(64, "0");
  return `0x${keccak256Hex(hexToBytes(`${keyWord}${slotWord}`))}`;
}

function normalizeAbiWordByType(value, type) {
  const input = value.trim();
  if (type === "address") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(input)) throw new Error("Mapping key type is address; enter a 20-byte 0x address.");
    return input.slice(2).toLowerCase().padStart(64, "0");
  }
  if (/^u?int\d{0,3}$/.test(type)) {
    if (!/^(0x[a-fA-F0-9]+|\d+)$/.test(input)) throw new Error(`Mapping key type is ${type}; enter a decimal integer or 0x hex integer.`);
    return BigInt(input).toString(16).padStart(64, "0");
  }
  if (type === "bool") {
    if (!/^(true|false|0|1)$/i.test(input)) throw new Error("Mapping key type is bool; enter true/false or 0/1.");
    return (/^(true|1)$/i.test(input) ? 1n : 0n).toString(16).padStart(64, "0");
  }
  if (type === "bytes32") {
    if (!/^0x[a-fA-F0-9]{64}$/.test(input)) throw new Error("Mapping key type is bytes32; enter 32-byte hex.");
    return input.slice(2).toLowerCase();
  }
  return normalizeAbiWord(input);
}

function decodeHint(layout) {
  const type = layout.kind === "mapping" ? layout.valueType : layout.valueType;
  if (type === "bool") return "0x...00 = false, 0x...01 = true";
  if (type === "address") return "last 20 bytes";
  if (/^uint/.test(type)) return "unsigned integer";
  if (/^int/.test(type)) return "signed integer";
  return "raw bytes32";
}

function decodeStorageValue(rawValue, valueType) {
  const raw = BigInt(rawValue);
  if (valueType === "bool") return raw === 0n ? "false" : raw === 1n ? "true" : `non-canonical bool (${raw.toString()})`;
  if (valueType === "address") return storageAddress(rawValue) || "0x0000000000000000000000000000000000000000";
  if (/^uint/.test(valueType)) return raw.toString();
  if (/^int/.test(valueType)) {
    const bits = Number(valueType.replace("int", "") || "256");
    const limit = 1n << BigInt(bits - 1);
    const mod = 1n << BigInt(bits);
    return (raw >= limit ? raw - mod : raw).toString();
  }
  return rawValue;
}

function storageReadView(layout, query, rawValue, prefixRows = []) {
  const valueType = layout.kind === "mapping" ? layout.valueType : layout.valueType;
  return storageLayoutSummary(layout) + resultRows([
    ...prefixRows,
    ["Base slot", query.baseSlotHex],
    ["Storage slot", query.storageSlot],
    ["Formula", query.formula],
    ["Raw bytes32", rawValue],
    [`Decoded ${valueType}`, decodeStorageValue(rawValue, valueType)],
    ["uint256 view", BigInt(rawValue).toString()],
  ]);
}

function rawStorageReadView(query, rawValue, decodeType, prefixRows = []) {
  const focused = decodeStorageValue(rawValue, decodeType);
  return storageRawSummary(query) + resultRows([
    ...prefixRows,
    ["Slot index", query.indexText],
    ["Slot hex", query.storageSlot],
    ["Formula", query.formula],
    ["Raw bytes32", rawValue],
    [`Decoded ${decodeType}`, focused],
    ["uint256 view", BigInt(rawValue).toString()],
    ["bool view", decodeStorageValue(rawValue, "bool")],
    ["address view", storageAddress(rawValue) || "0x0000000000000000000000000000000000000000"],
  ]);
}

async function scanMappingBaseSlots(endpoint, contract, layout, key, blockTag, out) {
  if (!key) throw new Error("Enter a mapping key. Scanning requires a concrete key whose value you want to inspect.");
  const maxSlot = Number($("#slotScanLimit").value || "80");
  if (!Number.isInteger(maxSlot) || maxSlot < 0 || maxSlot > 500) throw new Error("Scan range must be 0 to 500.");
  const expected = $("#slotExpected").value;
  out.innerHTML = `<div class="notice">Scanning candidate base slots 0 to ${maxSlot} for key <code>${escapeHtml(key)}</code>...</div>`;
  const matches = [];
  for (let slot = 0; slot <= maxSlot; slot += 1) {
    const query = storageQueryFromLayout(layout, String(slot), key);
    const rawValue = await rpcRequest(endpoint, "eth_getStorageAt", [contract, query.storageSlot, blockTag]);
    if (storageScanMatches(rawValue, expected)) matches.push({ slot, query, rawValue });
  }
  if (!matches.length) {
    out.innerHTML = storageLayoutSummary(layout) + `<div class="notice warn">No non-zero candidate was found in base slots 0 to ${maxSlot}. If the value is false/zero, scanning cannot distinguish it from unset storage. Use source/storageLayout or a key known to return true/non-zero.</div>`;
    return;
  }
  out.innerHTML = storageLayoutSummary(layout) +
    `<div class="candidate-list">${matches.slice(0, 24).map((match) => `<div class="selector-candidate storage-candidate">
      <span>#${match.slot}</span>
      <code>${escapeHtml(match.query.storageSlot)}<br/>raw=${escapeHtml(match.rawValue)}<br/>decoded=${escapeHtml(decodeStorageValue(match.rawValue, layout.valueType))}</code>
      ${copyButton(match.query.storageSlot)}
    </div>`).join("")}</div>` +
    `<div class="selector-caution">A scan is evidence, not proof. Confirm candidates with source code, compiler storageLayout, or multiple keys whose expected values you know.</div>`;
  bindCopyButtons(out);
}

function storageScanMatches(rawValue, expected) {
  const value = BigInt(rawValue);
  if (expected === "any") return true;
  return value !== 0n;
}

function renderProxySlot() {
  setWorkbench("chain");
  elements.toolPanel.innerHTML =
    panel("Input", `<label class="field"><span>Proxy address</span><input id="proxyAddress" class="mono" placeholder="0x..." /></label>
      <div class="toolbar"><button id="probeProxy" class="primary-button" type="button">Probe proxy slots</button></div>
      <div class="notice">Uses your optional Alchemy or Infura key for read-only <code>eth_getStorageAt</code>.</div>`) +
    panel("Output", `<div id="proxyOutput"></div>`);
  $("#probeProxy").addEventListener("click", updateProxySlot);
  updateProxySlot();
}

async function updateProxySlot() {
  const out = $("#proxyOutput");
  const address = $("#proxyAddress").value.trim();
  if (!address) { out.innerHTML = `<div class="notice">Enter a proxy address to inspect ERC-1967 implementation, admin, and beacon slots.</div>`; return; }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) { out.innerHTML = `<div class="notice danger">Enter a valid 20-byte EVM address.</div>`; return; }
  if (settings.privacyMode) { out.innerHTML = `<div class="notice warn">Privacy First Mode is active. Turn it off in Settings to allow the RPC request.</div>`; return; }
  const rpc = rpcEndpoint();
  if (!rpc) { out.innerHTML = `<div class="notice">Add an Alchemy or Infura API key in Settings to run the read-only probe.</div>`; return; }
  out.innerHTML = `<div class="notice">Reading standard proxy slots...</div>`;
  try {
    const slots = { implementation: eip1967Slot("implementation"), admin: eip1967Slot("admin"), beacon: eip1967Slot("beacon") };
    const values = await Promise.all(Object.values(slots).map((slot) => rpcRequest(rpc, "eth_getStorageAt", [address, slot, "latest"])));
    const [implementation, admin, beacon] = values;
    const rows = [["Implementation slot", slots.implementation], ["Implementation", storageAddress(implementation) || "not set"],
      ["Admin slot", slots.admin], ["Admin", storageAddress(admin) || "not set"], ["Beacon slot", slots.beacon], ["Beacon", storageAddress(beacon) || "not set"]];
    const beaconAddress = storageAddress(beacon);
    if (beaconAddress) {
      const beaconImplementation = await rpcRequest(rpc, "eth_call", [{ to: beaconAddress, data: "0x5c60da1b" }, "latest"]);
      rows.push(["Beacon implementation", storageAddress(beaconImplementation) || beaconImplementation]);
    }
    out.innerHTML = resultRows(rows);
    bindCopyButtons(out);
  } catch (error) { out.innerHTML = `<div class="notice danger">${escapeHtml(error.message || "RPC probe failed.")}</div>`; }
}

function eip1967Slot(name) {
  const hash = BigInt(`0x${keccak256Hex(new TextEncoder().encode(`eip1967.proxy.${name}`))}`);
  return `0x${(hash - 1n).toString(16).padStart(64, "0")}`;
}

function storageAddress(value) {
  const hex = String(value || "").replace(/^0x/, "");
  if (!/^[a-fA-F0-9]{64}$/.test(hex) || /^0+$/.test(hex)) return "";
  return `0x${hex.slice(-40)}`;
}

function rpcEndpoint() {
  const chain = settings.defaultChain || "ethereum";
  const alchemySlugs = { ethereum: "eth-mainnet", sepolia: "eth-sepolia", polygon: "polygon-mainnet", bsc: "bnb-mainnet" };
  if (settings.alchemyKey) return `https://${alchemySlugs[chain] || "eth-mainnet"}.g.alchemy.com/v2/${settings.alchemyKey}`;
  if (settings.infuraKey && (chain === "ethereum" || chain === "sepolia" || chain === "polygon")) {
    const infuraSlugs = { ethereum: "mainnet", sepolia: "sepolia", polygon: "polygon-mainnet" };
    return `https://${infuraSlugs[chain]}.infura.io/v3/${settings.infuraKey}`;
  }
  return "";
}

async function rpcRequest(endpoint, method, params) {
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }) });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message || "RPC request failed.");
  return payload.result;
}

function renderCalldata() {
  setWorkbench("calldata");
  elements.toolPanel.innerHTML =
    panel("Input", `<label class="field"><span>Raw calldata</span><textarea id="calldataInput" class="mono" placeholder="0xa9059cbb..."></textarea></label>
      <div class="toolbar"><button id="lookupCalldata" class="primary-button" type="button">Identify selector</button></div>
      <div class="notice">The first 4 bytes identify a function. Remaining 32-byte ABI words are shown with safe heuristics.</div>`) +
    panel("Output", `<div id="calldataOutput"></div>`);
  $("#calldataInput").addEventListener("input", debounce(updateCalldata, 160));
  $("#lookupCalldata").addEventListener("click", () => updateCalldata(true));
  updateCalldata();
}

async function updateCalldata(lookup = false) {
  const raw = $("#calldataInput").value.trim().replace(/^0x/, "");
  const out = $("#calldataOutput");
  if (!raw) { out.innerHTML = `<div class="notice">Paste calldata. The tool will separate its selector from ABI words and can identify public signature candidates.</div>`; return; }
  if (!/^[a-fA-F0-9]+$/.test(raw) || raw.length < 8 || raw.length % 2 !== 0) { out.innerHTML = `<div class="notice danger">Calldata must be hex.</div>`; return; }
  const selector = `0x${raw.slice(0, 8)}`;
  const words = raw.slice(8).match(/.{1,64}/g) || [];
  const rows = [["Selector", selector], ["Argument words", words.length], ["Decode confidence", "Raw ABI layout only until an ABI/signature is selected"]];
  if (lookup) {
    try {
      const candidates = await lookupSelectorCandidates(selector);
      rows.push(["Signature candidates", candidates.length ? candidates.join(" | ") : "No public match found"]);
    } catch (error) { rows.push(["Signature candidates", error.message]); }
  }
  const annotations = words.map((word, index) => {
    const padded = word.padEnd(64, "0");
    const address = /^0{24}[a-fA-F0-9]{40}$/.test(padded) ? ` address=0x${padded.slice(-40)}` : "";
    return `${String(index).padStart(2, "0")}  raw=0x${padded}\n    uint256=${BigInt(`0x${padded}`).toString()}${address}`;
  });
  out.innerHTML = resultRows(rows) + `<pre class="notice mono">${escapeHtml(annotations.join("\n"))}</pre>`;
  bindCopyButtons(out);
}

const opcodeNames = {
  "00": "STOP", "01": "ADD", "02": "MUL", "03": "SUB", "04": "DIV", "10": "LT", "11": "GT", "14": "EQ", "15": "ISZERO",
  "20": "SHA3", "35": "CALLDATALOAD", "36": "CALLDATASIZE", "37": "CALLDATACOPY", "39": "CODECOPY", "3d": "RETURNDATASIZE",
  "3e": "RETURNDATACOPY", "52": "MSTORE", "54": "SLOAD", "55": "SSTORE", "56": "JUMP", "57": "JUMPI", "5b": "JUMPDEST",
  f1: "CALL", f3: "RETURN", f4: "DELEGATECALL", fd: "REVERT", ff: "SELFDESTRUCT",
};

function renderDisassembler() {
  elements.toolPanel.innerHTML =
    panel("Input", `<label class="field"><span>Bytecode</span><textarea id="bytecodeInput" class="mono">0x6080604052348015600f57600080fd5b50</textarea></label>`) +
    panel("Disassembly", `<div id="bytecodeOutput"></div>`);
  $("#bytecodeInput").addEventListener("input", debounce(updateDisassembler, 120));
  updateDisassembler();
}

function updateDisassembler() {
  const raw = $("#bytecodeInput").value.trim().replace(/^0x/, "").toLowerCase();
  const out = $("#bytecodeOutput");
  if (!/^[a-f0-9]*$/.test(raw) || raw.length % 2 !== 0) { out.innerHTML = `<div class="notice danger">Bytecode must be even-length hex.</div>`; return; }
  const rows = [];
  for (let pc = 0; pc < raw.length / 2 && rows.length < 400; pc += 1) {
    const byte = raw.slice(pc * 2, pc * 2 + 2);
    const value = Number.parseInt(byte, 16);
    if (value >= 0x60 && value <= 0x7f) {
      const pushBytes = value - 0x5f;
      const data = raw.slice(pc * 2 + 2, pc * 2 + 2 + pushBytes * 2);
      rows.push(`${pc.toString().padStart(4, "0")}  PUSH${pushBytes}  0x${data}`);
      pc += pushBytes;
    } else { rows.push(`${pc.toString().padStart(4, "0")}  ${opcodeNames[byte] || `OP_0x${byte}`}`); }
  }
  out.innerHTML = `<pre class="notice mono">${escapeHtml(rows.join("\n"))}</pre>`;
}

function renderSelectorFinder() {
  setWorkbench("selector");
  elements.toolPanel.innerHTML =
    panel("Input", `<label class="field"><span>Function signature or selector</span><input id="selectorInput" class="mono" value="transfer(address,uint256)" /></label>
      <div class="toolbar"><button id="lookupSelector" class="primary-button" type="button">Lookup selector</button></div>
      <div class="notice">Enter <code>transfer(address,uint256)</code> to generate hashes, or <code>0xa9059cbb</code> to search public candidate signatures.</div>`) +
    panel("Output", `<div id="selectorOutput"></div>`);
  $("#selectorInput").addEventListener("input", updateSelector);
  $("#lookupSelector").addEventListener("click", () => updateSelector(true));
  updateSelector();
}

async function updateSelector(lookup = false) {
  const input = $("#selectorInput").value.trim();
  const out = $("#selectorOutput");
  if (/^0x[a-fA-F0-9]{8}$/.test(input)) {
    const selector = input.toLowerCase();
    if (lookup) {
      try {
        const candidates = await lookupSelectorCandidates(input);
        out.innerHTML = selectorLookupView(selector, candidates);
      } catch (error) { out.innerHTML = selectorLookupView(selector, [], error.message); }
    } else { out.innerHTML = selectorLookupView(selector); }
    bindCopyButtons(out);
    return;
  }
  const hash = input ? keccak256Hex(new TextEncoder().encode(input)) : "";
  out.innerHTML = resultRows([["Signature", input || "n/a"], ["Function selector", hash ? `0x${hash.slice(0, 8)}` : "n/a"], ["Event topic0", hash ? `0x${hash}` : "n/a"]]);
  bindCopyButtons(out);
}

function selectorLookupView(selector, candidates = null, error = "") {
  const body = candidates === null ? `<div class="notice">Run the lookup to search public signature candidates for this selector.</div>`
    : error ? `<div class="notice danger">${escapeHtml(error)}</div>`
    : candidates.length ? `<div class="candidate-list">${candidates.map((c, i) => `<div class="selector-candidate"><span>${String(i + 1).padStart(2, "0")}</span><code>${escapeHtml(c)}</code>${copyButton(c)}</div>`).join("")}</div>`
    : `<div class="notice">No public candidate was returned. This selector may be custom or absent from the indexed database.</div>`;
  return `<div class="selector-result-head"><span>4-byte selector</span><strong class="mono">${selector}</strong>${copyButton(selector)}</div>
    <div class="selector-result-section"><div class="selector-result-label">Public signature candidates${Array.isArray(candidates) ? ` (${candidates.length})` : ""}</div>${body}</div>
    <div class="selector-caution">Candidates can collide. Confirm the final function with the contract ABI, verified source, or decoded calldata.</div>`;
}

async function lookupSelectorCandidates(selector) {
  if (settings.privacyMode) throw new Error("Privacy First Mode blocks external signature lookup.");
  const response = await fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=${encodeURIComponent(selector.toLowerCase())}`);
  if (!response.ok) throw new Error("Signature lookup failed.");
  const payload = await response.json();
  return [...new Set((payload.results || []).map((item) => item.text_signature).filter(Boolean))].slice(0, 8);
}

function renderEncryption() {
  setWorkbench("vault");
  elements.toolPanel.innerHTML =
    panel("Input", `<label class="field"><span>Data</span><textarea id="encPlain" class="mono">local secrets only</textarea></label>
      <div class="input-grid">
        <label class="field"><span>Password</span><input id="encPassword" type="password" value="linsea-demo" /></label>
        <label class="field"><span>Mode</span><select id="encMode"><option value="encrypt">Encrypt AES-GCM</option><option value="decrypt">Decrypt AES-GCM bundle</option></select></label>
      </div><div class="toolbar"><button id="runEncrypt" class="primary-button" type="button">Run locally</button></div>
      <div class="notice warn">DES is intentionally not offered. It is a legacy cipher and should not be used for new data.</div>`) +
    panel("Output", `<div id="encOutput"></div>`);
  $("#runEncrypt").addEventListener("click", updateEncryption);
  $("#encMode").addEventListener("change", () => { $("#runEncrypt").textContent = $("#encMode").value === "encrypt" ? "Encrypt locally" : "Decrypt locally"; });
  updateEncryption();
}

async function updateEncryption() {
  const out = $("#encOutput");
  try {
    const mode = $("#encMode").value;
    const input = $("#encPlain").value;
    const password = $("#encPassword").value;
    if (!password) throw new Error("Enter a password.");
    if (mode === "decrypt") {
      const bundle = JSON.parse(input);
      if (bundle.v !== 1 || bundle.alg !== "AES-GCM" || !bundle.iv || !bundle.salt || !bundle.data) throw new Error("Paste a version 1 AES-GCM bundle from this tool.");
      const key = await deriveAesKey(password, base64ToBytes(bundle.salt), ["decrypt"]);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(bundle.iv) }, key, base64ToBytes(bundle.data));
      const text = new TextDecoder().decode(plain);
      out.innerHTML = resultRows([["Plaintext", text], ["Algorithm", "AES-GCM / PBKDF2-SHA-256"]]);
      bindCopyButtons(out);
      return;
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveAesKey(password, salt, ["encrypt"]);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(input));
    const bundle = JSON.stringify({ v: 1, alg: "AES-GCM", salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(cipher)) }, null, 2);
    out.innerHTML = `<pre class="notice mono">${escapeHtml(bundle)}</pre>${copyButton(bundle)}`;
    bindCopyButtons(out);
  } catch (error) { out.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`; }
}

async function deriveAesKey(password, salt, usages) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, usages);
}

function bytesToBase64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function base64ToBytes(value) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }

function renderRegexLab() {
  elements.toolPanel.innerHTML =
    panel("Input", `<div class="input-grid">
        <label class="field"><span>Pattern</span><input id="regexPattern" class="mono" value="0x[a-fA-F0-9]{40}" /></label>
        <label class="field"><span>Flags</span><input id="regexFlags" class="mono" value="g" /></label>
      </div><label class="field"><span>Test text</span><textarea id="regexText" class="mono">wallet: 0x000000000000000000000000000000000000dEaD</textarea></label>`) +
    panel("Matches", `<div id="regexOutput"></div>`);
  ["#regexPattern", "#regexFlags", "#regexText"].forEach((s) => $(s).addEventListener("input", updateRegex));
  updateRegex();
}

function updateRegex() {
  const out = $("#regexOutput");
  try {
    const regex = new RegExp($("#regexPattern").value, $("#regexFlags").value);
    const matches = [...$("#regexText").value.matchAll(regex)].map((match, index) => [`Match ${index + 1}`, match[0]]);
    out.innerHTML = matches.length ? resultRows(matches) : `<div class="notice">No matches.</div>`;
    bindCopyButtons(out);
  } catch (error) { out.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`; }
}

function renderCronMaster() {
  elements.toolPanel.innerHTML =
    panel("Input", `<label class="field"><span>Cron expression</span><input id="cronInput" class="mono" value="*/15 * * * *" /></label>`) +
    panel("Explanation", `<div id="cronOutput"></div>`);
  $("#cronInput").addEventListener("input", updateCron);
  updateCron();
}

function updateCron() {
  const parts = $("#cronInput").value.trim().split(/\s+/);
  const out = $("#cronOutput");
  if (parts.length !== 5) { out.innerHTML = `<div class="notice danger">Use a 5-field Unix cron expression.</div>`; return; }
  try {
    const nextRuns = nextCronRuns(parts, 10);
    out.innerHTML = resultRows([["Minute", parts[0]], ["Hour", parts[1]], ["Day of month", parts[2]], ["Month", parts[3]], ["Day of week", parts[4]]]) +
      `<pre class="notice mono">${escapeHtml(nextRuns.map((date, index) => `${String(index + 1).padStart(2, "0")}  ${date.toLocaleString()}`).join("\n"))}</pre>`;
    bindCopyButtons(out);
  } catch (error) { out.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`; }
}

function nextCronRuns(parts, limit) {
  const fields = [parseCronField(parts[0], 0, 59), parseCronField(parts[1], 0, 23), parseCronField(parts[2], 1, 31), parseCronField(parts[3], 1, 12), parseCronField(parts[4], 0, 7)];
  const now = new Date();
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0, 0);
  const runs = [];
  const maxMinutes = 366 * 24 * 60 * 3;
  for (let step = 0; step < maxMinutes && runs.length < limit; step += 1) { if (cronMatches(cursor, fields, parts)) runs.push(new Date(cursor)); cursor.setMinutes(cursor.getMinutes() + 1); }
  if (runs.length < limit) throw new Error("No matching times were found within the next three years.");
  return runs;
}

function parseCronField(value, min, max) {
  const allowed = new Set();
  for (const part of value.split(",")) {
    const [range, stepText] = part.split("/");
    const step = stepText ? Number(stepText) : 1;
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid step in "${value}".`);
    let start = min; let end = max;
    if (range !== "*") {
      const bounds = range.split("-");
      start = Number(bounds[0]);
      end = bounds.length === 2 ? Number(bounds[1]) : start;
      if (bounds.length > 2 || !Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) throw new Error(`Invalid cron field "${value}".`);
    }
    for (let candidate = start; candidate <= end; candidate += step) allowed.add(candidate === 7 && max === 7 ? 0 : candidate);
  }
  return allowed;
}

function cronMatches(date, fields, parts) {
  const [minutes, hours, days, months, weekdays] = fields;
  if (!minutes.has(date.getMinutes()) || !hours.has(date.getHours()) || !months.has(date.getMonth() + 1)) return false;
  const dayMatch = days.has(date.getDate());
  const weekdayMatch = weekdays.has(date.getDay());
  const dayWildcard = parts[2] === "*";
  const weekdayWildcard = parts[4] === "*";
  return dayWildcard && weekdayWildcard ? true : dayWildcard ? weekdayMatch : weekdayWildcard ? dayMatch : dayMatch || weekdayMatch;
}

function renderFbaCalculator() {
  setWorkbench("finance");
  elements.toolPanel.innerHTML =
    panel("Input", `<div class="input-grid">
        <label class="field"><span>Sale price</span><input id="fbaPrice" value="29.99" /></label>
        <label class="field"><span>Product cost</span><input id="fbaCost" value="8.50" /></label>
        <label class="field"><span>Shipping</span><input id="fbaShip" value="3.20" /></label>
        <label class="field"><span>Platform fee %</span><input id="fbaFee" value="15" /></label>
      </div>`) +
    panel("Output", `<div id="fbaOutput"></div>`);
  ["#fbaPrice", "#fbaCost", "#fbaShip", "#fbaFee"].forEach((s) => $(s).addEventListener("input", updateFba));
  updateFba();
}

function updateFba() {
  const price = Number($("#fbaPrice").value);
  const cost = Number($("#fbaCost").value);
  const ship = Number($("#fbaShip").value);
  const feePct = Number($("#fbaFee").value);
  const fee = price * feePct / 100;
  const profit = price - cost - ship - fee;
  const margin = profit / price * 100;
  const roi = profit / (cost + ship) * 100;
  $("#fbaOutput").innerHTML =
    `<div class="metric-strip">
      <div class="metric-card ${profit >= 0 ? "positive" : "negative"}"><span>Net profit</span><strong>${money(profit)}</strong><small>${margin.toFixed(2)}% margin</small></div>
      <div class="metric-card"><span>ROI</span><strong>${Number.isFinite(roi) ? `${roi.toFixed(2)}%` : "n/a"}</strong><small>on product + shipping</small></div>
      <div class="metric-card"><span>Landed cost</span><strong>${money(cost + ship + fee)}</strong><small>including platform fee</small></div>
    </div>` + resultRows([["Sale price", money(price)], ["Platform fee", money(fee)], ["Product cost", money(cost)], ["Shipping", money(ship)]]);
  bindCopyButtons($("#fbaOutput"));
}

function money(value) { return Number.isFinite(value) ? `$${value.toFixed(2)}` : "n/a"; }

function renderListingCleaner() {
  setWorkbench("editor");
  elements.toolPanel.innerHTML =
    panel("Input", `<label class="field"><span>Listing text</span><textarea id="listingInput"><h1>Product</h1>\n\nFast&nbsp;shipping  \n\n\nClean copy.</textarea></label>`) +
    panel("Output", `<div id="listingOutput"></div>`);
  $("#listingInput").addEventListener("input", updateListing);
  updateListing();
}

function updateListing() {
  const cleaned = $("#listingInput").value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  $("#listingOutput").innerHTML = `<pre class="notice mono">${escapeHtml(cleaned)}</pre>${resultRows([["Characters", cleaned.length], ["Words", cleaned ? cleaned.split(/\s+/).length : 0]])}`;
  bindCopyButtons($("#listingOutput"));
}

function renderShippingTracker() {
  setWorkbench("tracker");
  elements.toolPanel.innerHTML =
    panel("Input", `<label class="field"><span>Tracking number</span><input id="trackInput" class="mono" value="1Z999AA10123456784" /></label>`) +
    panel("Carrier", `<div id="trackOutput"></div>`);
  $("#trackInput").addEventListener("input", updateTracking);
  updateTracking();
}

function updateTracking() {
  const value = $("#trackInput").value.trim();
  let carrier = "Unknown";
  let url = "https://www.17track.net/en";
  if (/^1Z/i.test(value)) { carrier = "UPS"; url = `https://www.ups.com/track?tracknum=${encodeURIComponent(value)}`; }
  else if (/^\d{12,15}$/.test(value)) { carrier = "FedEx / generic numeric"; url = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(value)}`; }
  $("#trackOutput").innerHTML =
    `<div class="tracking-result"><span>Carrier estimate</span><strong>${escapeHtml(carrier)}</strong><a class="primary-button download-button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open tracking</a></div>` +
    resultRows([["Tracking number", value || "n/a"], ["Tracking URL", url]]);
  bindCopyButtons($("#trackOutput"));
}

function renderWhiteBackground() {
  setWorkbench("image");
  elements.toolPanel.innerHTML =
    panel("Input", `<label class="field"><span>Product image</span><input id="whiteBgFile" type="file" accept="image/*" /></label>
      <label class="field"><span>White threshold</span><input id="whiteBgThreshold" type="range" min="180" max="252" value="222" /></label>
      <div class="notice">Bright, low-saturation pixels are normalized to pure white locally.</div>`) +
    panel("Output", `<div id="whiteBgOutput"><div class="notice">Choose an image to prepare a white-background preview.</div></div>`);
  $("#whiteBgFile").addEventListener("change", updateWhiteBackground);
  $("#whiteBgThreshold").addEventListener("input", updateWhiteBackground);
}

function updateWhiteBackground() {
  const file = $("#whiteBgFile").files?.[0];
  const out = $("#whiteBgOutput");
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const threshold = Number($("#whiteBgThreshold").value);
      for (let offset = 0; offset < imageData.data.length; offset += 4) {
        const red = imageData.data[offset];
        const green = imageData.data[offset + 1];
        const blue = imageData.data[offset + 2];
        const alpha = imageData.data[offset + 3];
        const high = Math.max(red, green, blue);
        const low = Math.min(red, green, blue);
        if (alpha < 250 || (high >= threshold && high - low < 28)) {
          imageData.data[offset] = 255;
          imageData.data[offset + 1] = 255;
          imageData.data[offset + 2] = 255;
          imageData.data[offset + 3] = 255;
        }
      }
      context.putImageData(imageData, 0, 0);
      const url = canvas.toDataURL("image/png");
      out.innerHTML = `<img class="image-preview" src="${url}" alt="White-background output preview" />
        <a class="primary-button download-button" href="${url}" download="linsea-white-bg.png">Download PNG</a>`;
    };
    image.onerror = () => { out.innerHTML = `<div class="notice danger">This image could not be read.</div>`; };
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
}

/* ====== COMMAND PALETTE ====== */

function openCommand() {
  elements.commandOverlay.classList.remove("hidden");
  elements.commandInput.value = "";
  renderCommandResults("");
  setTimeout(() => elements.commandInput.focus(), 0);
}

function closeCommand() { elements.commandOverlay.classList.add("hidden"); }

function renderCommandResults(query) {
  const q = query.trim().toLowerCase();
  const matches = tools.filter((tool) => {
    const haystack = [tool.name, tool.zh, tool.description, ...tool.keywords].join(" ").toLowerCase();
    return !q || haystack.includes(q);
  });
  elements.commandResults.innerHTML = matches.map((tool) =>
    `<button class="command-item" data-tool="${tool.id}" type="button">
      <div><strong>${t(tool)}</strong><span>${tool.description}</span></div>
      <kbd>${categoryName(tool.category)}</kbd>
    </button>`).join("");
  elements.commandResults.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => { selectTool(button.dataset.tool); closeCommand(); });
  });
}

/* ====== THEME / LANGUAGE ====== */

function toggleTheme() {
  theme = theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  renderShell();
  saveState();
}

function toggleLanguage() {
  language = language === "en" ? "zh" : "en";
  renderShell();
  selectTool(activeToolId);
}

/* ====== UTILITIES ====== */

function debounce(fn, delay) {
  let timer = 0;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

mount();
