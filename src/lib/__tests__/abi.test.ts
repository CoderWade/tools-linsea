import { describe, expect, it } from "vitest";
import {
  decodeValues,
  encodeCall,
  encodeValues,
  formatAbiType,
  looksLikeArchiveGap,
  parseAbiType,
  parseSignature,
  splitArgs,
} from "../abi";
import { keccak256Hex } from "../evm";

const SEL_ERC20 = keccak256Hex("transfer(address,uint256)").slice(0, 8);
const SEL_TRANSFER = "a9059cbb";

describe("parseAbiType", () => {
  it("accepts the scalar and dynamic types the tool supports", () => {
    expect(parseAbiType("uint256")).toEqual({ kind: "uint", bits: 256 });
    expect(parseAbiType("uint")).toEqual({ kind: "uint", bits: 256 });
    expect(parseAbiType("int8")).toEqual({ kind: "int", bits: 8 });
    expect(parseAbiType("bool")).toEqual({ kind: "bool" });
    expect(parseAbiType("address")).toEqual({ kind: "address" });
    expect(parseAbiType("bytes32")).toEqual({ kind: "bytesN", size: 32 });
    expect(parseAbiType("bytes")).toEqual({ kind: "bytes" });
    expect(parseAbiType("string")).toEqual({ kind: "string" });
    expect(parseAbiType("address[]")).toEqual({ kind: "array", item: { kind: "address" } });
  });

  it("rejects nonsense instead of guessing", () => {
    expect(() => parseAbiType("uint7")).toThrow();
    expect(() => parseAbiType("uint264")).toThrow();
    expect(() => parseAbiType("bytes33")).toThrow();
    expect(() => parseAbiType("uint256[2]")).toThrow(/Fixed-size arrays/);
    expect(() => parseAbiType("function")).toThrow();
  });
});

describe("parseSignature", () => {
  it("normalises whitespace into one canonical form", () => {
    const a = parseSignature("reflectionFromToken(uint256, bool)");
    const b = parseSignature("reflectionFromToken( uint256 ,bool )");
    expect(a.canonical).toBe("reflectionFromToken(uint256,bool)");
    expect(a.canonical).toBe(b.canonical);
    expect(a.name).toBe("reflectionFromToken");
    expect(a.inputs).toHaveLength(2);
  });

  it("captures declared return types when present", () => {
    const signature = parseSignature("balanceOf(address) returns (uint256)");
    expect(signature.inputs).toEqual([{ kind: "address" }]);
    expect(signature.outputs).toEqual([{ kind: "uint", bits: 256 }]);
  });

  it("keeps bracketed commas inside the type", () => {
    const signature = parseSignature("batch(address[],uint256)");
    expect(signature.inputs.map(formatAbiType)).toEqual(["address[]", "uint256"]);
  });

  it("matches the selector the user observed on chain", () => {
    const signature = parseSignature("reflectionFromToken(uint256,bool)");
    expect(keccak256Hex(signature.canonical).slice(0, 8)).toBe("4549b039");
  });
});

describe("encodeCall", () => {
  it("matches the canonical ERC-20 transfer layout", () => {
    expect(SEL_ERC20).toBe(SEL_TRANSFER);
    const signature = parseSignature("transfer(address,uint256)");
    const { calldata } = encodeCall(
      signature,
      ["0x3F6C1f63C7389dD9549834bb615D7E83CEee645F", "1000000000000000000"],
      SEL_TRANSFER,
    );
    expect(calldata.slice(0, 10)).toBe("0xa9059cbb");
    expect(calldata.slice(10, 74)).toBe("0000000000000000000000003f6c1f63c7389dd9549834bb615d7e83ceee645f");
    expect(BigInt(`0x${calldata.slice(74)}`)).toBe(1000000000000000000n);
    expect(calldata.length).toBe(2 + 8 + 64 * 2);
  });

  it("encodes the exact call from the on-chain report", () => {
    const signature = parseSignature("reflectionFromToken(uint256,bool)");
    const { calldata } = encodeCall(signature, ["1", "false"], "4549b039");
    expect(calldata).toBe(
      "0x4549b039" +
        "0000000000000000000000000000000000000000000000000000000000000001" +
        "0000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("rejects a mismatched argument count", () => {
    const signature = parseSignature("reflectionFromToken(uint256,bool)");
    expect(() => encodeCall(signature, ["1"], "4549b039")).toThrow(/Expected 2 argument/);
  });

  it("range-checks numbers against the declared width", () => {
    expect(() => encodeValues([parseAbiType("uint8")], ["256"])).toThrow(/does not fit/);
    expect(() => encodeValues([parseAbiType("uint8")], ["255"])).not.toThrow();
    expect(() => encodeValues([parseAbiType("uint256")], ["-1"])).toThrow(/Negative/);
    expect(() => encodeValues([parseAbiType("int8")], ["-128"])).not.toThrow();
    expect(() => encodeValues([parseAbiType("int8")], ["-129"])).toThrow(/does not fit/);
  });

  it("pads dynamic values and offsets them past every head word", () => {
    const encoded = encodeValues([parseAbiType("uint256"), parseAbiType("string")], ["7", "hi"]);
    const offset = Number(BigInt(`0x${encoded.slice(64, 128)}`));
    expect(offset).toBe(64);
    expect(Number(BigInt(`0x${encoded.slice(128, 192)}`))).toBe(2);
    expect(encoded.slice(192, 196)).toBe("6869");
  });

  it("encodes signed values as two's complement", () => {
    const encoded = encodeValues([parseAbiType("int256")], ["-1"]);
    expect(encoded).toBe("f".repeat(64));
  });
});

describe("decodeValues", () => {
  it("reads a uint256 return value", () => {
    const data = "0x000000000000000000000000000000000000000000000000000000000000002a";
    expect(decodeValues([parseAbiType("uint256")], data)).toEqual(["42"]);
  });

  it("reads the reflection value observed at block 79788487", () => {
    // Exact bytes returned by eth_call at block 79788487 on BSC.
    const raw = "0x0000000000000024e4bba3a4875741cebfcc8b9890e7f3ccb5fcd119251c3e43";
    const [value] = decodeValues([parseAbiType("uint256")], raw);
    expect(value).toBe("231584178474632390847141970017375815706539969331281128078915");
  });

  it("reads bool, address, and bytes32", () => {
    expect(decodeValues([parseAbiType("bool")], `0x${"0".repeat(64)}`)).toEqual(["false"]);
    expect(decodeValues([parseAbiType("bool")], `0x${"0".repeat(63)}1`)).toEqual(["true"]);
    expect(decodeValues([parseAbiType("address")], `0x${"0".repeat(24)}${"ab".repeat(20)}`)).toEqual([
      `0x${"ab".repeat(20)}`,
    ]);
    expect(decodeValues([parseAbiType("bytes32")], `0x${"cd".repeat(32)}`)).toEqual([`0x${"cd".repeat(32)}`]);
  });

  it("reads dynamic string returns", () => {
    // offset=32, length=4, "GALA"
    const data =
      "0x" +
      "0000000000000000000000000000000000000000000000000000000000000020" +
      "0000000000000000000000000000000000000000000000000000000000000004" +
      "47414c4100000000000000000000000000000000000000000000000000000000";
    expect(decodeValues([parseAbiType("string")], data)).toEqual(["GALA"]);
  });

  it("explains empty return data instead of crashing", () => {
    expect(() => decodeValues([parseAbiType("uint256")], "0x")).toThrow(/may not exist/);
    expect(decodeValues([], "0x")).toEqual([]);
  });

  it("fails loudly on truncated data", () => {
    expect(() => decodeValues([parseAbiType("uint256")], "0x1234")).toThrow(/shorter/);
  });
});

describe("splitArgs", () => {
  it("accepts commas and newlines, and drops blanks", () => {
    expect(splitArgs("1, false")).toEqual(["1", "false"]);
    expect(splitArgs("1\nfalse\n")).toEqual(["1", "false"]);
    expect(splitArgs("  ")).toEqual([]);
  });
});

describe("looksLikeArchiveGap", () => {
  it("recognises the messages public nodes actually return", () => {
    expect(looksLikeArchiveGap("Archive requests require a personal token.")).toBe(true);
    expect(looksLikeArchiveGap("missing trie node")).toBe(true);
    expect(looksLikeArchiveGap("header not found")).toBe(true);
    expect(looksLikeArchiveGap("Unknown state. First available state is 123")).toBe(true);
    expect(looksLikeArchiveGap("execution reverted")).toBe(false);
  });
});
