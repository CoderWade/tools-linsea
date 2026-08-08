# Linsea Tools 产品文档

## 1. 产品定位

Linsea Tools 是一个面向 Web3 逆向安全、通用开发、跨境运营与风控测试场景的高密度在线工具箱。产品目标是把 CyberChef 式的“输入即处理”、Linear/Vercel 式的极简专业界面，以及 Web3 安全工程师常用的链上调试能力整合在一个轻量、快速、隐私优先的应用中。

核心关键词：

- 极简：少装饰、强层级、低干扰。
- 高信息密度：工具结果、参数、上下文尽量同屏呈现。
- 硬核专业感：代码友好、键盘优先、可复制、可追溯。
- Privacy First：默认尽可能本地执行，联网能力必须可解释、可关闭。

## 2. 目标用户

- Web3 安全研究员：需要快速查看 storage slot、代理实现地址、calldata、bytecode、selector。
- Solidity / 后端 / 全栈开发者：需要 JSON、时间戳、文本对比、Hash、编码转换等日常工具。
- 跨境运营人员：需要利润测算、文本清洗、白底图处理、物流查询入口。
- 支付与风控测试人员：需要 Luhn 校验、BIN 查询与合规 sandbox 卡号生成。

## 3. 产品原则

1. 本地优先：凡是不需要链上节点、远端字典或第三方接口的功能，必须在浏览器本地完成。
2. 只读链上：内置 RPC 代理只允许只读 RPC 方法，不提供签名、发交易或私钥输入能力。
3. 可解释输出：关键计算结果必须展示公式、来源、原始值与复制入口。
4. 工具即页面：首屏直接进入工具工作台，不做营销落地页。
5. 键盘优先：全局搜索、工具切换、复制、格式化等高频动作支持快捷键。
6. 合规边界明确：支付卡工具只服务测试和校验，不支持真实卡生成、撞库、绕风控。

## 4. 信息架构

### 4.1 顶层导航

- Reverse Security：逆向安全与链上调试。
- Developer：通用开发工具。
- Commerce：跨境运营工具。
- Risk Testing：风控测试工具。
- Settings：全局设置。

### 4.2 全局能力

- Cmd + K / Ctrl + K 全局命令面板。
- 中英双语切换。
- 明暗主题切换。
- 纯本地模式。
- BYOK：用户自带 Alchemy / Infura API Key。
- 最近使用工具。
- 收藏工具。
- 一键复制结果。
- 输入输出样例。
- 工具状态提示：Local Only、Network Required、Privacy Sensitive、Experimental。

## 5. 功能模块

### 5.1 逆向安全

#### 5.1.1 Storage Slot Inspector

目标：查看与计算 EVM 合约存储槽，专注于原始 slot 读取与 mapping 定位。

核心功能：

- 标准 slot 计算：输入 slot index，输出 32-byte slot key。
- mapping slot 计算：输入 key、value type、base slot，计算 `keccak256(abi.encode(key, slot))`。
- 地址、uint、bytes32、bool 等常见类型输入校验。
- 支持调用 `eth_getStorageAt` 读取链上值。
- 输出原始 hex、uint256、address、bool、bytes32 多种解释视图。
- constant / immutable 明确提示：不占用 storage slot。

联网策略：

- 用户未配置 BYOK 时，通过 `/api/rpc` 代理读取。
- 用户配置 BYOK 时，前端可直接请求用户自己的 Alchemy / Infura endpoint。
- 纯本地模式开启时，只允许计算 slot，不发起 RPC 请求。

#### 5.1.2 Source Layout Resolver

目标：把已验证源码或反编译源码中的状态变量、getter 名解析成 storage slot / byte offset。

核心功能：

- 支持粘贴 verified Solidity source。
- 支持粘贴 Dedaub 反编译源码。
- 支持 `storageLayout` JSON 作为精确输入。
- 输入状态变量名或 getter 名，定位其对应 slot。
- 对 mapping 支持 key -> value slot 推导。
- 对 constant / immutable 明确提示为不占用 storage slot。
- 输出变量名、类型、slot、offset 与读槽建议。

说明：

- 已验证合约优先贴源码。
- 未验证合约可贴反编译结果做 best-effort 解析。
- 解析完成后，再回到 Storage Slot Inspector 读取链上原始值。

#### 5.1.3 Proxy Slot Finder

目标：一键探测代理合约实现地址。

支持标准：

- ERC-1967 implementation slot。
- ERC-1967 admin slot。
- ERC-1967 beacon slot。
- Beacon proxy implementation 读取。
- EIP-1822 / UUPS proxiableUUID 辅助探测。
- OpenZeppelin Transparent / UUPS 常见模式提示。

输出内容：

- Proxy address。
- Implementation address。
- Admin address。
- Beacon address。
- Chain / RPC 来源。
- Slot 原始值。
- 探测置信度。
- 风险提示：implementation 为 0、admin 异常、beacon 不可读、合约无代码等。

#### 5.1.4 Calldata Decoder

目标：解析原始 calldata，识别 selector 并尽量还原函数参数。

核心功能：

- 提取 4-byte selector。
- 本地 ABI 优先解析：用户可粘贴 ABI。
- 远端签名字典补全：支持 OpenChain / 4byte 查询。
- 多候选签名展示。
- 参数 ABI decode。
- 支持 unknown selector 的手动签名输入。
- 输出 decoded view、raw words、copyable JSON。

隐私规则：

- 纯本地模式开启时，不查询 OpenChain / 4byte。
- 用户粘贴的 calldata 不自动上传，必须由用户触发“查询签名”。

#### 5.1.5 Unit Converter

目标：高精度转换 Wei / Gwei / Ether / Token Decimals。

核心功能：

- Wei、Gwei、Ether 双向实时转换。
- 自定义 token decimals。
- 大数精度安全，禁止 JS 浮点误差污染。
- 常用 decimals 快捷项：6、8、9、18。
- 输出科学计数法、完整数字、格式化小数。

#### 5.1.6 4Byte / Selector Finder

目标：函数与事件签名 hash 生成及反查。

核心功能：

- 输入函数签名生成 selector：`transfer(address,uint256)` -> `0xa9059cbb`。
- 输入事件签名生成 topic0。
- selector / topic0 反查候选签名。
- 支持批量输入。
- 展示 Keccak256 原始 hash。

隐私规则：

- 生成 hash 本地完成。
- 反查需要外部 API，受纯本地模式控制。

#### 5.1.7 Encoder / Hash Suite

目标：提供常用编码、解码、摘要工具。

支持能力：

- MD5。
- SHA1。
- SHA256。
- Keccak256。
- Base64 encode / decode。
- URL encode / decode。
- Hex / UTF-8 转换。

安全提示：

- MD5 与 SHA1 仅用于兼容和校验，不建议用于安全签名或密码存储。

#### 5.1.8 Symmetric Encryption

目标：提供本地对称加密 / 解密工具。

支持能力：

- AES-GCM 加密 / 解密。
- AES-CBC 兼容模式。
- DES 兼容模式。
- IV / nonce 生成。
- Salt 生成。
- PBKDF2 / Argon2id 派生密钥建议。
- 输出 Base64 / Hex。

安全修正：

- 默认推荐 AES-GCM。
- DES 标记为 Legacy / Weak，不作为推荐算法。
- 密钥、明文、密文必须只在本地处理，不上传服务器。

#### 5.1.9 JWT Inspector

目标：解析 JWT 并校验过期时间。

核心功能：

- Header / Payload 解码。
- `exp`、`iat`、`nbf` 可读时间显示。
- 过期状态与剩余时间提示。
- Algorithm none / weak alg 风险提示。
- 支持 HS256 本地验签。

安全边界：

- 默认不把 token 发往任何服务器。
- 不保存用户输入 token。

### 5.2 通用开发

#### 5.2.1 JSON Studio

目标：JSON 格式化、美化、校验与结构转换。

核心功能：

- JSON format / minify。
- 错误定位。
- JSONPath 查询。
- JSON diff。
- JSON 转 TypeScript interface。
- JSON 转 Go struct。
- JSON 转 SQL table draft。
- 大 JSON 虚拟滚动展示。

#### 5.2.2 Timestamp Pro

目标：Unix 时间戳、时区与区块时间辅助转换。

核心功能：

- 秒 / 毫秒自动识别。
- UTC 与本地时区转换。
- 指定时区转换。
- 相对时间计算：now + 7d、now - 3h。
- 常见格式输出：ISO 8601、RFC 3339、SQL datetime。
- 区块时间估算：按链平均出块时间推算近似 block height。

#### 5.2.3 Text Compare

目标：并排对比两段文本并突出差异。

核心功能：

- 左右输入对比。
- 行级 diff。
- 插入、删除、修改高亮。
- 统一格式化后再比对。
- 复制差异结果。

### 5.3 跨境运营

#### 5.3.1 FBA & Landed Cost Calculator

目标：计算跨境商品利润、平台佣金、FBA 费用、进口成本与到岸成本。

核心功能：

- 商品售价、采购成本、头程运费、尾程费用、仓储费输入。
- 平台佣金比例。
- 关税 / VAT / GST。
- 汇率。
- 毛利、净利、ROI、利润率输出。
- 敏感性分析：售价变化、汇率变化、运费变化。
- 支持保存计算模板。

#### 5.3.2 Listing Text Cleaner

目标：清洗 Listing 文本并导出纯文本。

核心功能：

- 去除 HTML 标签。
- 去除多余空行。
- 去除特殊不可见字符。
- 全角 / 半角转换。
- Trim whitespace。
- Bullet point 格式整理。
- 字符数 / 单词数统计。

#### 5.3.3 Product Pure White BG

目标：将产品图片处理为纯白背景。

实现策略：

- MVP：前端 Canvas 简单抠图，适合背景颜色接近纯色的商品图。
- 增强版：接入后端或第三方图像分割接口。
- 隐私提示：用户应明确知道图片是否会离开浏览器。

核心功能：

- 上传图片。
- 背景容差调节。
- 边缘羽化。
- 白底预览。
- 导出 JPG / PNG。

#### 5.3.4 Global Shipping Tracker

目标：提供物流单号追踪入口。

核心功能：

- 自动识别常见承运商。
- 单号格式校验。
- 跳转到承运商官网或聚合查询页面。
- 支持 DHL、FedEx、UPS、USPS、YunExpress、4PX 等常见渠道。

### 5.4 风控测试

#### 5.4.1 Card & BIN Tester

目标：用于支付测试、风控 QA 与 BIN 基础识别。

核心功能：

- Luhn 算法校验。
- 卡组织识别：Visa、Mastercard、Amex、Discover、JCB、UnionPay 等。
- BIN 字典查询：发卡行、国家、卡种、借记 / 贷记类型。
- Sandbox 卡号生成：基于测试 BIN 生成满足 Luhn 的测试卡号。
- 批量校验。

合规声明：

- 本工具仅用于支付网关 sandbox、QA 测试、格式校验和教育用途。
- 不生成真实可用银行卡。
- 不支持 CVV 猜测、有效期猜测、批量撞库、绕过风控或任何欺诈行为。
- BIN 查询依赖公开或授权数据源，结果仅供参考。

## 6. 全局交互设计

### 6.1 工作台布局

- 左侧：工具分组导航。
- 中间：输入区与参数区。
- 右侧：结果区、解释区、历史记录。
- 顶部：搜索、主题、语言、设置、隐私模式状态。
- 移动端：导航折叠为抽屉，输入与输出上下排列。

### 6.2 Cmd + K 命令面板

触发方式：

- macOS：Cmd + K。
- Windows / Linux：Ctrl + K。

能力：

- 搜索工具：slot、proxy、json、luhn、cron 等关键词。
- 执行动作：format JSON、copy output、clear input、toggle theme。
- 显示最近使用工具。
- 支持中英文关键词。

### 6.3 Settings Modal

配置项：

- Alchemy API Key。
- Infura API Key。
- 默认 Chain。
- RPC Endpoint override。
- Privacy First Mode。
- Theme：System / Light / Dark。
- Language：中文 / English。
- 清空本地历史。

存储策略：

- API Key 默认仅存储在浏览器 localStorage 或 IndexedDB。
- 明确提示：本地存储不等同于强加密保险箱。
- 可提供“仅本次会话保存”选项，使用 sessionStorage。

### 6.4 明暗主题

暗黑模式：

- 背景：`#09090b`。
- 面板：`#111113` / `#18181b`。
- 边框：`#27272a`。
- 文本：`#fafafa` / `#a1a1aa`。
- 代码高亮：使用高对比但不过饱和的色彩。

明亮模式：

- 背景：`#ffffff`。
- 面板：`#f8fafc`。
- 边框：`#e4e4e7`。
- 文本：`#09090b` / `#52525b`。

视觉要求：

- 不使用大面积渐变与装饰图形。
- 卡片圆角不超过 8px。
- 优先使用表格、分栏、代码块、紧凑表单。
- 工具按钮使用图标 + tooltip，常见动作不使用冗长文字。

## 7. 国际化

技术方案：

- 推荐：`next-intl`。
- 备选：`react-i18next`。

语言范围：

- 中文：默认文案面向中文用户。
- English：覆盖工具名称、参数、错误提示、帮助说明、设置项。

实现要求：

- 路由可采用 `/zh`、`/en`。
- 工具 slug 保持英文，利于分享与 SEO。
- 数字、时间、货币格式按 locale 渲染。
- 命令面板支持中英文别名。

## 8. 技术架构

### 8.1 前端

推荐技术栈：

- Next.js App Router。
- TypeScript。
- Tailwind CSS。
- shadcn/ui。
- next-themes。
- next-intl。
- Zustand 或 Jotai 管理轻量状态。
- TanStack Query 管理远程请求状态。
- React Hook Form + Zod 管理复杂表单与校验。

前端部署：

- Vercel。
- Cloudflare Pages。
- 静态优先，Serverless Route Handler 用于必要代理。

### 8.2 后端代理

Route Handler：

- `/api/rpc`：只读 RPC 代理。
- `/api/signature`：可选 selector / topic 反查代理。
- `/api/bin`：可选 BIN 数据查询代理。

代理规则：

- 限定 HTTP method 为 POST。
- 校验 Origin。
- 校验 Content-Type。
- 请求体大小限制。
- JSON-RPC method 白名单。
- IP 限流。
- 日志脱敏。

### 8.3 RPC 白名单

默认允许：

- `eth_chainId`
- `eth_blockNumber`
- `eth_getCode`
- `eth_getStorageAt`
- `eth_call`
- `eth_getBalance`
- `eth_getTransactionByHash`
- `eth_getTransactionReceipt`

默认禁止：

- `eth_sendRawTransaction`
- `eth_sendTransaction`
- `personal_*`
- `wallet_*`
- `debug_*`
- `trace_*`
- `admin_*`
- `miner_*`

### 8.4 安全策略

IP 限流：

- 使用 Upstash Redis。
- 默认限制：单 IP 30 次 / 分钟。
- 对 `/api/rpc`、`/api/signature`、`/api/bin` 分别限流。

CORS 域名锁：

- 只允许生产域名、预览域名白名单。
- 本地开发仅允许 localhost。
- Origin 缺失时默认拒绝，除非明确为内部 server-to-server 场景。

BYOK 策略：

- 用户提供 Alchemy / Infura API Key 后，优先走用户自己的 RPC。
- 用户 Key 不上传到产品服务器。
- 前端直接拼接官方 endpoint。
- UI 明确显示当前请求来源：Local、User RPC、Server Proxy。

隐私模式：

- 开启后禁用所有第三方请求。
- 禁用 OpenChain / 4byte / BIN 远程查询。
- 禁用 server RPC 代理。
- 仍允许本地 hash、编码、解码、格式化、slot 计算。

## 9. 数据与存储

本地存储内容：

- 用户设置。
- 最近使用工具。
- 收藏工具。
- 非敏感历史记录。

默认不保存：

- JWT。
- API Key 以外的敏感密文。
- Calldata 原文历史。
- 上传图片。
- 卡号输入记录。

可选策略：

- 提供“禁用历史记录”开关。
- 对敏感工具默认关闭历史记录。
- 清空所有本地数据按钮。

## 10. 可观测性

可采集：

- 工具打开次数。
- 错误类型。
- 性能指标。
- API 限流命中次数。

不可采集：

- 用户输入的 JWT、calldata、卡号、密钥、图片内容。
- 用户 BYOK API Key。
- 明文、密文、hash 原文。

建议：

- 使用匿名事件。
- 给隐私模式提供完整 opt-out。
- 日志中对地址、hash、IP 做最小化处理。

## 11. 广告与变现设计

目标：在不破坏专业工具体验、不影响隐私承诺、不降低页面性能的前提下，为后续接入 Google AdSense / Google Ads 预留广告能力。

### 11.1 广告位原则

- 工具核心操作区优先，广告不得插入输入框、参数表单、执行按钮与结果区之间。
- 广告不得遮挡、挤压或模拟复制按钮、运行按钮、下载按钮、下拉菜单等交互控件。
- 广告周围保留明确间距，并使用 `Advertisement` / `Sponsored` 标识。
- 工具页控制广告密度，内容页和教程页可承担更多广告展示。
- 移动端首屏尽量不展示广告，避免压缩核心工具操作空间。

推荐广告位：

- 桌面端右侧辅助栏底部：适合 `300x250`。
- 工具结果区下方：适合 responsive display ad。
- 长文档页正文中段：适合内容流广告。
- 页面底部：适合横幅或响应式广告。
- 移动端工具操作完成后：适合 `320x100` 或响应式广告。

不推荐广告位：

- 全局 Cmd + K 面板内。
- Settings modal 内。
- 输入区与输出区之间。
- 复制按钮、格式化按钮、查询按钮附近。
- JWT、卡号、密钥、加密解密等敏感工具的首屏区域。

### 11.2 布局预留

- 所有广告容器必须预留稳定尺寸，避免广告加载后造成 CLS。
- 广告加载失败时保留空白或收起到安全占位，不影响工具主体布局。
- 桌面端侧栏广告不得导致主工作区宽度跳变。
- 移动端广告必须在工具流程之后出现，不打断输入到结果的阅读路径。
- 开发环境显示灰色 placeholder，用于校验布局但不加载真实广告脚本。

建议尺寸：

- Sidebar rectangle：`300x250`。
- Desktop banner：`728x90`。
- Mobile banner：`320x100`。
- Responsive display：使用固定 `min-height` 包裹。

### 11.3 隐私模式与同意管理

Privacy First Mode 开启时：

- 不加载 Google Ads / AdSense 脚本。
- 不请求广告资源。
- 不写入广告相关 cookie。
- UI 显示广告区域已因隐私模式暂停。

Cookie / Consent：

- 面向 EU / UK 用户时，需要接入同意管理逻辑。
- 用户未同意个性化广告时，仅加载非个性化广告或不加载广告。
- 隐私政策必须说明广告、cookie、统计和第三方请求用途。
- 用户应能撤回同意并重新配置隐私偏好。

### 11.4 合规内容要求

逆向安全工具：

- 文案使用 smart contract auditing、defensive security、analysis、debugging 等防御性表述。
- 避免“破解”“盗取”“绕过”“攻击真实目标”等高风险表达。
- 示例数据使用公开合约、测试网或虚构地址。

风控与卡号工具：

- 明确声明仅用于 sandbox、QA testing、format validation、education。
- 不生成真实可用银行卡。
- 不提供 CVV 猜测、有效期猜测、批量撞库、绕风控等功能。
- BIN 查询结果仅供参考，不作为金融决策依据。

加密与 JWT 工具：

- 强调本地解析与调试用途。
- 不引导用户上传生产密钥、生产 token 或敏感凭证。
- 对弱算法提供明确风险提示。

跨境运营工具：

- 成本、利润、税费结果必须标记为估算值。
- 关税、汇率、平台费用可能变化，用户需以官方口径为准。

### 11.5 技术实现建议

统一封装 `AdSlot` 组件：

- `placement`：广告位置，如 `tool-sidebar`、`tool-footer`、`article-inline`。
- `format`：广告格式，如 `rectangle`、`banner`、`responsive`。
- `minHeight`：稳定布局高度。
- `disabledReason`：隐私模式、未同意 cookie、开发环境、敏感工具等禁用原因。
- `fallback`：广告失败或禁用时的占位。

加载策略：

- 广告脚本延迟加载，避免阻塞首屏工具。
- 使用 lazy loading，仅在广告位接近 viewport 时初始化。
- 对脚本加载失败静默降级。
- 工具计算逻辑不得依赖广告脚本。
- 对广告组件做 error boundary，避免广告异常影响页面。

敏感工具默认策略：

- JWT Inspector：默认不在首屏放广告。
- Symmetric Encryption：默认不在首屏放广告。
- Card & BIN Tester：默认只允许页底广告。
- Calldata Decoder：默认广告不得紧邻输入区。

### 11.6 广告验收标准

- 广告开启后 Core Web Vitals 不出现明显退化。
- 广告加载前后页面无明显布局跳动。
- Privacy First Mode 下无 Google Ads 网络请求。
- Cookie 未同意时广告行为符合目标市场法规要求。
- 广告不遮挡、不伪装、不诱导误点击。
- 敏感工具页广告位置符合合规策略。

## 12. SEO 与分享

页面策略：

- 每个工具拥有独立 URL，例如：`/tools/storage-slot-inspector`、`/tools/source-layout-resolver`、`/tools/text-compare`。
- 支持 query 参数预填非敏感示例。
- 生成 OpenGraph 标题与描述。
- 文档页提供工具解释与示例。

注意：

- 不通过 URL 分享敏感输入。
- 对 JWT、卡号、密钥类工具禁止自动写入 URL。

## 13. MVP 范围

第一阶段优先交付：

- 全局布局。
- Cmd + K。
- Settings modal。
- 明暗主题。
- 中英双语基础。
- Unit Converter。
- Encoder / Hash Suite。
- JWT Inspector。
- JSON Studio。
- Timestamp Pro。
- Text Compare。
- Source Layout Resolver。
- 4Byte / Selector Finder 的本地生成能力。
- Storage Slot Inspector 的本地计算能力。
- Card Luhn 校验。

第二阶段：

- `/api/rpc` 代理。
- Proxy Slot Finder。
- Storage Slot Inspector 链上读取。
- Calldata Decoder + 远程 selector 查询。
- Card BIN 查询。
- FBA Calculator。
- Listing Text Cleaner。
- Source Layout Resolver 的源码映射增强。

第三阶段：

- Product Pure White BG。
- Global Shipping Tracker。
- 高级 JSON diff。
- 多链支持。

## 14. 验收标准

通用验收：

- 所有工具在桌面端和移动端布局不溢出。
- 暗黑 / 明亮主题切换无闪烁或低对比问题。
- Cmd + K 可搜索并跳转所有工具。
- 纯本地模式下无第三方网络请求。
- 所有可复制输出均有明确复制按钮。
- 输入错误有可读提示，不出现未捕获异常。

安全验收：

- `/api/rpc` 只允许白名单只读方法。
- IP 限流生效。
- Origin 校验生效。
- BYOK 不上传服务器。
- JWT、卡号、密钥类输入不进入日志和历史记录。

性能验收：

- 首屏交互时间控制在合理范围。
- 大文本工具使用 debounce 或 worker，避免输入卡顿。
- Hash、JSON、bytecode 等重计算任务尽量使用 Web Worker。

广告验收：

- 广告容器预留稳定尺寸，不造成明显 CLS。
- 纯本地模式下广告脚本不加载。
- 广告不出现在敏感工具首屏核心操作区。
- 广告失败时不影响工具使用。

## 15. 风险与修正建议

- DES 不应作为推荐加密算法，仅作为兼容解密工具展示。
- Source Layout Resolver 的解析成功率需要持续验证。
- Calldata Decoder 的远程签名查询可能泄露业务行为，应受隐私模式约束。
- Card 工具必须强调 sandbox 与测试用途，不提供真实可用卡生成。
- Product Pure White BG 若追求稳定商用品质，纯前端方案可能不足，需要预留服务端或第三方接口。
- RPC 代理必须限制方法，否则容易被滥用或消耗节点额度。
- Google Ads / AdSense 审核可能对逆向安全、BIN、卡号、加密类页面敏感，需要通过防御性文案和明确合规声明降低误判风险。

## 16. 推荐页面结构

```text
/[locale]
/[locale]/tools/storage-slot-inspector
/[locale]/tools/source-layout-resolver
/[locale]/tools/proxy-slot-finder
/[locale]/tools/calldata-decoder
/[locale]/tools/unit-converter
/[locale]/tools/selector-finder
/[locale]/tools/hash-suite
/[locale]/tools/symmetric-encryption
/[locale]/tools/jwt-inspector
/[locale]/tools/json-studio
/[locale]/tools/timestamp-pro
/[locale]/tools/text-compare
/[locale]/tools/fba-landed-cost
/[locale]/tools/listing-text-cleaner
/[locale]/tools/product-white-bg
/[locale]/tools/shipping-tracker
/[locale]/tools/card-bin-tester
/api/rpc
/api/signature
/api/bin
```

## 17. 成功指标

产品指标：

- 工具首次可用时间。
- 工具搜索命中率。
- 单用户日均工具使用次数。
- 收藏工具使用率。
- 复制结果次数。

质量指标：

- 前端错误率。
- API 限流命中率。
- RPC 代理失败率。
- 大文本处理卡顿率。

隐私指标：

- 纯本地模式使用率。
- BYOK 使用率。
- 敏感工具历史记录禁用率。

变现指标：

- 广告展示量。
- 广告可见率。
- 广告点击率。
- 广告开启后的跳出率变化。
- 广告开启后的工具完成率变化。

## 18. 一句话总结

Linsea Tools 要成为一个“打开就能干活”的专业工具箱：链上逆向足够硬核，开发工具足够顺手，运营计算足够实用，安全与隐私边界足够清晰。
