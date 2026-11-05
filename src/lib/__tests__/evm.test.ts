import { describe, expect, it } from "vitest";
import {
  findStorageEntry,
  hexToBytes,
  isNestedMappingType,
  keccak256Hex,
  mappingSlotByType,
  parseMappingDeclaration,
  parseSourceLayout,
  toSlotHex,
} from "../evm";

/*
 * Every expectation below is taken from solc's own storageLayout output for the
 * same source compiled with 0.8.26. The parser reads source text without a
 * compiler, so these cases encode the packing rules it has to reproduce:
 *
 *   - scalars smaller than 32 bytes pack into the current slot;
 *   - a variable that does not fit starts a new slot;
 *   - arrays and structs claim whole slots and never pack with neighbours;
 *   - each contract's own variables are appended after its bases;
 *   - a base in a diamond contributes once, not once per path.
 */

function slots(source: string, contract = "C") {
  const layout = parseSourceLayout(source, contract);
  return layout.entries
    .filter((entry) => entry.slot !== null)
    .map((entry) => `${entry.name}=${entry.slot}${entry.offset ? `/off${entry.offset}` : ""}`);
}

describe("storage layout: solc parity", () => {
  it("packs small scalars (a:0, b:0/off1, c:0/off2, d:1)", () => {
    expect(slots("contract C { uint8 a; bool b; address c; uint256 d; }")).toEqual([
      "a=0",
      "b=0/off1",
      "c=0/off2",
      "d=1",
    ]);
  });

  it("sizes bytes32 arrays by element count (3 slots)", () => {
    expect(slots("contract C { bytes32[3] arr; uint256 x; }")).toEqual(["arr=0", "x=3"]);
  });

  it("sizes arrays by ceil(count*size/32) and never packs after them", () => {
    // An array occupies whole slots; the next variable always starts a new one,
    // even when the array leaves spare bytes in its last slot (solc behaviour).
    expect(slots("contract C { uint8[3] arr; uint8 after_; }")).toEqual(["arr=0", "after_=1"]);
    expect(slots("contract C { uint8[32] arr; uint8 after_; }")).toEqual(["arr=0", "after_=1"]);
    expect(slots("contract C { uint8[64] arr; uint8 after_; }")).toEqual(["arr=0", "after_=2"]);
    expect(slots("contract C { uint256[2] arr; uint8 after_; }")).toEqual(["arr=0", "after_=2"]);
  });

  it("sizes a multi-slot struct from its members", () => {
    expect(slots("contract C { struct S { uint256 a; uint256 b; } S s; uint256 after_; }")).toEqual([
      "s=0",
      "after_=2",
    ]);
  });

  it("packs a small struct into one slot", () => {
    expect(slots("contract C { struct S { uint16 a; uint16 b; } S s; uint256 after_; }")).toEqual([
      "s=0",
      "after_=1",
    ]);
  });

  it("counts a struct containing a dynamic member as two slots", () => {
    expect(slots("contract C { struct S { uint256 a; string s; } S st; uint8 after_; }")).toEqual([
      "st=0",
      "after_=2",
    ]);
  });

  it("sizes structs that contain fixed arrays", () => {
    // Inside a struct an array also claims a whole slot, so `b` lands at slot 1
    // and the struct is 2 slots wide.
    expect(slots("contract C { struct S { uint8[4] a; uint8 b; } S s; uint8 after_; }")).toEqual([
      "s=0",
      "after_=2",
    ]);
  });

  it("sizes a fixed array of structs", () => {
    expect(slots("contract C { struct S { uint256 a; } S[2] arr; uint8 after_; }")).toEqual([
      "arr=0",
      "after_=2",
    ]);
  });

  it("treats an enum as one byte that packs", () => {
    expect(slots("contract C { enum E { A, B } E e; uint8 after_; }")).toEqual(["e=0", "after_=0/off1"]);
  });

  it("treats a contract-typed variable as a 20-byte address", () => {
    expect(slots("contract C { IThing token; uint8 after_; }")).toEqual(["token=0", "after_=0/off20"]);
  });

  it("resolves a user-defined value type to its underlying width", () => {
    const source = "contract C { type Price is uint128; Price p; uint8 after_; }";
    expect(slots(source)).toEqual(["p=0", "after_=0/off16"]);
  });

  it("sizes a function-type variable (external 24 bytes, internal 8)", () => {
    expect(slots("contract C { function(uint256) external returns (bool) cb; uint8 after_; }")).toEqual([
      "cb=0",
      "after_=0/off24",
    ]);
    expect(slots("contract C { function(uint256) internal cb; uint8 after_; }")).toEqual([
      "cb=0",
      "after_=0/off8",
    ]);
  });

  it("appends own variables after bases, following the declared base order", () => {
    // `is B, A` lays out B first, then A, then C's own variables - matching solc.
    const source = "contract A { uint256 a; } contract B { uint256 b; } contract C is B, A { uint256 c; }";
    expect(slots(source)).toEqual(["b=0", "a=1", "c=2"]);
  });

  it("emits a diamond's shared base exactly once", () => {
    const source =
      "contract D { uint256 d; } contract A is D { uint256 a; } contract B is D { uint256 b; } contract C is A, B { uint256 c; }";
    // solc: d=0, a=1, b=2, c=3. Before the fix this produced d=0, a=1, d=2, b=3, c=4.
    expect(slots(source)).toEqual(["d=0", "a=1", "b=2", "c=3"]);
  });

  it("matches solc on a realistic token layout", () => {
    const source = `contract C {
      struct Fee { uint16 buy; uint16 sell; }
      address public owner;
      Fee public fee;
      mapping(address => uint256) public balances;
      uint256[] public history;
      bool public paused;
    }`;
    expect(slots(source)).toEqual(["owner=0", "fee=1", "balances=2", "history=3", "paused=4"]);
  });

  it("matches solc on an ERC-20 style layout", () => {
    const source = `contract C {
      mapping(address=>uint256) _balances;
      mapping(address=>mapping(address=>uint256)) _allowances;
      uint256 _totalSupply;
      string _name;
      string _symbol;
      uint8 _decimals;
    }`;
    expect(slots(source)).toEqual([
      "_balances=0",
      "_allowances=1",
      "_totalSupply=2",
      "_name=3",
      "_symbol=4",
      "_decimals=5",
    ]);
  });
});

describe("storage layout: source text handling", () => {
  it("does not treat // inside a string literal as a comment", () => {
    const source = `contract C {
      uint256 a;
      string constant U = "https://a.io";
      uint256 y;
    }`;
    // Stripping comments naively swallowed `y` entirely.
    expect(slots(source)).toEqual(["a=0", "y=1"]);
  });

  it("keeps a semicolon inside a string literal from splitting the statement", () => {
    const source = `contract C { string constant S = "a;b"; uint256 y; }`;
    expect(slots(source)).toEqual(["y=0"]);
  });

  it("ignores a type declaration instead of inventing a variable", () => {
    expect(slots("contract C { type Price is uint128; uint256 x; }")).toEqual(["x=0"]);
  });

  it("ignores events, errors, using-for, and function bodies", () => {
    const source = `contract C {
      event E(uint256);
      error Bad();
      using L for uint256;
      uint256 x;
      function f() public { uint256 local; }
    }`;
    expect(slots(source)).toEqual(["x=0"]);
  });
});

describe("storage layout: uncertainty propagation", () => {
  it("marks following variables unreliable when a type cannot be sized", () => {
    const layout = parseSourceLayout("contract C { Mystery m; uint256 after_; }", "C");
    expect(layout.hasUnknownSpans).toBe(true);
    const after = layout.entries.find((entry) => entry.name === "after_");
    expect(after?.reliable).toBe(false);
  });

  it("keeps every variable reliable when all types resolve", () => {
    const layout = parseSourceLayout("contract C { uint8 a; uint256 b; }", "C");
    expect(layout.hasUnknownSpans).toBe(false);
    expect(layout.entries.every((entry) => entry.reliable)).toBe(true);
  });

  it("keeps constant and immutable variables out of the slot cursor", () => {
    const layout = parseSourceLayout(
      "contract C { uint256 constant K = 1; uint256 immutable I; uint256 x; }",
      "C",
    );
    expect(layout.entries.map((entry) => `${entry.name}=${entry.slot}`)).toEqual(["K=null", "I=null", "x=0"]);
  });
});

describe("mapping handling", () => {
  it("derives the value slot for a flat mapping", () => {
    const slot = mappingSlotByType("0x0000000000000000000000000000000000000001", "address", toSlotHex(3n));
    // keccak is taken over the raw 64 bytes, not over their hex text.
    const packed = hexToBytes(
      "0000000000000000000000000000000000000000000000000000000000000001" +
        "0000000000000000000000000000000000000000000000000000000000000003",
    );
    expect(slot).toBe("0x" + keccak256Hex(packed));
  });

  it("recognises a nested mapping, which must not be probed", () => {
    expect(isNestedMappingType("mapping(address => mapping(address => uint256))")).toBe(true);
    expect(isNestedMappingType("mapping(address => uint256)")).toBe(false);
  });

  it("flags nested mappings during declaration parsing", () => {
    const parsed = parseMappingDeclaration("mapping(address => mapping(address => uint256)) public allowance;");
    expect(parsed?.nested).toBe(true);
    expect(parsed?.keyType).toBe("address");
  });

  it("flags nested mappings in a full layout", () => {
    const layout = parseSourceLayout("contract C { mapping(address=>mapping(address=>uint256)) m; }", "C");
    expect(layout.entries[0].nestedMapping).toBe(true);
  });
});

describe("getter alias lookup", () => {
  it("matches a public getter name to its private variable", () => {
    const layout = parseSourceLayout("contract C { uint256 private _totalSupply; }", "C");
    const found = findStorageEntry(layout.entries, "totalSupply");
    expect(found.entry?.name).toBe("_totalSupply");
  });

  it("strips a trailing () from a getter query", () => {
    const layout = parseSourceLayout("contract C { uint256 private _totalSupply; }", "C");
    expect(findStorageEntry(layout.entries, "totalSupply()").entry?.name).toBe("_totalSupply");
  });
});

describe("storageLayout JSON passthrough", () => {
  it("uses compiler output verbatim", () => {
    const json = JSON.stringify({
      storage: [
        { label: "owner", type: "t_address", slot: "0", offset: 0 },
        { label: "balances", type: "t_mapping(t_address,t_uint256)", slot: "1", offset: 0 },
      ],
      types: {
        t_address: { label: "address", encoding: "inplace" },
        "t_mapping(t_address,t_uint256)": { label: "mapping(address => uint256)", encoding: "mapping" },
      },
    });
    const layout = parseSourceLayout(json);
    expect(layout.sourceType).toBe("storageLayout JSON");
    expect(layout.hasUnknownSpans).toBe(false);
    expect(layout.entries.map((entry) => `${entry.name}=${entry.slot}=${entry.kind}`)).toEqual([
      "owner=0=static",
      "balances=1=mapping",
    ]);
  });
});
