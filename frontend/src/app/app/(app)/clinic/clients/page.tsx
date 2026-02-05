"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clinicListClients } from "@/lib/clinic-api";
import { ClinicClientListItem } from "@/lib/types/clinic";
import { useClinicSession } from "../clinic-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ClinicClientsPage() {
  const { loading: sessionLoading, role } = useClinicSession();
  const [items, setItems] = useState<ClinicClientListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(25);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const data = await clinicListClients({
        q: query.trim() || undefined,
        limit,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [query, limit]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setStatus(null);
    try {
      const data = await clinicListClients({
        q: query.trim() || undefined,
        limit,
        cursor: nextCursor,
      });
      const newItems = Array.isArray(data.items) ? data.items : [];
      setItems((prev) => [...prev, ...newItems]);
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (sessionLoading) return;
    if (role !== "CLINIC_ADMIN") return;
    loadFirstPage();
  }, [sessionLoading, role, loadFirstPage]);

  const filtered = useMemo(() => items, [items]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-h2">Clients</h1>
          <p className="text-sm text-app-muted mt-1">
            View client engagement and assignment completion counts.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link className="text-app-muted hover:text-app-text" href="/app/clinic/dashboard">
            Back to dashboard
          </Link>
        </div>
      </div>

      {status && <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>}

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="block text-label text-app-muted mb-1">Search</label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients"
              onBlur={loadFirstPage}
              disabled={loading || loadingMore}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-label text-app-muted mb-1">Page size</label>
            <Select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </Select>
          </div>
          <div className="ml-auto text-xs text-app-muted">
            Showing <span className="font-medium">{filtered.length}</span>
            {nextCursor ? <span className="ml-2">(more available)</span> : null}
          </div>
        </CardContent>
      </Card>

      {(sessionLoading || loading) && <p className="text-sm text-app-muted">Loading...</p>}

      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="text-sm text-app-muted">
            No clients found.
            <div className="mt-3">
              <Link
                href="/app/clinic/dashboard"
                className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-2 text-sm text-app-text hover:bg-app-surface-2"
              >
                Return to dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {filtered.length > 0 && (
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Client</TableHead>
              <TableHead>Therapist</TableHead>
              <TableHead>Assignments</TableHead>
              <TableHead>Responses</TableHead>
              <TableHead>Check-ins</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.fullName}</div>
                  <div className="text-xs text-app-muted">{item.email}</div>
                </TableCell>
                <TableCell>{item.therapistName ?? item.therapistId}</TableCell>
                <TableCell>{item.assignmentCount}</TableCell>
                <TableCell>{item.responseCount}</TableCell>
                <TableCell>{item.checkinCount}</TableCell>
                <TableCell className="text-right">
                  <Link
                    className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                    href={`/app/clinic/clients/${item.id}`}
                  >
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
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
    </div>
  );
}
