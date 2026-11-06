"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../lib/auth";
import { SharedUIProvider } from "../lib/shared-ui";
import { LightboxProvider } from "./lightbox";
import { Shell } from "./shell";

function AppLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/30">
        <Image src="/logo-mark-white.png" alt="OneRoot" width={169} height={221} className="h-8 w-auto" priority />
      </span>
      <span className="text-sm text-zinc-500">Loading…</span>
    </div>
  );
}

// Redirects unauthenticated admins to /login and keeps signed-in admins out of it.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  // Login is the only public page — there is no sign-up. Admins are created from /account.
  const isPublic = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!admin && !isPublic) router.replace("/login");
    if (admin && isPublic) router.replace("/");
  }, [admin, loading, isPublic, router]);

  if (loading) return <AppLoader />;
  // The login screen renders bare (no sidebar/header).
  if (isPublic) return admin ? null : <>{children}</>;
  // Avoid flashing protected content while redirecting.
  if (!admin) return null;

  return <Shell>{children}</Shell>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {/* The shared UI kit (Module Federation) loads while the session is checked. */}
      <SharedUIProvider fallback={<AppLoader />}>
        {/* Outside AuthGate so the overlay sits above the shell chrome. */}
        <LightboxProvider>
          <AuthGate>{children}</AuthGate>
        </LightboxProvider>
      </SharedUIProvider>
    </AuthProvider>
  );
}
