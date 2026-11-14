"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

/**
 * The dashboard's one dropdown, used in place of every native <select>.
 *
 * A drop-in for <select>: the same `value`, `onChange={(e) => ... e.target.value}`
 * and <option> children, so swapping one for the other is a rename. Or pass
 * `options` directly. `multiple` gives a checkbox per row (`values` /
 * `onValuesChange`).
 *
 * The list opens in a portal, positioned against the trigger, so a table cell,
 * a card or a dialog with overflow hidden cannot clip it; it flips above when
 * there is no room below. Keyboard: Enter / Space / arrows open, arrows move,
 * Enter picks, Esc closes, typing jumps to a match. A search box appears once
 * there are more than eight options.
 */

export type SelectOption = { value: string; label: string; disabled?: boolean; hint?: string };

type ChangeLike = { target: { value: string; name?: string }; currentTarget: { value: string; name?: string } };

export type CustomSelectProps = {
  value?: string | number | readonly string[];
  /** Same shape as a native select's change event, so existing handlers work unchanged. */
  onChange?: (e: ChangeLike) => void;
  /** Or simply the value. */
  onValueChange?: (value: string) => void;
  options?: SelectOption[];
  /** <option> children, as with a native select. */
  children?: ReactNode;
  multiple?: boolean;
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Show the search box regardless of how many options there are. */
  isSearch?: boolean;
  searchPlaceholder?: string;
  /** Shown when the search matches nothing. */
  emptyText?: string;
  className?: string;
  id?: string;
  name?: string;
  title?: string;
  required?: boolean;
  "aria-label"?: string;
};

/** Plain text of an <option>'s children, e.g. {o.label}{o.hint ? ` (${o.hint})` : ""}. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node as ReactElement<{ children?: ReactNode }>).props.children);
  return "";
}

/** The <option>s among the children, through fragments, maps and conditionals. */
function optionsFrom(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (el.type === Fragment) {
      out.push(...optionsFrom(el.props.children));
    } else if (el.type === "option") {
      const label = textOf(el.props.children);
      out.push({ value: String(el.props.value ?? label), label, disabled: !!el.props.disabled });
    } else if (el.type === "optgroup") {
      out.push(...optionsFrom(el.props.children));
    }
  });
  return out;
}

const SEARCH_AFTER = 8;

export function CustomSelect({
  value,
  onChange,
  onValueChange,
  options: given,
  children,
  multiple,
  values = [],
  onValuesChange,
  placeholder,
  disabled,
  isSearch,
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  className,
  id,
  name,
  title,
  required,
  "aria-label": ariaLabel,
}: CustomSelectProps) {
  const options = useMemo(() => given ?? optionsFrom(children), [given, children]);
  const current = multiple ? "" : value == null ? "" : String(value);
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean; maxH: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();

  const searchable = isSearch || options.length > SEARCH_AFTER;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)) : options;
  }, [options, query]);

  /** Where the list goes: under the trigger, or above it when there is no room. */
  const place = useCallback(() => {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 220 && above > below;
    const maxH = Math.max(140, Math.min(320, up ? above : below));
    setPos({ left: r.left, top: up ? r.top - 4 : r.bottom + 4, width: Math.max(r.width, 180), up, maxH });
  }, []);

  const openList = () => {
    if (disabled) return;
    place();
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  const pick = (o: SelectOption) => {
    if (o.disabled) return;
    if (multiple) {
      const next = values.includes(o.value) ? values.filter((v) => v !== o.value) : [...values, o.value];
      onValuesChange?.(next);
      return; // stays open to tick several
    }
    if (o.value !== current) {
      onChange?.({ target: { value: o.value, name }, currentTarget: { value: o.value, name } });
      onValueChange?.(o.value);
    }
    close();
  };

  // Follow the trigger while open: scrolling a table or the page, resizing.
  useLayoutEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  // Click outside closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open && searchable) search.current?.focus();
  }, [open, searchable]);

  // Keep the highlighted row in view.
  useEffect(() => {
    if (!open || active < 0) return;
    panel.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const move = (dir: 1 | -1) => {
    if (!shown.length) return;
    let i = active;
    for (let n = 0; n < shown.length; n++) {
      i = (i + dir + shown.length) % shown.length;
      if (!shown[i].disabled) break;
    }
    setActive(i);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
    } else if (e.key === "Tab") {
      close(false);
    } else if (!searchable && e.key.length === 1) {
      // Type-ahead: jump to the first option starting with what was typed.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const i = shown.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) setActive(i);
    }
  };

  const label = multiple
    ? values.length === 0
      ? placeholder ?? "Select…"
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label ?? "1 selected"
        : `${values.length} selected`
    : selected?.label || placeholder || "Select…";
  const muted = multiple ? values.length === 0 : !selected || selected.value === "";

  return (
    <>
      <button
        ref={trigger}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKey}
        className={`filter-control inline-flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? "border-brand-500 ring-2 ring-brand-500/20" : ""
        } ${className ?? ""}`}
      >
        <span className={`min-w-0 truncate ${muted ? "text-zinc-400" : ""}`}>{label}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-zinc-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {/* A form posts the value like a native select would. */}
      {name ? <input type="hidden" name={name} value={multiple ? values.join(",") : current} /> : null}

      {open && pos
        ? createPortal(
            <div
              ref={panel}
              onKeyDown={onKey}
              className="fixed z-[70] flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-sm shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950"
              style={{
                left: Math.min(pos.left, window.innerWidth - pos.width - 8),
                width: pos.width,
                maxHeight: pos.maxH,
                ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
              }}
            >
              {searchable && (
                <div className="flex items-center gap-2 border-b border-zinc-100 px-2.5 py-2 dark:border-zinc-800">
                  <Search size={14} className="shrink-0 text-zinc-400" />
                  <input
                    ref={search}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    placeholder={searchPlaceholder}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
                  />
                </div>
              )}
              <ul id={listId} role="listbox" aria-multiselectable={multiple || undefined} className="scroll-thin overflow-y-auto p-1">
                {shown.length === 0 && <li className="px-3 py-2 text-zinc-400">{emptyText}</li>}
                {shown.map((o, i) => {
                  const isOn = multiple ? values.includes(o.value) : o.value === current;
                  return (
                    <li
                      key={`${o.value}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isOn}
                      aria-disabled={o.disabled || undefined}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(o)}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 ${
                        o.disabled
                          ? "cursor-not-allowed text-zinc-300 dark:text-zinc-600"
                          : i === active
                            ? "bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200"
                            : "text-zinc-700 dark:text-zinc-200"
                      }`}
                    >
                      {multiple ? (
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isOn ? "border-brand-500 bg-brand-500 text-white" : "border-zinc-300 dark:border-zinc-700"
                          }`}
                        >
                          {isOn && <Check size={12} />}
                        </span>
                      ) : null}
                      <span className={`min-w-0 flex-1 truncate ${o.value === "" && !multiple ? "text-zinc-400" : ""}`}>{o.label}</span>
                      {o.hint ? <span className="shrink-0 text-xs text-zinc-400">{o.hint}</span> : null}
                      {!multiple && isOn ? <Check size={14} className="shrink-0 text-brand-600" /> : null}
                    </li>
                  );
                })}
              </ul>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
