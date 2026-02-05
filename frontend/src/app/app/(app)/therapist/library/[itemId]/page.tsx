"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type LibraryItem = {
  id: string;
  title: string;
  contentType: string;
  metadata: {
    primaryClinicalDomains?: string[];
    applicableModalities?: string[];
    targetPopulation?: string[];
    clinicalSetting?: string[];
    clinicalComplexityLevel?: string;
    sessionUse?: string;
    evidenceBasis?: string;
    customizationRequired?: { required?: boolean; notes?: string };
  } | null;
  sections: unknown[] | { sections?: unknown[] };
  status: string;
  version: number;
  versions: { id: string; versionNumber: number; changeSummary: string | null; createdAt: string }[];
};

type ClientOption = { id: string; fullName: string; email: string };
type LibrarySection = {
  id?: string;
  title?: string;
  content?: string;
  sectionType?: string;
  headingPath?: string;
  text?: string;
};

export default function LibraryItemDetailPage() {
  const params = useParams();
  const itemId = String(params.itemId);
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo<LibrarySection[]>(() => {
    if (!item) return [];
    const raw = Array.isArray(item.sections) ? item.sections : item.sections?.sections ?? [];
    return raw.filter(Boolean) as LibrarySection[];
  }, [item]);

  const isForm = item?.contentType?.toLowerCase().includes("form") ?? false;

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await apiFetch(`/library/items/${itemId}`)) as LibraryItem;
      setItem(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  const loadClients = useCallback(async () => {
    try {
      const data = (await apiFetch("/clients/mine")) as ClientOption[];
      setClients(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  async function requestSignature() {
    if (!selectedClient) {
      setRequestStatus("Select a client before requesting a signature.");
      return;
    }
    setRequestStatus(null);
    try {
      await apiFetch(`/library/forms/${itemId}/signature-requests`, {
        method: "POST",
        json: { clientId: selectedClient },
      });
      setRequestStatus(`Signature request created. PDF snapshot stored.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRequestStatus(msg);
    }
  }

  useEffect(() => {
    loadItem();
    loadClients();
  }, [loadItem, loadClients]);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Link href="/app/therapist/library" className="text-sm text-app-muted">
            ← Back to library
          </Link>
          <h1 className="text-h1 mt-2">{item?.title ?? "Library Item"}</h1>
          <p className="text-sm text-app-muted mt-2">
            {item?.contentType} · v{item?.version}
          </p>
        </div>
        {item && <Badge>{item.status}</Badge>}
      </div>

      {error && <p className="text-sm text-app-danger mb-4">{error}</p>}
      {loading && <p className="text-sm text-app-muted">Loading item...</p>}

      {item && (
        <>
          <Card className="mb-6 border-app-info bg-app-info-soft">
            <CardContent>
              <p className="text-sm text-app-info">
                Clinician interpretation required. Do not rely on automated conclusions; review
                all sections before use.
              </p>
            </CardContent>
          </Card>
          <Card className="mb-6">
            <CardContent>
              <h2 className="text-lg font-semibold mb-3">Metadata</h2>
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div>
                  <div className="text-app-muted">Primary domains</div>
                  <div>{(item.metadata?.primaryClinicalDomains || []).join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-app-muted">Modalities</div>
                  <div>{(item.metadata?.applicableModalities || []).join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-app-muted">Target population</div>
                  <div>{(item.metadata?.targetPopulation || []).join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-app-muted">Clinical setting</div>
                  <div>{(item.metadata?.clinicalSetting || []).join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-app-muted">Complexity</div>
                  <div>{item.metadata?.clinicalComplexityLevel || "Unspecified"}</div>
                </div>
                <div>
                  <div className="text-app-muted">Session use</div>
                  <div>{item.metadata?.sessionUse || "Unspecified"}</div>
                </div>
                <div>
                  <div className="text-app-muted">Evidence basis</div>
                  <div>{item.metadata?.evidenceBasis || "Unspecified"}</div>
                </div>
                <div>
                  <div className="text-app-muted">Customization required</div>
                  <div>
                    {item.metadata?.customizationRequired?.required ? "Yes" : "No"}
                    {item.metadata?.customizationRequired?.notes
                      ? ` — ${item.metadata.customizationRequired.notes}`
                      : ""}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isForm && (
            <Card className="mb-6">
              <CardContent>
                <h2 className="text-lg font-semibold mb-3">Request Signature</h2>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[240px]">
                    <label className="block text-label text-app-muted mb-1">
                      Client
                    </label>
                    <Select
                      value={selectedClient}
                      onChange={(event) => setSelectedClient(event.target.value)}
                    >
                      <option value="">Select client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.fullName} ({client.email})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="button" variant="primary" onClick={requestSignature}>
                    Request signature
                  </Button>
                </div>
                {requestStatus && (
                  <p className="text-sm text-app-muted mt-3">{requestStatus}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-3">Sections</h2>
              <div className="grid gap-3">
              {sections.map((section, index) => {
                  const title =
                    section.title || section.sectionType || section.headingPath || `Section ${index + 1}`;
                  const text = section.text || "";
                  const isClinicianNotes = /clinician|therapist|clinical notes/i.test(title);
                  const isRisk = /risk|escalation|suicid|self-harm/i.test(title + text);
                  return (
                    <details
                      key={`${title}-${index}`}
                      className={`rounded-md border px-4 py-3 ${
                        isRisk ? "border-app-danger bg-app-danger-soft" : "bg-app-surface"
                      }`}
                    >
                      <summary className="cursor-pointer font-medium">
                        {title}
                      </summary>
                      <div
                        className={`mt-2 whitespace-pre-wrap text-sm ${
                          isClinicianNotes ? "bg-app-info-soft p-3 rounded-md" : ""
                        }`}
                      >
                        {text}
                      </div>
                    </details>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {item.versions?.length ? (
            <Card className="mt-6">
              <CardContent>
                <h2 className="text-lg font-semibold mb-3">Version history</h2>
                <div className="grid gap-2 text-sm text-app-muted">
                  {item.versions.map((version) => (
                    <div key={version.id}>
                      v{version.versionNumber} · {version.changeSummary || "Update"} ·{" "}
                      {new Date(version.createdAt).toLocaleString()}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </main>
  );
}
