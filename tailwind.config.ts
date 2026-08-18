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
        cyan: "hsl(var(--cyan))",
      },
      boxShadow: {
        glow: "0 0 0 1px hsl(var(--accent) / 0.22), 0 18px 55px hsl(var(--shadow) / 0.22)",
        soft: "0 14px 38px hsl(var(--shadow) / 0.12)",
      },
      borderRadius: {
        ui: "14px",
        tool: "18px",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
