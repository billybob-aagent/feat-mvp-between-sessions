"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Assignment = {
  id: string;
  dueDate: string | null;
  createdAt: string;
  status: "draft" | "published";
  publishedAt: string | null;
  title: string;
  description: string | null;
  client: {
    id: string;
    fullName: string;
    email: string;
  };
};

export default function TherapistAssignmentsPage() {
  const { me, loading: sessionLoading } = useMe();
  const [items, setItems] = useState<Assignment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [limit, setLimit] = useState(20);

  const debouncedQuery = useDebouncedValue(query, 300);

  async function loadFirstPage() {
    setLoading(true);
    setStatus(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", String(limit));
      const data = (await apiFetch(
        `/assignments/therapist?${params.toString()}`,
      )) as { items: Assignment[]; nextCursor: string | null };
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
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setStatus(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", String(limit));
      params.set("cursor", nextCursor);
      const data = (await apiFetch(
        `/assignments/therapist?${params.toString()}`,
      )) as { items: Assignment[]; nextCursor: string | null };
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

  useEffect(() => {
    if (sessionLoading) return;
    if (me?.role !== "therapist") return;
    loadFirstPage();
  }, [sessionLoading, me, debouncedQuery, statusFilter, limit]);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h1">Assignments</h1>
          <p className="text-sm text-app-muted mt-1">
            Review client responses and track assignment progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/app/therapist/assignments/new"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-app-accent px-3 py-2 text-sm text-white hover:bg-app-accent/90"
          >
            New assignment
          </Link>

          <Button type="button" onClick={loadFirstPage} disabled={loading || loadingMore}>
            Refresh
          </Button>

        </div>
      </div>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="block text-label text-app-muted mb-1">Search</label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assignments"
              disabled={loading || loadingMore}
            />
          </div>

          <div className="min-w-[160px]">
            <label className="block text-label text-app-muted mb-1">Status</label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "draft" | "published")}
              disabled={loading || loadingMore}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </div>

          <div className="min-w-[140px]">
            <label className="block text-label text-app-muted mb-1">Page size</label>
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
            Showing <span className="font-medium">{items.length}</span>
            {nextCursor ? <span className="ml-2">(more available)</span> : null}
          </div>
        </CardContent>
      </Card>

      {(sessionLoading || loading) && <p className="text-sm text-app-muted">Loading...</p>}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="text-sm text-app-muted">
            No assignments yet.
            <div className="mt-3">
              <Link
                href="/app/therapist/assignments/new"
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-app-accent px-3 py-2 text-sm text-white hover:bg-app-accent/90"
              >
                Create your first assignment
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Assignment</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {items.map((a) => {
              const clientName = a.client.fullName;
              const clientEmail = a.client.email;
              const due = a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "-";
              const isPublished = a.status === "published";

              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{a.title}</div>
                    {a.description ? (
                      <div className="text-xs text-app-muted mt-1">
                        {a.description}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{clientName}</div>
                    <div className="text-xs text-app-muted">{clientEmail}</div>
                  </TableCell>
                  <TableCell>{due}</TableCell>
                  <TableCell>
                    <Badge variant={isPublished ? "success" : "warning"}>
                      {isPublished ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                        href={`/app/therapist/assignments/${a.id}/responses`}
                      >
                        Review
                      </Link>
                      <Link
                        className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                        href={`/app/therapist/session-prep?assignmentId=${encodeURIComponent(
                          a.id,
                        )}&clientId=${encodeURIComponent(a.client.id)}`}
                      >
                        Session prep
                      </Link>
                      <Link
                        className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                        href={`/app/therapist/assignments/${a.id}/edit`}
                      >
                        Edit
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
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
