# Timeminer Tools 产品文档

[English](#english) · [中文](#中文)

> 本文档描述**当前分支实际实现的内容**。所有标记为「未实现」的功能都是规划，不属于当前产品。
>
> This document describes **what is actually implemented on this branch**. Anything marked "Not built" is a plan, not part of the current product.

---

## 中文

### 1. 产品定位

面向 Web3 逆向安全与日常开发的**单页工具箱**。打开即用，不做落地页。

一句话：把「查一个存储槽」「解一段 calldata」「转一个时间戳」这类高频小操作，压缩到一次打开、输入、复制之内完成。

### 2. 目标用户

| 用户 | 典型动作 |
|---|---|
| Web3 安全研究员 | 读存储槽、定位 mapping 基础槽位、探测代理实现地址、拆解 calldata |
| Solidity / 全栈开发者 | 算 selector、转单位、格式化 JSON、比对文本、换算进制 |
| 通用使用者 | 看盘、换算时间戳 |

### 3. 产品原则

1. **工具即页面**：首屏直接是工作台，没有 hero、没有宣传区。
2. **本地优先**：能在浏览器算的绝不上传。在 17 个工具中，只有存储槽检查器、代理槽探测器、合约调用读取，以及用户主动点击时的签名反查会发出网络请求；签名反查在隐私优先模式下直接阻断。
3. **只读**：不签名、不发交易、不接受私钥。整个应用没有任何写链能力。
4. **结论可复查**：每次链上读取都固定输出 chainId、端点主机与确切区块号，任何结果都能事后复现。
5. **一个颜色一个含义**：配色系统的硬约束，详见第 6 节。

### 4. 信息架构

四个分区，共 17 个工具：

| 分区 | 工具数 | 工具 |
|---|---|---|
| 逆向安全 Reverse Security | 9 | 存储槽检查器、源码槽位解析器、代理槽探测器、合约调用读取、Calldata 解码器、事件日志解码器、ABI 编解码器、单位转换器、4Byte / Selector 查询 |
| 编码与密码 Encoding & Crypto | 4 | 编码与哈希套件、对称加密、JWT 检查器、进制转换器 |
| 通用开发 Developer | 3 | JSON 工作台、时间戳工具、文本对比 |
| 通用工具 General Tools | 1 | 时间看盘 |

分区的划分依据是**任务类型**，不是工具的技术难度：需要理解合约状态的留在逆向安全，纯粹的编码/密码学/数制换算归入编码与密码。

分区用颜色区分（紫 / 青 / 中性灰），但颜色只出现在四个位置：左栏竖条、工具列表图标、分类 chip、命令面板图标。编码与密码复用青色；通用开发与通用工具都用中性色，避免为"兜底"分区再消耗一个色相。

### 5. 功能模块（全部已实现）

#### 5.1 存储槽检查器 Storage Slot Inspector

两种模式：

- **原始槽位读取**：输入合约地址 + 槽位序号（十进制或 `0x`），通过 `eth_getStorageAt` 读一个 32 字节字。输出原始 bytes32、按 `bytes32` / `bool` / `uint256` / `int256` / `address` 解码的视图、uint256 十进制值。
- **mapping 探测**：输入 mapping 声明（如 `mapping(address => bool) public _feeWhiteList;`）+ 键值。已知基础槽位时直接计算 `keccak256(abi.encode(key, slot))` 读单槽；未知时按范围扫描基础槽位，报告所有非零命中。

实现约束：

- 扫描每片 20 条走 JSON-RPC batch，端点不支持时降级串行。
- 命中上限 24 条，扫描范围上限 500 个槽位。
- **扫描结果是线索不是证明**：值为 `false` 或 `0` 时，链上存储无法区分「值为零」与「从未写入」，UI 明确提示这一点。

#### 5.2 源码槽位解析器 Source Layout Resolver

粘贴已验证 Solidity 源码或 Dedaub 反编译源码，把变量名或 getter 名解析为存储槽位与字节偏移。

- 只统计顶层状态变量，函数体跳过。
- 支持多合约文件，指定合约名后解析该合约布局。
- mapping 类型支持输入键值推导值槽位。
- `constant` / `immutable` 明确标注为不占用存储槽。

#### 5.3 代理槽探测器 Proxy Slot Finder

一次 batch 读取 ERC-1967 的三个槽位：implementation、admin、beacon。输出链名、chainId、读取区块与槽位原始值。

#### 5.4 合约调用读取 Read Contract (eth_call)

目标：按函数签名调用任意 view / pure 函数，并解码返回值；支持同一调用在多个区块的对比。

流程：

1. 解析 `name(type,...)`，可选带 `returns (...)`。
2. 由规范签名计算 4 字节 selector，calldata 预览随输入实时更新（纯本地）。
3. ABI 编码参数：支持 `uintN` / `intN` / `bool` / `address` / `bytesN` / `bytes` / `string` / 动态数组。
4. 每个区块发一次 `eth_call`，再按声明的返回类型解码。

行为细节：

- 声明 `returns (uint256)` 得到精确解码；不声明时仍把返回值按 `uint256` 展示，避免用户只看到一串十六进制。
- 多区块输入（每行一个区号）会逐块展示，并给出「所有区块结果相同 / 存在差异」的判定。
- 响应中包含原始返回数据，可展开查看、可复制。
- 参数数量不匹配、数值超出位宽、地址格式错误等，都在发送前本地拦截并给出具体原因。

**archive 依赖**：公共节点通常读不到历史状态。当节点返回 `archive` / `missing trie node` / `header not found` / `unknown state` 时，UI 会指出具体是哪个区块不可读，并提示到设置中切换 archive 端点，而不是把 RPC 原始错误直接抛给用户。

**不做的事**：不签名、不发交易、不支持 `eth_getLogs`、不支持带 value 的调用。

#### 5.5 Calldata 解码器

拆出 selector 后，把参数按声明类型解码成带类型的值，同时保留 32 字节原始字视图。

类型有两种来源，都不强制联网：手动粘贴签名（纯本地），或点击「反查签名」从 OpenChain / 4byte.directory 取候选。反查的约束：

- 只在点击时发一次请求，打字过程中零请求；隐私优先模式下在发请求之前就报错阻断。
- 每个候选都本地重算 keccak 并标记是否一致。这只是卫生过滤——4 字节 selector 只有 2³² 种取值，被挖出来的诱饵天然与真签名碰撞，工具不假装能凭哈希区分真假。
- 全部候选都展示，绝不自动选中；机器生成的名字（长数字串、`$`、首尾下划线）排在后面，并说明类型列表相同的候选在链上字节完全一致。
- 远端文本按不可信处理：剥离控制字符与双向覆盖符，截断长度，只以文本渲染。

#### 5.6 事件日志解码器

粘贴单条 log 的 topics 与 data：`topics[0]` 反查事件签名，`indexed` 参数从 `topics[1..]` 解码，其余从 `data` 解码。

**动态类型的 indexed 参数只存 `keccak256(value)`**，原值不可还原。UI 会明确标注这一点并展示该哈希，而不是把它当作解码结果。

#### 5.7 ABI 编解码器

四种模式：编码调用、解码 calldata、编码构造函数参数、用完整 ABI JSON 解码。

类型系统覆盖完整 Contract ABI：整数、`bool`、`address`、`bytesN`、`bytes`、`string`、定长与动态数组、嵌套数组、任意深度 tuple。ABI JSON 模式保留 struct 字段名，并按 calldata 里的 selector 自动匹配函数。

解码是 fail-closed 的：边界检查、脏高位校验、声明长度越界即报错。编码与解码的正确性由 Foundry `cast` 生成的 310 条 Keccak 向量、21 条 ABI 形状向量与 240 例冻结差分语料共同锁定。

#### 5.8 单位转换器

在 `wei` / `gwei` / `ether` / 自定义代币精度之间双向换算，基于 `BigInt`，不使用浮点数。小数位数超出精度时直接报错。

#### 5.9 4Byte / Selector 查询

正向：本地按**规范化形式**计算 `keccak256`，输出函数 selector（前 4 字节）与事件 topic0（完整 32 字节）。空格、参数名、`indexed` 都不会影响结果。不发网络请求。

#### 5.10 编码与哈希套件

七种模式：Keccak256、SHA-256、SHA-1、Base64 编码/解码、URL 编码/解码。全部本地执行（SHA 系列走 `crypto.subtle`）。

#### 5.11 对称加密

AES-GCM 加解密试验台：

- PBKDF2-SHA-256 派生密钥，100,000 次迭代，随机 16 字节盐。
- 随机 12 字节 IV。
- 输出自描述 JSON 密文包（`v`、`alg`、`kdf`、`iterations`、`iv`、`salt`、`data`），可直接粘贴回来解密。
- 密钥不落盘、不出浏览器。

#### 5.12 JWT 检查器

本地 Base64URL 解码 header 与 payload，输出算法、过期时间与状态（已过期 / 有效或未知）。**不验证签名**——这一点在 UI 上应被理解为「解码」而非「校验」。

#### 5.13 JSON 工作台

格式化、压缩、校验 JSON，并可推断 TypeScript 类型骨架。

#### 5.14 时间戳工具

- **单条解析**：时间戳（秒 / 毫秒 / 微秒 / 纳秒，或自动识别）与日期字符串互转，支持任意 IANA 时区。
- **批量转换**：逐行粘贴，输出表格并可复制为 CSV。
- 附带实时 Unix 时钟、单位切换、暂停、`±1h` / `±1d` 快捷调整。
- 输出包含 ISO 8601、SQL UTC、当地时区、年内第几天、ISO 周。

#### 5.15 进制转换器

2–36 进制任意互转，基于 `BigInt`。支持 `0x` / `0b` / `0o` 前缀（且必须与输入进制匹配）、大写输出、二进制与十六进制分组显示。

#### 5.16 文本对比

逐行 LCS 差异比对，输出 `+` 新增 / `-` 删除 / 空格 未变的行级结果。纯本地。

#### 5.17 时间看盘

- 北京 / 香港 / 纽约三地实时时钟。
- 美股、A 股、港股三个市场的交易状态、开盘/收盘倒计时、时段条。
- 美国夏令时状态与下一次切换时间。

已知边界（UI 中有明确提示）：未纳入节假日（美国感恩节、A 股春节/国庆等）与临时休市，仅按周一至周五与常规时段计算。

### 6. 设计系统

四组 token，每组只承担一件事。

**中性色**：带色相而非纯灰，饱和度为 10–26%，让页面有调性但不靠饱和度做装饰。

| Token | 暗色 | 亮色 |
|---|---|---|
| `--canvas` | `222 26% 6.5%` | `220 22% 97%` |
| `--surface` | `222 20% 10.5%` | `0 0% 100%` |
| `--panel` | `222 22% 8.5%` | `220 24% 96%` |
| `--line` | `222 15% 24%` | `220 16% 85%` |
| `--text` | `214 26% 94%` | `222 30% 14%` |
| `--muted` | `216 14% 67%` | `220 13% 42%` |
| `--faint` | `216 12% 54%` | `220 10% 45%` |

**动作色**：只用于可交互元素。

| Token | 暗色 | 亮色 |
|---|---|---|
| `--accent` | `217 90% 70%` | `221 83% 46%` |
| `--accent-fg` | `222 40% 7%` | `0 0% 100%` |

**身份色**：只用于分区识别。

| Token | 暗色 | 亮色 |
|---|---|---|
| `--family-reverse` | `262 60% 68%` | `262 55% 46%` |
| `--family-dev` | `180 45% 52%` | `183 90% 26%` |
| `--family-general` | `216 12% 54%` | `220 10% 45%` |

**语义色**：只用于表达状态，必须配图标或文字。

| Token | 暗色 | 亮色 |
|---|---|---|
| `--ok` | `158 50% 52%` | `158 62% 29%` |
| `--warn` | `36 85% 63%` | `28 90% 35%` |
| `--danger` | `356 75% 68%` | `356 66% 44%` |

**禁止清单**：渐变、彩色阴影、大块彩色背景。彩色像素占比目标 ≤5%。

**形状**：控件 `10px`、卡片 `14px`、浮层 `20px`。嵌套控件比容器小一档。

**字重**：上限 700，无 900。正文 400，面板标题 600。

**对比度**：两套主题全部 token 达到 WCAG AA（最低 4.59，为亮色 `faint` 落在 panel 上）。完整数值见 README。

### 7. 国际化

**已实现，且中英对等。**

- 462 条用户可见字符串，全部位于 `src/lib/i18n.ts`，`[English, 中文]` 成对存放。
- 通过 `LanguageContext` + `useT()` 取用；需要语言参数的纯函数用 `t(lang, key, vars)`。
- 支持占位符插值（如 `{count}`、`{time}`）。

**翻译策略**（这是中文模式可读的关键）：

- 翻译所有自然语言：说明、错误、空状态、字段名、面板名、按钮、工具描述、标签。
- 保留英文的协议/工具专有名：`RPC`、`mapping`、`calldata`、`selector`、`ABI`、`bytes32`、`uint256`、`JWT`、`JSON`、`Keccak`、`Base64`、`chainId`。理由：翻译后会切断用户与所输入代码的联想。
- 不在一句话里混用两种语言。

**搜索与展示**：搜索索引中英双语，任一语言输入均可命中；但关键词列表按当前语言过滤展示，避免中文工具名下出现 `json / format / 格式化`。

**语言相关格式化**：

- 相对时间使用 `Intl.RelativeTimeFormat`，按 `zh-CN` / `en` 渲染。
- 日期时间使用 `Intl.DateTimeFormat`，支持任意 IANA 时区与夏令时。
- 星期、市场状态、盘前盘后、夏令时名称全部双语。

**已审计**：17 个工具 × 2 语言全量扫描，英文模式零 CJK 泄漏，中文模式零英文散文泄漏。

**主题与语言的持久化**：存于 `localStorage` 的 `timeminer-react-state`。主题在首帧前由内联脚本解析，深色用户不会闪白。

### 8. 技术架构（实际）

**前端**：Vite 6 + React 19 + TypeScript 5.7 + Tailwind CSS 3.4，lucide-react 图标。纯静态，无后端、无路由。

**源码结构**：

```
src/
  App.tsx              工具注册表、外壳、14 个工作台
  components/ui.tsx    基础组件（Button/Input/Select/Combobox/Tabs/Panel/Notice/EmptyState/Modal/…）
  lib/i18n.ts          345 条双语字符串 + Provider + hooks
  lib/chains.ts        链注册表与端点解析
  lib/rpc.ts           只读 JSON-RPC 传输
  lib/evm.ts           存储槽计算、ABI 解码、Solidity 源码解析
  index.css            设计 token 与基础样式
```

**依赖约束**：运行时依赖只有 `react`、`react-dom`、`lucide-react`。没有路由库、没有状态管理库、没有 i18n 库、没有 UI 组件库——全部手写，目的是控制体积与行为可预测性。

**未实现（规划中）**：后端 RPC 代理、`/api/*` 服务端路由、IP 限流、Next.js/next-intl 迁移。当前架构是纯静态站点，这些都不存在。

### 9. 链支持

| 链 | chainId | 默认端点 | 原生代币 |
|---|---|---|---|
| Ethereum Mainnet | 1 | Alchemy / Infura BYOK | ETH |
| Sepolia Testnet | 11155111 | Alchemy / Infura BYOK | ETH |
| Polygon Mainnet | 137 | Alchemy / Infura BYOK | POL |
| BNB Smart Chain | 56 | Alchemy BYOK | BNB |
| Anubis Mainnet | 6714 | `https://rpc.anubispace.org`（无需 Key） | DAI |
| 自定义 EVM 链 | 用户提供 | 用户提供 RPC 地址 | — |

**端点优先级**：RPC 地址覆盖 → 内置公共 RPC → Alchemy Key → Infura Key。服务商 Key 绝不会用于该服务商不支持的链，配置错误会报错而非静默换链。

**每次读取的固定动作**：

1. `eth_chainId` 校验，不匹配立即中止；
2. `latest` 解析为具体区块号；
3. 输出 chainId、端点主机、读取区块。

**RPC 方法**：应用只调用只读方法（`eth_chainId`、`eth_getStorageAt`、`eth_blockNumber` 等）。不存在发交易的方法调用路径。

### 10. 隐私与存储

**本地存储**（`localStorage`）：

- `timeminer-react-state`：当前分类、当前工具、主题、语言、最近使用（存 8 条、展示 5 条）、设置快照。
- `timeminer-tools-settings`：Alchemy / Infura Key、默认链、自定义链与 RPC 地址、隐私模式开关。

**不保存**：输入过的合约地址、calldata、JWT、明文/密文、对比文本、计算历史。

**隐私优先模式**：一个开关同时停用 RPC、广告与远程查询。开启后链上工具直接拒绝执行并提示，不静默降级。

**无遥测**：不埋点、不上报错误、无第三方统计脚本。

### 11. 广告位

右栏保留一个 `300 × 250` 占位块，当前不含任何广告代码。隐私优先模式下显示为停用状态。

约束（如未来接入）：不放第三方脚本、不做行为定向、不读取本地计算内容。

### 12. 测试与构建

- `npm test`：56 个单元测试，覆盖链解析（端点优先级、自定义链校验、URL 规范化）、JSON-RPC 传输层（批量、串行降级、错误解码），以及 ABI 编解码（类型解析、selector 计算、静态与动态参数编码、返回数据解码、archive 错误识别）。
- `npm run build`：先跑 `tsc -b`，类型错误直接失败；产物输出到 `dist/`。
- 当前产物体积：JS ≈ 346 kB（gzip ≈ 108 kB），CSS ≈ 24 kB（gzip ≈ 5.5 kB）。

### 13. 明确不做

- 任何涉及私钥、签名、发交易的功能。
- 任何需要上传用户数据的服务端处理。
- 支付卡生成、撞库、绕过风控类工具。
- 营销落地页。

### 14. 一句话总结

14 个只读工具，四层配色，中英对等，静态部署，无后端。

---

## English

### 1. Positioning

A **single-page toolbox** for Web3 reverse engineering and everyday development work. Open it and start typing; there is no landing page.

In one line: compress high-frequency micro-tasks — read a storage slot, decode calldata, convert a timestamp — into open, type, copy.

### 2. Users

| User | Typical actions |
|---|---|
| Web3 security researcher | read raw slots, locate a mapping base slot, find a proxy implementation, split calldata |
| Solidity / full-stack developer | compute selectors, convert units, format JSON, diff text, convert radix |
| General user | market clock, timestamp conversion |

### 3. Principles

1. **A tool is the page.** The first screen is the workbench. No hero, no marketing section.
2. **Local first.** Anything the browser can compute, the browser computes. Of the 17 tools, only Storage Slot Inspector, Proxy Slot Finder, Read Contract, and an explicitly triggered signature lookup make network requests; Privacy First Mode blocks the lookup outright.
3. **Read-only.** No signing, no transactions, no private keys. The app has no write path to any chain.
4. **Results are re-checkable.** Every chain read reports chainId, endpoint host, and the exact block number, so any output can be reproduced later.
5. **One colour, one meaning.** A hard constraint on the palette; see section 6.

### 4. Information architecture

Four sections, 17 tools:

| Section | Count | Tools |
|---|---|---|
| Reverse Security | 9 | Storage Slot Inspector, Source Layout Resolver, Proxy Slot Finder, Read Contract (eth_call), Calldata Decoder, Event Log Decoder, ABI Encoder / Decoder, Unit Converter, 4Byte / Selector Finder |
| Encoding & Crypto | 4 | Encoder / Hash Suite, Symmetric Encryption, JWT Inspector, Base Converter |
| Developer | 3 | JSON Studio, Timestamp Pro, Text Compare |
| General Tools | 1 | Market Clock |

Sections split by **task type**, not technical difficulty: anything needing contract state stays in Reverse Security; pure encoding, cryptography, and radix work moves to Encoding & Crypto.

Sections are colour-coded (violet / teal / neutral), but that colour appears in exactly four places: the rail stripe, the tool list icon, the category chip, and the command palette icon. Encoding & Crypto reuses the teal; Developer and General Tools are both neutral, so no extra hue is spent on a catch-all section.

### 5. Tools (all implemented)

#### 5.1 Storage Slot Inspector

Two modes:

- **Raw slot read** — contract address plus a slot index (decimal or `0x`) reads one 32-byte word via `eth_getStorageAt`. Outputs the raw bytes32, decoded views as `bytes32` / `bool` / `uint256` / `int256` / `address`, and the decimal uint256 value.
- **Mapping probe** — takes a mapping declaration (e.g. `mapping(address => bool) public _feeWhiteList;`) and a key. With a known base slot it computes `keccak256(abi.encode(key, slot))` and reads that single slot; without one it scans a range of base slots and reports every non-zero hit.

Implementation constraints:

- Scans run 20 calls per JSON-RPC batch and fall back to sequential requests when the endpoint rejects batching.
- 24 match limit; 500-slot scan ceiling.
- **A scan is evidence, not proof.** When the expected value is `false` or `0`, chain storage cannot distinguish "value is zero" from "never written". The UI says so explicitly.

#### 5.2 Source Layout Resolver

Paste verified Solidity or Dedaub decompiled source, then resolve a variable or getter name to its storage slot and byte offset.

- Only top-level state variables are counted; function bodies are skipped.
- Multi-contract files are supported by naming the deployed contract.
- Mapping types accept a key to derive the value slot.
- `constant` / `immutable` are explicitly marked as not occupying storage.

#### 5.3 Proxy Slot Finder

Reads the three ERC-1967 slots (implementation, admin, beacon) in one batch, reporting chain name, chainId, block read, and raw slot values.

#### 5.4 Read Contract (eth_call)

Goal: call any view or pure function by signature, decode the result, and compare the same call across blocks.

Flow:

1. Parse `name(type,...)`, optionally with `returns (...)`.
2. Compute the 4-byte selector from the canonical signature; the calldata preview updates as you type, entirely locally.
3. ABI-encode the arguments: `uintN` / `intN` / `bool` / `address` / `bytesN` / `bytes` / `string` / dynamic arrays.
4. One `eth_call` per requested block, then decode by the declared return types.

Behaviour details:

- Declaring `returns (uint256)` decodes exactly; without it the value is still shown as a uint256, so the user is never left with a bare hex string.
- A block list (one per line) produces a per-block readout plus a same/different verdict.
- The raw return data is included, expandable and copyable.
- Argument count mismatches, out-of-range numbers, and malformed addresses are caught locally before anything is sent, with the specific reason.

**Archive dependency**: public nodes usually cannot serve historical state. When a node answers with `archive`, `missing trie node`, `header not found`, or `unknown state`, the UI names the block that failed and points at the endpoint picker rather than surfacing the RPC error verbatim.

**Out of scope**: no signing, no transactions, no `eth_getLogs`, no value-bearing calls.

#### 5.5 Calldata Decoder

Splits the selector off and decodes the arguments into typed values, keeping the raw 32-byte word view alongside.

Types come from one of two places, neither forced to the network: a pasted signature (entirely local), or the "look up signature" button, which queries OpenChain and 4byte.directory. That lookup is constrained on purpose:

- One request per explicit click; nothing is sent while typing, and Privacy First Mode refuses before any request is made.
- Every candidate is re-hashed locally and flagged when it disagrees. This is hygiene, not a security boundary — a 4-byte selector has only 2³² values, so mined decoys collide with real ones by construction.
- Every candidate is shown and none is auto-selected. Machine-generated names (long digit runs, `$`, leading/trailing underscores) sort last, and a note states that candidates with the same type list are byte-identical on the wire.
- Remote text is untrusted: control characters and bidirectional overrides are stripped, length is capped, and results render as text only.

#### 5.6 Event Log Decoder

Paste one log's topics and data: `topics[0]` resolves the event, `indexed` parameters decode from `topics[1..]`, and the rest decode from `data`.

**An indexed parameter with a dynamic type stores only `keccak256(value)`** — the value cannot be recovered. The UI says so and shows the hash, instead of presenting it as a decoded value.

#### 5.7 ABI Encoder / Decoder

Four modes: encode a call, decode calldata, encode constructor arguments, decode against a full ABI JSON.

The type system is the complete Contract ABI: integers, `bool`, `address`, `bytesN`, `bytes`, `string`, fixed and dynamic arrays, nested arrays, and tuples at any depth. ABI JSON mode keeps struct field names and matches the function by the selector in the calldata.

Decoding is fail-closed: bounds checks, dirty-high-bit validation, and a hard error when a declared length exceeds the payload. Correctness is pinned by 310 Keccak vectors, 21 hand-picked ABI shapes, and a frozen 240-case differential corpus generated with Foundry `cast`.

#### 5.8 Unit Converter

Bidirectional conversion between `wei` / `gwei` / `ether` / custom token precision, using `BigInt` throughout — no floats. Excess decimal places fail loudly.

#### 5.9 4Byte / Selector Finder

Computes `keccak256` locally and returns the function selector (first 4 bytes) and event topic0 (full 32 bytes). No network request.

#### 5.10 Encoder / Hash Suite

Seven modes: Keccak256, SHA-256, SHA-1, Base64 encode/decode, URL encode/decode. All local; the SHA family uses `crypto.subtle`.

#### 5.11 Symmetric Encryption

An AES-GCM playground:

- PBKDF2-SHA-256 key derivation, 100,000 iterations, random 16-byte salt.
- Random 12-byte IV.
- Outputs a self-describing JSON bundle (`v`, `alg`, `kdf`, `iterations`, `iv`, `salt`, `data`) that can be pasted straight back for decryption.
- Keys are never persisted and never leave the browser.

#### 5.12 JWT Inspector

Decodes the header and payload with Base64URL locally and reports algorithm, expiry, and status (expired / active or unknown). **The signature is not verified** — this is decoding, not validation, and the UI should be read that way.

#### 5.13 JSON Studio

Format, minify, validate, and infer a TypeScript shape skeleton from JSON.

#### 5.14 Timestamp Pro

- **Single parse** — convert between timestamps (seconds, milliseconds, microseconds, nanoseconds, or auto-detected) and date strings across any IANA timezone.
- **Batch convert** — paste line by line, get a table you can copy out as CSV.
- Ships with a live Unix clock, unit switching, pause, and `±1h` / `±1d` quick adjustments.
- Output includes ISO 8601, SQL UTC, the selected zone, day of year, and ISO week.

#### 5.15 Base Converter

Any radix from 2 to 36, `BigInt` based. Accepts `0x` / `0b` / `0o` prefixes (which must match the input radix), uppercase output, and grouped binary/hex display.

#### 5.16 Text Compare

Line-level LCS diff with `+` added, `-` removed, and unchanged lines. Purely local.

#### 5.17 Market Clock

- Live clocks for Beijing, Hong Kong, and New York.
- Trading state, open/close countdown, and session bars for US, A-share, and HK markets.
- US daylight-saving state and the next transition.

Known boundary, stated in the UI: holidays (US Thanksgiving, A-share Spring Festival and National Day, etc.) and unscheduled halts are not modelled — only Monday to Friday and regular session hours.

### 6. Design system

Four token families, each with exactly one job.

**Neutral** — tinted rather than pure grey, 10–26% saturation, so the page has a hue without spending saturation on decoration.

| Token | Dark | Light |
|---|---|---|
| `--canvas` | `222 26% 6.5%` | `220 22% 97%` |
| `--surface` | `222 20% 10.5%` | `0 0% 100%` |
| `--panel` | `222 22% 8.5%` | `220 24% 96%` |
| `--line` | `222 15% 24%` | `220 16% 85%` |
| `--text` | `214 26% 94%` | `222 30% 14%` |
| `--muted` | `216 14% 67%` | `220 13% 42%` |
| `--faint` | `216 12% 54%` | `220 10% 45%` |

**Action** — interactive affordances only.

| Token | Dark | Light |
|---|---|---|
| `--accent` | `217 90% 70%` | `221 83% 46%` |
| `--accent-fg` | `222 40% 7%` | `0 0% 100%` |

**Identity** — section recognition only.

| Token | Dark | Light |
|---|---|---|
| `--family-reverse` | `262 60% 68%` | `262 55% 46%` |
| `--family-dev` | `180 45% 52%` | `183 90% 26%` |
| `--family-general` | `216 12% 54%` | `220 10% 45%` |

**State** — result meaning only, always paired with an icon or a word.

| Token | Dark | Light |
|---|---|---|
| `--ok` | `158 50% 52%` | `158 62% 29%` |
| `--warn` | `36 85% 63%` | `28 90% 35%` |
| `--danger` | `356 75% 68%` | `356 66% 44%` |

**Forbidden list**: gradients, coloured shadows, large coloured fills. Target for coloured pixels: ≤5% of any screen.

**Shape**: `10px` controls, `14px` cards, `20px` overlays. Nested controls sit one step below their container.

**Weight**: 700 maximum, no 900. Body 400, panel titles 600.

**Contrast**: every token meets WCAG AA in both themes (lowest 4.59, light `faint` on panel). Full table in the README.

### 7. Internationalisation

**Implemented, and the two languages are peers.**

- 462 user-facing strings live in `src/lib/i18n.ts` as `[English, 中文]` pairs.
- Reached through `LanguageContext` + `useT()`; pure helpers that need a language take `t(lang, key, vars)`.
- Placeholder interpolation is supported (`{count}`, `{time}`).

**Translation policy** — this is what keeps Chinese mode readable:

- Translate all natural language: instructions, errors, empty states, field labels, panel names, buttons, tool descriptions, badges.
- Keep in English the protocol and tooling terms whose translated form cuts the user's link to the code they are typing: `RPC`, `mapping`, `calldata`, `selector`, `ABI`, `bytes32`, `uint256`, `JWT`, `JSON`, `Keccak`, `Base64`, `chainId`.
- Never mix the two inside one phrase.

**Search vs display**: search indexes both scripts so either language finds the tool, but the keyword list is filtered to the active language — `json / format / 格式化` under a Chinese tool name reads as an unfinished translation.

**Locale-aware formatting**:

- Relative time via `Intl.RelativeTimeFormat` (`zh-CN` / `en`).
- Date and time via `Intl.DateTimeFormat`, any IANA zone, DST handled.
- Weekday names, market state, pre/post-market labels, and DST naming are all bilingual.

**Audited**: all 17 tools in both languages. Zero CJK characters in English mode, zero English prose in Chinese mode.

**Persistence**: theme and language live in `localStorage` under `timeminer-react-state`. The theme is resolved before first paint by an inline script, so dark-mode users never see a white flash.

### 8. Architecture (actual)

**Frontend**: Vite 6, React 19, TypeScript 5.7, Tailwind CSS 3.4, lucide-react icons. Fully static — no backend, no router.

**Source layout**:

```
src/
  App.tsx              tool registry, shell, all 14 workbenches
  components/ui.tsx    primitives (Button/Input/Select/Combobox/Tabs/Panel/Notice/EmptyState/Modal/…)
  lib/i18n.ts          345 bilingual strings + provider + hooks
  lib/chains.ts        chain registry and endpoint resolution
  lib/rpc.ts           read-only JSON-RPC transport
  lib/evm.ts           storage slot maths, ABI decoding, Solidity source parsing
  index.css            design tokens and base styles
```

**Dependency constraint**: the shipped bundle contains only React, React DOM, and lucide-react icons. No router, no state library, no i18n library, no component library — those are hand-written, to keep the bundle small and the behaviour predictable.

**Not built (planned)**: backend RPC proxy, `/api/*` server routes, IP rate limiting, Next.js / next-intl migration. The current architecture is a static site; none of these exist.

### 9. Chain support

| Chain | chainId | Default endpoint | Native |
|---|---|---|---|
| Ethereum Mainnet | 1 | Alchemy / Infura BYOK | ETH |
| Sepolia Testnet | 11155111 | Alchemy / Infura BYOK | ETH |
| Polygon Mainnet | 137 | Alchemy / Infura BYOK | POL |
| BNB Smart Chain | 56 | Alchemy BYOK | BNB |
| Anubis Mainnet | 6714 | `https://rpc.anubispace.org` (keyless) | DAI |
| Custom EVM chain | user supplied | user supplied RPC URL | — |

**Endpoint priority**: RPC URL override → bundled public RPC → Alchemy key → Infura key. A provider key is never used on a chain that provider does not serve, so a misconfiguration errors instead of silently switching networks.

**Every read does the same three things**:

1. Verify `eth_chainId`; abort on mismatch.
2. Resolve `latest` to a concrete block number.
3. Report chainId, endpoint host, and the block read.

**RPC methods**: the app only calls read-only methods (`eth_chainId`, `eth_getStorageAt`, `eth_blockNumber`, and similar). There is no code path that sends a transaction.

### 10. Privacy and storage

**`localStorage` contents**:

- `timeminer-react-state` — active section, active tool, theme, language, recent tools (8 stored, 5 shown), settings snapshot.
- `timeminer-tools-settings` — Alchemy / Infura keys, default chain, custom chain and RPC URL, privacy-mode flag.

**Never stored**: contract addresses you entered, calldata, JWTs, plaintext or ciphertext, compared text, calculation history.

**Privacy First Mode**: one switch disables RPC, ads, and remote lookups. In that mode chain tools refuse to run and say so, rather than degrading silently.

**No telemetry**: no analytics, no error reporting, no third-party scripts.

### 11. Ad slot

The right rail keeps a `300 × 250` placeholder with no ad code in it. It shows as disabled in Privacy First Mode.

Constraints if it is ever filled: no third-party scripts, no behavioural targeting, no reading of local calculation content.

### 12. Testing and build

- `npm test` — 56 unit tests covering chain resolution (endpoint priority, custom chain validation, URL normalisation), the JSON-RPC transport (batching, sequential fallback, error decoding), and the ABI codec (type parsing, selector computation, static and dynamic argument encoding, return decoding, archive-error recognition).
- `npm run build` — gated on `tsc -b`; a type error fails the build. Output in `dist/`.
- Current bundle: JS ≈ 346 kB (gzip ≈ 108 kB), CSS ≈ 24 kB (gzip ≈ 5.5 kB).

### 13. Explicitly out of scope

- Anything involving private keys, signing, or sending transactions.
- Any server-side processing of user data.
- Card generation, credential stuffing, or risk-control bypass tooling.
- Marketing landing pages.

### 14. One line

14 read-only tools, a four-layer palette, English and Chinese as peers, static deployment, no backend.
