"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiDownload, apiDownloadPost, apiFetch } from "@/lib/api";
import { clinicDashboard, clinicListClients } from "@/lib/clinic-api";
import type { ClinicClientListItem } from "@/lib/types/clinic";
import { useMe } from "@/lib/use-me";
import { useLocalStorageState } from "@/lib/use-local-storage";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { EmptyState } from "@/components/page/EmptyState";
import { ErrorState } from "@/components/page/ErrorState";
import { NotAuthorized } from "@/components/page/NotAuthorized";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TraceRow = {
  assignment_id: string;
  assignment_title: string | null;
  library_source: {
    item_id: string;
    version_id: string | null;
    version: number | null;
    title: string | null;
    slug: string | null;
  } | null;
  response: {
    response_id: string | null;
    submitted_at: string | null;
    status: "submitted" | "missing";
  };
  review: {
    reviewed_at: string | null;
    reviewed_by_role: string | null;
    reviewed_by_display: string | null;
  };
  aer_included: boolean;
  aer_reason_not_included: "UNREVIEWED" | "NO_RESPONSE" | "OUT_OF_PERIOD" | "NOT_AVAILABLE" | null;
};

type TraceResponse = {
  meta: { clientId: string; clinicId: string; period: { start: string; end: string } };
  rows: TraceRow[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function TraceView({ clientId: fixedClientId }: { clientId?: string }) {
  const { me } = useMe();
  const role = me?.role ?? null;
  const isClinicAdmin = role === "CLINIC_ADMIN";
  const isAdmin = role === "admin";
  const isTherapist = role === "therapist";
  const canAccessTrace = fixedClientId ? (isAdmin || isClinicAdmin || isTherapist) : (isAdmin || isClinicAdmin);
  const canGenerateAER = isAdmin || isClinicAdmin;
  const canIssueExternal = isAdmin || isClinicAdmin;

  const [clinicId, setClinicId] = useLocalStorageState("bs.clinic.id", "");
  const [clientId, setClientId] = useLocalStorageState("bs.trace.clientId", fixedClientId ?? "");
  const [start, setStart] = useLocalStorageState("bs.trace.start", daysAgoIso(30));
  const [end, setEnd] = useLocalStorageState("bs.trace.end", todayIso());
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [clients, setClients] = useState<ClinicClientListItem[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceResponse | null>(null);

  const [actionStatus, setActionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!fixedClientId) return;
    setClientId(fixedClientId);
  }, [fixedClientId, setClientId]);

  useEffect(() => {
    if (!canAccessTrace || fixedClientId) return;
    if (isAdmin && !clinicId) return;
    setLoadingClients(true);
    setClients([]);
    clinicListClients({ limit: 100, clinicId: isAdmin ? clinicId : undefined })
      .then((data) => setClients(Array.isArray(data.items) ? data.items : []))
      .catch(() => setClients([]))
      .finally(() => setLoadingClients(false));
  }, [canAccessTrace, fixedClientId, isAdmin, clinicId]);

  useEffect(() => {
    if (!canAccessTrace || !isClinicAdmin || clinicId) return;
    clinicDashboard()
      .then((data) => {
        if (data?.clinic?.id) setClinicId(data.clinic.id);
      })
      .catch(() => undefined);
  }, [canAccessTrace, isClinicAdmin, clinicId, setClinicId]);

  async function loadTrace() {
    if (!clientId) {
      setError("Client is required.");
      return;
    }
    setLoading(true);
    setError(null);
    setActionStatus(null);
    try {
      const params = new URLSearchParams({
        start,
        end,
      });
      if (statusFilter && statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      const data = await apiFetch<TraceResponse>(
        `/trace/client/${encodeURIComponent(clientId)}?${params.toString()}`,
      );
      setTrace(data);
    } catch (err) {
      setTrace(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!trace?.meta?.clinicId || !clientId) return;
    setActionStatus(null);
    try {
      const qs = new URLSearchParams({ start, end }).toString();
      const path = `/reports/aer/${encodeURIComponent(trace.meta.clinicId)}/${encodeURIComponent(clientId)}.pdf?${qs}`;
      const { blob, filename } = await apiDownload(path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `AER_${clientId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function generateAer() {
    if (!trace?.meta?.clinicId || !clientId) return;
    setActionStatus(null);
    try {
      const qs = new URLSearchParams({ start, end }).toString();
      await apiFetch(
        `/reports/aer/${encodeURIComponent(trace.meta.clinicId)}/${encodeURIComponent(clientId)}?${qs}`,
      );
      setActionStatus("AER generated for this period.");
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function issueExternalToken() {
    if (!trace?.meta?.clinicId || !clientId) return;
    setActionStatus(null);
    try {
      const res = (await apiFetch("/external-access/aer", {
        method: "POST",
        json: {
          clinicId: trace.meta.clinicId,
          clientId,
          start,
          end,
          program: null,
          format: "pdf",
          ttlMinutes: 60,
        },
      })) as { url: string };
      setActionStatus(res.url ? `External link issued: ${res.url}` : "External link issued.");
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function downloadBundle() {
    if (!trace?.meta?.clinicId || !clientId) return;
    setActionStatus(null);
    try {
      const { blob, filename } = await apiDownloadPost("/reports/aer-bundle", {
        clinicId: trace.meta.clinicId,
        clientId,
        start,
        end,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `AER_BUNDLE_${clientId}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : String(err));
    }
  }

  const rows = useMemo(() => trace?.rows ?? [], [trace]);
  const needsReviewCount = useMemo(
    () => rows.filter((row) => row.response.status === "submitted" && !row.review.reviewed_at).length,
    [rows],
  );

  if (!canAccessTrace) {
    return (
      <div className="mx-auto max-w-3xl">
        <NotAuthorized message="You do not have access to the AER trace view." />
      </div>
    );
  }

  return (
    <PageLayout
      title="Assignment → Review → AER Trace"
      subtitle="Verify the evidence chain from library snapshot to included AER evidence."
      actions={
        <div className="flex items-center gap-2">
          {canGenerateAER && (
            <Button
              variant="secondary"
              onClick={generateAer}
              disabled={!clientId || !trace?.meta?.clinicId}
            >
              Generate AER
            </Button>
          )}
          {canGenerateAER && (
            <Button
              variant="secondary"
              onClick={downloadPdf}
              disabled={!clientId || !trace?.meta?.clinicId}
            >
              Download PDF
            </Button>
          )}
          {canGenerateAER && (
            <Button
              variant="primary"
              onClick={downloadBundle}
              disabled={!clientId || !trace?.meta?.clinicId}
            >
              Download AER Bundle (.zip)
            </Button>
          )}
        </div>
      }
    >
      <FilterBar
        actions={
          <Button variant="primary" onClick={loadTrace} disabled={loading || !clientId}>
            {loading ? "Loading..." : "Load Trace"}
          </Button>
        }
      >
        {isAdmin && (
          <div className="min-w-[220px]">
            <label className="block text-label text-app-muted mb-1">Clinic ID</label>
            <Input
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              placeholder="Clinic ID"
            />
          </div>
        )}
        {!fixedClientId && (
          <div className="min-w-[220px]">
            <label className="block text-label text-app-muted mb-1">Client</label>
            <Select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={loadingClients || (isAdmin && !clinicId)}
            >
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.fullName || client.email || client.id}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="min-w-[160px]">
          <label className="block text-label text-app-muted mb-1">Start</label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-label text-app-muted mb-1">End</label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="min-w-[180px]">
          <label className="block text-label text-app-muted mb-1">Status</label>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="REVIEWED">Reviewed</option>
          </Select>
        </div>
      </FilterBar>

      {isTherapist && (
        <div className="mb-4 text-xs text-app-muted">
          Scope: My clients only.
        </div>
      )}
      {isClinicAdmin && (
        <div className="mb-4 text-xs text-app-muted">
          Scope: Clinic-wide.
        </div>
      )}
      {isAdmin && !clinicId && (
        <div className="mb-4 text-xs text-app-muted">
          Admins must specify a clinic ID to load client options.
        </div>
      )}

      {error && <ErrorState title="Unable to load trace" message={error} />}
      {actionStatus && <div className="text-sm text-app-muted mb-4">{actionStatus}</div>}

      {!loading && rows.length === 0 && (
        <EmptyState
          title="No trace data yet"
          description="Select a client and date range to view assignment evidence."
        />
      )}

      {rows.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evidence chain</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Reviewed</TableHead>
                    <TableHead>Included in AER</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const reason = row.aer_reason_not_included;
                    const responseBadge =
                      row.response.status === "submitted" ? "success" : "warning";
                    const reviewBadge = row.review.reviewed_at ? "success" : "warning";
                    const aerBadge = row.aer_included ? "success" : "warning";
                    const assignmentLink = isTherapist
                      ? `/app/therapist/assignments/${row.assignment_id}/edit`
                      : `/app/clients/${clientId}`;
                    const responseLink = isTherapist
                      ? `/app/therapist/assignments/${row.assignment_id}/responses`
                      : `/app/clients/${clientId}`;
                    return (
                      <TableRow key={row.assignment_id}>
                        <TableCell>
                          <div className="font-medium">
                            {row.assignment_title ?? "Assignment"}
                          </div>
                          <div className="text-xs text-app-muted">
                            ID: {row.assignment_id}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.library_source?.item_id ? (
                            <div className="text-sm">
                              <div className="font-medium">
                                {row.library_source.title ?? "Library Item"}
                              </div>
                              <div className="text-xs text-app-muted">
                                v{row.library_source.version ?? "—"} · {row.library_source.slug ?? "—"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-app-muted">Custom</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={responseBadge}>
                            {row.response.status === "submitted" ? "Submitted" : "Missing"}
                          </Badge>
                          <div className="text-xs text-app-muted mt-1">
                            {row.response.submitted_at ? formatDate(row.response.submitted_at) : "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={reviewBadge}>
                            {row.review.reviewed_at ? "Reviewed" : "Unreviewed"}
                          </Badge>
                          <div className="text-xs text-app-muted mt-1">
                            {row.review.reviewed_at ? formatDate(row.review.reviewed_at) : "—"}
                          </div>
                          {row.review.reviewed_by_display ? (
                            <div className="text-xs text-app-muted">
                              {row.review.reviewed_by_display}
                            </div>
                          ) : row.review.reviewed_by_role ? (
                            <div className="text-xs text-app-muted">
                              Role: {row.review.reviewed_by_role}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <span title={reason ?? undefined}>
                            <Badge variant={aerBadge}>
                              {row.aer_included ? "Yes" : "No"}
                            </Badge>
                          </span>
                          {!row.aer_included && reason && (
                            <div className="text-xs text-app-muted mt-1">Reason: {reason}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <Link href={assignmentLink} className="text-xs text-app-accent hover:underline">
                              View Assignment
                            </Link>
                            {row.response.response_id && (
                              <Link href={responseLink} className="text-xs text-app-accent hover:underline">
                                View Response
                              </Link>
                            )}
                            {canGenerateAER && (
                              <button
                                type="button"
                                className="text-xs text-app-accent hover:underline"
                                onClick={generateAer}
                              >
                                Generate AER
                              </button>
                            )}
                            {canGenerateAER && (
                              <button
                                type="button"
                                className="text-xs text-app-accent hover:underline"
                                onClick={downloadPdf}
                              >
                                Download PDF
                              </button>
                            )}
                            {canIssueExternal && (
                              <button
                                type="button"
                                className="text-xs text-app-accent hover:underline"
                                onClick={issueExternalToken}
                              >
                                Issue External Token
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-app-muted">Needs review</div>
                <div className="text-2xl font-semibold">{needsReviewCount}</div>
              </div>
              <div className="text-sm text-app-muted">
                {trace?.meta?.period.start} → {trace?.meta?.period.end}
              </div>
              <div className="flex items-center gap-2">
                {canGenerateAER && (
                  <Button variant="secondary" onClick={downloadPdf}>
                    Download PDF
                  </Button>
                )}
                {canGenerateAER && (
                  <Button variant="primary" onClick={downloadBundle}>
                    Download AER Bundle (.zip)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
