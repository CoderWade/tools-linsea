import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--canvas))",
        surface: "hsl(var(--surface))",
        panel: "hsl(var(--panel))",
        line: "hsl(var(--line))",
        text: "hsl(var(--text))",
        muted: "hsl(var(--muted))",
        faint: "hsl(var(--faint))",
        accent: "hsl(var(--accent))",
        "accent-fg": "hsl(var(--accent-fg))",
        "family-reverse": "hsl(var(--family-reverse))",
        "family-dev": "hsl(var(--family-dev))",
        "family-general": "hsl(var(--family-general))",
        ok: "hsl(var(--ok))",
        warn: "hsl(var(--warn))",
        danger: "hsl(var(--danger))",
      },
      boxShadow: {
        soft: "0 1px 2px hsl(var(--shadow) / 0.06), 0 8px 24px hsl(var(--shadow) / 0.08)",
        overlay: "0 24px 60px hsl(var(--shadow) / 0.32), 0 2px 8px hsl(var(--shadow) / 0.18)",
      },
      borderRadius: {
        ui: "10px",
        tool: "14px",
        overlay: "20px",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
