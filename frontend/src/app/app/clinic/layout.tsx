"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClinicSessionProvider } from "./clinic-session";
import { useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";

export default function ClinicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading } = useMe();
  const [role, setRole] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const nextUrl = useMemo(() => {
    if (typeof window === "undefined") return "/app/clinic/dashboard";
    return `${window.location.pathname}${window.location.search}`;
  }, [pathname]);

  useEffect(() => {
    if (loading) return;
    setStatus(null);

    if (!me) {
      router.replace(`/auth/login?next=${encodeURIComponent(nextUrl)}`);
      return;
    }

    setRole(me.role);
    if (me.role !== "CLINIC_ADMIN") {
      router.replace("/app");
    }
  }, [loading, me, router, nextUrl]);

  function navClass(path: string) {
    const active = pathname?.startsWith(path);
    return active
      ? "text-app-text font-medium bg-app-surface-2"
      : "text-app-muted hover:text-app-text";
  }

  return (
    <ClinicSessionProvider value={{ loading, role }}>
      <div className="min-h-screen bg-app-bg text-app-text flex">
        <aside className="w-64 bg-app-surface border-r border-app-border p-5 shadow-soft">
          <div className="text-h3 mb-6">Clinic Admin</div>
          <nav className="flex flex-col gap-1 text-sm">
            <Link
              className={`rounded-md px-2 py-1 ${navClass("/app/clinic/dashboard")}`}
              href="/app/clinic/dashboard"
            >
              Dashboard
            </Link>
            <Link
              className={`rounded-md px-2 py-1 ${navClass("/app/clinic/therapists")}`}
              href="/app/clinic/therapists"
            >
              Therapists
            </Link>
            <Link
              className={`rounded-md px-2 py-1 ${navClass("/app/clinic/clients")}`}
              href="/app/clinic/clients"
            >
              Clients
            </Link>
            <Link
              className={`rounded-md px-2 py-1 ${navClass("/app/clinic/assignments")}`}
              href="/app/clinic/assignments"
            >
              Assignments
            </Link>
            <Link
              className={`rounded-md px-2 py-1 ${navClass("/app/clinic/responses")}`}
              href="/app/clinic/responses"
            >
              Responses
            </Link>
            <Link
              className={`rounded-md px-2 py-1 ${navClass("/app/clinic/checkins")}`}
              href="/app/clinic/checkins"
            >
              Check-ins
            </Link>
            <Link
              className={`rounded-md px-2 py-1 ${navClass("/app/clinic/billing")}`}
              href="/app/clinic/billing"
            >
              Billing
            </Link>
            <Link
              className={`rounded-md px-2 py-1 ${navClass("/app/clinic/settings")}`}
              href="/app/clinic/settings"
            >
              Settings
            </Link>
          </nav>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="bg-app-surface border-b border-app-border">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-app-muted">
                Role: {loading ? "Loading..." : role ?? "Unknown"}
              </div>
              <Button type="button" onClick={() => router.replace("/app")} variant="ghost">
                Back to app
              </Button>
            </div>
          </header>

          <main className="flex-1 px-6 py-8">
            <div className="max-w-6xl mx-auto">
              {status && (
                <div className="mb-4 text-sm text-app-danger whitespace-pre-wrap">
                  {status}
                </div>
              )}
              {loading ? (
                <div className="text-sm text-app-muted">Loading...</div>
              ) : (
                children
              )}
            </div>
          </main>
        </div>
      </div>
    </ClinicSessionProvider>
  );
}
