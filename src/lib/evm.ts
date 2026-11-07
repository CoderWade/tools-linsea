import type { StringKey } from "./i18n";

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

/**
 * One resolved storage variable.
 *
 * `noteKey`/`noteParams` are deliberately not rendered text: the same parser
 * runs in both languages, so the caller translates with its own locale.
 *
 * `reliable` is false when an earlier variable in the layout had an unknown
 * span. Slot numbers after such a point are guesses, and the UI must say so —
 * silently printing a wrong slot is worse than printing none.
 */
export type StorageEntry = {
  name: string;
  type: string;
  kind: string;
  keyType?: string;
  valueType?: string;
  nestedMapping?: boolean;
  slot: bigint | null;
  offset: number | null;
  noteKey: StringKey;
  noteParams?: Record<string, string | number>;
  constant?: boolean;
  immutable?: boolean;
  reliable: boolean;
};

export type StorageLayout = {
  sourceType: string;
  contractName?: string;
  selectionNote?: string;
  entries: StorageEntry[];
  /** True when at least one variable had an unresolvable size. */
  hasUnknownSpans: boolean;
};

type ParsedContract = {
  kind: string;
  name: string;
  bases: string[];
  statements: string[];
  structs: Map<string, string[]>;
  enums: Set<string>;
  userTypes: Map<string, string>;
};

/**
 * Everything needed to size a type. Solidity storage sizing depends on
 * user-declared types, so a type name alone is not enough.
 */
type TypeRegistry = {
  structs: Map<string, string[]>;
  enums: Set<string>;
  userTypes: Map<string, string>;
  declarations: Set<string>;
  structSpanCache: Map<string, bigint | null>;
  computing: Set<string>;
};

type TypeInfo = {
  kind: "static" | "mapping" | "dynamic" | "dynamic-array" | "fixed-array" | "struct" | "unknown";
  /** For "static": bytes occupied. */
  sizeBytes?: number;
  /** For every non-static kind: how many whole slots it claims. Null when unknown. */
  slotSpan?: bigint | null;
  keyType?: string;
  valueType?: string;
  nestedMapping?: boolean;
  noteKey: StringKey;
  noteParams?: Record<string, string | number>;
};

export function keccak256Hex(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const rate = 136;
  const state = new Array<bigint>(25).fill(0n);
  // Keccak padding is `0x01 || zeros || 0x80` up to the next block boundary.
  // When the message plus the 0x01 domain byte already fills a block exactly,
  // both bits live in that final byte (0x01 | 0x80) instead of a second block.
  const padded = [...bytes, 0x01];
  if (padded.length % rate === 0) {
    padded[padded.length - 1] |= 0x80;
  } else {
    while (padded.length % rate !== rate - 1) padded.push(0);
    padded.push(0x80);
  }
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

/**
 * A nested mapping (mapping(K1 => mapping(K2 => V))) never stores anything at
 * the slot derived from a single key — that derived slot is the *location of
 * the inner mapping object*, and mappings are not materialised on chain. Any
 * read there is guaranteed to return zero, so callers must refuse rather than
 * report a misleading zero.
 */
export function isNestedMappingType(type: string) {
  const parsed = splitMappingTypes(normalizeSolidityType(type));
  return parsed ? /^mapping\(/i.test(normalizeSolidityType(parsed[1])) : false;
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
  const keyType = normalizeSolidityType(mappingTypes[0]);
  const valueType = normalizeSolidityType(mappingTypes[1]);
  return {
    kind: "mapping",
    name,
    keyType,
    valueType,
    nested: /^mapping\(/i.test(valueType),
    type: `mapping(${keyType} => ${valueType})`,
  };
}

export function parseSourceLayout(source: string, contractName = "", mode = "verified source"): StorageLayout {
  const jsonLayout = tryParseStorageLayoutJson(source);
  if (jsonLayout) return jsonLayout;
  const clean = stripSolidityComments(source);
  const contracts = parseContracts(clean);
  if (!contracts.length) return buildLayout(splitTopLevelStatements(clean), mode, createRegistry(contracts));

  const selected = selectContract(contracts, contractName);
  const map = new Map(contracts.map((contract) => [contract.name, contract]));
  const leafs = contracts.filter((contract) => contract.kind === "contract" && !contracts.some((item) => item.bases.includes(contract.name)));

  // Inheritance chain order matters for both storage order and type lookup:
  // the chain is walked base-first, so re-registering in that order lets a
  // derived contract's own declarations win over a same-named base type.
  const chain = collectChain(selected, map);
  const registry = createRegistry(contracts);
  for (const contract of chain) registerContractTypes(registry, contract);

  const statements = collectStatements(selected, map);
  return {
    ...buildLayout(statements, mode, registry),
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
      hasUnknownSpans: false,
      entries: payload.storage.map((entry) => {
        const label = payload.types?.[entry.type]?.label || entry.type;
        const info = classifyType(label, emptyRegistry());
        return {
          name: entry.label || "slot",
          type: label,
          kind: info.kind === "static" ? "static" : info.kind,
          keyType: info.keyType,
          valueType: info.valueType,
          nestedMapping: info.nestedMapping,
          noteKey: info.noteKey,
          noteParams: info.noteParams,
          slot: BigInt(entry.slot || "0"),
          offset: Number(entry.offset || 0),
          reliable: true,
        };
      }),
    };
  } catch {
    return null;
  }
}

function emptyRegistry(): TypeRegistry {
  return { structs: new Map(), enums: new Set(), userTypes: new Map(), declarations: new Set(), structSpanCache: new Map(), computing: new Set() };
}

function createRegistry(contracts: ParsedContract[]): TypeRegistry {
  const registry = emptyRegistry();
  for (const contract of contracts) registerContractTypes(registry, contract);
  return registry;
}

function registerContractTypes(registry: TypeRegistry, contract: ParsedContract) {
  registry.declarations.add(contract.name);
  for (const [name, members] of contract.structs) registry.structs.set(name, members);
  for (const name of contract.enums) registry.enums.add(name);
  for (const [name, underlying] of contract.userTypes) registry.userTypes.set(name, underlying);
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
    contracts.push({
      kind: match[1].toLowerCase(),
      name: match[2],
      bases: parseBases(match[3] || ""),
      statements: splitTopLevelStatements(body),
      structs: parseStructs(body),
      enums: parseEnums(body),
      userTypes: parseUserTypes(body),
    });
    matcher.lastIndex = close + 1;
  }
  return contracts;
}

/** `struct S { uint256 a; }` — members are split the same way as state variables. */
function parseStructs(body: string) {
  const structs = new Map<string, string[]>();
  const matcher = /\bstruct\s+([A-Za-z_$][\w$]*)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(body))) {
    const open = matcher.lastIndex - 1;
    const close = findMatching(body, open, "{", "}");
    if (close < 0) continue;
    structs.set(match[1], splitTopLevelStatements(body.slice(open + 1, close)));
    matcher.lastIndex = close + 1;
  }
  return structs;
}

function parseEnums(body: string) {
  const enums = new Set<string>();
  const matcher = /\benum\s+([A-Za-z_$][\w$]*)\s*\{[^}]*\}/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(body))) enums.add(match[1]);
  return enums;
}

/** User-defined value types: `type Price is uint128;` */
function parseUserTypes(body: string) {
  const types = new Map<string, string>();
  const matcher = /\btype\s+([A-Za-z_$][\w$]*)\s+is\s+([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(body))) types.set(match[1], normalizeSolidityType(match[2]));
  return types;
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

/** Base-first order, shared bases included once (matches Solidity's linearisation closely enough for storage order). */
function collectChain(contract: ParsedContract, map: Map<string, ParsedContract>): ParsedContract[] {
  const seen = new Set<string>();
  const order: ParsedContract[] = [];
  const visit = (current: ParsedContract) => {
    if (seen.has(current.name)) return;
    seen.add(current.name);
    for (const base of current.bases) {
      const parent = map.get(base);
      if (parent) visit(parent);
    }
    order.push(current);
  };
  visit(contract);
  return order;
}

/**
 * Concatenates inherited state variables before the contract's own.
 *
 * The `seen` set is shared across the whole walk, not scoped to the current
 * recursion path: a base contract reached through two branches (diamond
 * inheritance) must contribute its variables exactly once. Scoping the guard
 * to the path let `d` be emitted twice and shifted every later slot.
 */
function collectStatements(contract: ParsedContract, map: Map<string, ParsedContract>): string[] {
  const seen = new Set<string>();
  const statements: string[] = [];
  const visit = (current: ParsedContract) => {
    if (seen.has(current.name)) return;
    seen.add(current.name);
    for (const base of current.bases) {
      const parent = map.get(base);
      if (parent) visit(parent);
    }
    statements.push(...current.statements);
  };
  visit(contract);
  return statements;
}

function buildLayout(statements: string[], sourceType: string, registry: TypeRegistry): StorageLayout {
  const entries: StorageEntry[] = [];
  let slot = 0n;
  let offset = 0;
  let reliable = true;
  let hasUnknownSpans = false;

  for (const statement of statements) {
    const parsed = parseStateStatement(statement);
    if (!parsed) continue;
    const info = classifyType(parsed.type, registry);
    if (parsed.constant || parsed.immutable) {
      entries.push({
        ...parsed,
        kind: info.kind,
        keyType: info.keyType,
        valueType: info.valueType,
        nestedMapping: info.nestedMapping,
        noteKey: parsed.constant ? "storage.note.constant" : "storage.note.immutable",
        slot: null,
        offset: null,
        reliable: true,
      });
      continue;
    }
    const placed = place(slot, offset, info);
    slot = placed.nextSlot;
    offset = placed.nextOffset;
    if (!placed.reliable) {
      reliable = false;
      hasUnknownSpans = true;
    }
    entries.push({
      ...parsed,
      kind: info.kind === "static" ? "static" : info.kind,
      keyType: info.keyType,
      valueType: info.valueType,
      nestedMapping: info.nestedMapping,
      noteKey: info.noteKey,
      noteParams: info.noteParams,
      slot: placed.slot,
      offset: placed.offset,
      reliable,
    });
  }
  return { sourceType, entries, hasUnknownSpans };
}

function parseStateStatement(statement: string) {
  const text = statement.trim().replace(/\s+/g, " ");
  if (!text) return null;
  // `function name(...)` is a declaration to skip; `function(...)` with no name
  // is a function-*type* state variable, which does occupy storage.
  if (/^function\s+[A-Za-z_$]/i.test(text)) return null;
  if (/^(constructor|fallback|receive|modifier|event|error|struct|enum|using|import|pragma|contract|interface|library|assembly|type)\b/i.test(text)) return null;
  const constant = /\bconstant\b/i.test(text);
  const immutable = /\bimmutable\b/i.test(text);
  const mapping = parseMappingDeclaration(text);
  if (mapping) return { name: mapping.name, type: mapping.type, constant, immutable };
  const beforeInitializer = text.split("=")[0].trim();
  // Function-type variables contain parentheses, which are otherwise a signal
  // that the statement is not a state variable. Allow them explicitly.
  const isFunctionType = /^function\s*\(/i.test(beforeInitializer);
  if (!isFunctionType && /[(){}]/.test(beforeInitializer)) return null;
  if (/\{|\}/.test(beforeInitializer)) return null;
  const nameMatch = beforeInitializer.match(/([A-Za-z_$][\w$]*)$/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  const rawType = beforeInitializer.slice(0, nameMatch.index);
  // `external` on a function type is not a visibility modifier to discard: it
  // decides whether the variable is 24 bytes (address + selector) or 8 bytes
  // (internal function id). Keep it for function types only.
  const type = (isFunctionType
    ? rawType.replace(/\b(?:public|private|constant|immutable|virtual|override|storage|memory|calldata)\b/gi, " ")
    : rawType.replace(/\b(?:public|private|internal|external|constant|immutable|virtual|override|storage|memory|calldata)\b/gi, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
  if (!type) return null;
  if (/\b(?:return|if|else|for|while|emit|delete|new|require|assert|revert)\b/i.test(type)) return null;
  if (/[+\-*/%!<>&|?:]/.test(type)) return null;
  return { name, type: normalizeSolidityType(type), constant, immutable };
}

function classifyType(type: string, registry: TypeRegistry): TypeInfo {
  const normalized = normalizeSolidityType(type);

  const mapping = splitMappingTypes(normalized);
  if (mapping) {
    const valueType = normalizeSolidityType(mapping[1]);
    const nested = /^mapping\(/i.test(valueType);
    return {
      kind: "mapping",
      keyType: normalizeSolidityType(mapping[0]),
      valueType,
      nestedMapping: nested,
      slotSpan: 1n,
      noteKey: nested ? "storage.note.mappingNested" : "storage.note.mappingBase",
    };
  }

  if (/^(bytes|string)$/i.test(normalized)) {
    return { kind: "dynamic", slotSpan: 1n, noteKey: "storage.note.dynamic" };
  }

  if (/^\w+\[\]$/.test(normalized)) {
    return { kind: "dynamic-array", slotSpan: 1n, noteKey: "storage.note.dynamicArray" };
  }

  const fixed = normalized.match(/^(.+)\[(\d+)\]$/);
  if (fixed) {
    const count = Number(fixed[2]);
    const element = classifyType(fixed[1], registry);
    if (element.kind === "static" && element.sizeBytes) {
      // Arrays occupy whole slots: ceil(count * size / 32), and the next
      // variable starts after them without packing into leftover bytes.
      const slots = BigInt(Math.ceil((count * element.sizeBytes) / 32));
      return {
        kind: "fixed-array",
        slotSpan: slots,
        noteKey: "storage.note.fixedArray",
        noteParams: { count, slots: slots.toString() },
      };
    }
    const elementSpan = element.slotSpan;
    if (elementSpan != null && elementSpan > 0n) {
      return {
        kind: "fixed-array",
        slotSpan: BigInt(count) * elementSpan,
        noteKey: "storage.note.fixedArray",
        noteParams: { count, slots: (BigInt(count) * elementSpan).toString() },
      };
    }
    return { kind: "fixed-array", slotSpan: null, noteKey: "storage.note.unknownType", noteParams: { type: normalized } };
  }

  if (registry.enums.has(normalized)) {
    // Enums are uint8: they pack with their neighbours.
    return { kind: "static", sizeBytes: 1, slotSpan: 0n, noteKey: "storage.note.enum" };
  }

  if (registry.userTypes.has(normalized)) {
    const underlying = registry.userTypes.get(normalized)!;
    const info = classifyType(underlying, registry);
    return { ...info, noteKey: "storage.note.udvt", noteParams: { type: normalized, underlying } };
  }

  if (registry.declarations.has(normalized)) {
    // A state variable of contract/interface type is a 20-byte address.
    return { kind: "static", sizeBytes: 20, slotSpan: 0n, noteKey: "storage.note.contractType" };
  }

  if (registry.structs.has(normalized)) {
    const span = structSlotSpan(normalized, registry);
    if (span == null) return { kind: "struct", slotSpan: null, noteKey: "storage.note.unknownType", noteParams: { type: normalized } };
    return { kind: "struct", slotSpan: span, noteKey: "storage.note.struct", noteParams: { slots: span.toString() } };
  }

  if (/^function\s*\(/i.test(normalized)) {
    // external functions store address + selector (24 bytes), internal ones
    // store an 8-byte function id.
    const size = /external/i.test(normalized) ? 24 : 8;
    return { kind: "static", sizeBytes: size, slotSpan: 0n, noteKey: "storage.note.functionType", noteParams: { bytes: size } };
  }

  const bytes = storageSize(normalized);
  if (bytes !== null) {
    return bytes === 32
      ? { kind: "static", sizeBytes: 32, slotSpan: 1n, noteKey: "storage.note.fullSlot" }
      : { kind: "static", sizeBytes: bytes, slotSpan: 0n, noteKey: "storage.note.packed", noteParams: { bytes } };
  }

  // Imported interface/contract types are the one unresolved case that can be
  // guessed safely: the `IXxx` / `Xxx` naming convention plus capitalisation.
  // Everything else is reported as unknown rather than assumed to be 32 bytes.
  if (/^I[A-Z0-9]/.test(normalized)) {
    return { kind: "static", sizeBytes: 20, slotSpan: 0n, noteKey: "storage.note.interfaceHeuristic" };
  }

  return { kind: "unknown", slotSpan: null, noteKey: "storage.note.unknownType", noteParams: { type: normalized } };
}

/**
 * Slots claimed by a struct: it starts at a slot boundary, occupies whole
 * slots, and its members follow the same packing rules as state variables.
 */
function structSlotSpan(name: string, registry: TypeRegistry): bigint | null {
  if (registry.structSpanCache.has(name)) return registry.structSpanCache.get(name)!;
  if (registry.computing.has(name)) return null;
  const members = registry.structs.get(name);
  if (!members) return null;

  registry.computing.add(name);
  let slot = 0n;
  let offset = 0;
  let ok = true;
  for (const member of members) {
    const parsed = parseStateStatement(member);
    if (!parsed) { ok = false; break; }
    const info = classifyType(parsed.type, registry);
    const placed = place(slot, offset, info);
    if (!placed.reliable) { ok = false; break; }
    slot = placed.nextSlot;
    offset = placed.nextOffset;
  }
  registry.computing.delete(name);

  const span = ok ? (offset > 0 ? slot + 1n : slot) : null;
  registry.structSpanCache.set(name, span);
  return span;
}

function place(cursorSlot: bigint, cursorOffset: number, layout: TypeInfo): { slot: bigint; offset: number; nextSlot: bigint; nextOffset: number; reliable: boolean } {
  if (layout.kind !== "static") {
    const slot = cursorOffset > 0 ? cursorSlot + 1n : cursorSlot;
    const span = layout.slotSpan;
    if (span == null) {
      // Unknown span: keep the best-guess slot but advance one slot so the
      // caller can flag every following entry as unreliable.
      return { slot, offset: 0, nextSlot: slot + 1n, nextOffset: 0, reliable: false };
    }
    return { slot, offset: 0, nextSlot: slot + span, nextOffset: 0, reliable: true };
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
    ? { slot, offset, nextSlot: slot + 1n, nextOffset: 0, reliable: true }
    : { slot, offset, nextSlot: slot, nextOffset, reliable: true };
}

function storageSize(type: string) {
  if (type === "bool") return 1;
  if (type === "address" || type === "addresspayable") return 20;
  const bytes = type.match(/^bytes(\d+)$/i);
  if (bytes) return Number(bytes[1]) >= 1 && Number(bytes[1]) <= 32 ? Number(bytes[1]) : null;
  const integer = type.match(/^(u?int)(\d+)$/i);
  if (integer) {
    const bits = Number(integer[2]);
    if (bits < 8 || bits > 256 || bits % 8 !== 0) return null;
    return bits / 8;
  }
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

/**
 * Removes comments while respecting string literals.
 *
 * A naive `//` strip deletes everything after the marker, so a constant such as
 * `string U = "https://a.io";` loses its closing quote and semicolon and
 * swallows the next declaration — silently dropping a variable instead of
 * reporting a problem.
 */
function stripSolidityComments(text: string) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' || char === "'") {
      const quote = char;
      out += char;
      i += 1;
      while (i < text.length) {
        const inner = text[i];
        if (inner === "\\") {
          out += inner + (text[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += inner;
        i += 1;
        if (inner === quote) break;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }

    out += char;
    i += 1;
  }
  return out;
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
