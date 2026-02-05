"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMe } from "@/lib/use-me";
import {
  apiFetch,
  createAssignmentFromLibrary,
  libraryArchiveItem,
  libraryApproveItem,
  libraryItem,
  libraryPublishItem,
  libraryRejectItem,
  libraryStartReview,
  librarySubmitItem,
  libraryUpdateItem,
} from "@/lib/api";
import { clinicListClients } from "@/lib/clinic-api";
import { useLocalStorageState } from "@/lib/use-local-storage";
import type { LibraryItemDetail } from "@/lib/types/library";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { EmptyState } from "@/components/page/EmptyState";
import { ErrorState } from "@/components/page/ErrorState";
import { TableSkeleton } from "@/components/page/Skeletons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import { MetadataEditor } from "@/components/library/MetadataEditor";
import { SectionsEditor } from "@/components/library/SectionsEditor";

type AssignableClient = { id: string; fullName: string; email: string };

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

function safeParseObject(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

function safeParseSections(json: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(json || "[]");
    if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
    return [];
  } catch {
    return [];
  }
}

function sectionTitle(section: Record<string, unknown>) {
  const t = section.title;
  if (typeof t === "string" && t.trim()) return t;
  const p = section.headingPath;
  if (typeof p === "string" && p.trim()) return p;
  return "Section";
}

function sectionText(section: Record<string, unknown>) {
  const t = section.text;
  if (typeof t === "string") return t;
  return "";
}

type Audience = "clinician" | "client";

function normalizeAudience(value: unknown): Audience {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "client") return "client";
  return "clinician";
}

function isAssessment(contentType?: string | null) {
  const ct = String(contentType ?? "").toLowerCase();
  return ct.includes("assessment");
}

export default function LibraryItemDetailPage() {
  const params = useParams();
  const itemId = String(params.itemId);

  const { me } = useMe();
  const role = me?.role ?? null;
  const isAdmin = role === "admin";
  const isClient = role === "client";
  const canEdit = role === "therapist" || role === "CLINIC_ADMIN" || role === "admin";
  const canGovern = role === "admin" || role === "CLINIC_ADMIN";
  const canSubmit = role === "therapist" || role === "CLINIC_ADMIN";
  const canAssign = role === "therapist" || role === "CLINIC_ADMIN" || role === "admin";
  const [audienceView, setAudienceView] = useState<Audience>("clinician");

  useEffect(() => {
    if (isClient) setAudienceView("client");
  }, [isClient]);

  const [clinicId, setClinicId] = useLocalStorageState("bs.library.clinicId", "");
  const clinicIdForRequest = useMemo(() => (isAdmin ? clinicId.trim() : null), [clinicId, isAdmin]);

  const [item, setItem] = useState<LibraryItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ title: string; variant?: "success" | "danger" } | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editContentType, setEditContentType] = useState("");
  const [editMetadataJson, setEditMetadataJson] = useState("");
  const [editSectionsJson, setEditSectionsJson] = useState("");
  const [editChangeSummary, setEditChangeSummary] = useState("Edited via Library UI");
  const [saving, setSaving] = useState(false);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishSummary, setPublishSummary] = useState("Publish via Library UI");
  const [publishing, setPublishing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [startingReview, setStartingReview] = useState(false);
  const [approving, setApproving] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignClients, setAssignClients] = useState<AssignableClient[]>([]);
  const [assignClientId, setAssignClientId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await libraryItem(itemId, clinicIdForRequest)) as LibraryItemDetail;
      setItem(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [clinicIdForRequest, itemId]);

  useEffect(() => {
    if (isAdmin && !clinicIdForRequest) {
      setLoading(false);
      return;
    }
    load();
  }, [isAdmin, clinicIdForRequest, load]);

  function openEdit() {
    if (!item) return;
    setEditTitle(item.title);
    setEditSlug(item.slug);
    setEditContentType(item.contentType);
    setEditMetadataJson(safeJson(item.metadata ?? {}));
    setEditSectionsJson(safeJson(item.sections ?? []));
    setEditChangeSummary("Edited via Library UI");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!canEdit || !item || saving) return;
    setSaving(true);
    try {
      const metadata = JSON.parse(editMetadataJson);
      const sections = JSON.parse(editSectionsJson);
      if (!editChangeSummary.trim()) {
        throw new Error("Change summary is required.");
      }
      await libraryUpdateItem(item.id, {
        title: editTitle.trim(),
        slug: editSlug.trim(),
        contentType: editContentType.trim(),
        metadata,
        sections,
        changeSummary: editChangeSummary.trim(),
      });
      setToast({ title: "Item updated", variant: "success" });
      setEditOpen(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ title: msg, variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!canGovern || !item || publishing) return;
    if (item.status !== "APPROVED") {
      setToast({ title: "Item must be approved before publishing", variant: "danger" });
      return;
    }
    setPublishing(true);
    try {
      if (!publishSummary.trim()) throw new Error("Change summary is required.");
      await libraryPublishItem(item.id, { changeSummary: publishSummary.trim() || "Published" });
      setToast({ title: "Item published", variant: "success" });
      setPublishOpen(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ title: msg, variant: "danger" });
    } finally {
      setPublishing(false);
    }
  }

  async function archive() {
    if (!canGovern || !item || archiving) return;
    setArchiving(true);
    try {
      await libraryArchiveItem(item.id);
      setToast({ title: "Item archived", variant: "success" });
      setArchiveOpen(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ title: msg, variant: "danger" });
    } finally {
      setArchiving(false);
    }
  }

  async function submit() {
    if (!canSubmit || !item || submitting) return;
    if (item.status !== "DRAFT") {
      setToast({ title: "Only draft items can be submitted", variant: "danger" });
      return;
    }
    setSubmitting(true);
    try {
      await librarySubmitItem(item.id);
      setToast({ title: "Item submitted", variant: "success" });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ title: msg, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  async function startReview() {
    if (!canGovern || !item || startingReview) return;
    if (item.status !== "SUBMITTED") {
      setToast({ title: "Item must be submitted to start review", variant: "danger" });
      return;
    }
    setStartingReview(true);
    try {
      await libraryStartReview(item.id);
      setToast({ title: "Review started", variant: "success" });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ title: msg, variant: "danger" });
    } finally {
      setStartingReview(false);
    }
  }

  async function approve() {
    if (!canGovern || !item || approving) return;
    if (item.status !== "UNDER_REVIEW") {
      setToast({ title: "Item must be under review to approve", variant: "danger" });
      return;
    }
    setApproving(true);
    try {
      await libraryApproveItem(item.id);
      setToast({ title: "Item approved", variant: "success" });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ title: msg, variant: "danger" });
    } finally {
      setApproving(false);
    }
  }

  function openReject() {
    setRejectReason("");
    setRejectOpen(true);
  }

  async function reject() {
    if (!canGovern || !item || rejecting) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setToast({ title: "Reject reason is required", variant: "danger" });
      return;
    }
    setRejecting(true);
    try {
      await libraryRejectItem(item.id, { reason });
      setToast({ title: "Item rejected", variant: "success" });
      setRejectOpen(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ title: msg, variant: "danger" });
    } finally {
      setRejecting(false);
    }
  }

  const loadAssignableClients = useCallback(async () => {
    setAssignError(null);
    try {
      if (role === "therapist") {
        const res = (await apiFetch("/clients/mine")) as AssignableClient[];
        setAssignClients(Array.isArray(res) ? res : []);
        return;
      }
      if (role === "CLINIC_ADMIN") {
        const res = await clinicListClients({ q: undefined, limit: 100 });
        const rows = (res.items ?? []).map((c) => ({ id: c.id, fullName: c.fullName, email: c.email }));
        setAssignClients(rows);
        return;
      }
      setAssignClients([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAssignError(msg);
      setAssignClients([]);
    }
  }, [role]);

  useEffect(() => {
    if (!assignOpen) return;
    loadAssignableClients();
  }, [assignOpen, loadAssignableClients]);

  async function assignToClient() {
    if (!item || assigning) return;
    setAssigning(true);
    setAssignError(null);
    try {
      if (!assignClientId) throw new Error("Select a client.");

      await createAssignmentFromLibrary({
        ...(isAdmin ? { clinicId: clinicIdForRequest } : {}),
        clientId: assignClientId,
        libraryItemId: item.id,
        dueDate: assignDueDate.trim() || null,
        note: assignNote.trim() || null,
        program: null,
        assignmentTitleOverride: null,
      });

      setToast({ title: "Assignment assigned", variant: "success" });
      setAssignOpen(false);
      setAssignClientId("");
      setAssignDueDate("");
      setAssignNote("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAssignError(msg);
      setToast({ title: msg, variant: "danger" });
    } finally {
      setAssigning(false);
    }
  }

  const statusBadge = useMemo(() => {
    if (!item) return null;
    const variant =
      item.status === "PUBLISHED" || item.status === "APPROVED"
        ? "success"
        : item.status === "ARCHIVED" || item.status === "SUBMITTED"
          ? "neutral"
          : item.status === "REJECTED"
            ? "danger"
            : "warning";
    return <Badge variant={variant}>{item.status}</Badge>;
  }, [item]);

  const visibleSections = useMemo(() => {
    const sections = Array.isArray(item?.sections) ? (item?.sections as Array<Record<string, unknown>>) : [];
    const want = isClient ? "client" : audienceView;
    return sections.filter((s) => normalizeAudience(s.audience) === want);
  }, [audienceView, isClient, item?.sections]);

  return (
    <PageLayout
      title={item?.title ?? "Library item"}
      subtitle="Item detail, versions, and publish/archive actions."
      actions={
        item ? (
          <div className="flex flex-wrap items-center gap-2">
            {canAssign && (
              <Button variant="secondary" onClick={() => setAssignOpen(true)}>
                Assign to client
              </Button>
            )}
            {canSubmit && item.status === "DRAFT" && (
              <Button variant="secondary" onClick={submit} isLoading={submitting}>
                Submit for review
              </Button>
            )}
            {canGovern && item.status === "SUBMITTED" && (
              <>
                <Button variant="secondary" onClick={startReview} isLoading={startingReview}>
                  Start review
                </Button>
                <Button variant="outline" onClick={openReject}>
                  Reject
                </Button>
              </>
            )}
            {canGovern && item.status === "UNDER_REVIEW" && (
              <>
                <Button variant="secondary" onClick={approve} isLoading={approving}>
                  Approve
                </Button>
                <Button variant="outline" onClick={openReject}>
                  Reject
                </Button>
              </>
            )}
            {canGovern && item.status === "APPROVED" && (
              <>
                <Button variant="primary" onClick={() => setPublishOpen(true)}>
                  Publish
                </Button>
                <Button variant="outline" onClick={openReject}>
                  Reject
                </Button>
              </>
            )}
            {canEdit && (item.status === "DRAFT" || item.status === "REJECTED") && (
              <Button variant="secondary" onClick={openEdit}>
                Edit
              </Button>
            )}
            {canGovern && (
              <Button variant="outline" onClick={() => setArchiveOpen(true)} disabled={item.status === "ARCHIVED"}>
                Archive
              </Button>
            )}
          </div>
        ) : undefined
      }
      filters={
        isAdmin ? (
          <FilterBar>
            <div className="min-w-[260px]">
              <label className="text-label text-app-muted">Clinic ID (required for admin)</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={load} disabled={!clinicIdForRequest}>
                Reload
              </Button>
            </div>
          </FilterBar>
        ) : undefined
      }
    >
      {toast && (
        <div className="flex justify-end">
          <Toast
            title={toast.title}
            variant={toast.variant === "success" ? "success" : "danger"}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      {isAdmin && !clinicIdForRequest && (
        <Alert variant="warning" title="Clinic ID required">
          Platform admins must supply a clinicId to view library items.
        </Alert>
      )}

      {error && <ErrorState title="Unable to load item" message={error} actionLabel="Retry" onAction={load} />}
      {loading && <TableSkeleton rows={5} />}

      {!loading && !error && !item && (
        <EmptyState title="Item not found" description="The item may have been removed or you may not have access." />
      )}

      {item && (
        <div className="space-y-4">
          {isClient && (
            <Alert variant="info" title="Clinical support content">
              Clinical support content only. Not diagnosis. Your clinician guides care.
            </Alert>
          )}

          {!isClient && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-app-muted">
                  Audience view controls what content is displayed.
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={audienceView === "clinician" ? "primary" : "secondary"}
                    onClick={() => setAudienceView("clinician")}
                  >
                    Clinician view
                  </Button>
                  <Button
                    variant={audienceView === "client" ? "primary" : "secondary"}
                    onClick={() => setAudienceView("client")}
                  >
                    Client view
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isClient && isAssessment(item.contentType) && audienceView === "clinician" && (
            <Alert variant="warning" title="Assessment content guardrail">
              Screening/support tool only. Scoring and interpretation remain clinician-only.
              Do not treat this content as diagnosis or level-of-care assignment.
            </Alert>
          )}

          {!isClient && item.status === "REJECTED" && (
            <Alert variant="warning" title="Rejected">
              This item was rejected. Edit the draft to create a new version, then resubmit for review.
              {Array.isArray(item.decisions) && item.decisions.length > 0 ? (
                <div className="mt-2 text-sm text-app-muted">
                  Latest reason:{" "}
                  {(() => {
                    const latest = [...item.decisions].reverse().find((d) => d.toStatus === "REJECTED" && d.reason);
                    return latest?.reason ?? "—";
                  })()}
                </div>
              ) : null}
            </Alert>
          )}

          {isClient && item.status !== "PUBLISHED" && (
            <Alert variant="warning" title="Not published">
              Clients can only view published items.
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-app-muted">
                <div className="flex items-center gap-2">
                  {statusBadge}
                  <span className="text-xs">v{item.version}</span>
                </div>
                <div>Type: <span className="text-app-text">{item.contentType}</span></div>
                <div>Slug: <span className="text-app-text">{item.slug}</span></div>
                <div>Updated: <span className="text-app-text">{new Date(item.updatedAt).toLocaleString()}</span></div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="rounded-lg border border-app-border bg-app-surface-2 p-3 text-xs text-app-text overflow-auto">
                  {safeJson(item.metadata)}
                </pre>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {visibleSections.length > 0 ? (
                visibleSections.map((section, idx) => (
                  <details
                    key={`${idx}-${sectionTitle(section as Record<string, unknown>)}`}
                    className="rounded-lg border border-app-border bg-app-surface"
                  >
                    <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-app-text">
                      {sectionTitle(section as Record<string, unknown>)}
                    </summary>
                    <div className="px-4 pb-4 pt-2 text-sm text-app-muted whitespace-pre-wrap">
                      {sectionText(section as Record<string, unknown>) || "—"}
                    </div>
                  </details>
                ))
              ) : (
                <EmptyState
                  title="No sections for this audience"
                  description={
                    isClient
                      ? "This item has no client-safe sections."
                      : "Switch views or add sections labeled for this audience."
                  }
                />
              )}
            </CardContent>
          </Card>

          {!isClient && (
            <Card>
              <CardHeader>
                <CardTitle>Decision history</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {Array.isArray(item.decisions) && item.decisions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Transition</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.decisions.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs text-app-muted">{new Date(d.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-app-muted">{d.action}</TableCell>
                          <TableCell className="text-xs text-app-muted">
                            {d.fromStatus} → {d.toStatus}
                          </TableCell>
                          <TableCell className="text-xs text-app-muted">{d.reason ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-4 text-sm text-app-muted">No decision history found.</div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Versions (last 10)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {item.versions?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Change summary</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-sm text-app-muted">v{v.versionNumber}</TableCell>
                        <TableCell className="text-sm text-app-muted">{v.changeSummary ?? "—"}</TableCell>
                        <TableCell className="text-xs text-app-muted">{new Date(v.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 text-sm text-app-muted">No version history found.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit item"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={saveEdit}
              isLoading={saving}
              disabled={!editTitle.trim() || !editSlug.trim() || !editContentType.trim() || !editChangeSummary.trim()}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Alert variant="info">
            Saving changes creates a new version with an auditable change summary.
          </Alert>
          <div>
            <label className="text-label text-app-muted">Title</label>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-label text-app-muted">Slug</label>
            <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
          </div>
          <div>
            <label className="text-label text-app-muted">Content type</label>
            <Select value={editContentType} onChange={(e) => setEditContentType(e.target.value)}>
              <option value="Therapeutic">Therapeutic</option>
              <option value="Form">Form</option>
              <option value="Assessment">Assessment</option>
            </Select>
          </div>
          <div>
            <label className="text-label text-app-muted">Change summary</label>
            <Input value={editChangeSummary} onChange={(e) => setEditChangeSummary(e.target.value)} />
          </div>
          <div>
            <label className="text-label text-app-muted">Metadata</label>
            <MetadataEditor
              metadata={safeParseObject(editMetadataJson)}
              onChange={(next) => setEditMetadataJson(JSON.stringify(next, null, 2))}
            />
          </div>
          <div>
            <label className="text-label text-app-muted">Sections</label>
            <SectionsEditor
              sections={safeParseSections(editSectionsJson)}
              onChange={(next) => setEditSectionsJson(JSON.stringify(next, null, 2))}
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publish item"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={publish} isLoading={publishing} disabled={!publishSummary.trim()}>
              Publish
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Alert variant="warning" title="Publishing is irreversible for clients">
            After publishing, clients can access this item. Use change summaries for auditability.
          </Alert>
          <div>
            <label className="text-label text-app-muted">Change summary</label>
            <Input value={publishSummary} onChange={(e) => setPublishSummary(e.target.value)} />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive item"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setArchiveOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={archive} isLoading={archiving}>
              Archive
            </Button>
          </div>
        }
      >
        <Alert variant="warning" title="Archive confirmation">
          Archived items are hidden from clients and excluded from most browse flows.
        </Alert>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject item"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={reject} isLoading={rejecting} disabled={!rejectReason.trim()}>
              Reject
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Alert variant="warning" title="Reason required">
            Rejections are logged in the governance decision history. Provide a clear, reviewable reason.
          </Alert>
          <div>
            <label className="text-label text-app-muted">Reason</label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign to client"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={assignToClient}
              isLoading={assigning}
              disabled={!assignClientId || (isAdmin && !clinicIdForRequest)}
            >
              Assign
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Alert variant="info" title="Assignment from Library">
            This assigns the published, client-safe version of this library item. The assignment will be linked back to the library item/version for AER evidence.
          </Alert>
          {isAdmin && !clinicIdForRequest && (
            <Alert variant="warning" title="Clinic ID required">
              Platform admins must set a clinicId (top of page) before assigning.
            </Alert>
          )}
          {assignError && <Alert variant="danger" title="Unable to assign">{assignError}</Alert>}
          <div>
            <label className="text-label text-app-muted">Client</label>
            {isAdmin ? (
              <Input
                value={assignClientId}
                onChange={(e) => setAssignClientId(e.target.value)}
                placeholder="Client UUID"
              />
            ) : (
              <Select value={assignClientId} onChange={(e) => setAssignClientId(e.target.value)}>
                <option value="">Select client</option>
                {assignClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.email})
                  </option>
                ))}
              </Select>
            )}
          </div>
          <div>
            <label className="text-label text-app-muted">Due date (optional)</label>
            <Input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} />
          </div>
          <div>
            <label className="text-label text-app-muted">Note (optional)</label>
            <Textarea value={assignNote} onChange={(e) => setAssignNote(e.target.value)} rows={3} />
          </div>
        </div>
      </Dialog>
    </PageLayout>
  );
}
