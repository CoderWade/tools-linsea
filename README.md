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

## Current Build

- Componentized React application shell.
- Tailwind design tokens for dark/light technology styling.
- Reusable Button, Input, Textarea, Tabs, Modal, ResultRows, and custom Select components.
- Custom Select menus replace native browser dropdown presentation.
- Cmd/Ctrl + K command palette.
- Settings modal with persistent BYOK fields and Privacy First Mode.
- Core tool workbenches migrated, including storage slot read, mapping probe, source layout resolver, unit converter, selector/hash tools, JSON, timestamp, text diff, and compliance utilities.
