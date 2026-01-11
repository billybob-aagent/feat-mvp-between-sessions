"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type NotificationItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  type: string;
  readAt: string | null;
  createdAt: string;
  hasPayload: boolean;
};

export default function AdminNotificationsPage() {
  const { me, loading: sessionLoading } = useMe();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [limit, setLimit] = useState(25);

  async function loadFirstPage() {
    setLoading(true);
    setStatus(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      const data = (await apiFetch(
        `/admin/notifications?${params.toString()}`,
      )) as { items: NotificationItem[]; nextCursor: string | null };
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
      params.set("limit", String(limit));
      params.set("cursor", nextCursor);
      const data = (await apiFetch(
        `/admin/notifications?${params.toString()}`,
      )) as { items: NotificationItem[]; nextCursor: string | null };
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
  }, [sessionLoading, me, limit]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Notifications</h1>
          <p className="text-sm text-app-muted">
            Operational notification events across the platform.
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
              <div className="text-sm font-medium">No notifications found</div>
              <p className="text-sm text-app-muted">Try refreshing the list.</p>
            </div>
            <Button type="button" onClick={loadFirstPage}>
              Reload list
            </Button>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.userEmail ?? item.userId}</TableCell>
                  <TableCell className="text-xs text-app-muted">
                    Read: {item.readAt ? "Yes" : "No"}
                    <br />
                    Payload: {item.hasPayload ? "Yes" : "No"}
                  </TableCell>
                  <TableCell className="text-xs text-app-muted">
                    {new Date(item.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
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
