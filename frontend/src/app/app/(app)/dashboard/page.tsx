"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { StatCard } from "@/components/page/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/use-me";
import { clinicDashboard } from "@/lib/clinic-api";
import { useLocalStorageState } from "@/lib/use-local-storage";
import type { ClinicDashboard } from "@/lib/types/clinic";

export default function DashboardPage() {
  const { me } = useMe();
  const router = useRouter();
  const [data, setData] = useState<ClinicDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicId, setClinicId] = useLocalStorageState("bs.clinic.id", "");

  const aerStart = useLocalStorageState("bs.aer.start", "")[0];
  const aerEnd = useLocalStorageState("bs.aer.end", "")[0];

  useEffect(() => {
    const canLoad = me?.role === "CLINIC_ADMIN";
    if (!canLoad) return;

    setLoading(true);
    setError(null);

    clinicDashboard()
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [me?.role]);

  useEffect(() => {
    if (data?.clinic?.id) {
      setClinicId(data.clinic.id);
    }
  }, [data?.clinic?.id, setClinicId]);

  const aerRangeLabel = useMemo(() => {
    if (aerStart && aerEnd) return `${aerStart} → ${aerEnd}`;
    return "Last 30 days";
  }, [aerStart, aerEnd]);

  return (
    <RequireRole roles={["CLINIC_ADMIN", "admin", "therapist"]}>
      <PageLayout
        title="Dashboard"
        subtitle="Clinic-level operational overview and report entry points."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => router.push("/app/reports/aer")}>
              Generate AER
            </Button>
            <Button variant="secondary" onClick={() => router.push("/app/clients")}>
              View clients
            </Button>
            <Button variant="secondary" onClick={() => router.push("/app/reports/supervisor-weekly")}>
              Weekly packet
            </Button>
          </div>
        }
      >
        {error && <Alert variant="danger" title="Failed to load dashboard">{error}</Alert>}

        {loading && (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        )}

        {!loading && data && (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Therapists" value={data.counts.therapists} />
            <StatCard label="Clients" value={data.counts.clients} />
            <StatCard label="Assignments" value={data.counts.assignments} />
            <StatCard label="Responses (7d)" value={data.counts.responses} />
          </div>
        )}

        {!loading && !data && (
          <Alert variant="info" title="No clinic metrics loaded">
            For therapist roles, this dashboard is read-only. Use the Reports and AI Assist
            sections to work with client data.
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>AER snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-app-muted">
              <div>Default range: {aerRangeLabel}</div>
              <div>Clinic context: {clinicId || "Set on Reports pages"}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                  href="/app/reports/aer"
                >
                  Generate AER
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                  href="/app/reports/rollup"
                >
                  View rollup
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-app-muted">
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span>Needs review</span>
                  <span className="text-app-text font-medium">{data?.counts.responses ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Overdue check-ins</span>
                  <span className="text-app-text font-medium">—</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Open escalations</span>
                  <span className="text-app-text font-medium">—</span>
                </div>
              </div>
              <div className="text-xs text-app-muted">
                Drill into Clients and Escalations for queue-level detail.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Between Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-app-muted">
              <p>Clients, assignments, check-ins, and response review.</p>
              <div className="flex flex-wrap items-center gap-2">
                <Link className="text-app-accent text-xs" href="/app/clients">
                  Clients
                </Link>
                <Link className="text-app-accent text-xs" href="/app/assignments">
                  Assignments
                </Link>
                <Link className="text-app-accent text-xs" href="/app/responses">
                  Responses
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supervisor workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-app-muted">
              <p>Weekly packet and escalation visibility.</p>
              <div className="flex flex-wrap items-center gap-2">
                <Link className="text-app-accent text-xs" href="/app/reports/supervisor-weekly">
                  Weekly packet
                </Link>
                <Link className="text-app-accent text-xs" href="/app/escalations">
                  Escalations
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    </RequireRole>
  );
}
