"use client";

import { useMemo, useState } from "react";
import { useMe } from "@/lib/use-me";
import { apiDownload, apiFetch } from "@/lib/api";
import { useLocalStorageState } from "@/lib/use-local-storage";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { NotAvailableBanner } from "@/components/page/NotAvailableBanner";
import { ErrorState } from "@/components/page/ErrorState";
import { EmptyState } from "@/components/page/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { formatBytes } from "@/lib/format";

type AerReport = {
  meta?: {
    generated_at?: string;
    period?: { start?: string; end?: string };
    program?: string | null;
  };
  audit_integrity?: { report_id?: string };
  not_available?: string[];
  prescribed_interventions?: unknown[];
  adherence_timeline?: unknown[];
  [key: string]: unknown;
};

type AerLibrarySource = {
  item_id?: string;
  version_id?: string | null;
  version?: number | null;
  title?: string | null;
  slug?: string | null;
  content_type?: string | null;
} | null;

type AerPrescribedIntervention = {
  assignment_id?: string;
  title?: string | null;
  library_source?: AerLibrarySource;
  completed_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: { user_id?: string | null; name?: string | null } | null;
  evidence_refs?: string[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export default function AerReportPage() {
  const { me } = useMe();
  const canIssueExternal = me?.role === "CLINIC_ADMIN" || me?.role === "admin";

  const [clinicId, setClinicId] = useLocalStorageState("bs.clinic.id", "");
  const [clientId, setClientId] = useLocalStorageState("bs.aer.clientId", "");
  const [program, setProgram] = useState("");
  const [start, setStart] = useLocalStorageState("bs.aer.start", daysAgoIso(30));
  const [end, setEnd] = useLocalStorageState("bs.aer.end", todayIso());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AerReport | null>(null);
  const [showJson, setShowJson] = useState(false);

  const [pdfInfo, setPdfInfo] = useState<{
    loading: boolean;
    size: number | null;
    url: string | null;
    error: string | null;
  }>({ loading: false, size: null, url: null, error: null });

  const [externalLink, setExternalLink] = useState<string | null>(null);
  const [externalStatus, setExternalStatus] = useState<string | null>(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams({ start, end });
    if (program.trim()) params.set("program", program.trim());
    return params.toString();
  }, [start, end, program]);

  const libraryLinkedCount = useMemo(() => {
    const list = report?.prescribed_interventions;
    if (!Array.isArray(list)) return 0;
    return (list as AerPrescribedIntervention[]).filter((entry) =>
      Boolean(entry?.library_source?.item_id),
    ).length;
  }, [report?.prescribed_interventions]);

  const interventions = useMemo(() => {
    const list = report?.prescribed_interventions;
    if (!Array.isArray(list)) return [];
    return list as AerPrescribedIntervention[];
  }, [report?.prescribed_interventions]);

  const pdfPath =
    clinicId && clientId
      ? `/reports/aer/${encodeURIComponent(clinicId)}/${encodeURIComponent(clientId)}.pdf?${qs}`
      : null;

  async function loadReport() {
    if (!clinicId || !clientId) {
      setError("Clinic ID and Client ID are required.");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setPdfInfo({ loading: false, size: null, url: null, error: null });
    try {
      const data = await apiFetch<AerReport>(
        `/reports/aer/${encodeURIComponent(clinicId)}/${encodeURIComponent(clientId)}?${qs}`,
      );
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!pdfPath) return;
    setPdfInfo({ loading: true, size: null, url: null, error: null });
    try {
      const { blob, size, filename } = await apiDownload(pdfPath);
      const url = URL.createObjectURL(blob);
      setPdfInfo({ loading: false, size: size ?? blob.size, url, error: null });
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `AER_${clientId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfInfo({
        loading: false,
        size: null,
        url: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function createExternalLink() {
    if (!clinicId || !clientId) return;
    setExternalStatus(null);
    setExternalLink(null);
    try {
      const res = (await apiFetch("/external-access/aer", {
        method: "POST",
        json: {
          clinicId,
          clientId,
          start,
          end,
          program: program.trim() || null,
          format: "pdf",
          ttlMinutes: 60,
        },
      })) as { url: string };
      setExternalLink(res.url ?? null);
      setExternalStatus("External link issued.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setExternalStatus(msg);
    }
  }

  async function copyJson() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    } catch {
      // ignore
    }
  }

  return (
    <PageLayout
      title="AER (Client)"
      subtitle="Generate a single-client Adherence Evidence Report and export PDF evidence."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={loadReport} disabled={loading}>
            {loading ? "Generating..." : "Generate AER"}
          </Button>
          <Button variant="secondary" onClick={downloadPdf} disabled={!pdfPath}>
            Download PDF
          </Button>
        </div>
      }
    >

      <FilterBar>
        <div className="min-w-[220px]">
          <label className="text-label text-app-muted">Clinic ID</label>
          <Input
            value={clinicId}
            onChange={(event) => setClinicId(event.target.value)}
            placeholder="Clinic UUID"
          />
        </div>
        <div className="min-w-[220px]">
          <label className="text-label text-app-muted">Client ID</label>
          <Input
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder="Client UUID"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="text-label text-app-muted">Program (optional)</label>
          <Input
            value={program}
            onChange={(event) => setProgram(event.target.value)}
            placeholder="Program name"
          />
          <div className="text-xs text-app-muted mt-1">Best-effort filter.</div>
        </div>
        <div className="min-w-[160px]">
          <label className="text-label text-app-muted">Start</label>
          <Input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        </div>
        <div className="min-w-[160px]">
          <label className="text-label text-app-muted">End</label>
          <Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        </div>
        <div className="min-w-[160px]">
          <label className="text-label text-app-muted">Output</label>
          <Select defaultValue="pdf">
            <option value="pdf">JSON + PDF</option>
          </Select>
        </div>
      </FilterBar>

      {error && (
        <ErrorState title="Unable to generate AER" message={error} actionLabel="Retry" onAction={loadReport} />
      )}

      {!report && !loading && !error && (
        <EmptyState
          title="Generate an AER"
          description="Enter clinic and client IDs, then run the report."
        />
      )}

      {report && (
        <div className="space-y-4">
          {report.not_available?.length ? (
            <NotAvailableBanner items={report.not_available} />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Report metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-app-muted md:grid-cols-2">
              <div>
                Report ID: <span className="text-app-text">{report.audit_integrity?.report_id ?? "-"}</span>
              </div>
              <div>
                Generated at: <span className="text-app-text">{report.meta?.generated_at ?? "-"}</span>
              </div>
              <div>
                Period:{" "}
                <span className="text-app-text">
                  {report.meta?.period?.start ?? "-"} → {report.meta?.period?.end ?? "-"}
                </span>
              </div>
              <div>
                Program: <span className="text-app-text">{report.meta?.program ?? "-"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-app-muted md:grid-cols-2">
              <div>
                Prescribed interventions:{" "}
                <span className="text-app-text">{report.prescribed_interventions?.length ?? 0}</span>
              </div>
              <div>
                Library-linked interventions:{" "}
                <span className="text-app-text">{libraryLinkedCount}</span>
              </div>
              <div>
                Adherence events:{" "}
                <span className="text-app-text">{report.adherence_timeline?.length ?? 0}</span>
              </div>
              {pdfInfo.size !== null && (
                <div>
                  PDF size: <span className="text-app-text">{formatBytes(pdfInfo.size)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prescribed interventions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {interventions.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No interventions in period"
                    description="If you expect assignments here, verify clinic/client IDs and the reporting period."
                  />
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-app-surface-1 text-xs text-app-muted">
                      <tr className="border-b border-app-border">
                        <th className="px-4 py-3 text-left font-medium">Title</th>
                        <th className="px-4 py-3 text-left font-medium">Source</th>
                        <th className="px-4 py-3 text-left font-medium">Completed</th>
                        <th className="px-4 py-3 text-left font-medium">Reviewed</th>
                        <th className="px-4 py-3 text-right font-medium">Evidence refs</th>
                      </tr>
                    </thead>
                    <tbody className="text-app-text">
                      {interventions.map((row, idx) => (
                        <tr
                          key={row.assignment_id ?? `row-${idx}`}
                          className="border-b border-app-border hover:bg-app-surface-2"
                        >
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium">{row.title ?? row.assignment_id ?? "Assignment"}</div>
                            {row.assignment_id ? (
                              <div className="mt-1 text-xs text-app-muted">{row.assignment_id}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-top text-app-muted">
                            {row.library_source?.item_id ? (
                              <div>
                                <div className="text-app-text">
                                  {row.library_source.title ?? row.library_source.slug ?? row.library_source.item_id}
                                  {row.library_source.version ? ` v${row.library_source.version}` : ""}
                                </div>
                                <div className="mt-1 text-xs">
                                  {row.library_source.version_id ? `version_id: ${row.library_source.version_id}` : "version_id: null"}
                                </div>
                              </div>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-app-muted">{row.completed_at ?? "-"}</td>
                          <td className="px-4 py-3 align-top text-app-muted">{row.reviewed_at ?? "-"}</td>
                          <td className="px-4 py-3 align-top text-right text-app-muted">{row.evidence_refs?.length ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PDF export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-app-muted">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={downloadPdf} disabled={!pdfPath || pdfInfo.loading}>
                  {pdfInfo.loading ? "Downloading..." : "Download PDF"}
                </Button>
                {pdfInfo.url && (
                  <a
                    href={pdfInfo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-app-accent"
                  >
                    Open PDF
                  </a>
                )}
              </div>
              {pdfInfo.error && <Alert variant="danger">{pdfInfo.error}</Alert>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>External access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-app-muted">
              <div className="flex items-center gap-2">
                <Button variant="secondary" disabled={!canIssueExternal} onClick={createExternalLink}>
                  Issue token link
                </Button>
                {!canIssueExternal && (
                  <span className="text-xs">Clinic admins only</span>
                )}
              </div>
              {externalStatus && <div>{externalStatus}</div>}
              {externalLink && (
                <div className="break-all rounded-md border border-app-border bg-app-surface-2 p-3 text-xs text-app-text">
                  {externalLink}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>JSON output</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setShowJson((prev) => !prev)}>
                  {showJson ? "Hide JSON" : "Show JSON"}
                </Button>
                <Button variant="ghost" onClick={copyJson}>
                  Copy JSON
                </Button>
              </div>
              {showJson && (
                <pre className="max-h-[420px] overflow-auto rounded-lg bg-app-surface-2 p-4 text-xs text-app-text">
                  {JSON.stringify(report, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
