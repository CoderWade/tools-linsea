import { Check, ChevronDown, Copy, Search, X } from "lucide-react";
import { ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Button({
  children,
  variant = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition",
        "focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "border-accent/60 bg-accent text-white shadow-[0_12px_30px_hsl(var(--accent)/0.22)] hover:bg-accent/90",
        variant === "default" && "border-line bg-surface/78 text-text hover:border-accent/45 hover:bg-accent/5",
        variant === "ghost" && "border-transparent bg-transparent text-muted hover:bg-panel hover:text-text",
        variant === "danger" && "border-red-400/40 bg-red-500/10 text-red-500 hover:bg-red-500/15",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-line bg-surface/78 px-3 text-sm font-bold text-text transition backdrop-blur",
        "hover:border-accent/50 hover:bg-accent/5 focus:outline-none focus:ring-4 focus:ring-accent/15",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-surface/82 px-3 text-sm text-text outline-none transition placeholder:text-faint backdrop-blur",
        "hover:border-accent/45 focus:border-accent focus:ring-4 focus:ring-accent/15",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-40 w-full resize-y rounded-xl border border-line bg-surface/82 px-3 py-3 text-sm leading-6 text-text outline-none transition placeholder:text-faint backdrop-blur",
        "hover:border-accent/45 focus:border-accent focus:ring-4 focus:ring-accent/15",
        props.className,
      )}
    />
  );
}

export type SelectOption = { value: string; label: string; hint?: string };

export function Select({
  value,
  options,
  onChange,
  placeholder = "Select",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => options.find((item) => item.value === value), [options, value]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        data-ui="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface/82 px-3 text-left text-sm text-text transition backdrop-blur",
          "hover:border-accent/45 hover:bg-accent/5 focus:outline-none focus:ring-4 focus:ring-accent/15",
          open && "border-accent ring-4 ring-accent/15",
        )}
      >
        <span className={cn("truncate", !selected && "text-faint")}>{selected?.label || placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition", open && "rotate-180 text-accent")} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-labelledby={id}
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-accent/30 bg-surface/92 p-1.5 shadow-glow backdrop-blur-xl"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "grid w-full grid-cols-[1fr_auto] gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
                option.value === value ? "bg-accent/12 text-accent" : "text-text hover:bg-panel",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{option.label}</span>
                {option.hint ? <span className="block truncate text-xs text-muted">{option.hint}</span> : null}
              </span>
              {option.value === value ? <Check className="mt-0.5 h-4 w-4" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Combobox({
  value,
  options,
  onChange,
  placeholder = "Search...",
  emptyText = "No results",
  maxItems = 48,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  maxItems?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const ranked = options
      .map((option) => {
        const label = option.label.toLowerCase();
        const valueText = option.value.toLowerCase();
        const haystack = `${label} ${valueText}`;
        if (!normalizedQuery) return { option, score: 2 };
        if (label === normalizedQuery || valueText === normalizedQuery) return { option, score: 0 };
        if (label.startsWith(normalizedQuery) || valueText.startsWith(normalizedQuery)) return { option, score: 1 };
        if (haystack.includes(normalizedQuery)) return { option, score: 2 };
        return null;
      })
      .filter(Boolean) as Array<{ option: SelectOption; score: number }>;
    return ranked.sort((a, b) => a.score - b.score || a.option.label.localeCompare(b.option.label)).map((item) => item.option);
  }, [normalizedQuery, options]);
  const filtered = useMemo(() => matches.slice(0, maxItems), [matches, maxItems]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [value]);

  const commit = (next: string) => {
    onChange(next);
    setQuery(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-xl border border-line bg-surface/82 px-3 transition backdrop-blur",
          "hover:border-accent/45 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15",
          open && "border-accent ring-4 ring-accent/15",
        )}
      >
        <input
          id={id}
          data-ui="combobox-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery(value);
            }
            if (event.key === "Enter" && filtered[0]) {
              event.preventDefault();
              commit(filtered[0].value);
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-faint"
        />
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition", open && "rotate-180 text-accent")} />
      </div>
      {open ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-accent/30 bg-surface/92 p-1.5 shadow-glow backdrop-blur-xl"
        >
          {filtered.length ? (
            <>
              {filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => commit(option.value)}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_20px] items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    option.value === value ? "border border-accent/30 bg-accent/10 text-accent" : "border border-transparent text-text hover:bg-panel",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold leading-5">{option.label}</span>
                    {option.hint ? <span className="block truncate text-xs text-muted">{option.hint}</span> : null}
                  </span>
                  <span className="grid h-5 w-5 place-items-center">{option.value === value ? <Check className="h-4 w-4" /> : null}</span>
                </button>
              ))}
              {filtered.length < matches.length ? (
                <div className="sticky bottom-0 mt-1 rounded-xl border border-line bg-surface/95 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted backdrop-blur">
                  Showing {filtered.length} of {matches.length}. Keep typing to narrow.
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl px-3 py-3 text-sm text-muted">{emptyText}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function Tabs({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 rounded-2xl border border-line bg-panel p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-11 rounded-xl px-3 text-sm font-bold transition",
            value === option.value
              ? "border border-accent/50 bg-[linear-gradient(135deg,hsl(var(--accent)/0.18),hsl(var(--cyan)/0.10))] text-accent shadow-soft"
              : "text-muted hover:bg-surface hover:text-text",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("panel-surface overflow-hidden rounded-tool border border-line shadow-soft backdrop-blur-xl", className)}>
      <div className="border-b border-line bg-surface/35 px-5 py-4 backdrop-blur">
        <div className="relative inline-flex pb-2 text-xs font-black uppercase tracking-[0.18em] text-muted after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-12 after:bg-accent">
          {title}
        </div>
      </div>
      <div className="relative p-5">{children}</div>
    </section>
  );
}

export function Notice({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warn" | "danger" | "ok" }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 text-sm leading-6",
        tone === "default" && "border-line bg-panel text-muted",
        tone === "warn" && "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300",
        tone === "danger" && "border-red-400/40 bg-red-500/10 text-red-600 dark:text-red-300",
        tone === "ok" && "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      )}
    >
      {children}
    </div>
  );
}

export function ResultRows({ rows }: { rows: Array<[string, ReactNode, string?]> }) {
  return (
    <div className="grid">
      {rows.map(([label, value, copyValue]) => (
        <div key={label} className="grid min-h-11 grid-cols-[132px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2 last:border-b-0 max-sm:grid-cols-[1fr_auto]">
          <div className="text-xs font-semibold text-faint max-sm:col-span-2">{label}</div>
          <div className="min-w-0 break-words font-mono text-sm leading-6 text-text">{value}</div>
          <CopyButton value={copyValue ?? stringifyNode(value)} />
        </div>
      ))}
    </div>
  );
}

function stringifyNode(value: ReactNode) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!value}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 900);
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-muted transition hover:border-accent/50 hover:text-accent disabled:opacity-40"
    >
      <Copy className="h-3.5 w-3.5" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-md" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-xl rounded-3xl border border-line bg-surface p-5 shadow-glow">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-text">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <IconButton onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CommandInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-panel px-4 py-3 shadow-glow">
      <Search className="h-5 w-5 text-accent" />
      <input {...props} className="h-9 min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-faint" />
    </div>
  );
}
