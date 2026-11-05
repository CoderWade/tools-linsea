# Linsea Tools

[English](#english) · [中文](#中文)

Privacy-first Web3 and developer toolbox. Everything runs in the browser; chain access is read-only RPC.

隐私优先的 Web3 与开发者工具箱。所有计算在浏览器内完成，链上访问只做只读 RPC。

---

## English

### What this is

A static, single-page workbench holding 15 tools across four sections:

| Section | Tools |
|---|---|
| Reverse Security (7) | Storage Slot Inspector, Source Layout Resolver, Proxy Slot Finder, Read Contract (eth_call), Calldata Decoder, Unit Converter, 4Byte / Selector Finder |
| Encoding & Crypto (4) | Encoder / Hash Suite, Symmetric Encryption, JWT Inspector, Base Converter |
| Developer (3) | JSON Studio, Timestamp Pro, Text Compare |
| General (1) | Market Clock |

The app opens directly into a tool. There is no landing page, no sign-in, and no backend.

### Design system

The visual layer is four token families, each with exactly one job. A colour never means two things.

**Neutral** — tinted rather than pure grey, so the page has a hue without spending saturation on decoration:

| Token | Dark | Light |
|---|---|---|
| `--canvas` | `222 26% 6.5%` | `220 22% 97%` |
| `--surface` | `222 20% 10.5%` | `0 0% 100%` |
| `--panel` | `222 22% 8.5%` | `220 24% 96%` |
| `--line` | `222 15% 24%` | `220 16% 85%` |
| `--text` | `214 26% 94%` | `222 30% 14%` |
| `--muted` | `216 14% 67%` | `220 13% 42%` |
| `--faint` | `216 12% 54%` | `220 10% 45%` |

**Action** — interactive affordances only: buttons, focus rings, the selected tab, links. Never a panel border, never a shadow.

| Token | Dark | Light |
|---|---|---|
| `--accent` | `217 90% 70%` | `221 83% 46%` |
| `--accent-fg` | `222 40% 7%` | `0 0% 100%` |

**Identity** — which section a tool belongs to. Allowed in exactly four places: the rail stripe, the tool list icon, the category chip, and the command palette icon. "General Tools" deliberately has no hue; a catch-all section should not compete with the two real ones.

| Token | Dark | Light |
|---|---|---|
| `--family-reverse` | `262 60% 68%` | `262 55% 46%` |
| `--family-dev` | `180 45% 52%` | `183 90% 26%` |
| `--family-general` | `216 12% 54%` | `220 10% 45%` |

**State** — what a result means. Always paired with an icon or a word, never colour alone.

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--ok` | `158 50% 52%` | `158 62% 29%` | trading, complete, diff added |
| `--warn` | `36 85% 63%` | `28 90% 35%` | pre/post market, DST, incomplete scan |
| `--danger` | `356 75% 68%` | `356 66%` | rejected, errors, diff removed |

**Hard rules.** No gradients. No coloured shadows. No large coloured fills. Coloured pixels stay near 5% of any screen. Accent is reserved for things you can click.

**Measured contrast** (WCAG 2.1, on `--surface` / `--panel`):

| Token | Dark | Light |
|---|---|---|
| text | 15.32 / 16.02 | 16.38 / 14.88 |
| muted | 7.39 / 7.73 | 5.73 / 5.21 |
| faint | 4.84 / 5.07 | 5.06 / 4.59 |
| accent | 6.90 / 7.21 | 6.56 / 5.96 |
| ok | 7.90 / 8.27 | 5.44 / 4.94 |
| warn | 9.34 / 9.77 | 5.29 / 4.81 |
| danger | 5.98 / 6.26 | 6.15 / 5.58 |
| family-reverse | 5.43 / 5.68 | 7.71 / 7.01 |
| family-dev | 7.74 / 8.10 | 5.25 / 4.77 |

Lowest value in either theme: **4.59** (light `faint` on panel). Everything meets AA.

**Shape and type.** Three radii: `10px` controls, `14px` cards, `20px` overlays. A nested control always sits one step below its container. Type weight tops out at 700; there are no 900-weight headings. Controls are 44px tall with 14px text.

### Internationalisation

English and Chinese are complete peers, not a translated afterthought. All 367 user-facing strings live in `src/lib/i18n.ts` as `[English, 中文]` pairs, reached through `useT()` and `t(lang, key, vars)`.

The translation policy is deliberate, and it is what keeps Chinese mode readable:

- **Translate** everything that is ordinary language: instructions, errors, empty states, field labels, panel names, buttons, tool descriptions, badges.
- **Keep in English** the protocol and tooling terms whose translated form would break the user's mental link to the code they are typing: `RPC`, `mapping`, `calldata`, `selector`, `ABI`, `bytes32`, `uint256`, `JWT`, `JSON`, `Keccak`, `Base64`, `chainId`.
- **Never mix** the two inside one phrase without a reason. `读取原始存储槽` is correct; `Read 原始 storage slot` is not.

Search indexes both scripts so a query in either language finds the tool, but the displayed keyword list is filtered to the active language — seeing `json / format / 格式化` under a Chinese tool name reads as an unfinished translation.

Audited across all 15 tools in both languages: zero CJK characters leak into English mode, zero English prose leaks into Chinese mode.

### Layout

```
┌────────────┐ ┌──────────────────────────────────────────┐
│ brand      │ │ search · privacy · lang · theme · settings│
├────────────┤ └──────────────────────────────────────────┘
│ section    │  category / tool-id / chain
│  · tool    │  Tool Name
│  · tool    │  one-line description            [badges]
│            │  ┌──────────┐ ┌──────────┐ ┌── Tools ──┐
│            │  │ input    │ │ readout  │ ├── Recent ─┤
│ [settings] │  │ pane     │ │ pane     │ ├── Ad ─────┤
└────────────┘  └──────────┘ └──────────┘ └───────────┘
```

- Fixed 260px rail, 284px context rail, fluid workbench between them.
- The workbench splits into two panes: input on the left, readout on the right.
- Below `1024px` the rail collapses to a horizontal picker; below `768px` the header stacks.
- Dark and light are tuned independently, not algorithmically inverted. The theme is resolved before first paint by an inline script in `index.html`, so a returning dark-mode visitor never sees a white flash.

### Getting started

```bash
npm install
npm run dev      # http://127.0.0.1:5173/
npm run build    # static output in dist/
npm test         # 56 unit tests
```

Requires Node 22 or newer (matches CI).

### Chain support

Chain metadata lives in `src/lib/chains.ts`; the read-only transport in `src/lib/rpc.ts`.

| Chain | chainId | Default endpoint | Explorer |
|---|---|---|---|
| Ethereum Mainnet | 1 | Alchemy / Infura BYOK | etherscan.io |
| Sepolia Testnet | 11155111 | Alchemy / Infura BYOK | sepolia.etherscan.io |
| Polygon Mainnet | 137 | Alchemy / Infura BYOK | polygonscan.com |
| BNB Smart Chain | 56 | Alchemy BYOK | bscscan.com |
| Anubis Mainnet | 6714 | `https://rpc.anubispace.org` (keyless) | browser.anubispace.org |
| Custom EVM chain | user supplied | user supplied RPC URL | — |

Endpoint priority is explicit: **RPC URL override → bundled public RPC → Alchemy key → Infura key**. A provider key is never used on a chain that provider does not serve, so a misconfigured key fails loudly instead of silently reading another network.

Every storage and proxy read:

1. calls `eth_chainId` and aborts on a mismatch;
2. resolves `latest` to a concrete block number;
3. reports chain name, chainId, endpoint host, and the exact block read.

That way any output can be re-checked later at the same block. Mapping scans go through JSON-RPC batch (20 calls per chunk) and fall back to sequential requests when the endpoint rejects batching.

Adding another EVM chain is one registry entry:

```ts
{ id: "anubis", chainId: 6714, label: "Anubis Mainnet", shortLabel: "Anubis",
  rpcUrl: "https://rpc.anubispace.org", explorer: "https://browser.anubispace.org", nativeSymbol: "DAI" },
```

### Reading a contract (eth_call)

The Read Contract tool encodes a function call locally and sends it with `eth_call`:

1. Parse `name(type,...)`, optionally with `returns (...)`.
2. Compute the 4-byte selector from the canonical signature — the calldata preview updates as you type.
3. ABI-encode the arguments (uint/int, bool, address, bytesN, bytes, string, arrays).
4. Send one `eth_call` per requested block, then decode the return data.

Keys details:

- Declaring `returns (uint256)` gives exact decoding. Without it the tool still shows the value as a plain uint256 rather than nothing.
- Multiple blocks on one line-per-block input produce a side-by-side readout and a same/different verdict.
- `eth_call` cannot change state and costs no gas. Only view and pure functions work.

**Archive endpoints matter.** Public nodes usually cannot serve historical state. When a node answers with `archive`, `missing trie node`, `header not found`, or `unknown state`, the tool says which block failed and points at the endpoint picker instead of echoing the node's error.

### Free endpoints

Settings lists keyless public RPCs per chain, each probed before being listed. Verified at the time of writing:

| Chain | Endpoint | Archive |
|---|---|---|
| Ethereum | `ethereum-rpc.publicnode.com` | no |
| Ethereum | `eth.drpc.org` | yes |
| Ethereum | `cloudflare-eth.com` | no |
| Ethereum | `eth-mainnet.public.blastapi.io` | yes |
| Sepolia | `ethereum-sepolia-rpc.publicnode.com` | no |
| Polygon | `polygon-bor-rpc.publicnode.com` | no |
| Polygon | `polygon.drpc.org` | no |
| BSC | `bsc-dataseed1.bnbchain.org` | no |
| BSC | `bsc-dataseed2.bnbchain.org` | no |
| BSC | `rpc.48.club` | no |
| BSC | `bsc-rpc.publicnode.com` | no |
| BSC | `bsc-mainnet.public.blastapi.io` | yes |
| BSC | `bsc-mainnet.nodereal.io/v1/…` (shared demo key) | yes |
| Anubis | `rpc.anubispace.org` | no |

"Archive" means a historical `eth_call` at an older block succeeded during testing. Public endpoints drift and rate-limit, so the UI reports failures plainly and any URL can be overridden by hand.

### Privacy model

- Every tool that can run locally does: hashing, encoding, unit conversion, timestamp maths, JSON, diff, AES-GCM, JWT decoding.
- Chain reads are the only outbound requests, and they come from exactly two tools: Storage Slot Inspector and Proxy Slot Finder.
- **Privacy First Mode** disables RPC, ads, and remote lookups in one switch. In that mode the chain tools refuse to run rather than silently degrading.
- API keys and preferences live in `localStorage` in your own browser. There is no server to send them to.
- No signing, no transactions, no private key input anywhere in the app.

### Testing

`npm test` runs 56 unit tests covering chain resolution (endpoint priority, custom chain validation, URL normalisation), the JSON-RPC transport (batch handling, sequential fallback, error decoding), and the ABI codec (type parsing, selector computation, argument encoding, return decoding).

`npm run build` gates on `tsc -b`, so a type error fails the build.

### Project layout

```
src/
  App.tsx              tool registry, shell, and all 14 workbenches
  components/ui.tsx    Button, Input, Select, Combobox, Tabs, Panel, Notice, EmptyState, Modal, …
  lib/i18n.ts          345 bilingual strings + provider and hooks
  lib/chains.ts        chain registry and endpoint resolution
  lib/rpc.ts           read-only JSON-RPC transport
  lib/evm.ts           storage slot maths, ABI decoding, Solidity source parsing
  index.css            design tokens and base styles
index.html             theme pre-resolution, metadata
```

`App.tsx` is intentionally one file: 14 workbenches share the same hooks, helpers, and registry, and splitting them would scatter a single coherent surface across a dozen modules without making any of them easier to read.

### Deployment

GitHub Pages via `.github/workflows/`, building on every push to `main`. Custom domain `tools.timeminer.cc` through `CNAME`. See [DEPLOY.md](./DEPLOY.md) for the full walkthrough, in both languages.

---

## 中文

### 这是什么

一个静态单页工作台，包含四个分区共 15 个工具：

| 分区 | 工具 |
|---|---|
| 逆向安全（7） | 存储槽检查器、源码槽位解析器、代理槽探测器、合约调用读取、Calldata 解码器、单位转换器、4Byte / Selector 查询 |
| 编码与密码（4） | 编码与哈希套件、对称加密、JWT 检查器、进制转换器 |
| 通用开发（3） | JSON 工作台、时间戳工具、文本对比 |
| 通用工具（1） | 时间看盘 |

打开即进入工具，没有落地页、没有登录、没有后端。

### 设计系统

视觉层由四组 token 组成，每组只承担一件事。一个颜色绝不表示两种含义。

**中性色**——带色相而非纯灰，让页面有调性，但又不用饱和度去做装饰：

| Token | 暗色 | 亮色 |
|---|---|---|
| `--canvas` | `222 26% 6.5%` | `220 22% 97%` |
| `--surface` | `222 20% 10.5%` | `0 0% 100%` |
| `--panel` | `222 22% 8.5%` | `220 24% 96%` |
| `--line` | `222 15% 24%` | `220 16% 85%` |
| `--text` | `214 26% 94%` | `222 30% 14%` |
| `--muted` | `216 14% 67%` | `220 13% 42%` |
| `--faint` | `216 12% 54%` | `220 10% 45%` |

**动作色**——只用于可交互元素：按钮、焦点环、选中的 Tab、链接。绝不做面板边框，绝不做阴影。

| Token | 暗色 | 亮色 |
|---|---|---|
| `--accent` | `217 90% 70%` | `221 83% 46%` |
| `--accent-fg` | `222 40% 7%` | `0 0% 100%` |

**身份色**——表示工具属于哪个分区。只允许出现在四个位置：左栏竖条、工具列表图标、分类 chip、命令面板图标。「通用工具」故意不设色——一个兜底分区不该和两个真正的分区抢注意力。

| Token | 暗色 | 亮色 |
|---|---|---|
| `--family-reverse` | `262 60% 68%` | `262 55% 46%` |
| `--family-dev` | `180 45% 52%` | `183 90% 26%` |
| `--family-general` | `216 12% 54%` | `220 10% 45%` |

**语义色**——表示结果是什么状态。必须搭配图标或文字，绝不只靠颜色传达。

| Token | 暗色 | 亮色 | 用在哪 |
|---|---|---|---|
| `--ok` | `158 50% 52%` | `158 62% 29%` | 交易中、已完成、diff 新增 |
| `--warn` | `36 85% 63%` | `28 90% 35%` | 盘前盘后、夏令时、扫描不完整 |
| `--danger` | `356 75% 68%` | `356 66%` | 已撤回、错误、diff 删除 |

**硬性规则。** 不用渐变。不用彩色阴影。不用大块彩色背景。彩色像素占比控制在单屏 5% 以内。accent 只给能点的东西。

**实测对比度**（WCAG 2.1，背景为 `--surface` / `--panel`）：

| Token | 暗色 | 亮色 |
|---|---|---|
| text | 15.32 / 16.02 | 16.38 / 14.88 |
| muted | 7.39 / 7.73 | 5.73 / 5.21 |
| faint | 4.84 / 5.07 | 5.06 / 4.59 |
| accent | 6.90 / 7.21 | 6.56 / 5.96 |
| ok | 7.90 / 8.27 | 5.44 / 4.94 |
| warn | 9.34 / 9.77 | 5.29 / 4.81 |
| danger | 5.98 / 6.26 | 6.15 / 5.58 |
| family-reverse | 5.43 / 5.68 | 7.71 / 7.01 |
| family-dev | 7.74 / 8.10 | 5.25 / 4.77 |

两套主题中的最低值：**4.59**（亮色 `faint` 落在 panel 上）。全部达到 AA。

**形状与字号。** 三档圆角：控件 `10px`、卡片 `14px`、浮层 `20px`。嵌套控件永远比容器小一档。字重上限 700，没有 900 的标题。控件高 44px，正文 14px。

### 国际化

中文和英文是平等的两个语言，不是翻译附属品。367 条用户可见字符串全部位于 `src/lib/i18n.ts`，以 `[English, 中文]` 成对存放，通过 `useT()` 与 `t(lang, key, vars)` 取用。

翻译策略是刻意划定的，也是中文模式可读的原因：

- **翻译**所有自然语言：说明、错误、空状态、字段名、面板名、按钮、工具描述、标签。
- **保留英文**那些一旦翻译就会切断用户与代码联想的协议与工具专有名：`RPC`、`mapping`、`calldata`、`selector`、`ABI`、`bytes32`、`uint256`、`JWT`、`JSON`、`Keccak`、`Base64`、`chainId`。
- **绝不在一句话里混用**两种语言，除非有明确理由。`读取原始存储槽` 是对的；`Read 原始 storage slot` 不是。

搜索同时索引中英两种文字，任何一种语言输入都能找到工具；但展示的关键词列表会按当前语言过滤——中文工具名下出现 `json / format / 格式化`，看起来就是没翻译完。

对 15 个工具在两种语言下做了全量扫描：英文模式零个中文字符，中文模式零处英文散文。

### 布局

```
┌────────────┐ ┌──────────────────────────────────────────┐
│ 品牌       │ │ 搜索 · 隐私 · 语言 · 主题 · 设置          │
├────────────┤ └──────────────────────────────────────────┘
│ 分区       │  分类 / 工具 id / 链
│  · 工具    │  工具名称
│  · 工具    │  单行描述                          [标签]
│            │  ┌──────────┐ ┌──────────┐ ┌── 工具 ───┐
│            │  │ 输入面板 │ │ 结果面板 │ ├── 最近 ───┤
│ [设置]     │  │          │ │          │ ├── 广告 ───┤
└────────────┘  └──────────┘ └──────────┘ └───────────┘
```

- 固定 260px 左栏、284px 右栏，中间工作台自适应。
- 工作台分两栏：左边输入，右边结果。
- 小于 `1024px` 时左栏收成横向选择器；小于 `768px` 时顶栏堆叠。
- 明暗两套配色**独立调过**，不是算法反色。主题在首帧之前由 `index.html` 的内联脚本解析完成，深色用户不会看到白屏闪烁。

### 本地运行

```bash
npm install
npm run dev      # http://127.0.0.1:5173/
npm run build    # 静态产物输出到 dist/
npm test         # 56 个单元测试
```

需要 Node 22 或更高版本（与 CI 一致）。

### 链支持

链元数据在 `src/lib/chains.ts`，只读传输层在 `src/lib/rpc.ts`。

| 链 | chainId | 默认端点 | 区块浏览器 |
|---|---|---|---|
| Ethereum Mainnet | 1 | Alchemy / Infura BYOK | etherscan.io |
| Sepolia Testnet | 11155111 | Alchemy / Infura BYOK | sepolia.etherscan.io |
| Polygon Mainnet | 137 | Alchemy / Infura BYOK | polygonscan.com |
| BNB Smart Chain | 56 | Alchemy BYOK | bscscan.com |
| Anubis Mainnet | 6714 | `https://rpc.anubispace.org`（无需 Key） | browser.anubispace.org |
| 自定义 EVM 链 | 用户提供 | 用户提供 RPC 地址 | — |

端点优先级是明确的：**RPC 地址覆盖 → 内置公共 RPC → Alchemy Key → Infura Key**。服务商 Key 绝不会用于该服务商不支持的链，因此配置错误的 Key 会直接报错，而不是静默读到另一条网络。

每次存储槽与代理读取都会：

1. 调用 `eth_chainId` 校验，不匹配立即中止；
2. 把 `latest` 解析为具体区块号；
3. 输出链名、chainId、端点主机与确切读取区块。

这样任何结果都能事后在同一区块复查。mapping 扫描走 JSON-RPC batch（每片 20 条），端点不支持 batch 时自动降级为串行请求。

新增一条 EVM 链只需一行注册：

```ts
{ id: "anubis", chainId: 6714, label: "Anubis Mainnet", shortLabel: "Anubis",
  rpcUrl: "https://rpc.anubispace.org", explorer: "https://browser.anubispace.org", nativeSymbol: "DAI" },
```

### 读取合约（eth_call）

「合约调用读取」在本地完成编码，再通过 `eth_call` 发出去：

1. 解析 `name(type,...)`，可选带 `returns (...)`。
2. 由规范签名算出 4 字节 selector —— calldata 预览随输入实时更新。
3. ABI 编码参数（uint/int、bool、address、bytesN、bytes、string、数组）。
4. 每个区块发一次 `eth_call`，再解码返回数据。

几个关键点：

- 声明 `returns (uint256)` 才能精确解码；不声明时仍会按 uint256 展示数值，而不是什么都不显示。
- 区块列表每行一个，会并排展示并给出「是否相同」的判定。
- `eth_call` 不改变状态、不消耗 gas，只能用于 view 与 pure 函数。

**archive 端点很关键。** 公共节点通常读不到历史状态。当节点返回 `archive`、`missing trie node`、`header not found` 或 `unknown state` 时，工具会明确指出是哪个区块失败，并提示去设置里换端点，而不是把节点原文甩出来。

### 免费端点

设置页按链列出了无需 Key 的公共 RPC，每一条都经过实测才收录。写作时的验证结果：

| 链 | 端点 | 历史状态 |
|---|---|---|
| Ethereum | `ethereum-rpc.publicnode.com` | 否 |
| Ethereum | `eth.drpc.org` | 是 |
| Ethereum | `cloudflare-eth.com` | 否 |
| Ethereum | `eth-mainnet.public.blastapi.io` | 是 |
| Sepolia | `ethereum-sepolia-rpc.publicnode.com` | 否 |
| Polygon | `polygon-bor-rpc.publicnode.com` | 否 |
| Polygon | `polygon.drpc.org` | 否 |
| BSC | `bsc-dataseed1.bnbchain.org` | 否 |
| BSC | `bsc-dataseed2.bnbchain.org` | 否 |
| BSC | `rpc.48.club` | 否 |
| BSC | `bsc-rpc.publicnode.com` | 否 |
| BSC | `bsc-mainnet.public.blastapi.io` | 是 |
| BSC | `bsc-mainnet.nodereal.io/v1/…`（公共演示 Key） | 是 |
| Anubis | `rpc.anubispace.org` | 否 |

「历史状态」指测试时对较早区块执行 `eth_call` 成功。公共端点会变动、会限流，所以 UI 如实报告失败，且任何 URL 都可以手动覆盖。

### 隐私模型

- 凡能在本地完成的都本地完成：哈希、编码、单位换算、时间戳计算、JSON、文本对比、AES-GCM、JWT 解析。
- 链上读取是唯一的外发请求，且只发生在两个工具里：存储槽检查器与代理槽探测器。
- **隐私优先模式**用一个开关同时停用 RPC、广告与远程查询。开启后链上工具会直接拒绝执行，而不是悄悄降级。
- API Key 与偏好设置存在你自己浏览器的 `localStorage` 里，没有服务器可以接收它们。
- 全站不签名、不发交易、不接受私钥输入。

### 测试

`npm test` 运行 56 个单元测试，覆盖链解析（端点优先级、自定义链校验、URL 规范化）、JSON-RPC 传输层（批量处理、串行降级、错误解码），以及 ABI 编解码（类型解析、selector 计算、参数编码、返回解码）。

`npm run build` 以 `tsc -b` 为前置条件，类型错误会直接让构建失败。

### 项目结构

```
src/
  App.tsx              工具注册表、应用外壳与全部 14 个工具工作台
  components/ui.tsx    Button、Input、Select、Combobox、Tabs、Panel、Notice、EmptyState、Modal 等
  lib/i18n.ts          345 条双语字符串 + Provider 与 hooks
  lib/chains.ts        链注册表与端点解析
  lib/rpc.ts           只读 JSON-RPC 传输层
  lib/evm.ts           存储槽计算、ABI 解码、Solidity 源码解析
  index.css            设计 token 与基础样式
index.html             主题预解析、元信息
```

`App.tsx` 是一个文件是有意为之：14 个工作台共享同一批 hooks、helper 与注册表，拆开只会把一个连贯的界面打散到十几个模块里，并不会让任何一块更好读。

### 部署

通过 `.github/workflows/` 部署到 GitHub Pages，每次推送到 `main` 触发构建。自定义域名 `tools.timeminer.cc` 由 `CNAME` 指定。完整步骤见 [DEPLOY.md](./DEPLOY.md)。
