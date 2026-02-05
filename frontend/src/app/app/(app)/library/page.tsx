"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/use-me";
import { apiDownload, libraryCollections, libraryListSignatureRequests } from "@/lib/api";
import { useLocalStorageState } from "@/lib/use-local-storage";
import type { LibraryCollection, LibrarySignatureRequestListItem, LibrarySignatureRequestListResponse } from "@/lib/types/library";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { EmptyState } from "@/components/page/EmptyState";
import { ErrorState } from "@/components/page/ErrorState";
import { TableSkeleton } from "@/components/page/Skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function LibraryHomePage() {
  const { me } = useMe();
  const role = me?.role ?? null;
  const isAdmin = role === "admin";
  const isClient = role === "client";
  const canReview = role === "admin" || role === "CLINIC_ADMIN";

  const [clinicId, setClinicId] = useLocalStorageState("bs.library.clinicId", "");
  const clinicIdForRequest = useMemo(() => (isAdmin ? clinicId.trim() : null), [clinicId, isAdmin]);

  const [collections, setCollections] = useState<LibraryCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assigned, setAssigned] = useState<LibrarySignatureRequestListItem[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [assignedError, setAssignedError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await libraryCollections(clinicIdForRequest)) as LibraryCollection[];
      setCollections(Array.isArray(res) ? res : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [clinicIdForRequest]);

  const loadAssigned = useCallback(async () => {
    if (!isClient) return;
    setAssignedLoading(true);
    setAssignedError(null);
    try {
      const res = (await libraryListSignatureRequests({ status: null, limit: 50 })) as LibrarySignatureRequestListResponse;
      setAssigned(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAssignedError(msg);
      setAssigned([]);
    } finally {
      setAssignedLoading(false);
    }
  }, [isClient]);

  useEffect(() => {
    if (isAdmin && !clinicIdForRequest) {
      setLoading(false);
      return;
    }
    load();
    loadAssigned();
  }, [isAdmin, clinicIdForRequest, load, loadAssigned]);

  async function openAssignedPdf(requestId: string) {
    try {
      const { blob, filename, contentType } = await apiDownload(`/library/forms/${encodeURIComponent(requestId)}/pdf`);
      if (contentType?.includes("pdf")) {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        // Revoke later; the new tab may still need it briefly.
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        return;
      }
      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `form-${requestId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAssignedError(msg);
    }
  }

  return (
    <PageLayout
      title="Library"
      subtitle="Approved clinical content: browse collections, search, and run grounded queries."
      filters={
        isAdmin ? (
          <FilterBar>
            <div className="min-w-[260px]">
              <label className="text-label text-app-muted">Clinic ID (required for admin)</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
            </div>
          </FilterBar>
        ) : undefined
      }
    >
      {isClient && (
        <Alert variant="info" title="Clinical support content">
          Clinical support content only. Not diagnosis. Your clinician guides care.
        </Alert>
      )}

      {isClient && (
        <Card>
          <CardHeader>
            <CardTitle>Assigned to you</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {assignedError && (
              <div className="p-4">
                <Alert variant="warning" title="Unable to load assigned items">
                  {assignedError}
                </Alert>
              </div>
            )}
            {assignedLoading && <TableSkeleton rows={4} />}
            {!assignedLoading && !assignedError && assigned.length === 0 && (
              <div className="p-4">
                <EmptyState
                  title="No assigned forms"
                  description="If your clinician assigns a form for signature, it will appear here."
                />
              </div>
            )}
            {!assignedLoading && assigned.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assigned.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/app/library/items/${encodeURIComponent(r.itemId)}`}
                          className="font-medium text-app-text hover:underline"
                        >
                          {r.itemTitle}
                        </Link>
                        <div className="text-xs text-app-muted">{r.id}</div>
                      </TableCell>
                      <TableCell className="text-sm text-app-muted">{r.status}</TableCell>
                      <TableCell className="text-xs text-app-muted">{r.dueAt ? r.dueAt.slice(0, 10) : "—"}</TableCell>
                      <TableCell className="text-xs text-app-muted">{r.requestedAt.slice(0, 10)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="secondary" onClick={() => openAssignedPdf(r.id)}>
                          Open PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Collections</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-app-muted">
            Browse curated collections and filter items by type/status and metadata.
          </CardContent>
        </Card>
        {canReview ? (
          <Card>
            <CardHeader>
              <CardTitle>Review queue</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-app-muted">
              Clinic governance workflow for submitted content.{" "}
              <Link href="/app/library/review/queue" className="text-app-accent">
                Open queue
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Search</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-app-muted">
              Keyword search across ingested content chunks.{" "}
              <Link href="/app/library/search" className="text-app-accent">
                Open search
              </Link>
              .
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{canReview ? "Search" : "RAG Query"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-app-muted">
            {canReview ? (
              <>
                Keyword search across ingested content chunks.{" "}
                <Link href="/app/library/search" className="text-app-accent">
                  Open search
                </Link>
                .
              </>
            ) : (
              <>
                Retrieve relevant approved chunks to ground drafting workflows.{" "}
                <Link href="/app/library/rag" className="text-app-accent">
                  Open query
                </Link>
                .
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>RAG Query</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-app-muted">
            Retrieve relevant approved chunks to ground drafting workflows.{" "}
            <Link href="/app/library/rag" className="text-app-accent">
              Open query
            </Link>
            .
          </CardContent>
        </Card>
      </div>

      {error && <ErrorState title="Unable to load collections" message={error} actionLabel="Retry" onAction={load} />}
      {loading && <TableSkeleton rows={6} />}

      {!loading && !error && collections.length === 0 && (
        <EmptyState
          title={isAdmin && !clinicIdForRequest ? "Enter a clinic ID" : "No collections found"}
          description={
            isAdmin && !clinicIdForRequest
              ? "Platform admins must specify a clinicId to view collections."
              : "This clinic has no library collections yet."
          }
        />
      )}

      {!loading && collections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Collections</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/app/library/collections/${encodeURIComponent(c.id)}`}
                        className="font-medium text-app-text hover:underline"
                      >
                        {c.title}
                      </Link>
                      <div className="text-xs text-app-muted">{c.id}</div>
                    </TableCell>
                    <TableCell className="text-sm text-app-muted">
                      {c.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-app-muted">
                      {new Date(c.updatedAt).toLocaleString()}
                    </TableCell>
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
