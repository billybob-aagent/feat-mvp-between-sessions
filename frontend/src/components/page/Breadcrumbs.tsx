"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  app: "App",
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
  reports: "Reports",
  aer: "AER",
  rollup: "Rollup",
  "supervisor-weekly": "Weekly Packet",
  escalations: "Escalations",
  "external-access": "External Access",
  ai: "AI Assist",
  settings: "Settings",
  "adherence-assist": "Adherence Assist",
  "assessment-assist": "Assessment Assist",
  "dry-run": "Dry Run",
  clinic: "Clinic",
  admin: "Admin",
  therapists: "Therapists",
  billing: "Billing",
  "not-authorized": "Not Authorized",
};

function labelFor(segment: string) {
  return LABELS[segment] ?? segment.replace(/-/g, " ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname
    ?.split("/")
    .filter(Boolean)
    .filter((seg) => seg !== "app") ?? [];

  if (segments.length === 0) return null;

  let path = "/app";

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-app-muted">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href="/app" className="hover:text-app-text">
            Home
          </Link>
        </li>
        {segments.map((seg, idx) => {
          path += `/${seg}`;
          const isLast = idx === segments.length - 1;
          return (
            <li key={path} className="flex items-center gap-2">
              <span className="text-app-muted">/</span>
              {isLast ? (
                <span className="text-app-text">{labelFor(seg)}</span>
              ) : (
                <Link href={path} className="hover:text-app-text">
                  {labelFor(seg)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
