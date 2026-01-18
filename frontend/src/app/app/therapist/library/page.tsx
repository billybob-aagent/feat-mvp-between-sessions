"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type LibraryCollection = {
  id: string;
  title: string;
};

type LibraryItem = {
  id: string;
  title: string;
  contentType: string;
  status: string;
  version: number;
  metadata: any;
};

type SearchResult = {
  itemId: string;
  itemTitle: string;
  headingPath: string;
};

const TABS = [
  { label: "Forms", type: "Form" },
  { label: "Assessments", type: "Assessment" },
  { label: "Therapeutic Content", type: "Therapeutic Content" },
];

export default function TherapistLibraryPage() {
  const [collections, setCollections] = useState<LibraryCollection[]>([]);
  const [collectionId, setCollectionId] = useState<string>("");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [activeTab, setActiveTab] = useState(TABS[0].type);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [domain, setDomain] = useState("");
  const [modality, setModality] = useState("");
  const [population, setPopulation] = useState("");
  const [complexity, setComplexity] = useState("");
  const [sessionUse, setSessionUse] = useState("");

  const metadataOptions = useMemo(() => {
    const domains = new Set<string>();
    const modalities = new Set<string>();
    const populations = new Set<string>();
    const complexities = new Set<string>();
    const sessionUses = new Set<string>();
    for (const item of items) {
      const meta = item.metadata || {};
      (meta.primaryClinicalDomains || []).forEach((value: string) => domains.add(value));
      (meta.applicableModalities || []).forEach((value: string) => modalities.add(value));
      (meta.targetPopulation || []).forEach((value: string) => populations.add(value));
      if (meta.clinicalComplexityLevel) complexities.add(meta.clinicalComplexityLevel);
      if (meta.sessionUse) sessionUses.add(meta.sessionUse);
    }
    return {
      domains: Array.from(domains),
      modalities: Array.from(modalities),
      populations: Array.from(populations),
      complexities: Array.from(complexities),
      sessionUses: Array.from(sessionUses),
    };
  }, [items]);

  async function loadCollections() {
    const data = (await apiFetch("/library/collections")) as LibraryCollection[];
    setCollections(Array.isArray(data) ? data : []);
    if (data?.[0]?.id) {
      setCollectionId(data[0].id);
    }
  }

  async function loadItems() {
    if (!collectionId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("collectionId", collectionId);
      params.set("type", activeTab);
      if (domain) params.set("domain", domain);
      if (modality) params.set("modality", modality);
      if (population) params.set("population", population);
      if (complexity) params.set("complexity", complexity);
      if (sessionUse) params.set("sessionUse", sessionUse);
      if (query.trim()) params.set("q", query.trim());
      const data = (await apiFetch(`/library/items?${params.toString()}`)) as LibraryItem[];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(value: string) {
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    const data = (await apiFetch(`/library/search?q=${encodeURIComponent(value)}`)) as {
      items: SearchResult[];
    };
    setSearchResults(Array.isArray(data?.items) ? data.items : []);
  }

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    if (!collectionId) return;
    loadItems();
  }, [collectionId, activeTab, domain, modality, population, complexity, sessionUse, query]);

  useEffect(() => {
    const handle = setTimeout(() => {
      runSearch(query);
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-h1">Clinical Library</h1>
          <p className="text-sm text-app-muted mt-2">
            Search clinician-ready tools, assessments, and form templates.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px]">
            <label className="block text-label text-app-muted mb-1">Search</label>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, headings, or content"
            />
            {searchResults.length > 0 && (
              <div className="mt-2 rounded-md border border-app-border bg-white shadow-sm">
                {searchResults.slice(0, 5).map((result) => (
                  <Link
                    key={`${result.itemId}-${result.headingPath}`}
                    href={`/app/therapist/library/${result.itemId}`}
                    className="block px-3 py-2 text-sm hover:bg-app-surface-2"
                  >
                    <div className="font-medium">{result.itemTitle}</div>
                    <div className="text-xs text-app-muted">{result.headingPath}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-[200px]">
            <label className="block text-label text-app-muted mb-1">Collection</label>
            <Select
              value={collectionId}
              onChange={(event) => setCollectionId(event.target.value)}
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {TABS.map((tab) => (
              <Button
                key={tab.type}
                type="button"
                onClick={() => setActiveTab(tab.type)}
                variant={activeTab === tab.type ? "primary" : "secondary"}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div>
            <label className="block text-label text-app-muted mb-1">Domain</label>
            <Select value={domain} onChange={(event) => setDomain(event.target.value)}>
              <option value="">All</option>
              {metadataOptions.domains.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-label text-app-muted mb-1">Modality</label>
            <Select value={modality} onChange={(event) => setModality(event.target.value)}>
              <option value="">All</option>
              {metadataOptions.modalities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-label text-app-muted mb-1">Population</label>
            <Select value={population} onChange={(event) => setPopulation(event.target.value)}>
              <option value="">All</option>
              {metadataOptions.populations.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-label text-app-muted mb-1">Complexity</label>
            <Select value={complexity} onChange={(event) => setComplexity(event.target.value)}>
              <option value="">All</option>
              {metadataOptions.complexities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-label text-app-muted mb-1">Session Use</label>
            <Select value={sessionUse} onChange={(event) => setSessionUse(event.target.value)}>
              <option value="">All</option>
              {metadataOptions.sessionUses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-app-danger mb-4">{error}</p>}
      {loading && <p className="text-sm text-app-muted">Loading library...</p>}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="text-sm text-app-muted">
            No items matched the current filters.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link href={`/app/therapist/library/${item.id}`}>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                </Link>
                <p className="text-sm text-app-muted mt-1">
                  {item.contentType} · v{item.version}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(item.metadata?.primaryClinicalDomains || []).slice(0, 3).map((tag: string) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>

              <div className="text-right">
                <Badge>{item.status}</Badge>
                <div className="mt-2">
                  <Link
                    href={`/app/therapist/library/${item.id}`}
                    className="text-sm text-app-accent"
                  >
                    Open detail
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
