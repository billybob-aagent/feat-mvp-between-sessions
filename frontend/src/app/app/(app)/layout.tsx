"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setMeCache, useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Breadcrumbs } from "@/components/page/Breadcrumbs";
import { NotAuthorized } from "@/components/page/NotAuthorized";
import { Skeleton } from "@/components/ui/skeleton";

const buildNav = (role?: string | null) => {
  const base = [
    {
      section: "Home",
      items: [{ label: "Dashboard", href: "/app/dashboard" }],
    },
  ];

  if (role === "client") {
    return [
      ...base,
      {
        section: "Between Sessions",
        items: [
          { label: "My Check-ins", href: "/app/client/assignments" },
          { label: "Library", href: "/app/library" },
        ],
      },
    ];
  }

  const betweenSessions = {
    section: "Between Sessions",
    items: [
      { label: "Clients", href: "/app/clients" },
      { label: "Library", href: "/app/library" },
      ...(role === "admin" || role === "CLINIC_ADMIN"
        ? [{ label: "Library Review", href: "/app/library/review/queue" }]
        : []),
      { label: "Assignments", href: "/app/assignments" },
      { label: "Check-ins", href: "/app/checkins" },
      { label: "Responses", href: "/app/responses" },
    ],
  };

  const reports = {
    section: "Reports",
    items: [
      { label: "AER (Client)", href: "/app/reports/aer" },
      { label: "AER Rollup", href: "/app/reports/rollup" },
      { label: "Supervisor Weekly", href: "/app/reports/supervisor-weekly" },
    ],
  };

  const supervisors = {
    section: "Supervisors",
    items: [{ label: "Escalations", href: "/app/escalations" }],
  };

  const externalAccess = {
    section: "External Access",
    items: [{ label: "Issue & Revoke", href: "/app/external-access" }],
  };

  const aiAssist = {
    section: "AI Assist",
    items: [
      { label: "Overview", href: "/app/ai" },
      { label: "Settings", href: "/app/ai/settings" },
      { label: "Adherence Assist", href: "/app/ai/adherence-assist" },
      { label: "Assessment Assist", href: "/app/ai/assessment-assist" },
      { label: "Dry Run", href: "/app/ai/dry-run" },
    ],
  };

  const clinicSettings = {
    section: "Clinic / Settings",
    items: [
      { label: "Staff", href: "/app/settings/clinic/staff" },
      { label: "Clients", href: "/app/settings/clinic/clients" },
      { label: "Clinic Settings", href: "/app/clinic" },
    ],
  };

  if (role === "therapist") {
    return [
      ...base,
      betweenSessions,
      reports,
      supervisors,
      aiAssist,
    ];
  }

  const nav = [
    ...base,
    betweenSessions,
    reports,
    supervisors,
    externalAccess,
    aiAssist,
    clinicSettings,
  ];

  if (role === "admin") {
    nav.push({
      section: "Platform Admin",
      items: [
        { label: "Users", href: "/app/admin/users" },
        { label: "Assignments", href: "/app/admin/assignments" },
        { label: "Responses", href: "/app/admin/responses" },
        { label: "Notifications", href: "/app/admin/notifications" },
        { label: "Audit", href: "/app/admin/audit" },
        { label: "Library", href: "/app/admin/library" },
      ],
    });
  }

  return nav;
};

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  assignments: "Assignments",
  checkins: "Check-ins",
  responses: "Responses",
  library: "Library",
  collections: "Collections",
  items: "Items",
  search: "Search",
  rag: "RAG Query",
  review: "Review",
  queue: "Review Queue",
  reports: "Reports",
  aer: "AER",
  rollup: "AER Rollup",
  "supervisor-weekly": "Weekly Packet",
  escalations: "Escalations",
  "external-access": "External Access",
  ai: "AI Assist",
  settings: "Settings",
  "adherence-assist": "Adherence Assist",
  "assessment-assist": "Assessment Assist",
  "dry-run": "Dry Run",
  clinic: "Clinic",
  staff: "Staff",
  admin: "Admin",
};

function derivePageTitle(pathname?: string | null) {
  if (!pathname) return "Dashboard";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Dashboard";
  if (segments.includes("clients") && segments[segments.length - 1] !== "clients") {
    return "Client Profile";
  }
  const last = segments[segments.length - 1];
  return PAGE_LABELS[last] ?? last.replace(/-/g, " ");
}

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading } = useMe();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const navSections = useMemo(() => buildNav(me?.role ?? null), [me?.role]);
  const pageTitle = useMemo(() => derivePageTitle(pathname), [pathname]);

  function navClass(path: string) {
    const active = pathname?.startsWith(path);
    return active
      ? "bg-app-accent/10 text-app-text border-app-accent"
      : "text-app-muted hover:text-app-text";
  }

  if (!loading && !me) {
    return (
      <div className="min-h-screen bg-app-bg px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <NotAuthorized message="Please sign in to access the app." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 z-40 border-r border-app-border bg-app-surface px-4 py-6 shadow-card transition-all lg:static lg:translate-x-0 ${sidebarCollapsed ? "w-20" : "w-72"} ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <Link href="/app" className="text-base font-semibold text-app-text">
              {sidebarCollapsed ? "BS" : "Between Sessions"}
            </Link>
            <button
              type="button"
              className="text-xs text-app-muted lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="mt-3 hidden lg:flex items-center justify-between text-xs text-app-muted">
            <span>{sidebarCollapsed ? "" : "Navigation"}</span>
            <button
              type="button"
              className="text-xs text-app-muted hover:text-app-text"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
            >
              {sidebarCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {navSections.map((section) => (
              <div key={section.section}>
                {!sidebarCollapsed && (
                  <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">
                    {section.section}
                  </div>
                )}
                <div className="mt-2 space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={`flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm transition ${navClass(item.href)} ${sidebarCollapsed ? "justify-center" : ""}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="text-sm font-medium">
                        {sidebarCollapsed ? item.label.charAt(0) : item.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-black/20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-20 border-b border-app-border bg-app-surface/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="rounded-md border border-app-border px-2 py-1 text-xs text-app-muted lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  Menu
                </button>
                <div className="flex flex-col gap-1">
                  <div className="text-xs text-app-muted">Page</div>
                  <div className="text-sm font-semibold text-app-text">{pageTitle}</div>
                </div>
                <div className="hidden sm:block">
                  <Breadcrumbs />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="hidden md:block">
                  <Input aria-label="Search" placeholder="Search" className="w-48" />
                </div>
                <div className="hidden md:block">
                  <Select defaultValue="context" aria-label="Clinic context">
                    <option value="context">Clinic context (set per page)</option>
                  </Select>
                </div>
                <div className="flex items-center gap-2 text-xs text-app-muted">
                  {loading ? (
                    <Skeleton className="h-4 w-24" />
                  ) : (
                    <span>Role: {me?.role ?? "Unknown"}</span>
                  )}
                </div>
                <Button type="button" variant="secondary" onClick={logout}>
                  Logout
                </Button>
              </div>
            </div>
          </header>

          <main className="px-6 py-8">
            <div className="mx-auto w-full max-w-7xl">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                children
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
