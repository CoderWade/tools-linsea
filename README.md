# Linsea Tools

Local-first prototype for the Linsea Tools workbench.

## Run

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4173
```

## Current Build

- Zero dependency static frontend.
- Dense dark/light workbench UI with gradient scan lines, grid background, neon accents, and compact input/output split panels.
- Category navigation and tool pages.
- Cmd/Ctrl + K command palette.
- Settings modal with BYOK fields and Privacy First Mode.
- Reserved ad slot that is disabled visually when privacy mode is enabled.
- Functional MVP tools for unit conversion, hash/encoding, JWT inspection, JSON formatting, timestamps, regex, cron parsing, FBA estimate, listing cleanup, shipping guess, calldata splitting, bytecode disassembly, and Luhn testing.

## Next Step

When the UI direction is confirmed, migrate this structure to Next.js App Router, Tailwind CSS, shadcn/ui, next-themes, and next-intl.
