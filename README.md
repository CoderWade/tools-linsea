# Linsea Tools

Privacy-first Web3 and developer toolbox, migrated to a componentized React workbench.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS
- shadcn-style local UI primitives
- lucide-react icons
- GitHub Pages friendly static build

## Run Locally

```bash
npm install
npm run dev
```

Then open the URL printed by Vite, usually:

```text
http://127.0.0.1:5173/
```

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

## Test

```bash
npm test
```

Unit tests cover chain resolution and the JSON-RPC transport layer.

## Chain Support

Chain metadata lives in `src/lib/chains.ts`; the read-only RPC transport lives in `src/lib/rpc.ts`.

| Chain | chainId | Default endpoint | Explorer |
| --- | --- | --- | --- |
| Ethereum Mainnet | 1 | Alchemy / Infura BYOK | etherscan.io |
| Sepolia | 11155111 | Alchemy / Infura BYOK | sepolia.etherscan.io |
| Polygon | 137 | Alchemy / Infura BYOK | polygonscan.com |
| BNB Smart Chain | 56 | Alchemy BYOK | bscscan.com |
| Anubis Mainnet | 6714 | `https://rpc.anubispace.org` (keyless) | browser.anubispace.org |
| Custom EVM chain | user supplied | user supplied RPC URL | — |

Endpoint priority is explicit: **RPC URL override → bundled public RPC → Alchemy key → Infura key**. A provider key is never used for a chain that provider does not serve, so a misconfigured key fails loudly instead of silently reading another network.

Every storage and proxy read first calls `eth_chainId` and aborts on a mismatch, then resolves `latest` to a concrete block number. Results show chain name, chainId, endpoint host, and the exact block that was read, so any output can be re-checked later.

Adding another EVM chain is a one-line registry entry:

```ts
{ id: "anubis", chainId: 6714, label: "Anubis Mainnet", shortLabel: "Anubis", rpcUrl: "https://rpc.anubispace.org", explorer: "https://browser.anubispace.org", nativeSymbol: "DAI" },
```

## Current Build

- Componentized React application shell.
- Tailwind design tokens for dark/light technology styling.
- Reusable Button, Input, Textarea, Tabs, Modal, ResultRows, and custom Select components.
- Custom Select menus replace native browser dropdown presentation.
- Cmd/Ctrl + K command palette.
- Settings modal with persistent BYOK fields, chain selection, RPC override, and Privacy First Mode.
- Chain registry with chainId verification and block pinning for every RPC read.
- Batched mapping slot scans through JSON-RPC batch with sequential fallback.
- Core tool workbenches migrated, including storage slot read, mapping probe, source layout resolver, unit converter, selector/hash tools, JSON, timestamp, text diff, and compliance utilities.
