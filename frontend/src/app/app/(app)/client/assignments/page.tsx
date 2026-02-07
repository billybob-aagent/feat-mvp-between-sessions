"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";

type ClientAssignmentRow = {
  id: string;
  dueDate: string | null;
  createdAt: string;
  title: string;
  description: string | null;

  responseCount?: number;
  lastSubmittedAt?: string | null;
  lastReviewedAt?: string | null;

  librarySource?: {
    itemId: string;
    version: number | null;
    title: string | null;
    slug: string | null;
    contentType: string | null;
  } | null;
};

export default function ClientAssignmentsPage() {
  const router = useRouter();
  const { me, loading: sessionLoading } = useMe();
  const [items, setItems] = useState<ClientAssignmentRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const debouncedQuery = useDebouncedValue(query, 300);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      params.set("limit", String(limit));
      const data = (await apiFetch(
        `/assignments/mine?${params.toString()}`,
      )) as { items: ClientAssignmentRow[]; nextCursor: string | null };
      setItems(Array.isArray(data?.items) ? data.items : []);
      setNextCursor(data?.nextCursor ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, limit]);

  useEffect(() => {
    if (sessionLoading) return;
    if (me?.role !== "client") return;
    loadFirstPage();
  }, [sessionLoading, me, loadFirstPage]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setStatus(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      params.set("limit", String(limit));
      params.set("cursor", nextCursor);
      const data = (await apiFetch(
        `/assignments/mine?${params.toString()}`,
      )) as { items: ClientAssignmentRow[]; nextCursor: string | null };
      const newItems = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => [...prev, ...newItems]);
      setNextCursor(data?.nextCursor ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setLoadingMore(false);
    }
  }

  const stats = useMemo(() => {
    const active = items.length;
    const submitted = items.filter((a) => (a.responseCount ?? 0) > 0).length;
    const reviewed = items.filter((a) => !!a.lastReviewedAt).length;
    const dueSoon = items.filter((a) => {
      if (!a.dueDate) return false;
      const dueAt = new Date(a.dueDate).getTime();
      const now = Date.now();
      const diff = dueAt - now;
      return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 7;
    }).length;
    return { active, submitted, reviewed, dueSoon };
  }, [items]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <section className="rounded-2xl border border-app-border bg-app-surface-2 p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">
              Daily plan
            </div>
            <h1 className="text-h2 mt-2">Your check-ins</h1>
            <p className="text-sm text-app-muted">
              Complete check-ins that your therapist has assigned.
            </p>
            <div className="mt-2 text-sm text-app-muted">
              You have <span className="font-medium text-app-text">{stats.active}</span> active assignments.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* TODO: wire daily check-in flow to POST /api/v1/checkins/submit */}
            <Tooltip label="Coming soon">
              <span className="inline-flex">
                <Button variant="secondary" disabled>
                  Start Today&apos;s Check-in
                </Button>
              </span>
            </Tooltip>
            <Button variant="secondary" onClick={() => router.push("/app/client/assignments")}>
              View Active Assignments
            </Button>
            {/* TODO: add client feedback endpoint (GET /api/v1/feedback?clientId=...) */}
            <Tooltip label="Coming soon">
              <span className="inline-flex">
                <Button variant="secondary" disabled>
                  View Feedback
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>

        {status && <p className="mt-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>}

        <div className="mt-6 grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent>
              <div className="text-label text-app-muted">Active assignments</div>
              <div className="text-2xl font-semibold mt-2">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-label text-app-muted">Submitted</div>
              <div className="text-2xl font-semibold mt-2">{stats.submitted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-label text-app-muted">Reviewed</div>
              <div className="text-2xl font-semibold mt-2">{stats.reviewed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-label text-app-muted">Due soon</div>
              <div className="text-2xl font-semibold mt-2">{stats.dueSoon}</div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">
                Assignment inbox
              </div>
              <div className="text-sm text-app-muted">
                Search and complete check-ins assigned to you.
              </div>
            </div>
            <div className="text-xs text-app-muted">
              Showing <span className="font-medium text-app-text">{items.length}</span>
              {nextCursor ? <span className="ml-2">(more available)</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px]">
              <label className="text-label text-app-muted">Search</label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search check-ins"
                disabled={loading || loadingMore}
              />
            </div>
            <div>
              <label className="text-label text-app-muted">Page size</label>
              <Select
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value))}
                disabled={loading || loadingMore}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </Select>
            </div>
          </div>

          {(sessionLoading || loading) && (
            <p className="text-sm text-app-muted">Loading...</p>
          )}

          {!loading && items.length === 0 && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">No check-ins yet</div>
                <p className="text-sm text-app-muted">
                  Your therapist will send a check-in when ready.
                </p>
              </div>
              <Button type="button" onClick={loadFirstPage}>
                Refresh
              </Button>
            </div>
          )}

          {items.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last submission</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a) => {
                    const due = a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "-";
                    const count = a.responseCount ?? 0;
                    const last = a.lastSubmittedAt
                      ? new Date(a.lastSubmittedAt).toLocaleString()
                      : null;
                    const reviewed = !!a.lastReviewedAt;

                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium">{a.title}</div>
                            {a.librarySource ? <Badge variant="neutral">Library</Badge> : null}
                          </div>
                          {a.description ? (
                            <div className="text-xs text-app-muted line-clamp-2">
                              {a.description}
                            </div>
                          ) : null}
                          {a.librarySource?.title ? (
                            <div className="text-xs text-app-muted">
                              Source: {a.librarySource.title}
                              {a.librarySource.version ? ` v${a.librarySource.version}` : ""}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>{due}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {count > 0 ? (
                              <Badge variant="warning">Submitted</Badge>
                            ) : (
                              <Badge variant="neutral">Not submitted</Badge>
                            )}
                            {reviewed ? <Badge variant="success">Reviewed</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-app-muted">
                          {last ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={count > 0 ? "secondary" : "primary"}
                            onClick={() => router.push(`/app/client/assignments/${a.id}`)}
                          >
                            {count > 0 ? "View response" : "Submit response"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {nextCursor && (
                <div className="flex justify-end">
                  <Button type="button" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
