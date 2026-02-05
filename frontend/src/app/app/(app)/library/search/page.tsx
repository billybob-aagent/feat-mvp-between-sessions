"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/use-me";
import { librarySearch } from "@/lib/api";
import { useLocalStorageState } from "@/lib/use-local-storage";
import type { LibrarySearchResponse, LibrarySearchResult } from "@/lib/types/library";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { EmptyState } from "@/components/page/EmptyState";
import { ErrorState } from "@/components/page/ErrorState";
import { TableSkeleton } from "@/components/page/Skeletons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function LibrarySearchPage() {
  const { me } = useMe();
  const role = me?.role ?? null;
  const isAdmin = role === "admin";

  const [clinicId, setClinicId] = useLocalStorageState("bs.library.clinicId", "");
  const clinicIdForRequest = useMemo(() => (isAdmin ? clinicId.trim() : null), [clinicId, isAdmin]);

  const [q, setQ] = useState("");
  const [limit, setLimit] = useState("8");

  const [rows, setRows] = useState<LibrarySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (isAdmin && !clinicIdForRequest) {
      setError("clinicId is required for admin requests.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = (await librarySearch(q, Number(limit) || 8, clinicIdForRequest)) as LibrarySearchResponse;
      setRows(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [clinicIdForRequest, isAdmin, limit, q]);

  useEffect(() => {
    // No auto-search; keeps backend load predictable.
  }, []);

  return (
    <PageLayout
      title="Library Search"
      subtitle="Keyword search across approved content chunks."
      actions={
        <Button variant="primary" onClick={run} disabled={!q.trim() || loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      }
      filters={
        <FilterBar>
          {isAdmin && (
            <div className="min-w-[260px]">
              <label className="text-label text-app-muted">Clinic ID (required for admin)</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
            </div>
          )}
          <div className="min-w-[320px]">
            <label className="text-label text-app-muted">Query</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search text..." />
          </div>
          <div className="min-w-[140px]">
            <label className="text-label text-app-muted">Limit</label>
            <Select value={limit} onChange={(e) => setLimit(e.target.value)}>
              <option value="8">8</option>
              <option value="12">12</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </Select>
          </div>
        </FilterBar>
      }
    >
      <Alert variant="info">
        Retrieval only. Search results are content excerpts and do not represent clinical judgment or recommendations.
      </Alert>

      {error && <ErrorState title="Search failed" message={error} actionLabel="Retry" onAction={run} />}
      {loading && <TableSkeleton rows={6} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title="No results"
          description="Enter a query and run search to see matching chunks."
        />
      )}

      {!loading && rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Heading</TableHead>
                  <TableHead>Snippet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={`${r.itemId}-${idx}`}>
                    <TableCell>
                      <Link
                        href={`/app/library/items/${encodeURIComponent(r.itemId)}`}
                        className="font-medium text-app-text hover:underline"
                      >
                        {r.itemTitle}
                      </Link>
                      <div className="text-xs text-app-muted">{r.contentType}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "PUBLISHED" ? "success" : r.status === "ARCHIVED" ? "neutral" : "warning"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-app-muted">{r.headingPath}</TableCell>
                    <TableCell className="text-xs text-app-muted">{r.snippet}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
}
