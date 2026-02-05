"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { libraryCollections, libraryCreateItem, libraryItems } from "@/lib/api";
import { useLocalStorageState } from "@/lib/use-local-storage";
import type { LibraryCollection, LibraryItemListRow } from "@/lib/types/library";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { EmptyState } from "@/components/page/EmptyState";
import { ErrorState } from "@/components/page/ErrorState";
import { TableSkeleton } from "@/components/page/Skeletons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetadataEditor } from "@/components/library/MetadataEditor";
import { SectionsEditor } from "@/components/library/SectionsEditor";

const DEFAULT_METADATA: Record<string, unknown> = {
  primaryClinicalDomains: [],
  applicableModalities: [],
  targetPopulation: [],
  clinicalSetting: [],
  clinicalComplexityLevel: null,
  sessionUse: null,
};

const DEFAULT_SECTIONS: Array<Record<string, unknown>> = [
  {
    headingPath: "Collection > Item > Overview",
    title: "Overview",
    text: "",
    sectionType: "Overview",
    audience: "Clinician",
  },
  {
    headingPath: "Collection > Item > Client Instructions",
    title: "Client Instructions",
    text: "",
    sectionType: "Instructions",
    audience: "Client",
  },
];

export default function LibraryCollectionPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = String(params.collectionId);

  const { me } = useMe();
  const role = me?.role ?? null;
  const isAdmin = role === "admin";
  const isClient = role === "client";
  const canEdit = role === "therapist" || role === "CLINIC_ADMIN" || role === "admin";

  const [clinicId, setClinicId] = useLocalStorageState("bs.library.clinicId", "");
  const clinicIdForRequest = useMemo(() => (isAdmin ? clinicId.trim() : null), [clinicId, isAdmin]);

  const [collections, setCollections] = useState<LibraryCollection[]>([]);
  const collectionTitle = useMemo(
    () => collections.find((c) => c.id === collectionId)?.title ?? "Collection",
    [collections, collectionId],
  );

  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");
  const [status, setStatus] = useState<string>(isClient ? "published" : "all");
  const [domain, setDomain] = useState("");
  const [modality, setModality] = useState("");
  const [population, setPopulation] = useState("");
  const [complexity, setComplexity] = useState("");
  const [sessionUse, setSessionUse] = useState("");

  const [items, setItems] = useState<LibraryItemListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ title: string; variant?: "success" | "danger" } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createContentType, setCreateContentType] = useState<"Therapeutic" | "Form" | "Assessment">("Therapeutic");
  const [createTags, setCreateTags] = useState("");
  const [createMetadata, setCreateMetadata] = useState<Record<string, unknown>>(DEFAULT_METADATA);
  const [createSections, setCreateSections] = useState<Array<Record<string, unknown>>>(DEFAULT_SECTIONS);
  const [createChangeSummary, setCreateChangeSummary] = useState("Created via Library UI");
  const [creating, setCreating] = useState(false);

  const loadCollections = useCallback(async () => {
    try {
      const res = (await libraryCollections(clinicIdForRequest)) as LibraryCollection[];
      setCollections(Array.isArray(res) ? res : []);
    } catch {
      // ignore collections failure; items list still works
    }
  }, [clinicIdForRequest]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const normalizedStatus = isClient ? "published" : status === "all" ? null : status;
      const res = (await libraryItems({
        clinicId: clinicIdForRequest,
        collectionId,
        q: q.trim() || null,
        type: type.trim() || null,
        status: normalizedStatus,
        domain: domain.trim() || null,
        modality: modality.trim() || null,
        population: population.trim() || null,
        complexity: complexity.trim() || null,
        sessionUse: sessionUse.trim() || null,
      })) as LibraryItemListRow[];
      setItems(Array.isArray(res) ? res : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    clinicIdForRequest,
    collectionId,
    complexity,
    domain,
    isClient,
    modality,
    population,
    q,
    sessionUse,
    status,
    type,
  ]);

  useEffect(() => {
    if (isAdmin && !clinicIdForRequest) {
      setLoading(false);
      return;
    }
    loadCollections();
    loadItems();
  }, [isAdmin, clinicIdForRequest, loadCollections, loadItems]);

  async function handleCreate() {
    if (!canEdit || creating) return;
    setCreating(true);
    try {
      if (!createChangeSummary.trim()) {
        throw new Error("Change summary is required.");
      }
      const tags = createTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await libraryCreateItem({
        collectionId,
        slug: createSlug.trim(),
        title: createTitle.trim(),
        contentType: createContentType.trim(),
        metadata: createMetadata,
        sections: createSections,
        tags: tags.length ? tags : undefined,
        changeSummary: createChangeSummary.trim(),
      });

      setToast({ title: "Item created", variant: "success" });
      setCreateOpen(false);
      setCreateTitle("");
      setCreateSlug("");
      setCreateTags("");
      setCreateMetadata(DEFAULT_METADATA);
      setCreateSections(DEFAULT_SECTIONS);
      await loadItems();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ title: msg, variant: "danger" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageLayout
      title={collectionTitle}
      subtitle="Browse and filter library items. Only published content is visible to clients."
      actions={
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Create item
            </Button>
          )}
          <Button variant="secondary" onClick={loadItems} disabled={loading}>
            Refresh
          </Button>
        </div>
      }
      filters={
        <FilterBar>
          {isAdmin && (
            <div className="min-w-[260px]">
              <label className="text-label text-app-muted">Clinic ID (required for admin)</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
            </div>
          )}
          <div className="min-w-[240px]">
            <label className="text-label text-app-muted">Search</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles" onBlur={loadItems} />
          </div>
          <div className="min-w-[180px]">
            <label className="text-label text-app-muted">Type</label>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Form, Worksheet, ..." onBlur={loadItems} />
          </div>
          <div className="min-w-[160px]">
            <label className="text-label text-app-muted">Status</label>
            <Select value={isClient ? "published" : status} onChange={(e) => setStatus(e.target.value)} disabled={isClient}>
              <option value="all">All</option>
              <option value="published">Published</option>
              {!isClient && <option value="draft">Draft</option>}
              {!isClient && <option value="submitted">Submitted</option>}
              {!isClient && <option value="under_review">Under review</option>}
              {!isClient && <option value="approved">Approved</option>}
              {!isClient && <option value="rejected">Rejected</option>}
              {!isClient && <option value="archived">Archived</option>}
            </Select>
          </div>
          <div className="min-w-[180px]">
            <label className="text-label text-app-muted">Domain</label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g., anxiety" onBlur={loadItems} />
          </div>
          <div className="min-w-[180px]">
            <label className="text-label text-app-muted">Modality</label>
            <Input value={modality} onChange={(e) => setModality(e.target.value)} placeholder="e.g., CBT" onBlur={loadItems} />
          </div>
          <div className="min-w-[180px]">
            <label className="text-label text-app-muted">Population</label>
            <Input value={population} onChange={(e) => setPopulation(e.target.value)} placeholder="e.g., adults" onBlur={loadItems} />
          </div>
          <div className="min-w-[180px]">
            <label className="text-label text-app-muted">Complexity</label>
            <Input value={complexity} onChange={(e) => setComplexity(e.target.value)} placeholder="e.g., low" onBlur={loadItems} />
          </div>
          <div className="min-w-[180px]">
            <label className="text-label text-app-muted">Session use</label>
            <Input value={sessionUse} onChange={(e) => setSessionUse(e.target.value)} placeholder="e.g., between-session" onBlur={loadItems} />
          </div>
        </FilterBar>
      }
    >
      {toast && (
        <div className="flex justify-end">
          <Toast
            title={toast.title}
            variant={toast.variant === "success" ? "success" : "danger"}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      {isClient && (
        <Alert variant="info" title="Clinical support content">
          Clients can only view published items and client-safe sections.
        </Alert>
      )}

      {isAdmin && !clinicIdForRequest && (
        <Alert variant="warning" title="Clinic ID required">
          Platform admins must supply a clinicId to browse the library.
        </Alert>
      )}

      {error && <ErrorState title="Unable to load items" message={error} actionLabel="Retry" onAction={loadItems} />}
      {loading && <TableSkeleton rows={6} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="No items found"
          description="Adjust filters or switch to a different collection."
          action={
            <Button variant="secondary" onClick={() => router.push("/app/library")}>
              Back to collections
            </Button>
          }
        />
      )}

      {!loading && items.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/app/library/items/${encodeURIComponent(item.id)}`)}
                  >
                    <TableCell>
                      <div className="font-medium text-app-text">{item.title}</div>
                      <div className="text-xs text-app-muted">{item.slug}</div>
                    </TableCell>
                    <TableCell className="text-sm text-app-muted">{item.contentType}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "PUBLISHED"
                            ? "success"
                            : item.status === "ARCHIVED"
                              ? "neutral"
                              : "warning"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-app-muted">v{item.version}</TableCell>
                    <TableCell className="text-xs text-app-muted">{new Date(item.updatedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create library item"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              isLoading={creating}
              disabled={!createTitle.trim() || !createSlug.trim() || !createContentType.trim()}
            >
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-label text-app-muted">Title</label>
            <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Item title" />
          </div>
          <div>
            <label className="text-label text-app-muted">Slug</label>
            <Input value={createSlug} onChange={(e) => setCreateSlug(e.target.value)} placeholder="kebab-case-slug" />
          </div>
          <div>
            <label className="text-label text-app-muted">Content type</label>
            <Select
              value={createContentType}
              onChange={(e) => setCreateContentType(e.target.value as "Therapeutic" | "Form" | "Assessment")}
            >
              <option value="Therapeutic">Therapeutic</option>
              <option value="Form">Form</option>
              <option value="Assessment">Assessment</option>
            </Select>
          </div>
          <div>
            <label className="text-label text-app-muted">Tags (comma-separated, optional)</label>
            <Input value={createTags} onChange={(e) => setCreateTags(e.target.value)} placeholder="cbt, worksheet, ..." />
          </div>
          <div>
            <label className="text-label text-app-muted">Change summary</label>
            <Input value={createChangeSummary} onChange={(e) => setCreateChangeSummary(e.target.value)} />
          </div>
          <div>
            <label className="text-label text-app-muted">Metadata</label>
            <MetadataEditor metadata={createMetadata} onChange={setCreateMetadata} />
          </div>
          <div>
            <label className="text-label text-app-muted">Sections</label>
            <SectionsEditor sections={createSections} onChange={setCreateSections} />
          </div>
          <Alert variant="info">
            Items are created as <strong>draft</strong> and must be published before clients can view them.
          </Alert>
        </div>
      </Dialog>
    </PageLayout>
  );
}
