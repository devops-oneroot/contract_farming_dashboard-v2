"use client";

import { useSyncExternalStore } from "react";

/**
 * How many API requests are in flight, app-wide - what the global loader bar
 * shows. Every request made through `api` (lib/api.ts) counts itself in and
 * out, so no page has to remember to.
 */
let inFlight = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function beginRequest() {
  inFlight += 1;
  emit();
}

export function endRequest() {
  inFlight = Math.max(0, inFlight - 1);
  emit();
}

/** Wraps a promise so the global loader shows while it runs. */
export async function track<T>(p: Promise<T>): Promise<T> {
  beginRequest();
  try {
    return await p;
  } finally {
    endRequest();
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** True while any request is running. */
export function useGlobalLoading() {
  return useSyncExternalStore(
    subscribe,
    () => inFlight > 0,
    () => false
  );
}
