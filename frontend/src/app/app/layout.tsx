"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setMeCache, useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading } = useMe();

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore and continue to login
    } finally {
      setMeCache(null);
      router.replace("/auth/login");
    }
  }

  function navClass(path: string) {
    const active = pathname?.startsWith(path);
    return active
      ? "text-app-text font-medium"
      : "text-app-muted hover:text-app-text";
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <header className="border-b border-app-border bg-app-surface">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/app" className="font-semibold text-lg text-app-text">
              Between Sessions
            </Link>
            <span className="text-xs text-app-muted">
              {loading ? "Loading session..." : me?.role ?? "Unknown"}
            </span>
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-sm">
            {me?.role === "therapist" && (
              <>
                <Link
                  className={navClass("/app/therapist/assignments")}
                  href="/app/therapist/assignments"
                >
                  Assignments
                </Link>
                <Link className={navClass("/app/therapist/review")} href="/app/therapist/review">
                  Review
                </Link>
                <Link className={navClass("/app/therapist/session-prep")} href="/app/therapist/session-prep">
                  Session prep
                </Link>
              </>
            )}
            {me?.role === "client" && (
              <>
                <Link className={navClass("/app/client/assignments")} href="/app/client/assignments">
                  Check-ins
                </Link>
              </>
            )}
            {me?.role === "admin" && (
              <>
                <Link className={navClass("/app/admin/users")} href="/app/admin/users">
                  Admin
                </Link>
                <Link className={navClass("/app/admin/audit")} href="/app/admin/audit">
                  Audit
                </Link>
              </>
            )}
            {me?.role === "CLINIC_ADMIN" && (
              <Link className={navClass("/app/clinic/dashboard")} href="/app/clinic/dashboard">
                Clinic
              </Link>
            )}
            <Button type="button" onClick={logout} variant="secondary">
              Logout
            </Button>
          </nav>
        </div>
      </header>

      <main className="px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-sm text-app-muted">Loading...</div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
