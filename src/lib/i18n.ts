import { createContext, useContext } from "react";

export type Lang = "en" | "zh";

/*
 * One entry per user-visible string: [English, Chinese].
 *
 * Translation policy — the thing that keeps Chinese mode readable:
 *   - Translate everything that is ordinary language: instructions, errors,
 *     empty states, field labels, panel names, buttons.
 *   - Keep protocol and tooling terms in their canonical form, because a
 *     translated "存储槽" is useless when the user has to type `eth_getStorageAt`.
 *     Examples that stay English: RPC, mapping, calldata, selector, ABI,
 *     bytes32, uint256, JWT, JSON, Keccak, Base64, chainId.
 *   - Never mix the two inside one phrase without a reason. "读取原始存储槽"
 *     is fine; "Read 原始 storage slot" is not.
 */
export const strings = {
  // Shell
  "app.brand": ["Timeminer", "Timeminer"],
  "app.tagline": ["Security workbench", "安全工作台"],
  "app.footer": ["Local-first utilities for serious debugging.", "本地优先，为严肃的调试工作而做。"],
  "search.placeholder": ["Search tools or actions", "搜索工具或操作"],
  "search.short": ["Search tools", "搜索工具"],
  "privacy.on": ["Privacy on", "隐私优先已开"],
  "privacy.off": ["Privacy off", "隐私优先已关"],
  "privacy.on.hint": ["RPC, ads, and remote lookups are blocked", "已阻断 RPC、广告与远程查询"],
  "privacy.off.hint": ["RPC reads and remote lookups are enabled", "已启用 RPC 读取与远程查询"],
  "action.switchLanguage": ["Switch language", "切换语言"],
  "action.switchToLight": ["Switch to light theme", "切换到浅色主题"],
  "action.switchToDark": ["Switch to dark theme", "切换到深色主题"],
  "action.settings": ["Settings", "设置"],
  "action.save": ["Save preferences", "保存设置"],
  "action.close": ["Close", "关闭"],

  // Tool rail
  "panel.tools": ["Tools", "工具"],
  "panel.recent": ["Recent", "最近使用"],
  "recent.empty": ["No recent tools yet.", "暂无最近使用的工具。"],

  // Shared panels
  "panel.input": ["Input", "输入"],
  "panel.output": ["Output", "输出"],
  "panel.readout": ["Readout", "结果"],

  // Storage slot inspector
  "storage.panel": ["Storage Workbench", "存储槽工作台"],
  "storage.tab.raw": ["Raw slot read", "原始槽位读取"],
  "storage.tab.mapping": ["Mapping probe", "mapping 探测"],
  "field.contractAddress": ["Contract address", "合约地址"],
  "field.blockTag": ["Block tag", "区块标签"],
  "field.slotIndex": ["Slot index", "槽位序号"],
  "field.decodeFocus": ["Decode focus", "解码视图"],
  "field.mappingDeclaration": ["Mapping declaration", "mapping 声明"],
  "field.mappingKey": ["Mapping key", "mapping 键"],
  "field.knownBaseSlot": ["Known base slot", "已知基础槽位"],
  "field.scanRange": ["Scan range", "扫描范围"],
  "storage.hint.raw": [
    "Reads exactly one storage word with eth_getStorageAt. If Source Layout Resolver says slot #8, enter 8 here.",
    "只通过 eth_getStorageAt 读取一个存储字。若「源码槽位解析器」给出 #8，这里填 8。",
  ],
  "storage.hint.mapping": [
    "A scan is evidence, not proof. If the expected value is false/zero, chain storage cannot distinguish it from an unset key.",
    "扫描只能提供线索，不能作为证明。若期望值为 false 或 0，链上存储无法区分「值为零」与「从未写入」。",
  ],
  "storage.action.read": ["Read storage", "读取存储槽"],
  "storage.action.reading": ["Reading…", "读取中…"],
  "storage.empty.title": ["No read yet", "尚未读取"],
  "storage.empty.hint": [
    "Fill in a contract address and slot index, then run the read. Results include the chain, endpoint host, and the exact block that was read.",
    "填入合约地址与槽位序号后执行读取。结果会标明链、RPC 端点与读取时的确切区块高度。",
  ],
  "storage.err.privacy": ["Privacy First Mode blocks RPC requests.", "隐私优先模式已阻断 RPC 请求。"],
  "storage.err.address": ["Enter a valid contract address.", "请输入有效的合约地址。"],
  "storage.warn.nestedMapping": [
    "This is a nested mapping. The slot derived from one key points at the inner mapping object, which is never written on-chain — every read there returns 0. Resolve the inner mapping's base slot from the compiler storageLayout first.",
    "这是嵌套 mapping。由单个键推导出的槽位指向内层 mapping 对象本身，链上从不写入——读该槽位必定返回 0。请先用编译器 storageLayout 确定内层 mapping 的基础槽位。",
  ],
  "storage.warn.unreliable": [
    "{count} variable(s) after an unknown-size declaration have unreliable slots. Paste compiler storageLayout JSON or declare the missing struct/enum for exact results.",
    "有 {count} 个变量的槽位在「大小未知」的声明之后推导，结果不可靠。粘贴编译器 storageLayout JSON，或补全缺失的 struct/enum 声明，可获得精确结果。",
  ],
  "storage.err.declaration": [
    "Enter a mapping declaration such as mapping(address => bool) public flags;",
    "请输入 mapping 声明，例如 mapping(address => bool) public flags;",
  ],

  // Result row labels
  "row.contract": ["Contract", "合约"],
  "row.chain": ["Chain", "链"],
  "row.rpcSource": ["RPC source", "RPC 来源"],
  "row.blockRequested": ["Block requested", "请求区块"],
  "row.blockRead": ["Block read", "读取区块"],
  "row.slotHex": ["Slot hex", "槽位十六进制"],
  "row.rawBytes32": ["Raw bytes32", "原始 bytes32"],
  "row.uint256View": ["uint256 view", "uint256 视图"],
  "row.addressView": ["address view", "address 视图"],
  "row.baseSlot": ["Base slot", "基础槽位"],
  "row.valueSlot": ["Value slot", "值槽位"],
  "row.scanned": ["Scanned", "已扫描"],
  "row.nonZeroMatches": ["Non-zero matches", "非零命中"],
  "row.failedReads": ["Failed reads", "失败读取"],
  "row.stoppedEarly": ["Stopped early", "提前结束"],
  "row.source": ["Source", "来源"],
  "row.contractName": ["Contract", "合约"],
  "row.target": ["Target", "目标"],
  "row.type": ["Type", "类型"],
  "row.slotNumber": ["Slot number", "槽位号"],
  "row.byteOffset": ["Byte offset", "字节偏移"],
  "row.storageForm": ["Storage form", "存储形态"],
  "row.mappingKey": ["Mapping key", "mapping 键"],
  "row.rawSlot": ["Raw slot", "原始槽位"],
  "row.rpcMethod": ["RPC method", "RPC 方法"],
  "row.arguments": ["Arguments", "参数"],
  "row.returnTypes": ["Returns", "返回类型"],

  // eth_call
  "field.arguments": ["Arguments", "参数"],
  "field.blocks": ["Blocks (one per line)", "区块（每行一个）"],
  "call.panel": ["Contract Call", "合约调用"],
  "call.empty.title": ["No call yet", "尚未调用"],
  "call.empty.hint": [
    "Enter a contract, a function signature, and its arguments. The selector and calldata are computed locally before anything is sent.",
    "填入合约地址、函数签名与参数。selector 与 calldata 会先在本地算好，再发出去。",
  ],
  "call.notice": [
    "Only view and pure functions can be called this way — eth_call never changes state and costs no gas. Historical blocks require an archive endpoint.",
    "只能调用 view 与 pure 函数：eth_call 不改变状态、不消耗 gas。读取历史区块需要 archive 端点。",
  ],
  "call.argsPlaceholder": ["1, false", "1, false"],
  "call.blocksPlaceholder": [
    "Leave empty for latest, or list blocks: 79788487, 79788486",
    "留空读取最新区块，或列出区块号：79788487, 79788486",
  ],
  "call.calldataPreview": ["Calldata", "Calldata"],
  "call.action.run": ["Call contract", "执行调用"],
  "call.action.running": ["Calling…", "调用中…"],
  "call.err.signature": ["Enter a valid function signature.", "请输入有效的函数签名。"],
  "call.err.archive": [
    "Block {block} is not available on this endpoint: {message} Pick an archive endpoint in Settings.",
    "当前端点读不到区块 {block}：{message} 请在设置里换用 archive 端点。",
  ],
  "call.decodedCount": ["{count} decoded value(s)", "{count} 个解码值"],
  "call.noOutput": ["No return types declared, so the value below is decoded as a plain uint256. Add returns (…) to the signature for exact types.", "签名未声明返回类型，下方按 uint256 解读。在签名后加上 returns (…) 可精确解码。"],
  "call.rawData": ["Raw return data", "原始返回数据"],
  "call.asUint": ["Read as uint256", "按 uint256 解读"],
  "call.sameAcrossBlocks": ["Identical result at every block queried.", "所有查询区块的返回值相同。"],
  "call.differsAcrossBlocks": ["Results differ between blocks.", "不同区块的返回值存在差异。"],

  // Source layout resolver
  "layout.panel": ["Source Layout", "源码槽位"],
  "layout.tab.verified": ["Paste verified source", "粘贴已验证源码"],
  "layout.tab.decompiled": ["Paste decompiled", "粘贴反编译源码"],
  "field.targetName": ["Target name", "目标变量名"],
  "field.contractName": ["Contract name", "合约名"],
  "field.verifiedSource": ["Verified source", "已验证源码"],
  "field.decompiledSource": ["Dedaub decompiled source", "Dedaub 反编译源码"],
  "layout.placeholder.verified": ["Paste verified Solidity source here.", "在此粘贴已验证的 Solidity 源码。"],
  "layout.placeholder.decompiled": ["Paste Dedaub decompiled source here.", "在此粘贴 Dedaub 反编译源码。"],
  "layout.placeholder.contractName": ["optional, but safer", "可选，但填写更稳妥"],
  "layout.placeholder.mappingKey": ["only for mapping value", "仅 mapping 值需要"],
  "layout.notice": [
    "Only top-level state variables are counted. Function bodies are skipped. In multi-contract files, fill Contract name for the final token contract.",
    "只统计顶层状态变量，函数体会被跳过。若文件包含多个合约，请填写最终部署的合约名。",
  ],
  "layout.empty.title": ["No source pasted", "尚未粘贴源码"],
  "layout.empty.hint": [
    "Paste verified Solidity or Dedaub decompiled source above. Leave the target blank to list every storage declaration with its slot.",
    "在上方粘贴已验证的 Solidity 源码或 Dedaub 反编译源码。目标变量留空时会列出全部存储声明及其槽位。",
  ],
  "layout.noMatch": ["No name match for", "未找到匹配的变量名"],
  "layout.noDeclarations": ["No storage declarations were parsed.", "未解析到任何存储声明。"],

  // Proxy
  "proxy.panel": ["Proxy", "代理"],
  "field.proxyAddress": ["Proxy address", "代理合约地址"],
  "proxy.notice": [
    "Probes ERC-1967 implementation, admin, and beacon slots on the selected chain. Results always show the chainId and block that was read.",
    "在所选链上探测 ERC-1967 的 implementation、admin 与 beacon 槽位。结果始终标明 chainId 与读取区块。",
  ],
  "proxy.action.probe": ["Probe proxy slots", "探测代理槽位"],
  "proxy.empty.title": ["No probe yet", "尚未探测"],
  "proxy.empty.hint": [
    "Paste a proxy address and probe the ERC-1967 implementation, admin, and beacon slots.",
    "填入代理合约地址，探测 ERC-1967 的 implementation、admin 与 beacon 槽位。",
  ],
  "proxy.err.privacy": ["Privacy First Mode blocks RPC.", "隐私优先模式已阻断 RPC。"],
  "proxy.err.address": ["Enter a valid proxy address.", "请输入有效的代理合约地址。"],
  "row.implementationSlot": ["Implementation slot", "implementation 槽位"],
  "row.implementation": ["Implementation", "实现地址"],
  "row.admin": ["Admin", "admin 地址"],
  "row.beacon": ["Beacon", "beacon 地址"],
  "value.notSet": ["not set", "未设置"],

  // Calldata
  "calldata.panel": ["Calldata", "Calldata"],
  "calldata.placeholder": ["0xa9059cbb...", "0xa9059cbb..."],
  "row.selector": ["Selector", "Selector"],
  "row.argWords": ["Argument words", "参数个数"],
  "calldata.noWords": ["No ABI words yet.", "暂无 ABI 参数。"],

  // Unit converter
  "unit.panel": ["Converter", "单位换算"],
  "field.amount": ["Amount", "数量"],
  "field.fromUnit": ["From", "源单位"],
  "field.toUnit": ["To", "目标单位"],
  "field.tokenDecimals": ["Token decimals", "代币精度"],
  "row.input": ["Input", "输入"],
  "row.output": ["Output", "输出"],
  "row.baseUnits": ["Base units", "最小单位"],
  "unit.err.invalid": ["Enter a positive decimal number.", "请输入正数。"],
  "unit.err.decimals": ["Too many decimal places for this precision.", "小数位数超出该精度允许范围。"],

  // Selector finder
  "selector.panel": ["Signature", "函数签名"],
  "selector.canonicalNote": [
    "The selector is always computed over the canonical form, so spacing, parameter names, and indexed never change it.",
    "selector 始终按规范化后的形式计算，因此空格、参数名与 indexed 都不会影响结果。",
  ],
  "field.signature": ["Function or event signature", "函数或事件签名"],
  "row.signature": ["Signature", "签名"],
  "row.functionSelector": ["Function selector", "函数 selector"],
  "row.eventTopic": ["Event topic0", "事件 topic0"],
  "value.na": ["n/a", "不适用"],

  // Hash suite
  "hash.inputLabel": ["Input", "输入"],
  "hash.outputLabel": ["Output", "输出"],

  // Encryption
  "enc.panel": ["Cipher", "加解密"],
  "field.mode": ["Mode", "模式"],
  "field.data": ["Data", "数据"],
  "field.password": ["Password", "密码"],
  "enc.mode.encrypt": ["Encrypt AES-GCM", "AES-GCM 加密"],
  "enc.mode.decrypt": ["Decrypt AES-GCM bundle", "AES-GCM 解密"],
  "enc.action.encrypt": ["Encrypt locally", "本地加密"],
  "enc.action.decrypt": ["Decrypt locally", "本地解密"],
  "enc.empty.title": ["Nothing encrypted yet", "尚未加密"],
  "enc.empty.hint": [
    "Pick a mode, set a password, then run. Keys are derived in this browser and never leave it.",
    "选择模式并设置密码后执行。密钥仅在本浏览器内派生，不会离开本地。",
  ],
  "enc.sample.data": ["local secrets only", "仅限本地的测试数据"],
  "enc.err.password": ["Enter a password.", "请输入密码。"],
  "enc.err.bundle": ["Paste a version 1 AES-GCM bundle from this tool.", "请粘贴本工具生成的 version 1 AES-GCM 密文包。"],
  "row.plaintext": ["Plaintext", "明文"],
  "row.algorithm": ["Algorithm", "算法"],

  // JWT
  "jwt.panel": ["JWT", "JWT"],
  "row.algorithmShort": ["Algorithm", "算法"],
  "row.expiresAt": ["Expires at", "过期时间"],
  "row.status": ["Status", "状态"],
  "jwt.empty.title": ["No token decoded", "尚未解析"],
  "jwt.empty.hint": [
    "Paste a JWT on the left. Header and payload are base64-decoded in this browser.",
    "在左侧粘贴 JWT。header 与 payload 仅在本浏览器内做 Base64 解码。",
  ],
  "value.expired": ["Expired", "已过期"],
  "value.active": ["Active / unknown", "有效或未知"],

  // JSON studio
  "json.panel": ["JSON", "JSON"],
  "json.mode.format": ["Format", "格式化"],
  "json.mode.minify": ["Minify", "压缩"],
  "json.mode.ts": ["TypeScript", "TypeScript"],

  // Timestamp
  "ts.clockPanel": ["Epoch Clock", "时间戳时钟"],
  "ts.currentUnix": ["Current Unix Time", "当前 Unix 时间"],
  "ts.action.switchUnit": ["Switch unit", "切换单位"],
  "ts.action.pause": ["Pause", "暂停"],
  "ts.action.resume": ["Resume", "继续"],
  "ts.tab.single": ["Single parse", "单条解析"],
  "ts.tab.batch": ["Batch convert", "批量转换"],
  "ts.placeholder": ["1787063731, 1787063731000, 2026-08-18 22:27:31, ISO/RFC date", "1787063731、1787063731000、2026-08-18 22:27:31、ISO/RFC 日期"],
  "field.timestampOrDate": ["Timestamp or date", "时间戳或日期"],
  "field.inputUnit": ["Input unit", "输入单位"],
  "field.timezone": ["Timezone search", "时区搜索"],
  "ts.tzPlaceholder": ["Type UTC, Shanghai, New_York...", "输入 UTC、Shanghai、New_York…"],
  "ts.noTimezone": ["No timezone match", "没有匹配的时区"],
  "ts.action.nowSeconds": ["Now s", "当前秒"],
  "ts.action.nowMillis": ["Now ms", "当前毫秒"],
  "ts.action.nowDate": ["Now date", "当前日期"],
  "ts.action.clear": ["Clear", "清空"],
  "ts.batchPanel": ["Batch Timeline", "批量时间线"],
  "field.batchMode": ["Batch mode", "批量模式"],
  "ts.batch.timestamps": ["Timestamp -> date", "时间戳 → 日期"],
  "ts.batch.dates": ["Date -> timestamp", "日期 → 时间戳"],
  "field.batchValues": ["Values, one per line or pasted from logs", "每行一个值，也可直接粘贴日志"],
  "ts.action.clearBatch": ["Clear batch", "清空批量"],
  "ts.batch.paste": ["Paste values to convert.", "粘贴待转换的值。"],
  "ts.unit.auto": ["Auto detect", "自动识别"],
  "ts.unit.seconds": ["Seconds", "秒"],
  "ts.unit.milliseconds": ["Milliseconds", "毫秒"],
  "ts.unit.microseconds": ["Microseconds", "微秒"],
  "ts.unit.nanoseconds": ["Nanoseconds", "纳秒"],
  "row.detectedInput": ["Detected input", "识别结果"],
  "row.relative": ["Relative", "相对时间"],
  "row.unixSeconds": ["Unix seconds", "Unix 秒"],
  "row.unixMillis": ["Unix milliseconds", "Unix 毫秒"],
  "row.unixMicros": ["Unix microseconds", "Unix 微秒"],
  "row.unixNanos": ["Unix nanoseconds", "Unix 纳秒"],
  "row.isoUtc": ["ISO 8601 UTC", "ISO 8601 UTC"],
  "row.sqlUtc": ["SQL UTC", "SQL UTC"],
  "row.localTime": ["Local time", "本地时间"],
  "row.dayOfYear": ["Day of year", "年内第几天"],
  "row.isoWeek": ["ISO week", "ISO 周"],
  "ts.err.empty": ["Enter a timestamp or date/time.", "请输入时间戳或日期时间。"],
  "ts.err.range": ["Timestamp is outside the safe JavaScript Date range.", "时间戳超出 JavaScript 可安全表示的日期范围。"],
  "ts.err.unit": ["Unsupported timestamp unit.", "不支持的时间戳单位。"],
  "ts.err.invalidDate": ["Invalid date/time.", "日期时间无效。"],
  "ts.source.dateString": ["date/time string", "日期时间字符串"],

  // Base converter
  "base.panel": ["Radix Input", "进制输入"],
  "field.integer": ["Integer", "整数"],
  "base.placeholder": ["0x1a2b3c, 110101, 755, -42", "0x1a2b3c、110101、755、-42"],
  "field.fromBase": ["From base", "源进制"],
  "field.toBase": ["To base", "目标进制"],
  "field.customFrom": ["Custom from", "自定义源进制"],
  "field.customTo": ["Custom to", "自定义目标进制"],
  "base.action.swap": ["Swap", "交换"],
  "base.action.hexToDec": ["Hex to Dec", "十六进制转十进制"],
  "base.action.decToHex": ["Dec to Hex", "十进制转十六进制"],
  "base.action.binToDec": ["Bin to Dec", "二进制转十进制"],
  "base.toggle.uppercase": ["Uppercase output", "输出大写"],
  "base.toggle.grouped": ["Group binary/hex", "二进制与十六进制分组"],
  "base.outputMetric": ["Base {base} output", "{base} 进制结果"],
  "base.outputHint": ["{value} from base {base}", "{value}（源进制 {base}）"],
  "base.notice": [
    "Supports bases 2-36. Prefixes 0x, 0b, and 0o are accepted when they match the input base.",
    "支持 2–36 进制。当 0x、0b、0o 前缀与输入进制匹配时会被识别。",
  ],
  "row.inputBase": ["Input base", "源进制"],
  "row.outputBase": ["Output base", "目标进制"],
  "row.converted": ["Converted", "转换结果"],
  "row.decimal": ["Decimal (base 10)", "十进制"],
  "row.hexPrefixed": ["Hexadecimal prefixed", "十六进制（带前缀）"],
  "row.binaryPrefixed": ["Binary prefixed", "二进制（带前缀）"],
  "row.binary": ["Binary (base 2)", "二进制"],
  "row.octal": ["Octal (base 8)", "八进制"],
  "row.hex": ["Hexadecimal (base 16)", "十六进制"],
  "row.base36": ["Base36 (0-9A-Z)", "36 进制（0-9A-Z）"],
  "base.base2": ["Binary (base 2)", "二进制"],
  "base.base8": ["Octal (base 8)", "八进制"],
  "base.base10": ["Decimal (base 10)", "十进制"],
  "base.base16": ["Hexadecimal (base 16)", "十六进制"],
  "base.base36": ["Base36 (0-9A-Z)", "36 进制（0-9A-Z）"],
  "base.err.empty": ["Enter an integer to convert.", "请输入待转换的整数。"],
  "base.err.prefixMismatch": ["Input prefix does not match the selected base.", "输入前缀与所选进制不匹配。"],
  "base.err.prefixExtra": ["Remove the prefix or change input base to match it.", "去掉前缀，或将输入进制改为与之匹配。"],
  "base.err.noDigits": ["Enter digits after the prefix.", "请在前缀后输入数字。"],
  "base.err.radix": ["Base must be an integer from 2 to 36.", "进制必须是 2 到 36 之间的整数。"],
  "base.err.digit": ["Digit is invalid for this base.", "该字符不属于所选进制。"],

  // Text compare
  "diff.panel": ["Compare", "文本对比"],
  "field.original": ["Original", "原文"],
  "field.changed": ["Changed", "修改后"],

  // Market clock
  "market.clockPanel": ["World Clock", "世界时钟"],
  "market.sessionPanel": ["Market Sessions", "交易时段"],
  "market.legend.open": ["Trading", "交易中"],
  "market.legend.pre": ["Pre-market", "盘前"],
  "market.legend.after": ["After-hours", "盘后"],
  "market.refreshedAt": ["Refreshed", "刷新"],
  "market.city.beijing": ["Beijing", "北京"],
  "market.city.hongKong": ["Hong Kong", "香港"],
  "market.city.newYork": ["New York", "纽约"],
  "market.zoneEastern": ["US Eastern", "美东"],
  "market.dst.in": ["US is on daylight saving time", "美国当前处于夏令时"],
  "market.dst.out": ["US is on standard time", "美国当前处于冬令时"],
  "market.dst.ends": ["Daylight saving ends", "夏令时结束"],
  "market.dst.starts": ["Daylight saving starts", "夏令时开始"],
  "market.dst.back": ["clocks move back 1 hour", "时钟回拨 1 小时"],
  "market.dst.forward": ["clocks move forward 1 hour", "时钟前拨 1 小时"],
  "market.status.open": ["Trading", "交易中"],
  "market.status.pre": ["Pre-market", "盘前"],
  "market.status.after": ["After-hours", "盘后"],
  "market.status.lunch": ["Lunch break", "午间休市"],
  "market.status.beforeOpen": ["Not open yet", "未开盘"],
  "market.status.closed": ["Closed", "已收盘"],
  "market.status.weekend": ["Weekend closed", "周末休市"],
  "market.countdownToClose": ["Until close", "距收盘"],
  "market.countdownToOpen": ["Until open", "距开盘"],
  "market.weekend": ["Weekend closed", "周末休市"],
  "market.row.session": ["Sessions", "交易时段"],
  "market.row.extended": ["Extended", "盘前盘后"],
  "market.row.extendedPre": ["Pre-market", "盘前"],
  "market.row.extendedAfter": ["After-hours", "盘后"],
  "market.row.extendedBoth": ["Pre / after hours", "盘前 / 盘后"],
  "market.row.lunch": ["Lunch break", "午间休市"],
  "market.field.open": ["Open", "开盘"],
  "market.field.close": ["Close", "收盘"],
  "market.localSession": ["local session", "当地交易时段"],
  "market.beijing": ["Beijing", "北京"],
  "market.localTime": ["Local", "当地"],
  "market.notice": [
    "Holidays (US Thanksgiving, A-share Spring Festival and National Day, etc.) and unscheduled halts are not accounted for. Only Monday to Friday and the regular session hours are used. Times rely on the browser IANA timezone database, so DST switches automatically.",
    "未纳入节假日（美国感恩节、A 股春节与国庆等）与临时休市，仅按周一至周五和常规交易时段计算。时间基于浏览器 IANA 时区数据库，夏令时自动切换。",
  ],
  "market.days": ["days", "天"],
  "market.targetText": ["{dayTag}{time} {action} (Beijing {beijing})", "{dayTag}{time} {action}（北京时间 {beijing}）"],
  "market.nextDaySuffix": ["{time} (next day)", "{time}（次日）"],
  "market.localNow": ["Local {time} ({zone})", "当地 {time}（{zone}）"],
  "market.beijingHint": ["Beijing {time}", "北京 {time}"],

  // Settings
  "settings.title": ["Settings", "设置"],
  "settings.description": ["API keys and preferences are stored in this browser only.", "API Key 与偏好设置仅保存在本浏览器中。"],
  "field.defaultChain": ["Default chain", "默认链"],
  "field.customChainId": ["Custom chain ID", "自定义 chainId"],
  "field.customChainLabel": ["Custom chain label", "自定义链名称"],
  "field.rpcOverride": ["RPC URL override", "RPC 地址覆盖"],
  "settings.rpcPreview": ["Reads will use", "读取将使用"],
  "settings.rpcPreviewTail": ["expected chainId", "预期 chainId"],
  "settings.chainVerified": ["Every read verifies eth_chainId first.", "每次读取都会先校验 eth_chainId。"],
  "settings.noRpc": [
    "This chain has no bundled public RPC. Add a non-empty RPC URL override to read it directly from the browser.",
    "该链没有内置公共 RPC。请填写 RPC 地址覆盖，才能直接从浏览器读取。",
  ],
  "field.alchemyKey": ["Alchemy API Key", "Alchemy API Key"],
  "field.infuraKey": ["Infura API Key", "Infura API Key"],
  "settings.keyPlaceholder": ["Optional BYOK key", "可选的 BYOK Key"],
  "settings.freeEndpoints": ["Free public endpoints", "免费公共端点"],
  "settings.archiveYes": ["Archive", "支持历史"],
  "settings.archiveNo": ["Live only", "仅最新"],
  "settings.clearEndpoint": ["Clear selection (use bundled / BYOK endpoint)", "清除选择（改用内置 / BYOK 端点）"],
  "settings.priority": [
    "Endpoint priority: RPC URL override → bundled public RPC → Alchemy key → Infura key. A provider key is never used on a chain it does not serve.",
    "端点优先级：RPC 地址覆盖 → 内置公共 RPC → Alchemy Key → Infura Key。服务商 Key 绝不会用于其不支持的链。",
  ],
  "settings.privacy.title": ["Privacy First Mode", "隐私优先模式"],
  "settings.privacy.hint": ["Disable third-party requests, ads, RPC, and remote lookups.", "停用第三方请求、广告、RPC 与远程查询。"],

  // Command palette
  "command.title": ["Command Menu", "命令菜单"],
  "command.description": ["Type keywords to jump between tools.", "输入关键词快速跳转工具。"],
  "command.placeholder": ["Type slot, json, luhn, timestamp...", "输入 slot、json、时间戳…"],
  "command.empty": ["No matching tools.", "没有匹配的工具。"],

  // Shared component strings
  "common.select": ["Select", "请选择"],
  "common.search": ["Search...", "搜索…"],
  "common.noResults": ["No results", "没有结果"],
  "common.copy": ["Copy", "复制"],
  "common.copied": ["Copied", "已复制"],
  "common.optional": ["optional", "可选"],
  "common.showingOf": ["Showing {shown} of {total}. Keep typing to narrow.", "显示 {shown} / {total}，继续输入以缩小范围。"],

  // Added during the tool-by-tool pass
  "storage.scanning": ["Scanning base slots {start}–{end} of 0–{max} at block {block}…", "正在扫描基础槽位 {start}–{end}（共 0–{max}），区块 {block}…"],
  "storage.scan.allFailed": ["All {attempted} storage reads failed: {reason}", "全部 {attempted} 次存储读取均失败：{reason}"],
  "storage.scan.partial": ["{failed} of {attempted} reads failed, so this scan is incomplete. ", "{attempted} 次读取中有 {failed} 次失败，本次扫描不完整。"],
  "storage.scan.none": ["No non-zero candidate found in base slots 0–{max}. Zero/false cannot prove a mapping base slot.", "在基础槽位 0–{max} 中未发现非零值。值为 0 或 false 时，无法据此确认 mapping 的基础槽位。"],
  "storage.scan.failedNote": ["{failed} storage reads failed; treat this scan as incomplete.", "{failed} 次存储读取失败，本次扫描应视为不完整。"],
  "storage.scan.baseSlotHeading": ["Base slot #{n}", "基础槽位 #{n}"],
  "storage.scan.range": ["base slots 0–{scanned} of 0–{max}", "基础槽位 0–{scanned}（共 0–{max}）"],
  "storage.scan.limitReached": ["{limit} match limit reached", "已达 {limit} 条命中上限"],
  "storage.scan.exhausted": ["scan range exhausted", "扫描范围已用尽"],
  "storage.blockVerified": ["chainId {chainId} · verified via eth_chainId", "chainId {chainId} · 已通过 eth_chainId 校验"],
  "storage.note.constant": ["constant: not stored on-chain", "constant：不存储在链上"],
  "storage.note.immutable": ["immutable: stored in bytecode", "immutable：存储在字节码中"],
  "storage.note.mappingBase": ["mapping base slot; values live at keccak256(key, base slot)", "mapping 基础槽位；值位于 keccak256(key, 基础槽位)"],
  "storage.note.mappingNested": ["nested mapping: the derived slot is never written on-chain", "嵌套 mapping：推导出的槽位在链上从不写入"],
  "storage.note.dynamic": ["length/pointer slot; data is stored separately", "长度或指针槽位；数据另存"],
  "storage.note.dynamicArray": ["array length slot; elements start at keccak256(slot)", "数组长度槽位；元素起始于 keccak256(槽位)"],
  "storage.note.fixedArray": ["fixed array of {count} element(s), {slots} slot(s)", "定长数组，{count} 个元素，占 {slots} 个槽位"],
  "storage.note.enum": ["enum: 1 byte, packs with neighbours", "enum：1 字节，与相邻变量打包"],
  "storage.note.contractType": ["contract type: 20-byte address", "合约类型：20 字节地址"],
  "storage.note.functionType": ["function type: {bytes} bytes", "函数类型：{bytes} 字节"],
  "storage.note.struct": ["struct: occupies {slots} slot(s)", "struct：占 {slots} 个槽位"],
  "storage.note.udvt": ["user-defined value type ({type} is {underlying})", "自定义值类型（{type} 基于 {underlying}）"],
  "storage.note.interfaceHeuristic": ["assumed contract type (20-byte address)", "按合约类型推断（20 字节地址）"],
  "storage.note.packed": ["packed in {bytes} byte(s)", "打包占 {bytes} 字节"],
  "storage.note.fullSlot": ["full 32-byte slot", "占满 32 字节槽位"],
  "storage.note.unknownType": ["unknown type {type}: slot may be wrong", "无法识别类型 {type}：槽位可能不准"],
  "storage.note.unreliable": ["slot derived after an unknown-size variable; verify before use", "该槽位在未知大小的变量之后推导，使用前请核实"],
  "storage.placeholder.slot": ["23 or 0x17", "23 或 0x17"],
  "storage.decodeColumn": ["Decoded {type}", "解码为 {type}"],
  "storage.valueSlotPlaceholder": ["enter key to calculate", "输入键值后计算"],
  "storage.notOnChain": ["not stored on-chain", "不存储在链上"],
  "storage.constantNote": ["constant / immutable does not live in storage", "constant 与 immutable 不占用存储槽"],
  "storage.mappingValueReady": ["Value slot ready", "值槽位已就绪"],
  "storage.variable": ["Variable", "变量"],
  "storage.resolvedSlot": ["Resolved slot", "解析结果"],
  "storage.mappingValueSlot": ["Mapping value slot", "mapping 值槽位"],
  "storage.rawSlotPath": ["Raw slot read -> {slot}", "原始槽位 → {slot}"],
  "storage.copySlot": ["Copy slot", "复制槽位"],
  "storage.sourceType.verified": ["verified source", "已验证源码"],
  "storage.sourceType.decompiled": ["decompiled source", "反编译源码"],

  "unit.label": ["{amount} {unit}", "{amount} {unit}"],
  "unit.token": ["token", "代币"],

  "ts.unit.shortSeconds": ["s", "秒"],
  "ts.unit.shortMillis": ["ms", "毫秒"],
  "ts.shift.day": ["1d", "1 天"],
  "ts.shift.hour": ["h", "小时"],
  "ts.batch.headers.timestamps": ["Input|Detected|UTC ISO|Local|Relative", "输入|识别结果|UTC ISO|当地|相对"],
  "ts.batch.headers.dates": ["Input|Unix s|Unix ms|UTC ISO|Relative", "输入|Unix 秒|Unix 毫秒|UTC ISO|相对"],

  "settings.customRpcPlaceholder": ["https://rpc.example.org", "https://rpc.example.org"],
  "settings.customChainIdPlaceholder": ["6714", "6714"],
  "settings.customChainLabelPlaceholder": ["optional", "可选"],
  "settings.chainMissingId": ["chainId missing", "缺少 chainId"],
  "settings.unknownChain": ["Unknown chain", "未知链"],
  "settings.customChainFallback": ["Custom chain", "自定义链"],

  "common.yes": ["Yes", "是"],
  "common.no": ["No", "否"],
  "common.none": ["none", "无"],
  "common.notApplicable": ["n/a", "不适用"],
  "common.loading": ["Loading…", "加载中…"],
  "common.reload": ["Reload", "重新加载"],
  "common.errorPrefix": ["Error: {message}", "错误：{message}"],

  // Signature database (selector -> text)
  "sig.lookup": ["Look up signature", "反查签名"],
  "sig.lookingUp": ["Looking up…", "查询中…"],
  "sig.panel": ["Signature lookup", "签名反查"],
  "sig.notice": [
    "Keccak is one-way, so a selector can only be matched against a public corpus. Lookup runs only when you press the button, and it reveals this selector to OpenChain and 4byte.directory.",
    "Keccak 是单向函数，selector 只能与公开语料比对。只有点击按钮才会发起查询，查询会把该 selector 发送给 OpenChain 与 4byte.directory。",
  ],
  "sig.privacy": [
    "Privacy First Mode blocks remote lookups. Turn it off in Settings to query the signature databases.",
    "隐私优先模式已阻断远程查询。请在设置中关闭后使用签名数据库。",
  ],
  "sig.empty": ["No candidates found in either database.", "两个数据库都没有找到候选。"],
  "sig.ambiguous": [
    "{count} candidates share this selector. Any of them is byte-identical on the wire — pick the one that matches the contract you are inspecting.",
    "{count} 个候选共用这个 selector。它们在链上字节完全相同，请选择与所查合约相符的那个。",
  ],
  "sig.single": ["One candidate found.", "找到 1 个候选。"],
  "sig.sources": ["Sources", "来源"],
  "sig.source.cache": ["cache", "缓存"],
  "sig.verified": ["re-hash matches", "本地重算一致"],
  "sig.unverified": ["re-hash mismatch", "本地重算不一致"],
  "sig.verifiedContract": ["verified contract", "已验证合约"],
  "sig.useThis": ["Use this signature", "使用该签名"],
  "sig.selected": ["Selected", "已选中"],
  "sig.collisionWarning": [
    "A 4-byte selector has only 2^32 values, so unrelated functions collide by design. Local re-hashing proves a string produces this selector; it cannot prove the contract actually declares it.",
    "4 字节 selector 只有 2^32 种取值，不同函数天然会碰撞。本地重算只能证明该字符串会产生此 selector，无法证明合约真的声明了它。",
  ],
  "sig.err.unparseable": ["not valid ABI", "不是合法 ABI"],
  "sig.partial": ["Some sources failed: {errors}", "部分来源失败：{errors}"],
  "sig.manual": ["Or type inputs manually", "或手动填写参数类型"],
  "sig.rawWords": ["Raw 32-byte words", "原始 32 字节字"],
  "sig.lookupHint": [
    "Decoding needs types. Look the selector up, or paste a signature from the contract source.",
    "解码需要类型信息。可反查 selector，或粘贴合约源码里的签名。",
  ],

  // ABI encoder / decoder
  "abiPanel.title": ["ABI Encoder / Decoder", "ABI 编解码器"],
  "abiPanel.mode.encode": ["Encode call", "编码调用"],
  "abiPanel.mode.decode": ["Decode calldata", "解码 calldata"],
  "abiPanel.mode.constructor": ["Constructor args", "构造函数参数"],
  "abiPanel.mode.abi": ["Decode with ABI JSON", "用 ABI JSON 解码"],
  "abiPanel.notice": [
    "Encoding is local and deterministic. Signature mode accepts a readable signature; ABI mode takes a contract ABI JSON so tuples and structs keep their names.",
    "编码在本地完成且结果确定。签名模式接受可读签名；ABI 模式接受合约 ABI JSON，可保留 tuple 与 struct 的字段名。",
  ],
  "abiPanel.abiNotice": [
    "Paste the ABI array from a verified contract. Nothing is fetched, so this works with Privacy First Mode on.",
    "粘贴已验证合约的 ABI 数组。全部本地处理，因此隐私优先模式下同样可用。",
  ],
  "field.abiJson": ["Contract ABI JSON", "合约 ABI JSON"],
  "field.abiFunction": ["Function", "函数"],
  "field.calldataInput": ["Calldata", "Calldata"],
  "field.returndataInput": ["Return data (optional)", "返回数据（可选）"],
  "abiPanel.empty.title": ["Nothing encoded yet", "尚未编码"],
  "abiPanel.empty.hint": [
    "Enter a signature and its arguments to get calldata you can paste into a transaction.",
    "输入签名与参数，得到可直接粘贴进交易的 calldata。",
  ],
  "abiPanel.action.encode": ["Encode", "编码"],
  "abiPanel.action.decode": ["Decode", "解码"],
  "abiPanel.selector": ["Function selector", "函数 selector"],
  "abiPanel.calldata": ["Calldata", "Calldata"],
  "abiPanel.constructorData": ["Constructor arguments", "构造函数参数"],
  "abiPanel.err.abiJson": ["Paste a valid ABI JSON array.", "请粘贴合法的 ABI JSON 数组。"],
  "abiPanel.err.noFunctions": ["This ABI has no functions with matching types.", "该 ABI 中没有参数匹配的函数。"],
  "abiPanel.err.pickFunction": ["Choose a function first.", "请先选择函数。"],
  "abiPanel.err.selectorMismatch": [
    "Calldata starts with selector 0x{provided}, but {signature} hashes to 0x{expected}.",
    "calldata 开头的 selector 是 0x{provided}，但 {signature} 实际对应 0x{expected}。",
  ],
  "abiPanel.argsTitle": ["Arguments", "参数"],
  "abiPanel.argsHint": [
    "One argument per line. Arrays and tuples accept JSON, e.g. [1,2] or [1,\"0x…\"].",
    "每行一个参数。数组与 tuple 可用 JSON，例如 [1,2] 或 [1,\"0x…\"]。",
  ],
  "abiPanel.decodedName": ["Name", "名称"],
  "abiPanel.decodedValue": ["Value", "值"],
  "abiPanel.matchedFunction": ["Matched by selector", "按 selector 匹配"],
  "abiPanel.noMatch": ["No function in this ABI has selector 0x{selector}.", "该 ABI 中没有 selector 为 0x{selector} 的函数。"],
  "abiPanel.selectFunction": ["Select a function", "选择函数"],
  "abiPanel.constructorHeading": ["Constructor", "构造函数"],
  "abiPanel.constructorNote": [
    "Constructor arguments are appended to the deployment bytecode with no selector. Verify them against the creation transaction input.",
    "构造函数参数不带 selector，直接拼在部署字节码之后。可对照创建交易的 input 校验。",
  ],

  // Event log decoder
  "event.panel": ["Event log", "事件日志"],
  "event.notice": [
    "Paste a receipt log. topics[0] identifies the event, indexed parameters are read from topics[1..], and the rest come from data.",
    "粘贴 receipt 中的 log。topics[0] 标识事件，indexed 参数从 topics[1..] 读取，其余来自 data。",
  ],
  "field.topics": ["Topics (one per line)", "Topics（每行一个）"],
  "field.logData": ["Log data", "Log data"],
  "event.action.decode": ["Decode log", "解码日志"],
  "event.empty.title": ["No log decoded", "尚未解码"],
  "event.empty.hint": [
    "Paste the topics and data of one log entry, then decode it against a signature or ABI.",
    "粘贴单条 log 的 topics 与 data，再用签名或 ABI 解码。",
  ],
  "event.indexed": ["indexed", "indexed"],
  "event.fromTopic": ["from topics[{index}]", "来自 topics[{index}]"],
  "event.fromData": ["from data", "来自 data"],
  "event.dynamicIndexedWarning": [
    "This indexed parameter has a dynamic type, so the topic holds keccak256(value), not the value. It cannot be reversed — only compared against a candidate value.",
    "该 indexed 参数是动态类型，topic 中存的是 keccak256(value) 而不是原值，无法还原，只能与候选值比对。",
  ],
  "event.topicHash": ["Topic hash", "Topic 哈希"],
  "event.topic0Missing": ["First topic must be a 32-byte event topic.", "第一个 topic 必须是 32 字节的事件 topic。"],
  "event.anonymous": ["Anonymous event: no topic0, so it must be matched by ABI.", "匿名事件没有 topic0，只能通过 ABI 匹配。"],
  "event.err.topics": ["Enter at least one topic (64 hex characters each).", "请至少输入一个 topic（每个 64 位十六进制字符）。"],
  "event.err.count": ["Signature expects {expected} topic(s) but {actual} were supplied.", "签名需要 {expected} 个 topic，实际提供了 {actual} 个。"],
  "event.topicCount": ["Indexed parameters", "indexed 参数个数"],
  "event.dataWords": ["Data words", "data 字数"],
  "event.err.notIndexed": ["Parameter {name} is not indexed; its value must come from data.", "参数 {name} 不是 indexed，其值应来自 data。"],

  // Shared: signature source
  "sigSource.title": ["How to get the types", "如何获得类型"],
  "sigSource.lookup": ["Look up", "反查"],
  "sigSource.manual": ["Manual", "手动"],
  "sigSource.abi": ["ABI", "ABI"],
} satisfies Record<string, readonly [string, string]>;

export type StringKey = keyof typeof strings;

export const LanguageContext = createContext<Lang>("en");

export function useLang(): Lang {
  return useContext(LanguageContext);
}

/** Returns a translator bound to the current language. */
export function useT(): (key: StringKey, vars?: Record<string, string | number>) => string {
  const lang = useLang();
  return (key, vars) => {
    const text = strings[key][lang === "zh" ? 1 : 0];
    if (!vars) return text;
    return Object.entries(vars).reduce((acc, [name, value]) => acc.replace(`{${name}}`, String(value)), text);
  };
}

/** For helpers that receive the language as data rather than through context. */
export function t(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  const text = strings[key][lang === "zh" ? 1 : 0];
  if (!vars) return text;
  return Object.entries(vars).reduce((acc, [name, value]) => acc.replace(`{${name}}`, String(value)), text);
}
