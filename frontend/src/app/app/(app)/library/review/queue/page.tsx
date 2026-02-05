"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/use-me";
import {
  libraryApproveItem,
  libraryPublishItem,
  libraryRejectItem,
  libraryReviewQueue,
  libraryStartReview,
} from "@/lib/api";
import { useLocalStorageState } from "@/lib/use-local-storage";
import type { LibraryReviewQueueItem, LibraryReviewQueueResponse } from "@/lib/types/library";
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
import { Toast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type QueueStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED";

function statusBadge(status: string) {
  if (status === "APPROVED") return <Badge variant="success">APPROVED</Badge>;
  if (status === "UNDER_REVIEW") return <Badge variant="warning">UNDER_REVIEW</Badge>;
  if (status === "SUBMITTED") return <Badge variant="neutral">SUBMITTED</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

export default function LibraryReviewQueuePage() {
  const { me } = useMe();
  const role = me?.role ?? null;
  const isAdmin = role === "admin";
  const canReview = role === "admin" || role === "CLINIC_ADMIN";

  const [clinicId, setClinicId] = useLocalStorageState("bs.library.clinicId", "");
  const clinicIdForRequest = useMemo(() => (isAdmin ? clinicId.trim() : null), [clinicId, isAdmin]);

  const [status, setStatus] = useState<QueueStatus>("SUBMITTED");
  const [rows, setRows] = useState<LibraryReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; variant?: "success" | "danger" } | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectItemId, setRejectItemId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(async () => {
    if (!canReview) return;
    if (isAdmin && !clinicIdForRequest) {
      setLoading(false);
      setError("clinicId is required for admin review queue.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = (await libraryReviewQueue({ status, clinicId: clinicIdForRequest })) as LibraryReviewQueueResponse;
      setRows(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canReview, clinicIdForRequest, isAdmin, status]);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, okMessage: string) => {
      try {
        await fn();
        setToast({ title: okMessage, variant: "success" });
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setToast({ title: msg, variant: "danger" });
      }
    },
    [load],
  );

  function openReject(itemId: string) {
    setRejectItemId(itemId);
    setRejectReason("");
    setRejectOpen(true);
  }

  async function doReject() {
    if (!rejectItemId || rejecting) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setToast({ title: "Reject reason is required", variant: "danger" });
      return;
    }
    setRejecting(true);
    try {
      await libraryRejectItem(rejectItemId, { reason });
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

  if (!canReview) {
    return (
      <PageLayout
        title="Library Review Queue"
        subtitle="Review and approve submitted library items."
      >
        <Alert variant="warning" title="Not authorized">
          This page is only available to clinic admins and platform admins.
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Library Review Queue"
      subtitle="Governance workflow: submitted → under review → approved → published."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      }
      filters={
        <FilterBar>
          {isAdmin && (
            <div className="min-w-[260px]">
              <label className="text-label text-app-muted">Clinic ID (required for admin)</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
            </div>
          )}
          <div className="min-w-[220px]">
            <label className="text-label text-app-muted">Queue status</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as QueueStatus)}>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="APPROVED">APPROVED</option>
            </Select>
          </div>
        </FilterBar>
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

      <Alert variant="info" title="Publish gates">
        Forms and assessments must meet required section gates at publish time. Rejections require a reason and are logged.
      </Alert>

      {error && <ErrorState title="Unable to load review queue" message={error} actionLabel="Retry" onAction={load} />}
      {loading && <TableSkeleton rows={8} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title="No items in queue"
          description="There are no items matching the selected queue status."
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/app/library/items/${encodeURIComponent(r.id)}`}
                        className="font-medium text-app-text hover:underline"
                      >
                        {r.title}
                      </Link>
                      <div className="text-xs text-app-muted">{r.id}</div>
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-xs text-app-muted">{r.contentType}</TableCell>
                    <TableCell className="text-xs text-app-muted">
                      {r.lastDecisionAt ? new Date(r.lastDecisionAt).toLocaleString() : new Date(r.updatedAt).toLocaleString()}
                      {r.lastDecisionAction ? <div className="text-[11px] text-app-muted">{r.lastDecisionAction}</div> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {r.status === "SUBMITTED" && (
                          <>
                            <Button variant="secondary" onClick={() => act(() => libraryStartReview(r.id), "Review started")}>
                              Start review
                            </Button>
                            <Button variant="outline" onClick={() => openReject(r.id)}>
                              Reject
                            </Button>
                          </>
                        )}
                        {r.status === "UNDER_REVIEW" && (
                          <>
                            <Button variant="secondary" onClick={() => act(() => libraryApproveItem(r.id), "Item approved")}>
                              Approve
                            </Button>
                            <Button variant="outline" onClick={() => openReject(r.id)}>
                              Reject
                            </Button>
                          </>
                        )}
                        {r.status === "APPROVED" && (
                          <>
                            <Button
                              variant="primary"
                              onClick={() => act(() => libraryPublishItem(r.id, { changeSummary: "Published via review queue" }), "Item published")}
                            >
                              Publish
                            </Button>
                            <Button variant="outline" onClick={() => openReject(r.id)}>
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject item"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doReject} isLoading={rejecting} disabled={!rejectReason.trim()}>
              Reject
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Alert variant="warning" title="Reason required">
            Rejections are append-only and part of the governance decision log. Provide a clear, reviewable reason.
          </Alert>
          <div>
            <label className="text-label text-app-muted">Reason</label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} placeholder="Why is this item rejected?" />
          </div>
        </div>
      </Dialog>
    </PageLayout>
  );
}

