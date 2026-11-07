/*
 * Solidity ABI codec.
 *
 * Scope is the full Contract ABI type system as it appears in real call data:
 * integers, bool, address, bytesN, bytes, string, fixed and dynamic arrays,
 * nested arrays, and tuples (structs) at any depth. Encoding follows the spec
 * literally — every argument gets a 32-byte head word in the static case, or an
 * offset into the tail in the dynamic case.
 *
 * Decoding is deliberately strict. This code answers "what does this
 * transaction actually do", so a plausible-looking wrong answer is worse than
 * an error. Every read is bounds-checked, every static word is validated
 * against its declared type, and a truncated payload throws instead of being
 * silently clipped.
 */

export type AbiType =
  | { kind: "uint"; bits: number }
  | { kind: "int"; bits: number }
  | { kind: "bool" }
  | { kind: "address" }
  | { kind: "bytesN"; size: number }
  | { kind: "bytes" }
  | { kind: "string" }
  | { kind: "array"; item: AbiType; length: number | null }
  | { kind: "tuple"; components: AbiParameter[] };

export type AbiParameter = {
  name?: string;
  type: AbiType;
  indexed?: boolean;
};

export type AbiSignature = {
  name: string;
  kind: "function" | "event";
  inputs: AbiParameter[];
  outputs: AbiParameter[];
  mutability: string;
  canonical: string;
};

export type EncodedCall = {
  selector: string;
  calldata: string;
};

export type DecodedParameter = {
  name?: string;
  type: AbiType;
  value: string;
};

const WORD = 64;
const BYTES32_MOD = 1n << 256n;
/** Hard ceilings so a hostile payload cannot stall the tab. */
const MAX_ARRAY_ITEMS = 10_000;
const MAX_DEPTH = 32;
const MAX_INT_INPUT_CHARS = 4096;
const MAX_TYPES = 512;
/*
 * Total values a single decode may produce.
 *
 * A depth limit alone does not bound the work: array elements may point at the
 * same sub-array, so a payload of a few kilobytes can describe width^depth
 * values (100 elements over 4 levels is 10^8 decodes and hangs the tab). This
 * budget is the real bound. It is far above any legitimate response — a
 * 200k-word payload is already 6.4 MB of return data — so real data never
 * comes close.
 */
const MAX_DECODE_NODES = 200_000;

/* ------------------------------------------------------------------ */
/* Type parsing                                                        */
/* ------------------------------------------------------------------ */

const KEYWORDS = new Set([
  "memory", "calldata", "storage", "indexed", "payable", "external",
  "public", "internal", "private", "view", "pure", "constant", "returns",
  "nonpayable", "anonymous", "function", "event", "error", "constructor",
]);

export function parseAbiType(raw: string): AbiType {
  const text = raw.trim();
  if (!text) throw new Error("Empty type.");
  if (text.length > 1024) throw new Error("Type is unreasonably long.");

  let index = 0;

  function skipSpace() {
    while (index < text.length && /\s/.test(text[index])) index += 1;
  }

  function readIdentifier(): string {
    const start = index;
    while (index < text.length && /[A-Za-z0-9_$]/.test(text[index])) index += 1;
    if (start === index) throw new Error(`Unsupported ABI type: ${text.slice(start) || text}`);
    return text.slice(start, index);
  }

  function tryReadIdentifier(): string | null {
    const start = index;
    while (index < text.length && /[A-Za-z0-9_$]/.test(text[index])) index += 1;
    if (start === index) return null;
    return text.slice(start, index);
  }

  function parseArraySuffix(base: AbiType): AbiType {
    let type = base;
    for (;;) {
      skipSpace();
      if (text[index] !== "[") return type;
      index += 1;
      const start = index;
      while (index < text.length && /\d/.test(text[index])) index += 1;
      const digits = text.slice(start, index);
      skipSpace();
      if (text[index] !== "]") throw new Error(`Unclosed array suffix in type: ${text}`);
      index += 1;
      if (!digits) {
        type = { kind: "array", item: type, length: null };
      } else {
        const length = Number(digits);
        if (!Number.isSafeInteger(length) || length < 0) throw new Error(`Invalid array length in type: ${text}`);
        type = { kind: "array", item: type, length };
      }
    }
  }

  function parseBase(): AbiType {
    skipSpace();
    if (text[index] === "(") {
      index += 1;
      const components: AbiParameter[] = [];
      skipSpace();
      if (text[index] === ")") {
        index += 1;
        return { kind: "tuple", components };
      }
      for (;;) {
        const type = parseBaseWithSuffix();
        skipSpace();
        // Tuple components may carry names in source-style signatures.
        let name: string | undefined;
        while (index < text.length && /[A-Za-z_$]/.test(text[index])) {
          const word = readIdentifier();
          if (word === "indexed" || KEYWORDS.has(word)) continue;
          if (name) throw new Error(`Unexpected token in tuple: ${word}`);
          name = word;
          skipSpace();
        }
        components.push({ type, ...(name ? { name } : {}) });
        skipSpace();
        if (text[index] === ",") {
          index += 1;
          continue;
        }
        if (text[index] === ")") {
          index += 1;
          break;
        }
        throw new Error(`Unclosed tuple in type: ${text}`);
      }
      return { kind: "tuple", components };
    }

    const name = readIdentifier();
    // `address payable` is a Solidity source spelling; the ABI type is address.
    if (name === "address") {
      const save = index;
      skipSpace();
      if (tryReadIdentifier() !== "payable") index = save;
      return { kind: "address" };
    }
    if (name === "bool") return { kind: "bool" };
    if (name === "bytes") return { kind: "bytes" };
    if (name === "string") return { kind: "string" };
    if (name === "uint") return { kind: "uint", bits: 256 };
    if (name === "int") return { kind: "int", bits: 256 };

    const uint = name.match(/^uint(\d+)$/);
    if (uint) return { kind: "uint", bits: validBits(Number(uint[1]), name) };
    const int = name.match(/^int(\d+)$/);
    if (int) return { kind: "int", bits: validBits(Number(int[1]), name) };
    const bytesN = name.match(/^bytes(\d+)$/);
    if (bytesN) {
      const size = Number(bytesN[1]);
      if (size < 1 || size > 32) throw new Error(`bytesN size must be 1-32: ${name}`);
      return { kind: "bytesN", size };
    }
    throw new Error(`Unsupported ABI type: ${name}`);
  }

  function parseBaseWithSuffix(): AbiType {
    return parseArraySuffix(parseBase());
  }

  const parsed = parseBaseWithSuffix();
  skipSpace();
  if (index !== text.length) throw new Error(`Unexpected text after type: ${text.slice(index)}`);
  return parsed;
}

function validBits(bits: number, raw: string) {
  if (!Number.isInteger(bits) || bits < 8 || bits > 256 || bits % 8 !== 0) throw new Error(`Invalid bit width in ${raw}`);
  return bits;
}

export function formatAbiType(type: AbiType): string {
  switch (type.kind) {
    case "uint":
      return `uint${type.bits}`;
    case "int":
      return `int${type.bits}`;
    case "bytesN":
      return `bytes${type.size}`;
    case "array":
      return type.length === null ? `${formatAbiType(type.item)}[]` : `${formatAbiType(type.item)}[${type.length}]`;
    case "tuple":
      return `(${type.components.map((component) => formatAbiType(component.type)).join(",")})`;
    default:
      return type.kind;
  }
}

export function formatAbiParameter(parameter: AbiParameter): string {
  return parameter.name ? `${formatAbiType(parameter.type)} ${parameter.name}` : formatAbiType(parameter.type);
}

export function isDynamic(type: AbiType): boolean {
  switch (type.kind) {
    case "bytes":
    case "string":
      return true;
    case "array":
      return type.length === null || isDynamic(type.item);
    case "tuple":
      return type.components.some((component) => isDynamic(component.type));
    default:
      return false;
  }
}

export function staticByteSize(type: AbiType): number {
  if (isDynamic(type)) throw new Error(`Type ${formatAbiType(type)} is dynamic and has no static size.`);
  switch (type.kind) {
    case "array":
      return (type.length ?? 0) * staticByteSize(type.item);
    case "tuple":
      return type.components.reduce((total, component) => total + staticByteSize(component.type), 0);
    default:
      return 32;
  }
}

/* ------------------------------------------------------------------ */
/* Signature parsing                                                   */
/* ------------------------------------------------------------------ */

/**
 * Accepts the shapes people actually paste:
 *
 *   transfer(address,uint256)
 *   function transfer(address to, uint256 amount) external returns (bool)
 *   balanceOf(address) view returns (uint256)
 *   Transfer(address indexed from, address indexed to, uint256 value)
 *
 * The canonical form is always rebuilt from parsed types, so whitespace,
 * parameter names, `indexed`, and `uint`/`int` aliases cannot change it.
 */
export function parseSignature(text: string, kind: "function" | "event" = "function"): AbiSignature {
  let input = text.trim();
  if (!input) throw new Error("Enter a function or event signature.");
  if (input.length > 4096) throw new Error("Signature is unreasonably long.");

  input = input.replace(/^(?:function|event)\s+/i, "");
  const open = input.indexOf("(");
  if (open < 0) throw new Error(`Cannot parse signature: ${text}`);
  const name = input.slice(0, open).trim();
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error(`Invalid function name in signature: ${text}`);

  const close = matchingParen(input, open);
  if (close < 0) throw new Error(`Unclosed parameter list in signature: ${text}`);
  const inputs = parseParameterList(input.slice(open + 1, close));

  let rest = input.slice(close + 1).trim();
  let outputs: AbiParameter[] = [];
  let mutability = "";

  // Walk the suffix. Order is free in the wild: `view returns (...)` and
  // `returns (...) view` both appear in generated documentation.
  while (rest) {
    const match = rest.match(/^([A-Za-z]+)\b/);
    if (!match) throw new Error(`Unexpected text after signature: ${rest}`);
    const word = match[1];
    rest = rest.slice(match[0].length).trim();

    if (word === "returns") {
      if (!rest.startsWith("(")) throw new Error(`returns must be followed by a parameter list: ${text}`);
      const end = matchingParen(rest, 0);
      if (end < 0) throw new Error(`Unclosed returns list in signature: ${text}`);
      outputs = parseParameterList(rest.slice(1, end));
      rest = rest.slice(end + 1).trim();
      continue;
    }
    if (["external", "public", "internal", "private", "view", "pure", "payable", "constant", "nonpayable", "anonymous"].includes(word)) {
      mutability = word;
      continue;
    }
    throw new Error(`Unexpected text after signature: ${word}`);
  }

  const canonical = `${name}(${inputs.map((parameter) => formatAbiType(parameter.type)).join(",")})`;
  return { name, kind, inputs, outputs, mutability, canonical };
}

function matchingParen(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    if (text[index] === ")") {
      depth -= 1;
      if (depth === 0) return index;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

function parseParameterList(text: string): AbiParameter[] {
  if (!text.trim()) return [];
  const parts = splitTopLevel(text, ",");
  if (parts.length > MAX_TYPES) throw new Error("Too many parameters.");
  return parts.map((part) => parseParameter(part));
}

/** Splits on commas that are not inside parentheses or brackets. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;
    if (depth < 0) throw new Error("Unbalanced brackets in parameter list.");
    if (char === separator && depth === 0) {
      if (!current.trim()) throw new Error("Empty parameter in signature.");
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (depth !== 0) throw new Error("Unbalanced brackets in parameter list.");
  if (!current.trim()) throw new Error("Empty parameter in signature.");
  parts.push(current);
  return parts;
}

function parseParameter(text: string): AbiParameter {
  let rest = text.trim();
  if (!rest) throw new Error("Empty parameter in signature.");

  let type: AbiType;
  if (rest.startsWith("(")) {
    const end = matchingParen(rest, 0);
    if (end < 0) throw new Error(`Unclosed tuple in parameter: ${text}`);
    const tupleText = rest.slice(0, end + 1);
    rest = rest.slice(end + 1);
    const suffix = arraySuffixOf(rest);
    type = parseAbiType(tupleText + suffix);
    rest = rest.slice(suffix.length);
  } else {
    const match = rest.match(/^[A-Za-z_$][\w$]*(?:\s+payable\b)?/);
    if (!match) throw new Error(`Unsupported ABI type: ${text}`);
    const base = match[0].replace(/\s+payable\b/, "");
    rest = rest.slice(match[0].length);
    const suffix = arraySuffixOf(rest);
    rest = rest.slice(suffix.length);
    type = parseAbiType(base + suffix);
  }

  const words = rest.trim().split(/\s+/).filter(Boolean);
  let name: string | undefined;
  let indexed = false;
  for (const word of words) {
    if (word === "indexed") {
      indexed = true;
      continue;
    }
    if (KEYWORDS.has(word)) continue;
    if (!/^[A-Za-z_$][\w$]*$/.test(word)) throw new Error(`Unexpected token in parameter: ${word}`);
    if (name) throw new Error(`Unexpected token in parameter: ${word}`);
    name = word;
  }
  return { name, type, ...(indexed ? { indexed: true } : {}) };
}

function arraySuffixOf(text: string): string {
  const match = text.match(/^(?:\s*\[[0-9]*\])+/);
  return match ? match[0].replace(/\s+/g, "") : "";
}

/* ------------------------------------------------------------------ */
/* ABI JSON                                                            */
/* ------------------------------------------------------------------ */

export type AbiJsonParameter = {
  name?: string;
  type: string;
  internalType?: string;
  indexed?: boolean;
  components?: AbiJsonParameter[];
};

export type AbiJsonEntry = {
  type: string;
  name?: string;
  inputs?: AbiJsonParameter[];
  outputs?: AbiJsonParameter[];
  stateMutability?: string;
  anonymous?: boolean;
};

export type AbiFunction = {
  kind: "function";
  name: string;
  inputs: AbiParameter[];
  outputs: AbiParameter[];
  mutability: string;
  signature: AbiSignature;
};

export type AbiConstructor = {
  kind: "constructor";
  inputs: AbiParameter[];
  mutability: string;
};

export type AbiEvent = {
  kind: "event";
  name: string;
  inputs: AbiParameter[];
  anonymous: boolean;
  signature: AbiSignature;
};

export type AbiItem = AbiFunction | AbiConstructor | AbiEvent;

/**
 * Parses a contract ABI array into the three fragment kinds this tool can act
 * on. Fallback, receive, and error fragments are skipped: they carry no
 * parameters this workbench can encode or decode.
 */
export function parseAbiJson(text: string): AbiItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`ABI is not valid JSON: ${(error as Error).message}`);
  }
  if (!Array.isArray(parsed)) throw new Error("ABI must be a JSON array of fragments.");
  if (parsed.length > 5000) throw new Error("ABI has too many fragments.");

  const items: AbiItem[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") throw new Error("ABI contains a non-object fragment.");
    const fragment = entry as AbiJsonEntry;
    if (typeof fragment.type !== "string") throw new Error("ABI fragment is missing its type.");
    if (!["function", "constructor", "event"].includes(fragment.type)) continue;

    const inputs = (fragment.inputs ?? []).map((parameter) => parseJsonParameter(parameter, 0));
    if (fragment.type === "event") {
      if (!fragment.name) throw new Error("ABI event is missing its name.");
      const signature = parseSignature(
        `${fragment.name}(${inputs.map((parameter) => formatAbiType(parameter.type)).join(",")})`,
        "event",
      );
      signature.inputs = inputs;
      items.push({ kind: "event", name: fragment.name, inputs, anonymous: Boolean(fragment.anonymous), signature });
      continue;
    }
    if (fragment.type === "constructor") {
      items.push({ kind: "constructor", inputs, mutability: fragment.stateMutability ?? "nonpayable" });
      continue;
    }

    if (!fragment.name) throw new Error("ABI function is missing its name.");
    const outputs = (fragment.outputs ?? []).map((parameter) => parseJsonParameter(parameter, 0));
    const signature = parseSignature(
      `${fragment.name}(${inputs.map((parameter) => formatAbiType(parameter.type)).join(",")})`,
    );
    signature.outputs = outputs;
    signature.mutability = fragment.stateMutability ?? signature.mutability;
    items.push({
      kind: "function",
      name: fragment.name,
      inputs,
      outputs,
      mutability: signature.mutability,
      signature,
    });
  }
  return items;
}

function parseJsonParameter(parameter: AbiJsonParameter, depth: number): AbiParameter {
  if (depth > MAX_DEPTH) throw new Error("ABI nesting is too deep.");
  if (!parameter || typeof parameter !== "object" || typeof parameter.type !== "string") {
    throw new Error("ABI parameter is missing its type.");
  }
  const raw = parameter.type.trim();

  // `tuple`, `tuple[]`, `tuple[2][]` carry their shape in components.
  const tupleMatch = raw.match(/^tuple((?:\[[0-9]*\])*)$/);
  if (tupleMatch) {
    const components = (parameter.components ?? []).map((component) => parseJsonParameter(component, depth + 1));
    const suffix = tupleMatch[1];
    const base: AbiType = { kind: "tuple", components };
    return {
      name: parameter.name || undefined,
      type: suffix ? parseAbiType(`${formatAbiType(base)}${suffix}`) : base,
      ...(parameter.indexed ? { indexed: true } : {}),
    };
  }

  return {
    name: parameter.name || undefined,
    type: parseAbiType(raw),
    ...(parameter.indexed ? { indexed: true } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Encoding                                                            */
/* ------------------------------------------------------------------ */

export function encodeCall(signature: AbiSignature, rawArgs: string[], selector: string): EncodedCall {
  return { selector: `0x${selector}`, calldata: `0x${selector}${encodeParameters(signature.inputs, rawArgs)}` };
}

export function encodeParameters(parameters: AbiParameter[], rawArgs: string[]): string {
  if (rawArgs.length !== parameters.length) {
    throw new Error(`Expected ${parameters.length} argument(s), got ${rawArgs.length}.`);
  }
  if (parameters.length > MAX_TYPES) throw new Error("Too many parameters.");
  return encodeSequence(parameters.map((parameter) => parameter.type), rawArgs);
}

export function encodeValues(types: AbiType[], rawArgs: string[]): string {
  if (rawArgs.length !== types.length) {
    throw new Error(`Expected ${types.length} argument(s), got ${rawArgs.length}.`);
  }
  return encodeSequence(types, rawArgs);
}

function encodeSequence(types: AbiType[], values: string[]): string {
  if (types.length > MAX_TYPES) throw new Error("Too many parameters.");
  let headSize = 0;
  for (const type of types) headSize += isDynamic(type) ? 32 : staticByteSize(type);

  const heads: string[] = [];
  const tails: string[] = [];
  let offset = headSize;

  types.forEach((type, index) => {
    const value = values[index] ?? "";
    if (isDynamic(type)) {
      const payload = encodeDynamic(type, value);
      heads.push(word(BigInt(offset)));
      tails.push(payload);
      offset += payload.length / 2;
    } else {
      heads.push(encodeStatic(type, value));
    }
  });

  return heads.join("") + tails.join("");
}

function encodeStatic(type: AbiType, raw: string): string {
  switch (type.kind) {
    case "uint": {
      const value = parseBigIntInput(raw, false);
      if (value >= 1n << BigInt(type.bits)) throw new Error(`Value does not fit in uint${type.bits}: ${raw}`);
      return word(value);
    }
    case "int": {
      const value = parseBigIntInput(raw, true);
      const limit = 1n << BigInt(type.bits - 1);
      if (value >= limit || value < -limit) throw new Error(`Value does not fit in int${type.bits}: ${raw}`);
      return word(value < 0n ? BYTES32_MOD + value : value);
    }
    case "bool": {
      const text = raw.trim().toLowerCase();
      if (["true", "1", "yes"].includes(text)) return word(1n);
      if (["false", "0", "no", ""].includes(text)) return word(0n);
      throw new Error(`Expected true or false, got: ${raw}`);
    }
    case "address": {
      const hex = raw.trim().replace(/^0x/i, "");
      if (!/^[0-9a-fA-F]{40}$/.test(hex)) throw new Error(`Invalid address: ${raw}`);
      return hex.toLowerCase().padStart(WORD, "0");
    }
    case "bytesN": {
      const hex = raw.trim().replace(/^0x/i, "");
      if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error(`Invalid hex for bytes${type.size}: ${raw}`);
      if (hex.length % 2) throw new Error(`bytes${type.size} needs an even number of hex digits: ${raw}`);
      if (hex.length > type.size * 2) throw new Error(`Value is longer than bytes${type.size}: ${raw}`);
      return hex.toLowerCase().padEnd(WORD, "0");
    }
    case "array": {
      const items = parseArrayItems(raw, type);
      if (type.length !== null && items.length !== type.length) {
        throw new Error(`Expected ${type.length} items for ${formatAbiType(type)}, got ${items.length}.`);
      }
      return encodeSequence(items.map(() => type.item), items);
    }
    case "tuple": {
      const items = parseTupleItems(raw, type);
      return encodeSequence(type.components.map((component) => component.type), items);
    }
    default:
      throw new Error(`Unsupported static type: ${formatAbiType(type)}`);
  }
}

function encodeDynamic(type: AbiType, raw: string): string {
  switch (type.kind) {
    case "bytes": {
      const hex = raw.trim().replace(/^0x/i, "");
      if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error(`Invalid hex for bytes: ${raw}`);
      if (hex.length % 2) throw new Error("bytes needs an even number of hex digits.");
      const body = hex.toLowerCase();
      return word(BigInt(body.length / 2)) + body.padEnd(Math.ceil(body.length / WORD) * WORD, "0");
    }
    case "string": {
      const bytes = new TextEncoder().encode(raw);
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      return word(BigInt(bytes.length)) + hex.padEnd(Math.ceil(hex.length / WORD) * WORD, "0");
    }
    case "array": {
      const items = parseArrayItems(raw, type);
      if (type.length !== null && items.length !== type.length) {
        throw new Error(`Expected ${type.length} items for ${formatAbiType(type)}, got ${items.length}.`);
      }
      const payload = encodeSequence(items.map(() => type.item), items);
      // A fixed-size array of dynamic items has no length word; its length is
      // part of the type, and the parent already emitted the offset.
      return type.length === null ? word(BigInt(items.length)) + payload : payload;
    }
    case "tuple": {
      const items = parseTupleItems(raw, type);
      return encodeSequence(type.components.map((component) => component.type), items);
    }
    default:
      throw new Error(`Type ${formatAbiType(type)} is not dynamic.`);
  }
}

function parseArrayItems(raw: string, type: { item: AbiType }): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`Array arguments must be JSON, e.g. [1,2]: ${(error as Error).message}`);
    }
    if (!Array.isArray(parsed)) throw new Error("Array argument must be a JSON array.");
    if (parsed.length > MAX_ARRAY_ITEMS) throw new Error("Array argument is too long.");
    return parsed.map((item) => literalToString(item));
  }

  // A bare comma list is unambiguous only for scalar elements. Anything that
  // can itself contain a comma must use JSON.
  if (canUseCommaList(type.item)) {
    const parts = trimmed.split(",").map((part) => part.trim());
    if (parts.length > MAX_ARRAY_ITEMS) throw new Error("Array argument is too long.");
    return parts;
  }
  throw new Error(`Array of ${formatAbiType(type.item)} must be written as a JSON array, e.g. ["a","b"].`);
}

function parseTupleItems(raw: string, type: { components: AbiParameter[] }): string[] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) {
    throw new Error(`Tuple arguments must be a JSON array, e.g. [1,"0x..."].`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`Tuple arguments must be valid JSON: ${(error as Error).message}`);
  }
  if (!Array.isArray(parsed)) throw new Error("Tuple argument must be a JSON array.");
  if (parsed.length !== type.components.length) {
    throw new Error(`Expected ${type.components.length} tuple field(s), got ${parsed.length}.`);
  }
  return parsed.map((item) => literalToString(item));
}

function literalToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (value === null) return "";
  // A nested array or object is handed back as JSON text so the next level of
  // the parser can consume it with the same grammar.
  if (Array.isArray(value)) return JSON.stringify(value);
  throw new Error("Only strings, numbers, booleans, and nested arrays are allowed inside array/tuple arguments.");
}

function parseBigIntInput(raw: string, allowNegative: boolean): bigint {
  const text = raw.trim();
  if (!text) return 0n;
  if (text.length > MAX_INT_INPUT_CHARS) throw new Error("Integer input is unreasonably long.");
  const negative = text.startsWith("-");
  if (negative && !allowNegative) throw new Error(`Negative value not allowed: ${raw}`);
  const body = text.replace(/^[+-]/, "").trim();
  let value: bigint;
  if (/^0x[0-9a-fA-F]+$/.test(body)) value = BigInt(body);
  else if (/^\d+$/.test(body)) value = BigInt(body);
  else throw new Error(`Expected an integer, got: ${raw}`);
  return negative ? -value : value;
}

function word(value: bigint) {
  if (value < 0n) throw new Error("Cannot encode a negative word.");
  const hex = value.toString(16);
  if (hex.length > WORD) throw new Error("Value exceeds 32 bytes.");
  return hex.padStart(WORD, "0");
}

/* ------------------------------------------------------------------ */
/* Decoding                                                            */
/* ------------------------------------------------------------------ */

type DecodeContext = { data: string; limit: number; budget: number };

function context(data: string): DecodeContext {
  const body = data.trim().replace(/^0x/i, "");
  if (body.length % 2) throw new Error("Hex data has an odd number of digits.");
  if (!/^[0-9a-fA-F]*$/.test(body)) throw new Error("Data contains non-hex characters.");
  return { data: body.toLowerCase(), limit: body.length / 2, budget: MAX_DECODE_NODES };
}

export function decodeParameters(parameters: AbiParameter[], data: string): DecodedParameter[] {
  if (!parameters.length) return [];
  const ctx = context(data);
  if (!ctx.limit) throw new Error("Return data is empty; the call may not have returned anything.");
  const values = decodeSequence(parameters.map((parameter) => parameter.type), ctx, 0, 0);
  return parameters.map((parameter, index) => ({ name: parameter.name, type: parameter.type, value: values[index] }));
}

export function decodeValues(types: AbiType[], data: string): string[] {
  if (!types.length) return [];
  const ctx = context(data);
  if (!ctx.limit) throw new Error("Return data is empty; the call may not have returned anything.");
  return decodeSequence(types, ctx, 0, 0);
}

/**
 * Decodes one value that starts at an absolute byte offset. Used for indexed
 * event topics, which are single 32-byte words rather than a full payload.
 */
export function decodeSingle(type: AbiType, data: string, byteOffset = 0): string {
  const ctx = context(data);
  return decodeAt(type, ctx, byteOffset, 0);
}

function decodeSequence(types: AbiType[], ctx: DecodeContext, start: number, depth: number): string[] {
  if (depth > MAX_DEPTH) throw new Error("ABI nesting is too deep.");
  if (start < 0 || start > ctx.limit) throw new Error("ABI offset points outside the payload.");

  let cursor = start;
  const out: string[] = [];
  for (const type of types) {
    if (isDynamic(type)) {
      const relative = readWord(ctx, cursor);
      cursor += 32;
      if (relative > BigInt(ctx.limit)) throw new Error("Dynamic offset points outside the payload.");
      const absolute = start + Number(relative);
      if (absolute > ctx.limit) throw new Error("Dynamic offset points outside the payload.");
      out.push(decodeAt(type, ctx, absolute, depth + 1));
    } else {
      out.push(decodeAt(type, ctx, cursor, depth + 1));
      cursor += staticByteSize(type);
      if (cursor > ctx.limit) throw new Error("Return data is shorter than the expected ABI layout.");
    }
  }
  return out;
}

function decodeAt(type: AbiType, ctx: DecodeContext, position: number, depth: number): string {
  if (depth > MAX_DEPTH) throw new Error("ABI nesting is too deep.");
  if (position < 0 || position > ctx.limit) throw new Error("ABI offset points outside the payload.");
  // Charge each produced value against the shared budget. Offsets can point at
  // the same region repeatedly, so payload size alone does not bound the work.
  ctx.budget -= 1;
  if (ctx.budget < 0) throw new Error("ABI data expands to too many values to decode safely.");

  switch (type.kind) {
    case "uint": {
      const value = readWord(ctx, position);
      if (type.bits < 256 && value >= 1n << BigInt(type.bits)) {
        throw new Error(`Decoded word is not a valid uint${type.bits} (dirty high bits).`);
      }
      return value.toString();
    }
    case "int": {
      const raw = readWord(ctx, position);
      if (type.bits < 256) {
        const bits = BigInt(type.bits);
        const mask = (1n << bits) - 1n;
        const low = raw & mask;
        const signBit = 1n << (bits - 1n);
        const signed = low >= signBit ? low - (1n << bits) : low;
        const canonical = signed < 0n ? BYTES32_MOD + signed : signed;
        if (canonical !== raw) throw new Error(`Decoded word is not a valid int${type.bits} (dirty high bits).`);
        return signed.toString();
      }
      return (raw >= 1n << 255n ? raw - BYTES32_MOD : raw).toString();
    }
    case "bool": {
      const value = readWord(ctx, position);
      if (value > 1n) throw new Error("Decoded word is not a valid bool (expected 0 or 1).");
      return value === 0n ? "false" : "true";
    }
    case "address": {
      const value = readWord(ctx, position);
      if (value >= 1n << 160n) throw new Error("Decoded word is not a valid address (dirty high bits).");
      return `0x${value.toString(16).padStart(40, "0")}`;
    }
    case "bytesN": {
      ensureRange(ctx, position, type.size);
      return `0x${ctx.data.slice(position * 2, position * 2 + type.size * 2)}`;
    }
    case "bytes": {
      const { start, length } = readDynamicLayout(ctx, position);
      return `0x${ctx.data.slice(start * 2, (start + length) * 2)}`;
    }
    case "string": {
      const { start, length } = readDynamicLayout(ctx, position);
      return decodeHexToText(ctx.data.slice(start * 2, (start + length) * 2));
    }
    case "array": {
      if (type.length === null) {
        const count = readCount(ctx, position);
        const headsStart = position + 32;
        const itemHeadSize = isDynamic(type.item) ? 32 : staticByteSize(type.item);
        if (headsStart + count * itemHeadSize > ctx.limit) throw new Error("Array length exceeds the data size.");
        const items: string[] = [];
        for (let index = 0; index < count; index += 1) {
          const head = headsStart + index * itemHeadSize;
          if (isDynamic(type.item)) {
            const relative = readWord(ctx, head);
            if (relative > BigInt(ctx.limit)) throw new Error("Array element offset points outside the payload.");
            const absolute = headsStart + Number(relative);
            if (absolute > ctx.limit) throw new Error("Array element offset points outside the payload.");
            items.push(decodeAt(type.item, ctx, absolute, depth + 1));
          } else {
            items.push(decodeAt(type.item, ctx, head, depth + 1));
          }
        }
        return `[${items.join(", ")}]`;
      }

      const items: string[] = [];
      let cursor = position;
      for (let index = 0; index < type.length; index += 1) {
        if (isDynamic(type.item)) {
          const relative = readWord(ctx, cursor);
          cursor += 32;
          if (relative > BigInt(ctx.limit)) throw new Error("Array element offset points outside the payload.");
          const absolute = position + Number(relative);
          if (absolute > ctx.limit) throw new Error("Array element offset points outside the payload.");
          items.push(decodeAt(type.item, ctx, absolute, depth + 1));
        } else {
          items.push(decodeAt(type.item, ctx, cursor, depth + 1));
          cursor += staticByteSize(type.item);
        }
      }
      return `[${items.join(", ")}]`;
    }
    case "tuple": {
      const types = type.components.map((component) => component.type);
      return `(${decodeSequence(types, ctx, position, depth + 1).join(", ")})`;
    }
  }
}

function readDynamicLayout(ctx: DecodeContext, position: number) {
  const lengthWord = readWord(ctx, position);
  if (lengthWord > BigInt(ctx.limit)) throw new Error("Declared payload length exceeds the data size.");
  const length = Number(lengthWord);
  const start = position + 32;
  if (start + length > ctx.limit) throw new Error("Declared payload length exceeds the data size.");
  return { start, length };
}

function readCount(ctx: DecodeContext, position: number): number {
  const value = readWord(ctx, position);
  if (value > BigInt(MAX_ARRAY_ITEMS)) throw new Error(`Array length exceeds the ${MAX_ARRAY_ITEMS}-item limit.`);
  return Number(value);
}

function ensureRange(ctx: DecodeContext, position: number, length: number) {
  if (position < 0 || position + length > ctx.limit) throw new Error("Return data is shorter than the expected ABI layout.");
}

function readWord(ctx: DecodeContext, byteOffset: number): bigint {
  if (byteOffset < 0 || byteOffset + 32 > ctx.limit) throw new Error("Return data is shorter than the expected ABI layout.");
  const start = byteOffset * 2;
  return BigInt(`0x${ctx.data.slice(start, start + WORD)}`);
}

function decodeHexToText(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

/* ------------------------------------------------------------------ */
/* Argument input                                                      */
/* ------------------------------------------------------------------ */

/**
 * Reads the argument textarea. The grammar is one argument per line, because
 * commas are legitimate bytes inside a string. A single line is also accepted
 * when every parameter is a scalar that cannot contain a comma, or when the
 * whole line is a JSON array.
 */
export function splitArgumentInput(text: string, types: AbiType[]): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!types.length) return [];

  if (types.length === 1) return [normalized.replace(/\n$/, "")];

  const lines = normalized.split("\n");
  if (lines.length > 1) {
    const filled = lines.filter((line) => line.trim() !== "");
    if (filled.length !== types.length) {
      throw new Error(`Expected ${types.length} argument line(s), got ${filled.length}.`);
    }
    return filled;
  }

  const trimmed = normalized.trim();
  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = null;
    }
    if (Array.isArray(parsed)) {
      if (parsed.length !== types.length) throw new Error(`Expected ${types.length} argument(s), got ${parsed.length}.`);
      return parsed.map((item) => literalToString(item));
    }
  }

  if (types.every((type) => canUseCommaList(type))) {
    const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length === types.length) return parts;
  }

  throw new Error(`Put each argument on its own line (expected ${types.length}).`);
}

/** True when a raw comma-separated list is unambiguous for this type. */
function canUseCommaList(type: AbiType): boolean {
  return ["uint", "int", "bool", "address", "bytesN"].includes(type.kind);
}

/** Legacy helper kept for callers that only deal with scalar arguments. */
export function splitArgs(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Recognises the handful of node messages that mean "this endpoint cannot see
 * that historical block", so the UI can explain it instead of echoing RPC jargon.
 */
export function looksLikeArchiveGap(message: string): boolean {
  const text = message.toLowerCase();
  return [
    "archive",
    "missing trie node",
    "header not found",
    "unknown state",
    "first available state",
    "state not available",
    "ancient",
    "pruned",
  ].some((needle) => text.includes(needle));
}
