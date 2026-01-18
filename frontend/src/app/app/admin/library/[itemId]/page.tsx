"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLibraryItemPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const itemId = String(params.itemId);
  const clinicId = searchParams.get("clinicId") ?? "";

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [contentType, setContentType] = useState("");
  const [metadataJson, setMetadataJson] = useState("");
  const [sectionsJson, setSectionsJson] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadItem() {
    if (!clinicId) return;
    setLoading(true);
    try {
      const data = (await apiFetch(
        `/library/items/${itemId}?clinicId=${clinicId}`,
      )) as any;
      setTitle(data.title || "");
      setSlug(data.slug || "");
      setContentType(data.contentType || "");
      setMetadataJson(JSON.stringify(data.metadata ?? {}, null, 2));
      setSectionsJson(JSON.stringify(data.sections ?? [], null, 2));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(msg);
    } finally {
      setLoading(false);
    }
  }

  async function updateItem() {
    if (!clinicId) {
      setStatus("clinicId is required.");
      return;
    }
    try {
      const metadata = JSON.parse(metadataJson);
      const sections = JSON.parse(sectionsJson);
      await apiFetch(`/library/items/${itemId}`, {
        method: "PATCH",
        json: {
          slug,
          title,
          contentType,
          metadata,
          sections,
          changeSummary: "Admin edit",
        },
      });
      setStatus("Item updated.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(msg);
    }
  }

  async function publishItem() {
    try {
      await apiFetch(`/library/items/${itemId}/publish`, { method: "POST", json: {} });
      setStatus("Item published.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(msg);
    }
  }

  async function archiveItem() {
    try {
      await apiFetch(`/library/items/${itemId}/archive`, { method: "POST", json: {} });
      setStatus("Item archived.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(msg);
    }
  }

  useEffect(() => {
    loadItem();
  }, [itemId, clinicId]);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <Link href={`/app/admin/library?clinicId=${clinicId}`} className="text-sm text-app-muted">
        ← Back to library admin
      </Link>
      <h1 className="text-h1 mt-3">Edit Library Item</h1>

      {loading && <p className="text-sm text-app-muted mt-4">Loading...</p>}
      {status && <p className="text-sm text-app-muted mt-4">{status}</p>}

      <Card className="mt-6">
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-label text-app-muted mb-1">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-label text-app-muted mb-1">Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
            <div>
              <label className="block text-label text-app-muted mb-1">Content type</label>
              <Input value={contentType} onChange={(e) => setContentType(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-label text-app-muted mb-1">Metadata JSON</label>
            <textarea
              className="w-full min-h-[200px] rounded-md border p-3 text-sm"
              value={metadataJson}
              onChange={(e) => setMetadataJson(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-label text-app-muted mb-1">Sections JSON</label>
            <textarea
              className="w-full min-h-[220px] rounded-md border p-3 text-sm"
              value={sectionsJson}
              onChange={(e) => setSectionsJson(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={updateItem}>
              Save changes
            </Button>
            <Button type="button" onClick={publishItem}>
              Publish
            </Button>
            <Button type="button" variant="ghost" onClick={archiveItem}>
              Archive
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
