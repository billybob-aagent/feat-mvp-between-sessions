"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Collection = { id: string; title: string };
type LibraryItem = {
  id: string;
  title: string;
  contentType: string;
  status: string;
  version: number;
};

const DEFAULT_METADATA = JSON.stringify(
  {
    contentType: "",
    primaryClinicalDomains: [],
    applicableModalities: [],
    targetPopulation: [],
    clinicalSetting: [],
    clinicalComplexityLevel: null,
    sessionUse: null,
    evidenceBasis: null,
    customizationRequired: {
      required: false,
      notes: null,
    },
  },
  null,
  2,
);

const DEFAULT_SECTIONS = JSON.stringify(
  [
    {
      headingPath: "Collection > Item > Overview",
      title: "Overview",
      text: "",
      sectionType: "Overview",
      audience: "Clinician",
    },
  ],
  null,
  2,
);

export default function AdminLibraryPage() {
  const [clinicId, setClinicId] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [contentType, setContentType] = useState("Form");
  const [metadataJson, setMetadataJson] = useState(DEFAULT_METADATA);
  const [sectionsJson, setSectionsJson] = useState(DEFAULT_SECTIONS);

  async function loadCollections() {
    if (!clinicId) return;
    const data = (await apiFetch(`/library/collections?clinicId=${clinicId}`)) as Collection[];
    setCollections(Array.isArray(data) ? data : []);
    if (data?.[0]?.id) setCollectionId(data[0].id);
  }

  async function loadItems() {
    if (!clinicId || !collectionId) return;
    const data = (await apiFetch(
      `/library/items?clinicId=${clinicId}&collectionId=${collectionId}`,
    )) as LibraryItem[];
    setItems(Array.isArray(data) ? data : []);
  }

  async function createItem() {
    if (!clinicId || !collectionId) {
      setStatus("Clinic and collection are required.");
      return;
    }
    try {
      const metadata = JSON.parse(metadataJson);
      const sections = JSON.parse(sectionsJson);
      await apiFetch("/library/items", {
        method: "POST",
        json: {
          collectionId,
          slug,
          title,
          contentType,
          metadata,
          sections,
          changeSummary: "Created via admin console",
        },
      });
      setStatus("Item created.");
      await loadItems();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(msg);
    }
  }

  async function publishItem(itemId: string) {
    try {
      await apiFetch(`/library/items/${itemId}/publish`, { method: "POST", json: {} });
      await loadItems();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(msg);
    }
  }

  async function archiveItem(itemId: string) {
    try {
      await apiFetch(`/library/items/${itemId}/archive`, { method: "POST", json: {} });
      await loadItems();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(msg);
    }
  }

  useEffect(() => {
    loadCollections();
  }, [clinicId]);

  useEffect(() => {
    loadItems();
  }, [collectionId, clinicId]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-h1 mb-6">Library Admin</h1>

      <Card className="mb-6">
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-label text-app-muted mb-1">Clinic ID</label>
            <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} />
          </div>
          <div>
            <label className="block text-label text-app-muted mb-1">Collection</label>
            <Select
              value={collectionId}
              onChange={(event) => setCollectionId(event.target.value)}
            >
              <option value="">Select collection</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="space-y-4">
          <h2 className="text-lg font-semibold">Create new item</h2>
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
              className="w-full min-h-[180px] rounded-md border p-3 text-sm"
              value={metadataJson}
              onChange={(e) => setMetadataJson(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-label text-app-muted mb-1">Sections JSON</label>
            <textarea
              className="w-full min-h-[200px] rounded-md border p-3 text-sm"
              value={sectionsJson}
              onChange={(e) => setSectionsJson(e.target.value)}
            />
          </div>
          <Button type="button" variant="primary" onClick={createItem}>
            Create item
          </Button>
          {status && <p className="text-sm text-app-muted">{status}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold mb-4">Library Items</h2>
          <div className="grid gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <Link
                    href={`/app/admin/library/${item.id}?clinicId=${clinicId}`}
                    className="font-medium"
                  >
                    {item.title}
                  </Link>
                  <div className="text-sm text-app-muted">
                    {item.contentType} · v{item.version} · {item.status}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" onClick={() => publishItem(item.id)}>
                    Publish
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => archiveItem(item.id)}>
                    Archive
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
