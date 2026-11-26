"use client";

import { useEffect, useState } from "react";

/**
 * Web push through OneSignal: new enquiries reach an account's laptop or phone
 * even when no dashboard tab is open.
 *
 * Each browser is logged in to OneSignal with the account's id as its
 * external_id, so the backend (src/config/onesignal.js) pushes to cf_admins.id.
 * The service worker is public/OneSignalSDKWorker.js.
 *
 * Off (every function a no-op) when NEXT_PUBLIC_ONESIGNAL_APP_ID is not set.
 */

export const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "";

/** The parts of the OneSignal v16 page SDK used here. */
type OneSignalSdk = {
  init: (opts: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  Notifications: {
    isPushSupported: () => boolean;
    permission: boolean;
    requestPermission: () => Promise<void>;
    addEventListener: (event: "permissionChange", cb: (granted: boolean) => void) => void;
    removeEventListener: (event: "permissionChange", cb: (granted: boolean) => void) => void;
  };
  User: {
    PushSubscription: {
      optedIn?: boolean;
      optIn: () => Promise<void>;
      addEventListener: (event: "change", cb: () => void) => void;
      removeEventListener: (event: "change", cb: () => void) => void;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: ((os: OneSignalSdk) => void | Promise<void>)[];
  }
}

const SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

let ready: Promise<OneSignalSdk | null> | null = null;

/** Load and initialise the SDK once; resolves null when push is off or unavailable. */
function oneSignal(): Promise<OneSignalSdk | null> {
  if (!ONESIGNAL_APP_ID || typeof window === "undefined") return Promise.resolve(null);
  if (ready) return ready;
  ready = new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (os) => {
      try {
        await os.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: "OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
          // Local development runs on http://localhost.
          allowLocalhostAsSecureOrigin: true,
          // The dashboard asks from its own bell, not OneSignal's widgets.
          notifyButton: { enable: false },
          promptOptions: { slidedown: { prompts: [] } },
        });
        resolve(os);
      } catch (err) {
        console.warn("[web push] OneSignal init failed", err);
        resolve(null);
      }
    });
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.defer = true;
    s.onerror = () => resolve(null); // blocked by an ad blocker, offline
    document.head.appendChild(s);
  });
  return ready;
}

/** Point this browser's subscription at the signed-in account, or detach it on sign-out. */
export function syncWebPushUser(adminId: string | null) {
  oneSignal()
    .then((os) => (os ? (adminId ? os.login(adminId) : os.logout()) : undefined))
    .catch((err) => console.warn("[web push] login sync failed", err));
}

export type WebPushState =
  /** Push is off, or this browser cannot do it (e.g. iPhone Safari outside a home-screen app). */
  | "unsupported"
  | "loading"
  /** Supported but not turned on here yet. */
  | "off"
  /** The person blocked notifications for this site in the browser. */
  | "blocked"
  | "on";

/** Whether push is on in this browser, and a way to turn it on (call from a click). */
export function useWebPush() {
  const [state, setState] = useState<WebPushState>(ONESIGNAL_APP_ID ? "loading" : "unsupported");

  useEffect(() => {
    let os: OneSignalSdk | null = null;
    let cancelled = false;
    const update = () => {
      if (cancelled || !os) return;
      if (!os.Notifications.isPushSupported()) return setState("unsupported");
      if (typeof Notification !== "undefined" && Notification.permission === "denied") return setState("blocked");
      setState(os.Notifications.permission && os.User.PushSubscription.optedIn !== false ? "on" : "off");
    };
    oneSignal().then((sdk) => {
      if (cancelled) return;
      if (!sdk) return setState("unsupported");
      os = sdk;
      os.Notifications.addEventListener("permissionChange", update);
      os.User.PushSubscription.addEventListener("change", update);
      update();
    });
    return () => {
      cancelled = true;
      os?.Notifications.removeEventListener("permissionChange", update);
      os?.User.PushSubscription.removeEventListener("change", update);
    };
  }, []);

  const enable = async () => {
    const os = await oneSignal();
    if (!os) return;
    try {
      if (!os.Notifications.permission) await os.Notifications.requestPermission();
      if (os.Notifications.permission) await os.User.PushSubscription.optIn();
    } catch (err) {
      console.warn("[web push] enabling failed", err);
    }
  };

  return { state, enable };
}
