"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AssignmentItem = {
  id: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  publishedAt: string | null;
  title: string | null;
  therapistId: string;
  therapistName: string | null;
  clientId: string;
  clientName: string | null;
};

export default function AdminAssignmentsPage() {
  const { me, loading: sessionLoading } = useMe();
  const [items, setItems] = useState<AssignmentItem[]>([]);
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
        `/admin/assignments?${params.toString()}`,
      )) as { items: AssignmentItem[]; nextCursor: string | null };
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
        `/admin/assignments?${params.toString()}`,
      )) as { items: AssignmentItem[]; nextCursor: string | null };
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
          <h1 className="text-h2">Assignments</h1>
          <p className="text-sm text-app-muted">
            Clinic and therapist assignments across the system.
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
              <div className="text-sm font-medium">No assignments found</div>
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
                <TableHead>Assignment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Therapist</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Dates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.title ?? "Assignment"}</div>
                    <div className="text-xs text-app-muted break-all">{item.id}</div>
                  </TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>{item.therapistName ?? item.therapistId}</TableCell>
                  <TableCell>{item.clientName ?? item.clientId}</TableCell>
                  <TableCell className="text-xs text-app-muted">
                    Created {new Date(item.createdAt).toLocaleDateString()}
                    <br />
                    Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "-"}
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
