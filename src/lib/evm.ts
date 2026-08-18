const MASK_64 = (1n << 64n) - 1n;
const KECCAK_ROTATION = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
] as const;
const KECCAK_RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
] as const;

export type StorageEntry = {
  name: string;
  type: string;
  kind: string;
  keyType?: string;
  valueType?: string;
  slot: bigint | null;
  offset: number | null;
  note: string;
  constant?: boolean;
  immutable?: boolean;
};

export type StorageLayout = {
  sourceType: string;
  contractName?: string;
  selectionNote?: string;
  entries: StorageEntry[];
};

type ParsedContract = { kind: string; name: string; bases: string[]; statements: string[] };

export function keccak256Hex(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const rate = 136;
  const state = new Array<bigint>(25).fill(0n);
  const padded = [...bytes, 0x01];
  while (padded.length % rate !== rate - 1) padded.push(0);
  padded.push(0x80);
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let i = 0; i < rate; i += 1) {
      state[Math.floor(i / 8)] ^= BigInt(padded[offset + i]) << BigInt((i % 8) * 8);
    }
    keccakF(state);
  }
  const out: number[] = [];
  for (let i = 0; i < 32; i += 1) out.push(Number((state[Math.floor(i / 8)] >> BigInt((i % 8) * 8)) & 0xffn));
  return out.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function rotate64(value: bigint, shift: number) {
  const n = BigInt(shift);
  return shift === 0 ? value : ((value << n) | (value >> (64n - n))) & MASK_64;
}

function keccakF(state: bigint[]) {
  for (const rc of KECCAK_RC) {
    const c = new Array<bigint>(5);
    for (let x = 0; x < 5; x += 1) c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    for (let x = 0; x < 5; x += 1) {
      const d = c[(x + 4) % 5] ^ rotate64(c[(x + 1) % 5], 1);
      for (let y = 0; y < 5; y += 1) state[x + 5 * y] = (state[x + 5 * y] ^ d) & MASK_64;
    }
    const b = new Array<bigint>(25);
    for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotate64(state[x + 5 * y], KECCAK_ROTATION[x][y]);
    for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) state[x + 5 * y] = (b[x + 5 * y] ^ ((~b[((x + 1) % 5) + 5 * y] & MASK_64) & b[((x + 2) % 5) + 5 * y])) & MASK_64;
    state[0] = (state[0] ^ rc) & MASK_64;
  }
}

export function parseSlotIndex(value: string, label = "Slot") {
  const input = value.trim();
  if (!input) throw new Error(`${label} is required.`);
  if (!/^(0x[a-fA-F0-9]+|\d+)$/.test(input)) throw new Error(`${label} must be decimal or 0x hex.`);
  const parsed = BigInt(input);
  if (parsed < 0n || parsed >= (1n << 256n)) throw new Error(`${label} must fit in uint256.`);
  return parsed;
}

export function toSlotHex(value: bigint | string) {
  const slot = typeof value === "bigint" ? value : parseSlotIndex(value);
  return `0x${slot.toString(16).padStart(64, "0")}`;
}

export function normalizeAbiWord(value: string) {
  const hex = value.toLowerCase().replace(/^0x/, "");
  return `0x${hex.padStart(64, "0")}`;
}

export function normalizeAbiWordByType(value: string, type: string) {
  const input = value.trim();
  const normalized = normalizeSolidityType(type);
  if (normalized === "address") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(input)) throw new Error("Address key must be a 20-byte 0x address.");
    return normalizeAbiWord(input);
  }
  if (/^u?int\d*$/.test(normalized)) {
    if (!/^(0x[a-fA-F0-9]+|\d+)$/.test(input)) throw new Error("Integer key must be decimal or 0x hex.");
    return normalizeAbiWord(BigInt(input).toString(16));
  }
  if (normalized === "bool") {
    if (!/^(true|false|0|1)$/i.test(input)) throw new Error("Bool key must be true/false or 0/1.");
    return normalizeAbiWord(/^(true|1)$/i.test(input) ? "1" : "0");
  }
  if (normalized === "bytes32") {
    if (!/^0x[a-fA-F0-9]{64}$/.test(input)) throw new Error("bytes32 key must be 32-byte hex.");
    return input.toLowerCase();
  }
  return normalizeAbiWord(input);
}

export function mappingSlotByType(key: string, keyType: string, slot: string) {
  const packed = hexToBytes(`${normalizeAbiWordByType(key, keyType).slice(2)}${normalizeAbiWord(slot).slice(2)}`);
  return `0x${keccak256Hex(packed)}`;
}

export function hexToBytes(hex: string) {
  const normalized = hex.replace(/^0x/, "");
  if (normalized.length % 2 !== 0) throw new Error("Hex input must have an even length.");
  if (!/^[a-fA-F0-9]*$/.test(normalized)) throw new Error("Invalid hex input.");
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function decodeStorageValue(rawValue: string, valueType: string) {
  const value = BigInt(rawValue || "0x0");
  const type = normalizeSolidityType(valueType);
  if (type === "bool") return value === 0n ? "false" : value === 1n ? "true" : `non-canonical bool (${value})`;
  if (type === "address" || type === "addresspayable") return `0x${rawValue.replace(/^0x/, "").slice(-40)}`;
  if (/^uint/.test(type)) return value.toString();
  if (/^int/.test(type)) return value >= (1n << 255n) ? (value - (1n << 256n)).toString() : value.toString();
  return rawValue;
}

export function parseMappingDeclaration(input: string) {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (!/^mapping\s*\(/i.test(normalized)) return null;
  const openIndex = normalized.indexOf("(");
  const closeIndex = findMatching(normalized, openIndex, "(", ")");
  if (closeIndex < 0) return null;
  const type = normalized.slice(0, closeIndex + 1);
  const mappingTypes = splitMappingTypes(type);
  if (!mappingTypes) return null;
  const tail = normalized.slice(closeIndex + 1).replace(/\b(?:public|private|internal|external|constant|immutable|virtual|override)\b/gi, " ").trim();
  const name = tail.split("=")[0].trim().split(/\s+/).filter(Boolean).at(-1) || "mapping";
  return { kind: "mapping", name, keyType: normalizeSolidityType(mappingTypes[0]), valueType: normalizeSolidityType(mappingTypes[1]), type: `mapping(${normalizeSolidityType(mappingTypes[0])} => ${normalizeSolidityType(mappingTypes[1])})` };
}

export function parseSourceLayout(source: string, contractName = "", mode = "verified source"): StorageLayout {
  const jsonLayout = tryParseStorageLayoutJson(source);
  if (jsonLayout) return jsonLayout;
  const clean = stripSolidityComments(source);
  const contracts = parseContracts(clean);
  if (!contracts.length) return buildLayout(splitTopLevelStatements(clean), mode);
  const selected = selectContract(contracts, contractName);
  const map = new Map(contracts.map((contract) => [contract.name, contract]));
  const leafs = contracts.filter((contract) => contract.kind === "contract" && !contracts.some((item) => item.bases.includes(contract.name)));
  const statements = collectStatements(selected, map, new Set<string>());
  return {
    ...buildLayout(statements, mode),
    contractName: selected.name,
    selectionNote: contractName.trim()
      ? `requested contract: ${selected.name}`
      : leafs.length > 1
        ? `auto-selected ${selected.name}; candidates: ${leafs.map((item) => item.name).join(", ")}`
        : `auto-selected ${selected.name}`,
  };
}

function tryParseStorageLayoutJson(text: string): StorageLayout | null {
  try {
    const payload = JSON.parse(text) as { storage?: Array<{ label?: string; type: string; slot?: string; offset?: string | number }>; types?: Record<string, { label?: string; encoding?: string }> };
    if (!Array.isArray(payload.storage)) return null;
    return {
      sourceType: "storageLayout JSON",
      entries: payload.storage.map((entry) => {
        const label = payload.types?.[entry.type]?.label || entry.type;
        const info = classifyType(label);
        return {
          name: entry.label || "slot",
          type: label,
          ...info,
          slot: BigInt(entry.slot || "0"),
          offset: Number(entry.offset || 0),
        };
      }),
    };
  } catch {
    return null;
  }
}

function parseContracts(clean: string) {
  const contracts: ParsedContract[] = [];
  const matcher = /\b(?:abstract\s+)?(contract|interface|library)\s+([A-Za-z_$][\w$]*)\s*([^{};]*)\{/gi;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(clean))) {
    const open = matcher.lastIndex - 1;
    const close = findMatching(clean, open, "{", "}");
    if (close < 0) continue;
    const body = clean.slice(open + 1, close);
    contracts.push({ kind: match[1].toLowerCase(), name: match[2], bases: parseBases(match[3] || ""), statements: splitTopLevelStatements(body) });
    matcher.lastIndex = close + 1;
  }
  return contracts;
}

function parseBases(header: string) {
  const match = header.match(/\bis\s+([\s\S]+)$/i);
  if (!match) return [];
  return splitTopLevelComma(match[1]).map((item) => item.trim().match(/^([A-Za-z_$][\w$]*)/)?.[1]).filter(Boolean) as string[];
}

function selectContract(contracts: ParsedContract[], requested: string) {
  if (requested.trim()) {
    const found = contracts.find((contract) => contract.name === requested.trim());
    if (!found) throw new Error(`Contract "${requested}" was not found.`);
    return found;
  }
  const inherited = new Set(contracts.flatMap((contract) => contract.bases));
  return contracts.filter((contract) => contract.kind === "contract" && !inherited.has(contract.name)).at(-1) || contracts.filter((contract) => contract.kind === "contract").at(-1) || contracts[0];
}

function collectStatements(contract: { name: string; bases: string[]; statements: string[] }, map: Map<string, { name: string; bases: string[]; statements: string[] }>, visiting: Set<string>): string[] {
  if (visiting.has(contract.name)) return [];
  visiting.add(contract.name);
  const inherited = contract.bases.flatMap((base) => {
    const item = map.get(base);
    return item ? collectStatements(item, map, visiting) : [];
  });
  visiting.delete(contract.name);
  return [...inherited, ...contract.statements];
}

function buildLayout(statements: string[], sourceType: string): StorageLayout {
  const entries: StorageEntry[] = [];
  let slot = 0n;
  let offset = 0;
  for (const statement of statements) {
    const parsed = parseStateStatement(statement);
    if (!parsed) continue;
    const layout = classifyType(parsed.type);
    if (parsed.constant || parsed.immutable) {
      entries.push({ ...parsed, ...layout, slot: null, offset: null, note: parsed.constant ? "constant: not stored on-chain" : "immutable: stored in bytecode" });
      continue;
    }
    const placed = place(slot, offset, layout);
    slot = placed.nextSlot;
    offset = placed.nextOffset;
    entries.push({ ...parsed, ...layout, slot: placed.slot, offset: placed.offset });
  }
  return { sourceType, entries };
}

function parseStateStatement(statement: string) {
  const text = statement.trim().replace(/\s+/g, " ");
  if (!text || /^(function|constructor|fallback|receive|modifier|event|error|struct|enum|using|import|pragma|contract|interface|library|assembly)\b/i.test(text)) return null;
  const constant = /\bconstant\b/i.test(text);
  const immutable = /\bimmutable\b/i.test(text);
  const mapping = parseMappingDeclaration(text);
  if (mapping) return { name: mapping.name, type: mapping.type, constant, immutable };
  const beforeInitializer = text.split("=")[0].trim();
  if (/[(){}]/.test(beforeInitializer)) return null;
  const nameMatch = beforeInitializer.match(/([A-Za-z_$][\w$]*)$/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  const type = beforeInitializer.slice(0, nameMatch.index).replace(/\b(?:public|private|internal|external|constant|immutable|virtual|override|storage|memory|calldata)\b/gi, " ").replace(/\s+/g, " ").trim();
  if (!type || /\b(?:return|if|else|for|while|emit|delete|new|require|assert|revert)\b/i.test(type) || /[+\-*/%!<>&|?:]/.test(type)) return null;
  return { name, type: normalizeSolidityType(type), constant, immutable };
}

function classifyType(type: string) {
  const normalized = normalizeSolidityType(type);
  const mapping = splitMappingTypes(normalized);
  if (mapping) return { kind: "mapping", keyType: normalizeSolidityType(mapping[0]), valueType: normalizeSolidityType(mapping[1]), slotSpan: 1n, note: "mapping base slot; values live at keccak256(key, base slot)" };
  if (/^(bytes|string)$/i.test(normalized)) return { kind: "dynamic", slotSpan: 1n, note: "length/pointer slot; data is stored separately" };
  if (/^\w+\[\]$/.test(normalized)) return { kind: "dynamic-array", slotSpan: 1n, note: "array length slot; elements start at keccak256(slot)" };
  const fixed = normalized.match(/^(.+?)\[(\d+)\]$/);
  if (fixed) return { kind: "fixed-array", slotSpan: BigInt(fixed[2]), note: `fixed array of ${fixed[2]} element(s)` };
  const bytes = storageSize(normalized);
  if (bytes !== null) return { kind: "static", sizeBytes: bytes, slotSpan: bytes === 32 ? 1n : 0n, note: bytes < 32 ? `packed in ${bytes} byte(s)` : "full 32-byte slot" };
  return { kind: "complex", slotSpan: 1n, note: "complex type; use compiler storageLayout for exact nested layout" };
}

function place(cursorSlot: bigint, cursorOffset: number, layout: { kind: string; slotSpan?: bigint; sizeBytes?: number }) {
  if (layout.kind !== "static") {
    const slot = cursorOffset > 0 ? cursorSlot + 1n : cursorSlot;
    return { slot, offset: 0, nextSlot: slot + (layout.slotSpan || 1n), nextOffset: 0 };
  }
  const size = layout.sizeBytes || 32;
  let slot = cursorSlot;
  let offset = cursorOffset;
  if (offset + size > 32) {
    slot += 1n;
    offset = 0;
  }
  const nextOffset = offset + size;
  return size === 32 || nextOffset === 32
    ? { slot, offset, nextSlot: slot + 1n, nextOffset: 0 }
    : { slot, offset, nextSlot: slot, nextOffset };
}

function storageSize(type: string) {
  if (type === "bool") return 1;
  if (type === "address" || type === "addresspayable") return 20;
  const bytes = type.match(/^bytes(\d+)$/i);
  if (bytes) return Number(bytes[1]) >= 1 && Number(bytes[1]) <= 32 ? Number(bytes[1]) : null;
  const integer = type.match(/^(u?int)(\d+)$/i);
  if (integer) return Number(integer[2]) / 8;
  if (/^(uint|int)$/i.test(type)) return 32;
  return null;
}

function splitMappingTypes(text: string): [string, string] | null {
  const normalized = normalizeSolidityType(text);
  const start = normalized.match(/^mapping\((.*)\)$/i);
  if (!start) return null;
  const inner = start[1];
  let depth = 0;
  for (let i = 0; i < inner.length - 1; i += 1) {
    if (inner[i] === "(") depth += 1;
    else if (inner[i] === ")") depth = Math.max(depth - 1, 0);
    else if (inner[i] === "=" && inner[i + 1] === ">" && depth === 0) return [inner.slice(0, i), inner.slice(i + 2)];
  }
  return null;
}

function splitTopLevelStatements(body: string) {
  const statements: string[] = [];
  let current = "";
  let paren = 0;
  let bracket = 0;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(paren - 1, 0);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(bracket - 1, 0);
    if (char === "{" && paren === 0 && bracket === 0) {
      const close = findMatching(body, i, "{", "}");
      if (close < 0) break;
      current = "";
      i = close;
      continue;
    }
    if (char === ";" && paren === 0 && bracket === 0) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function splitTopLevelComma(text: string) {
  const parts: string[] = [];
  let start = 0;
  let paren = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "(") paren += 1;
    else if (text[i] === ")") paren = Math.max(paren - 1, 0);
    else if (text[i] === "," && paren === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function findMatching(text: string, openIndex: number, open: string, close: string) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === open) depth += 1;
    else if (text[i] === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function stripSolidityComments(text: string) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
}

export function normalizeSolidityType(type: string) {
  return type.trim().replace(/\s/g, "").replace(/^uint$/i, "uint256").replace(/^int$/i, "int256");
}

export function findStorageEntry(entries: StorageEntry[], target: string) {
  const normalized = target.trim().replace(/\(\s*\)$/, "");
  const exact = entries.find((entry) => entry.name === normalized);
  if (exact) return { entry: exact, reason: "exact name match" };
  const alias = normalized.replace(/^_+/, "").toLowerCase();
  const found = entries.find((entry) => entry.name.replace(/^_+/, "").toLowerCase() === alias);
  return found ? { entry: found, reason: `getter alias match: ${normalized} -> ${found.name}` } : { entry: null, reason: "" };
}

export async function rpcRequest(endpoint: string, method: string, params: unknown[]) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message || "RPC request failed.");
  return payload.result as string;
}
