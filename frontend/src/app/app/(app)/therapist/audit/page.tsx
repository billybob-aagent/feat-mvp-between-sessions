"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditItem = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export default function TherapistAuditPage() {
  const { me, loading: sessionLoading } = useMe();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [limit, setLimit] = useState(25);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      const data = (await apiFetch(
        `/audit/mine?${params.toString()}`,
      )) as { items: AuditItem[]; nextCursor: string | null };
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
  }, [limit]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setStatus(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("cursor", nextCursor);
      const data = (await apiFetch(
        `/audit/mine?${params.toString()}`,
      )) as { items: AuditItem[]; nextCursor: string | null };
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
  }, [sessionLoading, me, loadFirstPage]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-h2">Audit trail</h1>
          <p className="text-sm text-app-muted mt-1">
            Track key actions taken across assignments, responses, and sessions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
            href="/app/therapist/assignments"
          >
            Back to assignments
          </Link>
        </div>
      </div>

      {status && <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>}

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[140px]">
            <label className="block text-label text-app-muted mb-1">Page size</label>
            <Select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={loading || loadingMore}
            >
              <option value="10">10</option>
              <option value="25">25</option>
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
            No audit activity yet.
            <div className="mt-3">
              <Link
                className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                href="/app/therapist/assignments"
              >
                View assignments
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Metadata</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const when = new Date(item.createdAt).toLocaleString();
              const entity = item.entityType && item.entityId
                ? `${item.entityType}:${item.entityId}`
                : item.entityType ?? "system";
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.action}</div>
                  </TableCell>
                  <TableCell>{entity}</TableCell>
                  <TableCell>{when}</TableCell>
                  <TableCell>
                    {item.metadata ? (
                      <div className="text-xs text-app-muted whitespace-pre-wrap">
                        {JSON.stringify(item.metadata)}
                      </div>
                    ) : (
                      <span className="text-xs text-app-muted">-</span>
                    )}
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
