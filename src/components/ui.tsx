import { Check, ChevronDown, Copy, Inbox, Search, X } from "lucide-react";
import { ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { useT } from "../lib/i18n";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

/*
 * Controls share one set of decisions: 10px radius, 44px height, 14px text,
 * a 1px line instead of a shadow, and a 2px focus ring. Cards use 14px and
 * overlays 20px, so a nested control always sits one step below its container.
 */
const controlBase =
  "rounded-ui border border-line bg-panel text-[14px] text-text outline-none transition-colors placeholder:text-faint hover:border-accent/45 focus:border-accent focus:ring-2 focus:ring-accent/25";

export function Button({
  children,
  variant = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-ui border px-4 text-sm font-semibold transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "border-accent bg-accent text-accent-fg hover:bg-accent/90",
        variant === "default" && "border-line bg-surface text-text hover:border-accent/50 hover:bg-panel",
        variant === "ghost" && "border-transparent bg-transparent text-muted hover:bg-panel hover:text-text",
        variant === "danger" && "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15",
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
        "inline-flex h-9 min-w-9 items-center justify-center rounded-ui border border-line bg-surface px-2.5 text-xs font-semibold text-muted transition-colors",
        "hover:border-accent/50 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("h-11 w-full px-3", controlBase, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn("min-h-40 w-full resize-y px-3 py-2.5 leading-6", controlBase, props.className)}
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
          "flex h-11 w-full items-center justify-between gap-3 px-3 text-left",
          controlBase,
          "hover:bg-panel focus-visible:ring-2",
          open && "border-accent ring-2 ring-accent/25",
        )}
      >
        <span className={cn("truncate", !selected && "text-faint")}>{selected?.label || placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180 text-accent")} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-labelledby={id}
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-tool border border-line bg-surface p-1.5 shadow-overlay"
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
                "grid w-full grid-cols-[1fr_auto] gap-2 rounded-ui px-3 py-2 text-left text-sm transition-colors",
                option.value === value ? "bg-accent/10 text-accent" : "text-text hover:bg-panel",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{option.label}</span>
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
  placeholder,
  emptyText,
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
  const tr = useT();
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const resolvedPlaceholder = placeholder ?? tr("common.search");
  const resolvedEmpty = emptyText ?? tr("common.noResults");
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
          "flex h-11 items-center gap-2 px-3",
          controlBase,
          "focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25",
          open && "border-accent ring-2 ring-accent/25",
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
          placeholder={resolvedPlaceholder}
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
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180 text-accent")} />
      </div>
      {open ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-tool border border-line bg-surface p-1.5 shadow-overlay"
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
                    "grid w-full grid-cols-[minmax(0,1fr)_20px] items-center gap-2 rounded-ui px-3 py-2 text-left text-sm transition-colors",
                    option.value === value ? "bg-accent/10 text-accent" : "text-text hover:bg-panel",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium leading-5">{option.label}</span>
                    {option.hint ? <span className="block truncate text-xs text-muted">{option.hint}</span> : null}
                  </span>
                  <span className="grid h-5 w-5 place-items-center">{option.value === value ? <Check className="h-4 w-4" /> : null}</span>
                </button>
              ))}
              {filtered.length < matches.length ? (
                <div className="sticky bottom-0 mt-1 rounded-ui border border-line bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {tr("common.showingOf", { shown: filtered.length, total: matches.length })}
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-ui px-3 py-3 text-sm text-muted">{resolvedEmpty}</div>
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
    <div className="grid grid-cols-2 gap-1 rounded-ui border border-line bg-panel p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "h-10 rounded-[7px] px-3 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-accent/10 text-accent"
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
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-tool border border-line bg-surface", className)}>
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-[11.5px] font-semibold tracking-[0.04em] text-muted">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 p-5">{children}</div>
    </section>
  );
}

export function Notice({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warn" | "danger" | "ok" }) {
  return (
    <div
      className={cn(
        "rounded-ui border px-3.5 py-2.5 text-sm leading-6",
        tone === "default" && "border-line bg-panel text-muted",
        tone === "warn" && "border-warn/40 bg-warn/10 text-muted",
        tone === "danger" && "border-danger/40 bg-danger/10 text-danger",
        tone === "ok" && "border-ok/40 bg-ok/8 text-muted",
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-ui border border-line bg-panel text-faint">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <div className="mt-3 text-sm font-semibold text-text">{title}</div>
      {hint ? <p className="mt-1 max-w-sm text-xs leading-5 text-muted">{hint}</p> : null}
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
  const tr = useT();
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
      className="inline-flex h-8 items-center gap-1.5 rounded-ui border border-line bg-surface px-2.5 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-40"
    >
      <Copy className="h-3.5 w-3.5" />
      {copied ? tr("common.copied") : tr("common.copy")}
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
  // Hook must run before the early return, or the order changes between renders.
  const tr = useT();
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-[hsl(220_60%_2%/0.6)] p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-overlay border border-line bg-surface p-5 shadow-overlay">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <IconButton onClick={onClose} aria-label={tr("action.close")}>
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
    <div className="flex items-center gap-3 rounded-ui border border-accent/30 bg-panel px-3.5 py-2.5">
      <Search className="h-4 w-4 text-accent" />
      <input {...props} className="h-8 min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-faint" />
    </div>
  );
}
