"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type MeResponse =
  | { authenticated: false }
  | { authenticated: true; userId: string; role: string };

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function getMe(): Promise<MeResponse | null> {
      try {
        return await apiFetch<MeResponse>("/auth/me");
      } catch {
        return null; // covers 401 or any fetch error
      }
    }

    async function guard() {
      // 1) First attempt
      const me1 = await getMe();

      if (cancelled) return;

      if (me1 && me1.authenticated === true) {
        if (me1.role !== "client") {
          router.replace("/app");
          return;
        }
        setOk(true);
        return;
      }

      // 2) Not authenticated -> try refresh once
      try {
        await apiFetch("/auth/refresh", { method: "POST", json: {} });
      } catch {
        if (cancelled) return;
        router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      if (cancelled) return;

      // 3) Retry me after refresh
      const me2 = await getMe();

      if (cancelled) return;

      if (me2 && me2.authenticated === true) {
        if (me2.role !== "client") {
          router.replace("/app");
          return;
        }
        setOk(true);
        return;
      }

      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    }

    guard();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!ok) {
    return (
      <main className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold">Loading…</h1>
        <p className="text-gray-700 mt-2">Checking access.</p>
      </main>
    );
  }

  return <>{children}</>;
}

