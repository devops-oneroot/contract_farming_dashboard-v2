"use client";

import type { ComponentType, JSX, ReactNode } from "react";
import { useSharedUI, type SharedUIModule } from "../lib/shared-ui";
import { CustomSelect } from "./custom-select";

/**
 * The common UI kit's controls, as this app uses them. Each one renders the
 * component federated from shared_ui (see lib/shared-ui.tsx). Only if that
 * remote could not be loaded does it fall back to the plain HTML element, so
 * the dashboard keeps working; the fallbacks are deliberately bare.
 */

function shared<P extends object>(pick: (ui: SharedUIModule) => ComponentType<P>, Fallback: ComponentType<P>, name: string) {
  function SharedComponent(props: P) {
    const ui = useSharedUI();
    const Comp = ui ? pick(ui) : Fallback;
    return <Comp {...props} />;
  }
  SharedComponent.displayName = `Shared(${name})`;
  return SharedComponent;
}

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const CONTROL = "filter-control";

export const Button = shared((ui) => ui.Button, function FallbackButton({
  variant = "primary",
  size,
  loading,
  loadingText,
  icon,
  className,
  children,
  disabled,
  ...props
}) {
  void size; // the shared Button has two sizes; the fallback has one
  const tone =
    variant === "primary" || variant === "add"
      ? "bg-brand-500 text-white hover:bg-brand-600"
      : variant === "danger"
        ? "bg-red-600 text-white hover:bg-red-700"
        : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900";
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx("inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium disabled:opacity-60", tone, className)}
    >
      {icon}
      {loading ? (loadingText ?? children) : children}
    </button>
  );
}, "Button");

export const Input = shared((ui) => ui.Input, function FallbackInput({ isPassword, className, ...props }) {
  return <input {...props} type={isPassword ? "password" : props.type} className={cx(CONTROL, className)} />;
}, "Input");

/**
 * Every dropdown in the dashboard is the custom one (components/custom-select),
 * never a native <select>: one look and one keyboard behaviour everywhere,
 * whether or not the shared UI kit loaded.
 *
 * `Select` takes the same props and <option> children as a native select;
 * `Dropdown` takes `options`, with `multiple` for a checkbox per row.
 */
export const Select = CustomSelect;

export function Dropdown({
  options,
  value = "",
  onChange,
  multiple,
  values = [],
  onValuesChange,
  placeholder,
  disabled,
  className,
  title,
  id,
  isSearch,
  searchPlaceholder,
  emptyText,
  "aria-label": ariaLabel,
}: {
  options: { value: string; label: string; hint?: string; disabled?: boolean }[];
  value?: string;
  onChange?: (value: string) => void;
  multiple?: boolean;
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
  id?: string;
  isSearch?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  "aria-label"?: string;
}) {
  return (
    <CustomSelect
      options={options}
      value={value}
      onValueChange={onChange}
      multiple={multiple}
      values={values}
      onValuesChange={onValuesChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      title={title}
      id={id}
      isSearch={isSearch}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      aria-label={ariaLabel}
    />
  );
}

export const DateInput = shared((ui) => ui.DateInput, function FallbackDateInput({ className, ...props }) {
  return <input {...props} type="date" className={cx(CONTROL, className)} />;
}, "DateInput");

export const SearchInput = shared((ui) => ui.SearchInput, function FallbackSearchInput({ value, onChange, placeholder, className, autoFocus }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={cx(CONTROL, className)}
    />
  );
}, "SearchInput");

export const Field = shared((ui) => ui.Field, function FallbackField({ label, hint, required, className, children }) {
  return (
    <label className={cx("flex flex-col gap-1.5 text-sm", className)}>
      <span className="font-medium">
        {label}
        {required && " *"}
      </span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}, "Field");

type TabsProps<T extends string> = { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void };

/**
 * The common tab strip. Cast back to a generic after `shared()`, so the tab
 * value keeps its own type (`Tabs<"recent" | "farmers">`).
 */
export const Tabs = shared(
  (ui) => ui.Tabs as ComponentType<TabsProps<string>>,
  function FallbackTabs({ tabs, value, onChange }: TabsProps<string>) {
    return (
      // Scrolls sideways on a phone instead of pushing the page wider.
      <div
        role="tablist"
        // The base line is an inset shadow, painted under the tabs, so the
        // active tab's underline sits on it without the -1px overlap a
        // scrolling box would clip.
        className="scroll-thin flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-zinc-200)] dark:shadow-[inset_0_-1px_0_var(--color-zinc-800)]"
      >
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={value === t.value}
            onClick={() => onChange(t.value)}
            className={cx(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              value === t.value ? "border-brand-500 text-brand-700" : "border-transparent text-zinc-500 hover:text-zinc-800"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  },
  "Tabs"
) as unknown as <T extends string>(props: TabsProps<T>) => JSX.Element;

/** The common dialog. Fallback: a plain centred panel over a dimmed page. */
export const Modal = shared((ui) => ui.Modal, function FallbackModal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="mt-10 w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-base font-semibold">{title}</div>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-900">
            ✕
          </button>
        </div>
        {children}
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}, "Modal");
