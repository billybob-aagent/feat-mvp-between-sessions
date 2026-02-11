"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "@/lib/use-me";
import { useLocalStorageState } from "@/lib/use-local-storage";
import { reviewQueueList, reviewQueueMarkReviewed } from "@/lib/api";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { NotAuthorized } from "@/components/page/NotAuthorized";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DEFAULT_PAGE_SIZE = 25;

type ReviewQueueItem = {
  id: string;
  assignmentId: string;
  assignmentTitle: string | null;
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  therapistName: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
  flaggedAt: string | null;
  hasTherapistNote: boolean;
  feedbackCount: number;
  engagementState: "pending" | "partial" | "completed" | "overdue";
  engagementStateUpdatedAt: string | null;
  engagementRisk: boolean;
};

type ReviewQueueResponse = {
  items: ReviewQueueItem[];
  nextCursor: string | null;
};

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export default function ReviewQueuePage() {
  const { me, loading: meLoading } = useMe();
  const role = me?.role ?? null;
  const isTherapist = role === "therapist";
  const isClinicAdmin = role === "CLINIC_ADMIN";
  const isAdmin = role === "admin";
  const canAccess = isTherapist || isClinicAdmin || isAdmin;

  const [clinicId, setClinicId] = useLocalStorageState("bs.clinic.id", "");

  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [reviewedFilter, setReviewedFilter] = useState<"all" | "reviewed" | "unreviewed">("unreviewed");
  const [flaggedFilter, setFlaggedFilter] = useState<"all" | "flagged" | "unflagged">("all");
  const [limit, setLimit] = useState<number>(DEFAULT_PAGE_SIZE);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkNote, setBulkNote] = useState("");
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [bulkActing, setBulkActing] = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);

  const debouncedQuery = useDebouncedValue(query, 250);

  const filterKey = useMemo(() => {
    if (!me?.userId && !role) return null;
    const userKey = me?.userId ?? `role:${role ?? "unknown"}`;
    const clinicKey = clinicId || "self";
    return `bs.reviewQueue.filters.${userKey}.${clinicKey}`;
  }, [me?.userId, role, clinicId]);

  const [filtersLoaded, setFiltersLoaded] = useState(false);

  useEffect(() => {
    if (!filterKey) return;
    try {
      const raw = window.localStorage.getItem(filterKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          q?: string;
          reviewed?: "all" | "reviewed" | "unreviewed";
          flagged?: "all" | "flagged" | "unflagged";
          limit?: number;
        };
        setQuery(parsed.q ?? "");
        setReviewedFilter(parsed.reviewed ?? "unreviewed");
        setFlaggedFilter(parsed.flagged ?? "all");
        setLimit(parsed.limit ?? DEFAULT_PAGE_SIZE);
      }
    } catch {
      // ignore
    } finally {
      setFiltersLoaded(true);
    }
  }, [filterKey]);

  useEffect(() => {
    if (!filterKey || !filtersLoaded) return;
    try {
      window.localStorage.setItem(
        filterKey,
        JSON.stringify({
          q: query,
          reviewed: reviewedFilter,
          flagged: flaggedFilter,
          limit,
        }),
      );
    } catch {
      // ignore
    }
  }, [filterKey, filtersLoaded, query, reviewedFilter, flaggedFilter, limit]);

  const canLoad = useMemo(() => {
    if (!canAccess) return false;
    if (isAdmin && !clinicId.trim()) return false;
    return true;
  }, [canAccess, isAdmin, clinicId]);

  const loadQueue = useCallback(async () => {
    if (!canLoad) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = (await reviewQueueList({
        clinicId: isAdmin ? clinicId.trim() : undefined,
        q: debouncedQuery.trim() || undefined,
        reviewed: reviewedFilter,
        flagged: flaggedFilter,
        limit,
      })) as ReviewQueueResponse;
      const rows = Array.isArray(res.items) ? res.items : [];
      setItems(rows);
      setSelectedIds(new Set());
      setFocusedId(rows.length > 0 ? rows[0].id : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems([]);
      setSelectedIds(new Set());
      setFocusedId(null);
    } finally {
      setLoading(false);
    }
  }, [canLoad, clinicId, debouncedQuery, flaggedFilter, isAdmin, limit, reviewedFilter]);

  useEffect(() => {
    if (meLoading) return;
    if (!canLoad) return;
    loadQueue();
  }, [meLoading, canLoad, loadQueue]);

  const selectionCount = selectedIds.size;

  const engagementBadge = (state: ReviewQueueItem["engagementState"]) => {
    switch (state) {
      case "overdue":
        return { label: "Overdue", variant: "danger" as const };
      case "partial":
        return { label: "Partial", variant: "warning" as const };
      case "completed":
        return { label: "Completed", variant: "success" as const };
      default:
        return { label: "Pending", variant: "neutral" as const };
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectionCount === items.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((item) => item.id)));
  };

  const markReviewed = useCallback(async (ids: string[], note?: string) => {
    if (!isTherapist || ids.length === 0) return;
    setBulkActing(true);
    setBulkStatus(null);
    try {
      await reviewQueueMarkReviewed({ responseIds: ids, therapistNote: note || undefined });
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((row) =>
          ids.includes(row.id)
            ? { ...row, reviewedAt: now }
            : row,
        ),
      );
      setSelectedIds(new Set());
      setBulkStatus("Responses marked reviewed.");
    } catch (err) {
      setBulkStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkActing(false);
    }
  }, [isTherapist]);

  const handleBulkConfirm = async () => {
    const ids = Array.from(selectedIds);
    await markReviewed(ids, bulkNote.trim() || undefined);
    setBulkOpen(false);
    setBulkNote("");
  };

  const focusIndex = useMemo(() => items.findIndex((item) => item.id === focusedId), [items, focusedId]);

  const moveFocus = useCallback((delta: number) => {
    if (items.length === 0) return;
    const current = focusIndex >= 0 ? focusIndex : 0;
    let nextIndex = current + delta;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= items.length) nextIndex = items.length - 1;
    const nextId = items[nextIndex]?.id;
    if (nextId) setFocusedId(nextId);
  }, [focusIndex, items]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (!canAccess) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? "";
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (event.key === "Escape") {
        if (bulkOpen) {
          setBulkOpen(false);
          return;
        }
        if (focusedId) {
          setFocusedId(null);
          return;
        }
        if (document.activeElement === searchRef.current) {
          searchRef.current?.blur();
        }
        return;
      }

      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        moveFocus(1);
        return;
      }

      if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        moveFocus(-1);
        return;
      }

      if ((event.key === "r" || event.key === "R") && isTherapist) {
        if (!focusedId) return;
        const focused = items.find((item) => item.id === focusedId);
        if (!focused || focused.reviewedAt) return;
        event.preventDefault();
        markReviewed([focusedId]);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [bulkOpen, canAccess, focusedId, isTherapist, items, markReviewed, moveFocus]);

  if (meLoading) {
    return <div className="text-sm text-app-muted">Loading...</div>;
  }

  if (!canAccess) {
    return <NotAuthorized message="Review queue is available to therapists and clinic admins." />;
  }

  return (
    <PageLayout
      title="Review Queue"
      subtitle="Review and mark client responses."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadQueue} disabled={!canLoad || loading}>
            Refresh
          </Button>
          {isTherapist && (
            <Button
              variant="primary"
              onClick={() => setBulkOpen(true)}
              disabled={selectionCount === 0 || bulkActing}
            >
              Mark reviewed
            </Button>
          )}
        </div>
      }
      filters={
        <FilterBar>
          <div className="min-w-[220px]">
            <label className="text-label text-app-muted">Search</label>
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client or assignment"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-label text-app-muted">Reviewed</label>
            <Select
              value={reviewedFilter}
              onChange={(e) => setReviewedFilter(e.target.value as "all" | "reviewed" | "unreviewed")}
            >
              <option value="all">All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="reviewed">Reviewed</option>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-label text-app-muted">Flagged</label>
            <Select
              value={flaggedFilter}
              onChange={(e) => setFlaggedFilter(e.target.value as "all" | "flagged" | "unflagged")}
            >
              <option value="all">All</option>
              <option value="flagged">Flagged</option>
              <option value="unflagged">Unflagged</option>
            </Select>
          </div>
          <div className="min-w-[140px]">
            <label className="text-label text-app-muted">Page size</label>
            <Select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </div>
          {isAdmin && (
            <div className="min-w-[240px]">
              <label className="text-label text-app-muted">Clinic ID</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
            </div>
          )}
        </FilterBar>
      }
    >
      {isTherapist && (
        <Alert variant="info">Scope: My clients only (server enforced).</Alert>
      )}
      {isClinicAdmin && (
        <Alert variant="info">Scope: Clinic-wide review queue.</Alert>
      )}
      {isAdmin && !clinicId && (
        <Alert variant="warning">Admin must enter a clinic ID to load the queue.</Alert>
      )}

      {error && <Alert variant="danger" title="Unable to load review queue">{error}</Alert>}
      {status && <Alert variant="success">{status}</Alert>}
      {bulkStatus && <Alert variant="info">{bulkStatus}</Alert>}

      {(loading || !filtersLoaded) && (
        <div className="text-sm text-app-muted">Loading...</div>
      )}

      {!loading && filtersLoaded && items.length === 0 && (
        <Card>
          <CardContent className="text-sm text-app-muted">No responses found.</CardContent>
        </Card>
      )}

      {!loading && items.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {isTherapist && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={selectionCount > 0 && selectionCount === items.length}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>Assignment</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isFocused = item.id === focusedId;
                  const rowClass = isFocused ? "bg-app-accent/10" : "";
                  return (
                    <TableRow
                      key={item.id}
                      className={rowClass}
                      onClick={() => setFocusedId(item.id)}
                    >
                      {isTherapist && (
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.id}`}
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelected(item.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="font-medium">{item.assignmentTitle ?? item.assignmentId}</div>
                        {item.feedbackCount > 0 && (
                          <div className="text-xs text-app-muted">Feedback: {item.feedbackCount}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.clientName ?? item.clientId}</div>
                        <div className="text-xs text-app-muted">{item.clientEmail ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={engagementBadge(item.engagementState).variant}>
                            {engagementBadge(item.engagementState).label}
                          </Badge>
                          {item.engagementRisk ? <Badge variant="danger">High risk</Badge> : null}
                        </div>
                        <div className="mt-2 text-xs text-app-muted">
                          {item.engagementStateUpdatedAt
                            ? `Since ${new Date(item.engagementStateUpdatedAt).toLocaleDateString()}`
                            : "No activity yet"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.reviewedAt ? "success" : "warning"}>
                          {item.reviewedAt ? "Reviewed" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.flaggedAt ? "warning" : "neutral"}>
                          {item.flaggedAt ? "Flagged" : "Clear"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isTherapist ? (
                          <Button
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.reviewedAt) return;
                              markReviewed([item.id]);
                            }}
                            disabled={bulkActing || Boolean(item.reviewedAt)}
                          >
                            {item.reviewedAt ? "Reviewed" : "Mark reviewed"}
                          </Button>
                        ) : (
                          <span className="text-xs text-app-muted">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Mark reviewed"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkConfirm}
              disabled={bulkActing || selectionCount === 0}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-app-muted">
          <div>
            {selectionCount} response{selectionCount === 1 ? "" : "s"} selected.
          </div>
          <div>These will be marked reviewed.</div>
          <div>
            <label className="text-label text-app-muted">Optional note</label>
            <Input
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              placeholder="Internal note to attach"
            />
          </div>
        </div>
      </Dialog>
    </PageLayout>
  );
}
