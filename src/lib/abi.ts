/*
 * Minimal Solidity ABI codec.
 *
 * Scope is deliberately narrow: enough static and dynamic types to call the
 * getters and view functions people actually reach for when inspecting a
 * token — no structs, no fixed-size arrays of structs, no nested tuples.
 * Everything here is pure functions over strings and bigints, so it stays
 * testable without a chain.
 *
 * Encoding follows the Contract ABI spec: each argument occupies one 32-byte
 * head word; dynamic values put an offset there and their payload after every
 * head. Decoding walks the same layout in reverse.
 */

export type AbiType =
  | { kind: "uint"; bits: number }
  | { kind: "int"; bits: number }
  | { kind: "bool" }
  | { kind: "address" }
  | { kind: "bytesN"; size: number }
  | { kind: "bytes" }
  | { kind: "string" }
  | { kind: "array"; item: AbiType };

export type AbiSignature = {
  name: string;
  inputs: AbiType[];
  outputs: AbiType[];
  canonical: string;
};

export type EncodedCall = {
  selector: string;
  calldata: string;
};

const WORD = 64;

export function parseAbiType(raw: string): AbiType {
  const text = raw.trim();
  if (!text) throw new Error("Empty type in signature.");

  if (text.endsWith("[]")) return { kind: "array", item: parseAbiType(text.slice(0, -2)) };
  if (text.endsWith("]")) throw new Error(`Fixed-size arrays are not supported: ${text}`);

  if (text === "bool") return { kind: "bool" };
  if (text === "address") return { kind: "address" };
  if (text === "bytes") return { kind: "bytes" };
  if (text === "string") return { kind: "string" };
  if (text === "uint") return { kind: "uint", bits: 256 };
  if (text === "int") return { kind: "int", bits: 256 };

  const uint = text.match(/^uint(\d+)$/);
  if (uint) return { kind: "uint", bits: validBits(Number(uint[1]), text) };

  const int = text.match(/^int(\d+)$/);
  if (int) return { kind: "int", bits: validBits(Number(int[1]), text) };

  const bytesN = text.match(/^bytes(\d+)$/);
  if (bytesN) {
    const size = Number(bytesN[1]);
    if (size < 1 || size > 32) throw new Error(`bytesN size must be 1-32: ${text}`);
    return { kind: "bytesN", size };
  }

  throw new Error(`Unsupported ABI type: ${text}`);
}

function validBits(bits: number, raw: string) {
  if (bits < 8 || bits > 256 || bits % 8 !== 0) throw new Error(`Invalid bit width in ${raw}`);
  return bits;
}

export function formatAbiType(type: AbiType): string {
  switch (type.kind) {
    case "uint": return `uint${type.bits}`;
    case "int": return `int${type.bits}`;
    case "bytesN": return `bytes${type.size}`;
    case "array": return `${formatAbiType(type.item)}[]`;
    default: return type.kind;
  }
}

/**
 * Accepts `name(uint256,bool)` or `name(uint256,bool) returns (uint256)`.
 * The selector is always computed over the canonical form, so whitespace and
 * extra spaces never change the resulting 4 bytes.
 */
export function parseSignature(text: string): AbiSignature {
  const cleaned = text.trim().replace(/\s+/g, " ").replace(/\s*\(\s*/g, "(").replace(/\s*\)\s*/g, ")").replace(/\s*,\s*/g, ",");
  if (!cleaned) throw new Error("Enter a function signature such as balanceOf(address).");

  const match = cleaned.match(/^([A-Za-z_$][\w$]*)\s*\(([^)]*)\)(?:\s*(?:returns|external|view|pure)*\s*\(([^)]*)\))?/i);
  if (!match) throw new Error(`Cannot parse signature: ${text}`);

  const [, name, inputText = "", outputText = ""] = match;
  const inputs = splitTypes(inputText).map(parseAbiType);
  const outputs = splitTypes(outputText).map(parseAbiType);
  const canonical = `${name}(${inputs.map(formatAbiType).join(",")})`;
  return { name, inputs, outputs, canonical };
}

function splitTypes(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // Commas inside brackets belong to the type, not the argument list.
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of trimmed) {
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** Splits user input like `1, false` or `1\ntrue` into argument strings. */
export function splitArgs(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function encodeCall(signature: AbiSignature, rawArgs: string[], selector: string): EncodedCall {
  if (rawArgs.length !== signature.inputs.length) {
    throw new Error(`Expected ${signature.inputs.length} argument(s), got ${rawArgs.length}.`);
  }
  const encoded = encodeValues(signature.inputs, rawArgs);
  return { selector: `0x${selector}`, calldata: `0x${selector}${encoded}` };
}

export function encodeValues(types: AbiType[], rawArgs: string[]): string {
  const heads: string[] = [];
  const tails: string[] = [];
  let tailOffset = types.length * 32;

  types.forEach((type, index) => {
    const encoded = encodeValue(type, rawArgs[index] ?? "");
    if (encoded.dynamic) {
      heads.push(word(BigInt(tailOffset)));
      tails.push(encoded.data);
      tailOffset += encoded.data.length / 2;
    } else {
      heads.push(encoded.data);
    }
  });

  return heads.join("") + tails.join("");
}

function encodeValue(type: AbiType, raw: string): { data: string; dynamic: boolean } {
  switch (type.kind) {
    case "uint": {
      const value = parseBigIntInput(raw, false);
      if (value >= 1n << BigInt(type.bits)) throw new Error(`Value does not fit in uint${type.bits}: ${raw}`);
      return { data: word(value), dynamic: false };
    }
    case "int": {
      const value = parseBigIntInput(raw, true);
      const limit = 1n << BigInt(type.bits - 1);
      if (value >= limit || value < -limit) throw new Error(`Value does not fit in int${type.bits}: ${raw}`);
      const unsigned = value < 0n ? (1n << 256n) + value : value;
      return { data: word(unsigned), dynamic: false };
    }
    case "bool": {
      const text = raw.trim().toLowerCase();
      if (["true", "1", "yes"].includes(text)) return { data: word(1n), dynamic: false };
      if (["false", "0", "no", ""].includes(text)) return { data: word(0n), dynamic: false };
      throw new Error(`Expected true or false, got: ${raw}`);
    }
    case "address": {
      const hex = raw.trim().replace(/^0x/i, "");
      if (!/^[0-9a-fA-F]{40}$/.test(hex)) throw new Error(`Invalid address: ${raw}`);
      return { data: hex.toLowerCase().padStart(WORD, "0"), dynamic: false };
    }
    case "bytesN": {
      const hex = raw.trim().replace(/^0x/i, "");
      if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error(`Invalid hex for bytes${type.size}: ${raw}`);
      if (hex.length > type.size * 2) throw new Error(`Value is longer than bytes${type.size}: ${raw}`);
      return { data: hex.toLowerCase().padEnd(WORD, "0"), dynamic: false };
    }
    case "bytes": {
      const hex = raw.trim().replace(/^0x/i, "");
      if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error(`Invalid hex for bytes: ${raw}`);
      if (hex.length % 2) throw new Error("Hex payload must have an even number of digits.");
      const body = hex.toLowerCase();
      const padded = body.padEnd(Math.ceil(body.length / WORD) * WORD, "0");
      return { data: word(BigInt(body.length / 2)) + padded, dynamic: true };
    }
    case "string": {
      const bytes = new TextEncoder().encode(raw);
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const padded = hex.padEnd(Math.ceil(hex.length / WORD) * WORD, "0");
      return { data: word(BigInt(bytes.length)) + padded, dynamic: true };
    }
    case "array": {
      const items = splitArgs(raw);
      const inner = encodeValues(items.map(() => type.item), items);
      return { data: word(BigInt(items.length)) + inner, dynamic: true };
    }
  }
}

function parseBigIntInput(raw: string, allowNegative: boolean): bigint {
  const text = raw.trim();
  if (!text) return 0n;
  const negative = text.startsWith("-");
  if (negative && !allowNegative) throw new Error(`Negative value not allowed: ${raw}`);
  const body = text.replace(/^[+-]/, "").trim();
  if (/^0x[0-9a-fA-F]+$/.test(body)) return BigInt((negative ? "-" : "") + body);
  if (!/^\d+$/.test(body)) throw new Error(`Expected an integer, got: ${raw}`);
  return BigInt((negative ? "-" : "") + body);
}

function word(value: bigint) {
  const hex = value.toString(16);
  if (hex.length > WORD) throw new Error("Value exceeds 32 bytes.");
  return hex.padStart(WORD, "0");
}

export function decodeValues(types: AbiType[], data: string): string[] {
  const body = data.replace(/^0x/i, "");
  if (!body.length) {
    if (types.length) throw new Error("RPC returned empty data; the function may not exist on this contract.");
    return [];
  }
  return types.map((type, index) => decodeValue(type, body, index * 32));
}

function decodeValue(type: AbiType, body: string, headOffset: number): string {
  const head = readWord(body, headOffset);
  switch (type.kind) {
    case "uint":
      return head.toString();
    case "int": {
      const value = head >= 1n << 255n ? head - (1n << 256n) : head;
      return value.toString();
    }
    case "bool":
      return head === 0n ? "false" : "true";
    case "address":
      return `0x${head.toString(16).padStart(40, "0")}`;
    case "bytesN":
      return `0x${body.slice(headOffset * 2, headOffset * 2 + type.size * 2)}`;
    case "bytes": {
      const start = Number(head) * 2;
      const length = Number(readWord(body, Number(head)));
      return `0x${body.slice(start + WORD, start + WORD + length * 2)}`;
    }
    case "string": {
      const start = Number(head) * 2;
      const length = Number(readWord(body, Number(head)));
      const hex = body.slice(start + WORD, start + WORD + length * 2);
      return decodeHexToText(hex);
    }
    case "array": {
      const start = Number(head);
      const length = Number(readWord(body, start));
      const items: string[] = [];
      // Arrays of dynamic items store offsets relative to the first item after
      // the length word, which is what decodeValue expects for its head base.
      for (let index = 0; index < length; index += 1) {
        items.push(decodeValue(type.item, body, start + 32 + index * 32));
      }
      return `[${items.join(", ")}]`;
    }
  }
}

function readWord(body: string, byteOffset: number): bigint {
  const start = byteOffset * 2;
  const hex = body.slice(start, start + WORD);
  if (hex.length !== WORD) throw new Error("Return data is shorter than the expected ABI layout.");
  return BigInt(`0x${hex}`);
}

function decodeHexToText(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
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
