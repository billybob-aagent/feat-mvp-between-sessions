"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clinicListTherapists } from "@/lib/clinic-api";
import { ClinicTherapistListItem } from "@/lib/types/clinic";
import { useClinicSession } from "../clinic-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ClinicTherapistsPage() {
  const { loading: sessionLoading, role } = useClinicSession();
  const [items, setItems] = useState<ClinicTherapistListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "disabled">("all");
  const [limit, setLimit] = useState(25);

  async function loadFirstPage() {
    setLoading(true);
    setStatus(null);
    try {
      const data = await clinicListTherapists({
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
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setStatus(null);
    try {
      const data = await clinicListTherapists({
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
  }, [sessionLoading, role, limit]);

  const visibleItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => (filter === "disabled" ? item.isDisabled : !item.isDisabled));
  }, [items, filter]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-h2">Therapists</h1>
          <p className="text-sm text-app-muted mt-1">
            Manage therapist accounts and caseload visibility.
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
              placeholder="Search therapists"
              onBlur={loadFirstPage}
              disabled={loading || loadingMore}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-label text-app-muted mb-1">Status</label>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "active" | "disabled")}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </Select>
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
            Showing <span className="font-medium">{visibleItems.length}</span>
            {nextCursor ? <span className="ml-2">(more available)</span> : null}
          </div>
        </CardContent>
      </Card>

      {(sessionLoading || loading) && <p className="text-sm text-app-muted">Loading...</p>}

      {!loading && visibleItems.length === 0 && (
        <Card>
          <CardContent className="text-sm text-app-muted">
            No therapists found.
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

      {visibleItems.length > 0 && (
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Therapist</TableHead>
              <TableHead>Caseload</TableHead>
              <TableHead>Assignments</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.fullName}</div>
                  <div className="text-xs text-app-muted">{item.email}</div>
                </TableCell>
                <TableCell>{item.clientCount}</TableCell>
                <TableCell>{item.assignmentCount}</TableCell>
                <TableCell>
                  <Badge variant={item.isDisabled ? "warning" : "success"}>
                    {item.isDisabled ? "Disabled" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                    href={`/app/clinic/therapists/${item.id}`}
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
