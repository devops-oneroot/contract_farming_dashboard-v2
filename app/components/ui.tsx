"use client";

import type { ComponentType } from "react";
import { useSharedUI, type SharedUIModule } from "../lib/shared-ui";

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

export const Select = shared((ui) => ui.Select, function FallbackSelect({ isSearch, className, ...props }) {
  void isSearch; // a native <select> has no search box
  return <select {...props} className={cx(CONTROL, className)} />;
}, "Select");

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
