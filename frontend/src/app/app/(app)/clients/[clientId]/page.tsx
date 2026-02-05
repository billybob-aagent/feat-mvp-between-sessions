"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiDownload, apiFetch, clinicianListAssignments } from "@/lib/api";
import { clinicDashboard, clinicGetClient, clinicListCheckins, clinicListResponses } from "@/lib/clinic-api";
import type { ClinicCheckinListItem, ClinicClientDetail } from "@/lib/types/clinic";
import { useMe } from "@/lib/use-me";
import { useLocalStorageState } from "@/lib/use-local-storage";
import { PageLayout } from "@/components/page/PageLayout";
import { EmptyState } from "@/components/page/EmptyState";
import { ErrorState } from "@/components/page/ErrorState";
import { TableSkeleton } from "@/components/page/Skeletons";
import { NotAvailableBanner } from "@/components/page/NotAvailableBanner";
import { Tabs } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";

type TherapistClient = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
};

type AssignmentRow = {
  id: string;
  title: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  responseCount?: number | null;
  librarySource?: {
    itemId: string;
    version: number | null;
    title: string | null;
    slug: string | null;
    contentType: string | null;
  } | null;
};

type ResponseRow = {
  id: string;
  assignmentId: string;
  assignmentTitle: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
  flaggedAt: string | null;
};

type AerReport = {
  meta: {
    period: { start: string; end: string };
    report_id: string;
  };
  prescribed_interventions?: AerPrescribedIntervention[];
  adherence_timeline?: unknown[];
  not_available?: string[];
};

type AerLibrarySource = {
  item_id?: string;
  version_id?: string | null;
  version?: number | null;
  title?: string | null;
  slug?: string | null;
} | null;

type AerPrescribedIntervention = {
  assignment_id?: string;
  title?: string | null;
  library_source?: AerLibrarySource;
  completed_at?: string | null;
  reviewed_at?: string | null;
  evidence_refs?: string[];
};

type EscalationRow = {
  id: string;
  clientId: string;
  reason: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  resolvedAt: string | null;
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
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function ClientProfilePage() {
  const params = useParams();
  const clientId = String(params.clientId);
  const router = useRouter();
  const { me } = useMe();
  const role = me?.role ?? null;
  const isClinicAdmin = role === "CLINIC_ADMIN";
  const isTherapist = role === "therapist";

  const [clinicId, setClinicId] = useLocalStorageState<string>(
    "bs.clinic.id",
    "",
  );

  const [detail, setDetail] = useState<ClinicClientDetail | TherapistClient | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("overview");

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [checkins, setCheckins] = useState<ClinicCheckinListItem[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  const [selectedResponseIds, setSelectedResponseIds] = useState<string[]>([]);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const [aerStart, setAerStart] = useLocalStorageState("bs.aer.start", daysAgoIso(30));
  const [aerEnd, setAerEnd] = useLocalStorageState("bs.aer.end", todayIso());
  const [aerReport, setAerReport] = useState<AerReport | null>(null);
  const [aerLoading, setAerLoading] = useState(false);
  const [aerError, setAerError] = useState<string | null>(null);

  const [externalLink, setExternalLink] = useState<string | null>(null);
  const [externalStatus, setExternalStatus] = useState<string | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDescription, setAssignDescription] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignStatus, setAssignStatus] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinNote, setCheckinNote] = useState("");
  const [checkinDueDate, setCheckinDueDate] = useState("");
  const [checkinStatus, setCheckinStatus] = useState<string | null>(null);

  const [escalations, setEscalations] = useState<EscalationRow[]>([]);
  const [escalationLoading, setEscalationLoading] = useState(false);
  const [escalationError, setEscalationError] = useState<string | null>(null);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState("MISSED_INTERVENTIONS");
  const [escalateNote, setEscalateNote] = useState("");

  const needsReviewCount = useMemo(() => {
    return responses.filter((row) => !row.reviewedAt).length;
  }, [responses]);

  const overdueCheckinCount = useMemo(() => {
    if (!("lastCheckinAt" in (detail ?? {}))) return 0;
    const last = (detail as ClinicClientDetail).lastCheckinAt;
    if (!last) return 1;
    const lastDate = new Date(last);
    const diff = Date.now() - lastDate.getTime();
    return diff > 7 * 24 * 60 * 60 * 1000 ? 1 : 0;
  }, [detail]);

  const pendingEscalations = useMemo(
    () => escalations.filter((row) => row.status === "OPEN").length,
    [escalations],
  );
  const allResponsesSelected =
    selectedResponseIds.length > 0 && selectedResponseIds.length === responses.length;

  const loadClinicId = useCallback(async () => {
    if (!isClinicAdmin) return;
    try {
      const dashboard = await clinicDashboard();
      if (dashboard?.clinic?.id) {
        setClinicId(dashboard.clinic.id);
      }
    } catch {
      // ignore
    }
  }, [isClinicAdmin, setClinicId]);

  const loadDetail = useCallback(async () => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      if (isClinicAdmin) {
        const res = await clinicGetClient(clientId);
        setDetail(res);
        return;
      }
      if (isTherapist) {
        const res = (await apiFetch("/clients/mine")) as TherapistClient[];
        const match = Array.isArray(res) ? res.find((row) => row.id === clientId) : null;
        if (!match) throw new Error("Client not found.");
        setDetail(match);
        return;
      }
      setDetail(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  }, [clientId, isClinicAdmin, isTherapist]);

  const loadAssignments = useCallback(async () => {
    setTabLoading(true);
    setTabError(null);
    try {
      if (!isClinicAdmin && !isTherapist) {
        setAssignments([]);
        return;
      }

      const res = (await clinicianListAssignments({
        clientId,
        status: "all",
        limit: 200,
      })) as { items: AssignmentRow[] };
      const rows = Array.isArray(res?.items) ? res.items : [];
      setAssignments(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTabError(msg);
      setAssignments([]);
    } finally {
      setTabLoading(false);
    }
  }, [clientId, isClinicAdmin, isTherapist]);

  const loadResponses = useCallback(async () => {
    setTabLoading(true);
    setTabError(null);
    try {
      if (isClinicAdmin) {
        const res = await clinicListResponses({ clientId, reviewed: "all", flagged: "all" });
        const rows =
          res.items?.map((row) => ({
            id: row.id,
            assignmentId: row.assignmentId,
            assignmentTitle: row.assignmentTitle ?? null,
            createdAt: row.createdAt,
            reviewedAt: row.reviewedAt,
            flaggedAt: row.flaggedAt,
          })) ?? [];
        setResponses(rows);
        return;
      }
      if (isTherapist) {
        const params = new URLSearchParams();
        params.set("clientId", clientId);
        params.set("limit", "50");
        const assignmentRes = (await apiFetch(
          `/assignments/therapist?${params.toString()}`,
        )) as { items: Array<{ id: string; title: string | null }> };

        const collected: ResponseRow[] = [];
        for (const assignment of assignmentRes.items ?? []) {
          const res = (await apiFetch(
            `/responses/therapist/assignment/${encodeURIComponent(assignment.id)}?clientId=${encodeURIComponent(
              clientId,
            )}&limit=50`,
          )) as { items: Array<{ id: string; assignmentId: string; createdAt: string | null; reviewedAt: string | null; flaggedAt: string | null; }> };

          for (const row of res.items ?? []) {
            collected.push({
              id: row.id,
              assignmentId: row.assignmentId,
              assignmentTitle: assignment.title ?? "Assignment",
              createdAt: row.createdAt,
              reviewedAt: row.reviewedAt,
              flaggedAt: row.flaggedAt,
            });
          }
        }
        setResponses(collected);
        return;
      }
      setResponses([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTabError(msg);
      setResponses([]);
    } finally {
      setTabLoading(false);
    }
  }, [clientId, isClinicAdmin, isTherapist]);

  function toggleResponseSelection(id: string) {
    setSelectedResponseIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }

  async function bulkMarkReviewed() {
    if (!isTherapist || reviewing || selectedResponseIds.length === 0) return;
    setReviewing(true);
    setReviewStatus(null);
    try {
      for (const responseId of selectedResponseIds) {
        await apiFetch(`/responses/therapist/${encodeURIComponent(responseId)}/review`, {
          method: "PATCH",
          json: { therapistNote: reviewNote.trim() || undefined },
        });
      }
      setReviewDialogOpen(false);
      setReviewNote("");
      setSelectedResponseIds([]);
      await loadResponses();
      setReviewStatus("Responses marked reviewed.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setReviewStatus(msg);
    } finally {
      setReviewing(false);
    }
  }

  const loadCheckins = useCallback(async () => {
    setTabLoading(true);
    setTabError(null);
    try {
      if (isClinicAdmin) {
        const res = await clinicListCheckins({ clientId });
        setCheckins(res.items ?? []);
        return;
      }
      setCheckins([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTabError(msg);
      setCheckins([]);
    } finally {
      setTabLoading(false);
    }
  }, [clientId, isClinicAdmin]);

  const loadEscalations = useCallback(async () => {
    if (!clinicId) return;
    setEscalationLoading(true);
    setEscalationError(null);
    try {
      const params = new URLSearchParams();
      params.set("status", "ALL");
      params.set("limit", "200");
      const res = (await apiFetch(
        `/supervisor-actions/escalations/${encodeURIComponent(clinicId)}?${params.toString()}`,
      )) as { rows: EscalationRow[] };
      const filtered = (res?.rows || []).filter((row) => row.clientId === clientId);
      setEscalations(filtered);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEscalationError(msg);
      setEscalations([]);
    } finally {
      setEscalationLoading(false);
    }
  }, [clinicId, clientId]);

  async function loadAer() {
    setAerLoading(true);
    setAerError(null);
    try {
      if (!clinicId) throw new Error("Set clinic context to load AER.");
      const res = (await apiFetch(
        `/reports/aer/${encodeURIComponent(clinicId)}/${encodeURIComponent(
          clientId,
        )}?start=${encodeURIComponent(aerStart)}&end=${encodeURIComponent(aerEnd)}`,
      )) as AerReport;
      setAerReport(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAerError(msg);
      setAerReport(null);
    } finally {
      setAerLoading(false);
    }
  }

  async function downloadAerPdf() {
    if (!clinicId) return;
    const qs = new URLSearchParams({ start: aerStart, end: aerEnd });
    const { blob, filename } = await apiDownload(
      `/reports/aer/${encodeURIComponent(clinicId)}/${encodeURIComponent(
        clientId,
      )}.pdf?${qs.toString()}`,
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || `AER_${clientId}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function createExternalLink() {
    if (!clinicId) return;
    setExternalStatus(null);
    setExternalLink(null);
    try {
      const res = (await apiFetch("/external-access/aer", {
        method: "POST",
        json: {
          clinicId,
          clientId,
          start: aerStart,
          end: aerEnd,
          program: null,
          format: "pdf",
          ttlMinutes: 60,
        },
      })) as { url: string };
      setExternalLink(res.url ?? null);
      setExternalStatus("External link issued.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setExternalStatus(msg);
    }
  }

  async function submitAssignment() {
    if (!isTherapist || assigning) return;
    setAssigning(true);
    setAssignStatus(null);
    try {
      const dueDateIso =
        assignDueDate.trim().length > 0
          ? new Date(`${assignDueDate}T00:00:00`).toISOString()
          : undefined;
      await apiFetch("/assignments", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          title: assignTitle.trim(),
          description: assignDescription.trim() || undefined,
          dueDate: dueDateIso,
        }),
      });
      setAssignOpen(false);
      setAssignTitle("");
      setAssignDescription("");
      setAssignDueDate("");
      setAssignStatus("Assignment created.");
      if (activeTab === "assignments") loadAssignments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAssignStatus(msg);
    } finally {
      setAssigning(false);
    }
  }

  async function submitCheckinRequest() {
    if (!isTherapist || assigning) return;
    setAssigning(true);
    setCheckinStatus(null);
    try {
      const dueDateIso =
        checkinDueDate.trim().length > 0
          ? new Date(`${checkinDueDate}T00:00:00`).toISOString()
          : undefined;
      await apiFetch("/assignments", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          title: "Check-in request",
          description: checkinNote.trim() || "Please complete your between-session check-in.",
          dueDate: dueDateIso,
        }),
      });
      setCheckinOpen(false);
      setCheckinNote("");
      setCheckinDueDate("");
      setCheckinStatus("Check-in request sent.");
      if (activeTab === "assignments") loadAssignments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCheckinStatus(msg);
    } finally {
      setAssigning(false);
    }
  }

  async function submitEscalation() {
    if (!clinicId) return;
    try {
      await apiFetch("/supervisor-actions/escalate", {
        method: "POST",
        json: {
          clinicId,
          clientId,
          periodStart: aerStart,
          periodEnd: aerEnd,
          reason: escalateReason,
          note: escalateNote.trim() || null,
          assignToTherapistId: null,
        },
      });
      setEscalateOpen(false);
      setEscalateNote("");
      await loadEscalations();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEscalationError(msg);
    }
  }

  useEffect(() => {
    loadClinicId();
  }, [loadClinicId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (activeTab === "assignments") loadAssignments();
    if (activeTab === "responses") loadResponses();
    if (activeTab === "checkins") loadCheckins();
    if (activeTab === "escalations") loadEscalations();
  }, [activeTab, loadAssignments, loadResponses, loadCheckins, loadEscalations]);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "assignments", label: "Assignments" },
    { id: "checkins", label: "Check-ins" },
    { id: "responses", label: "Responses / Reviews" },
    { id: "aer", label: "AER" },
    { id: "escalations", label: "Escalations" },
  ];

  const displayName = detail?.fullName ?? "Client";

  return (
    <PageLayout
      title={displayName}
      subtitle="Client engagement, adherence evidence, and escalation actions."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => router.push("/app/clients")}>
            Back to clients
          </Button>
          {isTherapist && (
            <>
              <Button variant="secondary" onClick={() => setAssignOpen(true)}>
                Assign
              </Button>
              <Button variant="secondary" onClick={() => setCheckinOpen(true)}>
                Request check-in
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => setEscalateOpen(true)}>
            Escalate
          </Button>
          <Button variant="primary" onClick={() => setActiveTab("aer")}>
            Generate AER
          </Button>
        </div>
      }
    >

      {detailError && (
        <ErrorState title="Unable to load client" message={detailError} />
      )}
      {detailLoading && <TableSkeleton rows={4} />}

      {!detailLoading && detail && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm text-app-muted">Client profile</div>
              <div className="text-h2">{displayName}</div>
              <div className="text-sm text-app-muted">{detail.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="neutral">Client ID</Badge>
              <span className="text-xs text-app-muted">{detail.id}</span>
            </div>
          </div>

          <Tabs items={tabs} value={activeTab} onChange={setActiveTab} />

          {activeTab === "overview" && (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>AER snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-app-muted">
                  <div>Period: {aerStart} → {aerEnd}</div>
                  <div>Assignments logged: {aerReport?.prescribed_interventions?.length ?? "—"}</div>
                  <div>Events logged: {aerReport?.adherence_timeline?.length ?? "—"}</div>
                  <Button variant="secondary" onClick={() => setActiveTab("aer")}>
                    Open AER controls
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Needs review</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-semibold">{needsReviewCount}</div>
                  <div className="text-sm text-app-muted">
                    Responses awaiting clinician review.
                  </div>
                  <Button variant="secondary" onClick={() => setActiveTab("responses")}>
                    Review responses
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Overdue check-ins</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-semibold">{overdueCheckinCount}</div>
                  <div className="text-sm text-app-muted">
                    Check-ins requiring attention.
                  </div>
                  <Button variant="secondary" onClick={() => setActiveTab("checkins")}>
                    Review check-ins
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Escalations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-semibold">{pendingEscalations}</div>
                  <div className="text-sm text-app-muted">
                    Open escalations for this client.
                  </div>
                  <Button variant="secondary" onClick={() => setActiveTab("escalations")}>
                    View escalations
                  </Button>
                </CardContent>
              </Card>

              <Card className="xl:col-span-4">
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-app-muted">Assignments</div>
                    <div className="text-2xl font-semibold">
                      {"assignmentCount" in detail ? detail.assignmentCount : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-app-muted">Responses</div>
                    <div className="text-2xl font-semibold">
                      {"responseCount" in detail ? detail.responseCount : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-app-muted">Overdue check-ins</div>
                    <div className="text-2xl font-semibold">{overdueCheckinCount}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "assignments" && (
            <div className="space-y-4">
              {tabError && <ErrorState title="Unable to load assignments" message={tabError} />}
              {tabLoading && <TableSkeleton rows={5} />}
              {!tabLoading && assignments.length === 0 && (
                <EmptyState
                  title="No assignments yet"
                  description="Assignments and check-ins will appear here once issued."
                />
              )}
              {!tabLoading && assignments.length > 0 && (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Responses</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-medium">{row.title ?? "Assignment"}</div>
                                {row.librarySource ? <Badge variant="neutral">Library</Badge> : null}
                              </div>
                              {row.librarySource ? (
                                <div className="text-xs text-app-muted">
                                  Source:{" "}
                                  <Link
                                    href={`/app/library/items/${encodeURIComponent(row.librarySource.itemId)}`}
                                    className="text-app-accent hover:underline"
                                  >
                                    {row.librarySource.title ?? row.librarySource.slug ?? row.librarySource.itemId}
                                  </Link>
                                  {row.librarySource.version ? ` v${row.librarySource.version}` : ""}
                                </div>
                              ) : null}
                              <div className="text-xs text-app-muted">{row.id}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.status === "published" ? "success" : "warning"}>
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-app-muted">
                              {formatDate(row.dueDate)}
                            </TableCell>
                            <TableCell>{row.responseCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === "checkins" && (
            <div className="space-y-4">
              {tabError && <ErrorState title="Unable to load check-ins" message={tabError} />}
              {tabLoading && <TableSkeleton rows={5} />}
              {!tabLoading && checkins.length === 0 && (
                <EmptyState
                  title="No check-ins yet"
                  description="Check-in submissions will appear here."
                />
              )}
              {!tabLoading && checkins.length > 0 && (
                <div className="space-y-3">
                  {checkins.map((row) => (
                    <Card key={row.id}>
                      <CardContent className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-xs text-app-muted">Submitted</div>
                          <div className="text-sm font-medium">{formatDate(row.createdAt)}</div>
                          <div className="text-xs text-app-muted">Therapist</div>
                          <div className="text-sm">{row.therapistName ?? row.therapistId}</div>
                        </div>
                        <div className="rounded-lg border border-app-border bg-app-surface-2 px-4 py-3 text-center">
                          <div className="text-xs text-app-muted">Mood</div>
                          <div className="text-2xl font-semibold text-app-text">{row.mood}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "responses" && (
            <div className="space-y-4">
              {tabError && <ErrorState title="Unable to load responses" message={tabError} />}
              {tabLoading && <TableSkeleton rows={5} />}
              {!tabLoading && responses.length === 0 && (
                <EmptyState
                  title="No responses yet"
                  description="Responses will appear once assignments are submitted."
                />
              )}
              {!tabLoading && responses.length > 0 && (
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-app-muted">
                      Selected{" "}
                      <span className="font-medium text-app-text">{selectedResponseIds.length}</span>{" "}
                      of {responses.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={!isTherapist || selectedResponseIds.length === 0}
                        onClick={() => setReviewDialogOpen(true)}
                      >
                        Bulk mark reviewed
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {!tabLoading && responses.length > 0 && (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <input
                              type="checkbox"
                              aria-label="Select all responses"
                              checked={allResponsesSelected}
                              onChange={() =>
                                setSelectedResponseIds(
                                  allResponsesSelected ? [] : responses.map((row) => row.id),
                                )
                              }
                            />
                          </TableHead>
                          <TableHead>Assignment</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Flags</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {responses.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                aria-label={`Select response ${row.id}`}
                                checked={selectedResponseIds.includes(row.id)}
                                onChange={() => toggleResponseSelection(row.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {row.assignmentTitle ?? row.assignmentId}
                              </div>
                              <div className="text-xs text-app-muted">{row.id}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.reviewedAt ? "success" : "warning"}>
                                {row.reviewedAt ? "Reviewed" : "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-app-muted">
                              {formatDate(row.createdAt)}
                            </TableCell>
                            <TableCell className="text-xs text-app-muted">
                              {row.flaggedAt ? "Flagged" : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => router.push("/app/ai/adherence-assist")}
                              >
                                Draft feedback
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === "aer" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="grid gap-4 md:grid-cols-4">
                  <div>
                    <label className="text-label text-app-muted">Start</label>
                    <Input
                      type="date"
                      value={aerStart}
                      onChange={(event) => setAerStart(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-label text-app-muted">End</label>
                    <Input
                      type="date"
                      value={aerEnd}
                      onChange={(event) => setAerEnd(event.target.value)}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button variant="primary" onClick={loadAer} disabled={aerLoading}>
                      {aerLoading ? "Generating..." : "View AER JSON"}
                    </Button>
                    <Button variant="secondary" onClick={downloadAerPdf}>
                      Download PDF
                    </Button>
                  </div>
                  <div className="flex items-end justify-end">
                    <Button variant="ghost" onClick={createExternalLink} disabled={!isClinicAdmin}>
                      Copy external link
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {externalStatus && (
                <div className="text-sm text-app-muted">{externalStatus}</div>
              )}
              {externalLink && (
                <Card>
                  <CardContent className="text-sm">
                    <div className="text-xs text-app-muted mb-1">External link (tokened)</div>
                    <div className="break-all">{externalLink}</div>
                  </CardContent>
                </Card>
              )}

              {aerError && <ErrorState title="AER error" message={aerError} />}
              {aerReport?.not_available?.length ? (
                <NotAvailableBanner items={aerReport.not_available} />
              ) : null}

              {aerReport && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>AER JSON summary</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-app-muted space-y-2">
                      <div>Report ID: {aerReport.meta.report_id}</div>
                      <div>
                        Period: {aerReport.meta.period.start} → {aerReport.meta.period.end}
                      </div>
                      <div>
                        Prescribed interventions: {aerReport.prescribed_interventions?.length ?? 0}
                      </div>
                      <div>
                        Adherence events: {aerReport.adherence_timeline?.length ?? 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Prescribed interventions</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {!aerReport.prescribed_interventions?.length ? (
                        <div className="p-6">
                          <EmptyState
                            title="No interventions in period"
                            description="If you expect assignments here, verify the reporting period and that assignments exist for this client."
                          />
                        </div>
                      ) : (
                        <div className="overflow-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-app-surface-1 text-xs text-app-muted">
                              <tr className="border-b border-app-border">
                                <th className="px-4 py-3 text-left font-medium">Title</th>
                                <th className="px-4 py-3 text-left font-medium">Source</th>
                                <th className="px-4 py-3 text-left font-medium">Completed</th>
                                <th className="px-4 py-3 text-left font-medium">Reviewed</th>
                              </tr>
                            </thead>
                            <tbody className="text-app-text">
                              {aerReport.prescribed_interventions.map((row, idx) => (
                                <tr
                                  key={row.assignment_id ?? `row-${idx}`}
                                  className="border-b border-app-border hover:bg-app-surface-2"
                                >
                                  <td className="px-4 py-3 align-top">
                                    <div className="font-medium">
                                      {row.title ?? row.assignment_id ?? "Assignment"}
                                    </div>
                                    {row.assignment_id ? (
                                      <div className="mt-1 text-xs text-app-muted">
                                        {row.assignment_id}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="px-4 py-3 align-top text-app-muted">
                                    {row.library_source?.item_id ? (
                                      <div>
                                        <div className="text-app-text">
                                          {row.library_source.title ??
                                            row.library_source.slug ??
                                            row.library_source.item_id}
                                          {row.library_source.version
                                            ? ` v${row.library_source.version}`
                                            : ""}
                                        </div>
                                      </div>
                                    ) : (
                                      <span>-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 align-top text-app-muted">
                                    {row.completed_at ?? "-"}
                                  </td>
                                  <td className="px-4 py-3 align-top text-app-muted">
                                    {row.reviewed_at ?? "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {activeTab === "escalations" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-h3">Escalations</div>
                  <div className="text-sm text-app-muted">
                    Supervisor actions and SLA status.
                  </div>
                </div>
                <Button variant="primary" onClick={() => setEscalateOpen(true)}>
                  Create escalation
                </Button>
              </div>

              {escalationError && (
                <ErrorState title="Escalations error" message={escalationError} />
              )}
              {escalationLoading && <TableSkeleton rows={4} />}

              {!escalationLoading && escalations.length === 0 && (
                <EmptyState
                  title="No escalations"
                  description="Create an escalation if this client needs supervisor attention."
                />
              )}

              {!escalationLoading && escalations.length > 0 && (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reason</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Resolved</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {escalations.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.reason}</TableCell>
                            <TableCell>
                              <Badge variant={row.status === "OPEN" ? "warning" : "success"}>
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-app-muted">
                              {formatDate(row.createdAt)}
                            </TableCell>
                            <TableCell className="text-xs text-app-muted">
                              {formatDate(row.resolvedAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign new work"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitAssignment}
              disabled={!isTherapist || assigning || !assignTitle.trim()}
            >
              {assigning ? "Assigning..." : "Assign"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-label text-app-muted">Title</label>
            <Input
              value={assignTitle}
              onChange={(event) => setAssignTitle(event.target.value)}
              placeholder="Assignment title"
            />
          </div>
          <div>
            <label className="text-label text-app-muted">Description</label>
            <textarea
              className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft"
              rows={4}
              value={assignDescription}
              onChange={(event) => setAssignDescription(event.target.value)}
              placeholder="Instructions for the client"
            />
          </div>
          <div>
            <label className="text-label text-app-muted">Due date (optional)</label>
            <Input
              type="date"
              value={assignDueDate}
              onChange={(event) => setAssignDueDate(event.target.value)}
            />
          </div>
          {assignStatus && (
            <p className="text-xs text-app-muted whitespace-pre-wrap">{assignStatus}</p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        title="Request check-in"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setCheckinOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitCheckinRequest}
              disabled={!isTherapist || assigning}
            >
              {assigning ? "Sending..." : "Send request"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-label text-app-muted">Message</label>
            <textarea
              className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft"
              rows={4}
              value={checkinNote}
              onChange={(event) => setCheckinNote(event.target.value)}
              placeholder="Ask the client to complete their check-in"
            />
          </div>
          <div>
            <label className="text-label text-app-muted">Due date (optional)</label>
            <Input
              type="date"
              value={checkinDueDate}
              onChange={(event) => setCheckinDueDate(event.target.value)}
            />
          </div>
          {checkinStatus && (
            <p className="text-xs text-app-muted whitespace-pre-wrap">{checkinStatus}</p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        title="Create escalation"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setEscalateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitEscalation} disabled={!clinicId}>
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-label text-app-muted">Reason</label>
            <Select value={escalateReason} onChange={(event) => setEscalateReason(event.target.value)}>
              <option value="MISSED_INTERVENTIONS">Missed interventions</option>
              <option value="LOW_COMPLETION">Low completion</option>
              <option value="NO_ACTIVITY">No activity</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <div>
            <label className="text-label text-app-muted">Note (optional)</label>
            <textarea
              className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft"
              rows={4}
              value={escalateNote}
              onChange={(event) => setEscalateNote(event.target.value)}
              placeholder="Explain why this needs supervisor attention"
            />
          </div>
          {!clinicId && (
            <p className="text-xs text-app-danger">
              Clinic context required to create an escalation.
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        title="Bulk mark reviewed"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!isTherapist || reviewing || selectedResponseIds.length === 0}
              onClick={bulkMarkReviewed}
            >
              {reviewing ? "Updating..." : "Mark reviewed"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-app-muted">
            Add an optional internal note that will be attached to each reviewed response.
          </p>
          <div>
            <label className="text-label text-app-muted">Therapist note (optional)</label>
            <textarea
              className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft"
              rows={4}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
            />
          </div>
          {reviewStatus && (
            <p className="text-xs text-app-muted whitespace-pre-wrap">{reviewStatus}</p>
          )}
        </div>
      </Dialog>
    </PageLayout>
  );
}
