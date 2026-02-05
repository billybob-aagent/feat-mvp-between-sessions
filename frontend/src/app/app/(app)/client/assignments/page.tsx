"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Your check-ins</h1>
          <p className="text-sm text-app-muted">
            Complete check-ins that your therapist has assigned.
          </p>
        </div>
      </div>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4">
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
          <div className="ml-auto text-xs text-app-muted">
            Showing <span className="font-medium text-app-text">{items.length}</span>
            {nextCursor ? <span className="ml-2">(more available)</span> : null}
          </div>
        </CardContent>
      </Card>

      {(sessionLoading || loading) && (
        <p className="text-sm text-app-muted">Loading...</p>
      )}

      {!loading && items.length === 0 && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">No check-ins yet</div>
              <p className="text-sm text-app-muted">
                Your therapist will send a check-in when ready.
              </p>
            </div>
            <Button type="button" onClick={loadFirstPage}>
              Refresh
            </Button>
          </CardContent>
        </Card>
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
                      <Link
                        className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-2 text-xs text-app-text shadow-soft hover:bg-app-surface-2"
                        href={`/app/client/assignments/${a.id}`}
                      >
                        Open check-in
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {nextCursor && (
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
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
