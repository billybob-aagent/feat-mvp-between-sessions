"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading } = useMe();

  useEffect(() => {
    if (!loading && me && me.role !== "admin") {
      router.replace("/app");
    }
  }, [loading, me, router]);

  function navClass(path: string) {
    const active = pathname?.startsWith(path);
    return active
      ? "text-app-text font-medium"
      : "text-app-muted hover:text-app-text";
  }

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-h3">Loading...</h1>
        <p className="text-sm text-app-muted mt-2">Checking access.</p>
      </main>
    );
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto px-6 py-4 border-b border-app-border mb-6">
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className={navClass("/app/admin/users")} href="/app/admin/users">
            Users
          </Link>
          <Link className={navClass("/app/admin/audit")} href="/app/admin/audit">
            Audit
          </Link>
          <Link className={navClass("/app/admin/assignments")} href="/app/admin/assignments">
            Assignments
          </Link>
          <Link className={navClass("/app/admin/notifications")} href="/app/admin/notifications">
            Notifications
          </Link>
          <Link className={navClass("/app/admin/responses")} href="/app/admin/responses">
            Responses
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
