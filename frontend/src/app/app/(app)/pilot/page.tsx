"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/use-me";
import { useLocalStorageState } from "@/lib/use-local-storage";
import { clinicDashboard } from "@/lib/clinic-api";
import { pilotMetrics } from "@/lib/api";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { NotAuthorized } from "@/components/page/NotAuthorized";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object" && value.constructor === Object) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      acc[key] = sortKeys(val);
      return acc;
    }, {});
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortKeys(value), null, 2);
}

type PilotMetrics = {
  clinic_id: string;
  period: { start: string; end: string };
  review_throughput: {
    reviewed_responses_count: number;
    reviewed_checkins_count: number;
    reviewed_checkins_not_available: boolean;
    median_time_to_review_hours: number | null;
  };
  aer_usage: {
    aer_generated_count: number;
    external_access_fetch_count: number;
  };
  ai_usage: {
    drafts_generated_count: number;
    drafts_applied_count: number;
  };
  operational: {
    active_therapists: number;
    active_clients: number;
  };
};

export default function PilotMetricsPage() {
  const { me, loading: meLoading } = useMe();
  const isClinicAdmin = me?.role === "CLINIC_ADMIN";
  const isAdmin = me?.role === "admin";
  const canAccess = isClinicAdmin || isAdmin;

  const [clinicId, setClinicId] = useLocalStorageState("bs.clinic.id", "");
  const [start, setStart] = useLocalStorageState("bs.pilot.start", daysAgoIso(7));
  const [end, setEnd] = useLocalStorageState("bs.pilot.end", todayIso());

  const [metrics, setMetrics] = useState<PilotMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isClinicAdmin) return;
    clinicDashboard()
      .then((res) => {
        if (!clinicId) setClinicId(res.clinic.id);
      })
      .catch(() => {
        // ignore
      });
  }, [isClinicAdmin, clinicId, setClinicId]);

  const canLoad = useMemo(() => {
    if (!canAccess) return false;
    if (isAdmin && !clinicId) return false;
    return Boolean(start && end && clinicId);
  }, [canAccess, isAdmin, clinicId, start, end]);

  async function handleLoad() {
    if (!canLoad) return;
    setLoading(true);
    setError(null);
    try {
      const res = await pilotMetrics({ clinicId, start, end });
      setMetrics(res as PilotMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!metrics) return;
    const json = stableStringify(metrics);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PILOT_METRICS_${metrics.clinic_id}_${metrics.period.start}_${metrics.period.end}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (meLoading) {
    return <div className="text-sm text-app-muted">Loading...</div>;
  }

  if (!canAccess) {
    return <NotAuthorized message="Pilot metrics are available to clinic admins and admins." />;
  }

  return (
    <PageLayout
      title="Pilot Metrics"
      subtitle="Track week-one outcomes and readiness for expansion."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handleLoad} disabled={!canLoad || loading}>
            {loading ? "Loading..." : "Load metrics"}
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={!metrics}>
            Export JSON
          </Button>
        </div>
      }
      filters={
        <FilterBar>
          <div className="min-w-[220px]">
            <label className="text-label text-app-muted">Clinic ID</label>
            <Input
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              placeholder="Clinic UUID"
              disabled={isClinicAdmin}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-label text-app-muted">Start</label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="min-w-[160px]">
            <label className="text-label text-app-muted">End</label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          {isAdmin && !clinicId && (
            <div className="flex items-end text-xs text-app-muted">Admin requires clinicId input.</div>
          )}
        </FilterBar>
      }
    >
      <Alert variant="info" title="Pilot Mode">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>Pilot Mode:</span>
          <Link className="text-app-text underline" href="/app/onboarding">
            Seed
          </Link>
          <span>→</span>
          <Link className="text-app-text underline" href="/app/review-queue">
            Review Queue
          </Link>
          <span>→</span>
          <Link className="text-app-text underline" href="/app/reports/aer">
            Generate AER
          </Link>
          <span>→</span>
          <Link className="text-app-text underline" href="/app/pilot">
            View Metrics
          </Link>
        </div>
      </Alert>

      {error && <Alert variant="danger" title="Unable to load metrics">{error}</Alert>}

      {!metrics && !loading && (
        <Alert variant="info" title="No metrics loaded">
          Select a clinic and date range, then click Load metrics.
        </Alert>
      )}

      {metrics && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Review throughput</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Metric</TableHead>
                    <TableHead>Value</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Reviewed responses</TableCell>
                    <TableCell>{metrics.review_throughput.reviewed_responses_count}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Reviewed check-ins</TableCell>
                    <TableCell>
                      {metrics.review_throughput.reviewed_checkins_not_available
                        ? "Not available"
                        : metrics.review_throughput.reviewed_checkins_count}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Median time to review (hrs)</TableCell>
                    <TableCell>
                      {metrics.review_throughput.median_time_to_review_hours ?? "—"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AER usage</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Metric</TableHead>
                    <TableHead>Value</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>AER generated</TableCell>
                    <TableCell>{metrics.aer_usage.aer_generated_count}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>External access fetches</TableCell>
                    <TableCell>{metrics.aer_usage.external_access_fetch_count}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI usage</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Metric</TableHead>
                    <TableHead>Value</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Drafts generated</TableCell>
                    <TableCell>{metrics.ai_usage.drafts_generated_count}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Drafts applied</TableCell>
                    <TableCell>{metrics.ai_usage.drafts_applied_count}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operational</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Metric</TableHead>
                    <TableHead>Value</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Active therapists</TableCell>
                    <TableCell>{metrics.operational.active_therapists}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Active clients</TableCell>
                    <TableCell>{metrics.operational.active_clients}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pilot success checklist</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-app-muted">
            <ul className="list-disc pl-5 space-y-2">
              <li>Invite staff and at least one client.</li>
              <li>Assign the first published library item.</li>
              <li>Client submits a response.</li>
              <li>Therapist reviews in the review queue.</li>
              <li>Generate an AER for at least one client.</li>
              <li>Optional: issue an external access token for audit/UR.</li>
              <li>Optional: generate and apply an AI draft (if enabled).</li>
            </ul>
            <div className="mt-4 text-xs">
              Success criteria: ≥ reviews per therapist/week, median time-to-review trending down,
              AER generated for ≥ target clients, and external token used when required.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Week 1 ops</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-app-muted">
            <ul className="list-disc pl-5 space-y-2">
              <li>Confirm staff and client invites are accepted.</li>
              <li>Run first assignment and verify submission flow.</li>
              <li>Review responses daily; document any delays.</li>
              <li>Generate AER and share internally for QA.</li>
              <li>Schedule a 15-minute pilot check-in with clinic lead.</li>
              <li>Track exceptions or blockers and resolve within 24 hours.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
