"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import Link from "next/link";
import { createInstance, type ModuleFederation } from "@module-federation/runtime";
import type * as SharedUI from "shared_ui/ui";
import { useThemeMode } from "../components/theme-toggle";

/**
 * The common UI kit (buttons, inputs, selects, date pickers, tables, modals…)
 * comes from the `shared_ui` app over Module Federation: nothing is copied into
 * this repo, so every app that consumes it updates when it is redeployed.
 *
 * Runtime-only federation: the remote is described by its mf-manifest.json and
 * loaded in the browser by @module-federation/runtime. No bundler plugin is
 * involved, so it works with Turbopack. Types come from the remote's
 * @mf-types.zip, unpacked into types/shared_ui (`npm run mf:types`).
 */
export type SharedUIModule = typeof SharedUI;

export const SHARED_UI_MANIFEST =
  process.env.NEXT_PUBLIC_SHARED_UI_MANIFEST ?? "https://shared-ui.onrender.com/mf-manifest.json";

// How long the first paint waits for the remote before going ahead with the
// plain fallbacks in components/ui.tsx.
const LOAD_TIMEOUT_MS = 10_000;

let federation: ModuleFederation | null = null;
let loading: Promise<SharedUIModule> | null = null;

function getFederation() {
  federation ??= createInstance({
    name: "oneroot_dashboard",
    remotes: [{ name: "shared_ui", entry: SHARED_UI_MANIFEST }],
    // The remote asks for react / react-dom as singletons (^19). Hand it ours,
    // and with loaded-first it takes these instead of fetching its own copy:
    // two Reacts on one page break every hook inside a shared component.
    shared: {
      react: {
        version: React.version,
        lib: () => React,
        loaded: true,
        shareConfig: { singleton: true, requiredVersion: "^19.0.0" },
      },
      "react-dom": {
        version: ReactDOM.version,
        lib: () => ReactDOM,
        loaded: true,
        shareConfig: { singleton: true, requiredVersion: "^19.0.0" },
      },
    },
    shareStrategy: "loaded-first",
  });
  return federation;
}

/** Loads the shared UI once; later calls get the same promise. A failure can be retried. */
export function loadSharedUI(): Promise<SharedUIModule> {
  loading ??= (async () => {
    const mod = await getFederation().loadRemote<SharedUIModule>("shared_ui/ui");
    if (!mod) throw new Error("shared_ui/ui did not load");
    await adoptRemoteCss();
    return mod;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/* ------------------------------------------------------------------ CSS -- */

/**
 * The remote ships its own Tailwind build. Two builds on one page repeat the
 * same base utilities (.p-4, .flex-col…), and the copy that loads second
 * outranks the first one's responsive variants (sm:p-6 stops working). So the
 * remote's stylesheet is taken in as text, every rule this app already has
 * word-for-word is dropped, and only the rest is added to the page.
 */
async function adoptRemoteCss() {
  if (document.querySelector("style[data-shared-ui]")) return;
  const manifestUrl = new URL(SHARED_UI_MANIFEST, location.href);
  const manifest = await (await fetch(manifestUrl)).json();
  const base = new URL(manifest.metaData?.publicPath && manifest.metaData.publicPath !== "auto" ? manifest.metaData.publicPath : ".", manifestUrl);
  const hrefs: string[] = (manifest.exposes ?? []).flatMap(
    (e: { assets?: { css?: { sync?: string[]; async?: string[] } } }) => [
      ...(e.assets?.css?.sync ?? []),
      ...(e.assets?.css?.async ?? []),
    ]
  );
  const urls = [...new Set(hrefs)].map((h) => new URL(h, base).href);

  const own = new Set<string>();
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collectKeys(sheet.cssRules, "", own);
    } catch {
      // A cross-origin sheet we cannot read; it is not one of ours.
    }
  }

  const css: string[] = [];
  for (const url of urls) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(await (await fetch(url)).text());
    dropKnown(sheet, "", own);
    css.push(Array.from(sheet.cssRules, (r) => r.cssText).join("\n"));
  }

  const style = document.createElement("style");
  style.dataset.sharedUi = "";
  style.textContent = css.join("\n");
  document.head.appendChild(style);

  // The remote's chunk loader also adds the original files as <link>s; switch
  // those off, now and if it adds them again.
  const isRemoteCss = (n: Node): n is HTMLLinkElement =>
    n instanceof HTMLLinkElement && n.rel === "stylesheet" && urls.includes(n.href);
  document.querySelectorAll("link").forEach((l) => isRemoteCss(l) && (l.disabled = true));
  new MutationObserver((records) => {
    for (const r of records) r.addedNodes.forEach((n) => isRemoteCss(n) && (n.disabled = true));
  }).observe(document.head, { childList: true });
}

// A group rule (@layer, @media, @supports…) contributes its prelude as context.
const isGroup = (r: CSSRule): r is CSSRule & { cssRules: CSSRuleList } =>
  !(r instanceof CSSStyleRule) && "cssRules" in r;
const prelude = (r: CSSRule) => r.cssText.slice(0, r.cssText.indexOf("{")).trim();

function collectKeys(rules: CSSRuleList, ctx: string, out: Set<string>) {
  for (const r of Array.from(rules)) {
    if (isGroup(r)) collectKeys(r.cssRules, `${ctx}${prelude(r)}|`, out);
    else out.add(ctx + r.cssText);
  }
}

function dropKnown(parent: { cssRules: CSSRuleList; deleteRule(i: number): void }, ctx: string, known: Set<string>) {
  for (let i = parent.cssRules.length - 1; i >= 0; i--) {
    const r = parent.cssRules[i];
    if (isGroup(r)) {
      dropKnown(r as unknown as CSSGroupingRule, `${ctx}${prelude(r)}|`, known);
      if (r.cssRules.length === 0) parent.deleteRule(i);
    } else if (known.has(ctx + r.cssText)) {
      parent.deleteRule(i);
    }
  }
}

/* ------------------------------------------------------------- React -- */

type Status = "loading" | "ready" | "failed";
const SharedUIContext = React.createContext<SharedUIModule | null>(null);

/** The loaded shared UI module, or null while loading / if it could not load. */
export const useSharedUI = () => React.useContext(SharedUIContext);

// Shared components follow this app's look: the accent the admin picked (live,
// through the CSS variable) and the zinc greys used everywhere else.
function themeFor(mode: "light" | "dark") {
  return {
    mode,
    colors: { brand: "var(--brand-600)", neutral: "#52525b", line: "#e4e4e7", surface: "#ffffff" },
    darkColors: { brand: "var(--brand-500)", neutral: "#a1a1aa", line: "#27272a", surface: "#09090b" },
  };
}

/**
 * Loads the shared UI before the app first renders (with a timeout), so the
 * tree is never re-mounted under a provider halfway through a session.
 * `fallback` is shown meanwhile.
 */
export function SharedUIProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [{ status, ui }, setState] = React.useState<{ status: Status; ui: SharedUIModule | null }>({
    status: "loading",
    ui: null,
  });
  const mode = useThemeMode();
  const theme = React.useMemo(() => themeFor(mode), [mode]);

  React.useEffect(() => {
    let live = true;
    // Whichever comes first wins; a late arrival is ignored for this session,
    // since the app is already running on the fallbacks.
    const settle = (next: { status: Status; ui: SharedUIModule | null }) =>
      live && setState((s) => (s.status === "loading" ? next : s));
    const timer = setTimeout(() => settle({ status: "failed", ui: null }), LOAD_TIMEOUT_MS);
    loadSharedUI().then(
      (mod) => settle({ status: "ready", ui: mod }),
      (err) => {
        console.error("[shared-ui] could not load the shared UI; using plain fallbacks.", err);
        settle({ status: "failed", ui: null });
      }
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);

  if (status === "loading") return <>{fallback}</>;
  if (!ui) return <SharedUIContext.Provider value={null}>{children}</SharedUIContext.Provider>;

  const { ThemeProvider, ToastProvider, ConfirmProvider } = ui;
  return (
    <SharedUIContext.Provider value={ui}>
      <ThemeProvider theme={theme} link={Link as unknown as SharedUI.LinkLike}>
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </SharedUIContext.Provider>
  );
}
