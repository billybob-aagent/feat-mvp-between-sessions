"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/use-me";
import { libraryRagQuery } from "@/lib/api";
import { useLocalStorageState } from "@/lib/use-local-storage";
import type { LibraryRagChunk, LibraryRagResponse } from "@/lib/types/library";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { EmptyState } from "@/components/page/EmptyState";
import { ErrorState } from "@/components/page/ErrorState";
import { TableSkeleton } from "@/components/page/Skeletons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function LibraryRagPage() {
  const { me } = useMe();
  const role = me?.role ?? null;
  const isAdmin = role === "admin";

  const [clinicId, setClinicId] = useLocalStorageState("bs.library.clinicId", "");
  const clinicIdForRequest = useMemo(() => (isAdmin ? clinicId.trim() : null), [clinicId, isAdmin]);

  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState("6");

  const [chunks, setChunks] = useState<LibraryRagChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (isAdmin && !clinicIdForRequest) {
      setError("clinicId is required for admin requests.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    setChunks([]);
    try {
      const res = (await libraryRagQuery({
        query,
        limit: Number(limit) || 6,
        clinicId: clinicIdForRequest,
      })) as LibraryRagResponse;
      const list = Array.isArray(res?.chunks) ? res.chunks : [];
      setChunks(list);
      if (list.length === 0) {
        setNotice("No approved sources found for this query.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [clinicIdForRequest, isAdmin, limit, query]);

  return (
    <PageLayout
      title="Library RAG Query"
      subtitle="Retrieve approved content chunks for grounded drafting. This endpoint does not call an LLM."
      actions={
        <Button variant="primary" onClick={run} disabled={!query.trim() || loading}>
          {loading ? "Querying..." : "Run query"}
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
          <div className="min-w-[140px]">
            <label className="text-label text-app-muted">Limit</label>
            <Select value={limit} onChange={(e) => setLimit(e.target.value)}>
              <option value="4">4</option>
              <option value="6">6</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </Select>
          </div>
          <div className="min-w-[420px] flex-1">
            <label className="text-label text-app-muted">Query</label>
            <Textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={2} placeholder="Enter keywords to retrieve relevant approved chunks..." />
          </div>
        </FilterBar>
      }
    >
      <Alert variant="info">
        Retrieval only (no clinical judgment). Returned chunks are citations you can use in clinician-reviewed drafts. If no sources are returned, downstream assistants must disclose lack of grounding.
      </Alert>

      {error && <ErrorState title="RAG query failed" message={error} actionLabel="Retry" onAction={run} />}
      {loading && <TableSkeleton rows={6} />}

      {!loading && !error && notice && <Alert variant="warning">{notice}</Alert>}

      {!loading && !error && chunks.length === 0 && !notice && (
        <EmptyState title="No results yet" description="Run a query to retrieve approved content chunks." />
      )}

      {chunks.length > 0 && (
        <div className="space-y-4">
          {chunks.map((c, idx) => (
            <Card key={`${c.itemId}-${idx}`}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <Link
                      href={`/app/library/items/${encodeURIComponent(c.itemId)}`}
                      className="text-app-text hover:underline"
                    >
                      {c.itemTitle}
                    </Link>
                    <span className="ml-2 text-xs text-app-muted">{c.contentType}</span>
                  </span>
                  <Badge variant={c.status === "PUBLISHED" ? "success" : c.status === "ARCHIVED" ? "neutral" : "warning"}>
                    {c.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-app-muted">{c.headingPath}</div>
                <pre className="whitespace-pre-wrap rounded-lg border border-app-border bg-app-surface-2 p-3 text-xs text-app-text">
                  {c.text}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
