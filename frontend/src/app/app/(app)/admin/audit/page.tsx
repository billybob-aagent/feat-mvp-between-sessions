"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditItem = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export default function AdminAuditPage() {
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
        `/admin/audit?${params.toString()}`,
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
        `/admin/audit?${params.toString()}`,
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
    if (me?.role !== "admin") return;
    loadFirstPage();
  }, [sessionLoading, me, loadFirstPage]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Audit</h1>
          <p className="text-sm text-app-muted">
            Administrative audit trail for key actions.
          </p>
        </div>
      </div>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px]">
            <label className="text-label text-app-muted">Page size</label>
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
              <div className="text-sm font-medium">No audit activity</div>
              <p className="text-sm text-app-muted">Check back later for updates.</p>
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
                <TableHead>Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const when = new Date(item.createdAt).toLocaleString();
                const who = item.userEmail ?? item.userId ?? "system";
                const entity =
                  item.entityType && item.entityId
                    ? `${item.entityType}:${item.entityId}`
                    : item.entityType ?? "system";
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.action}</TableCell>
                    <TableCell>{who}</TableCell>
                    <TableCell className="text-xs text-app-muted break-all">
                      {entity}
                    </TableCell>
                    <TableCell className="text-xs text-app-muted">{when}</TableCell>
                    <TableCell className="text-xs text-app-muted">
                      {item.metadata ? JSON.stringify(item.metadata) : "-"}
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
