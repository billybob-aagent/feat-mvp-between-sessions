"use client";

import { useEffect, useMemo, useState } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

type DraftResult = {
  assistant?: string;
  version?: string;
  text?: string;
  evidence_refs?: string[];
  disclaimer?: string;
  redaction_stats?: Record<string, number>;
  sanitized_hash?: string;
  denial_reason?: string;
  purpose?: string;
  prompt_version?: string;
  generated_at?: string;
  apply_target_response_id?: string | null;
};

type AiSettings = {
  enabled: boolean;
};

type EvidencePreviewItem = {
  assignment_title: string | null;
  response_date: string;
  reviewed_at: string;
  completion_status: "reviewed";
};

type EvidencePreview = {
  reviewed_response_count: number;
  items: EvidencePreviewItem[];
};

export default function ProgressSummaryPage() {
  const today = useMemo(() => new Date(), []);
  const { me } = useMe();
  const isTherapist = me?.role === "therapist";

  const [clinicId, setClinicId] = useState("");
  const [clientId, setClientId] = useState("");
  const [periodStart, setPeriodStart] = useState(toDateInput(new Date(today.getTime() - 30 * 86400000)));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(today));

  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [aiStatusError, setAiStatusError] = useState<string | null>(null);

  const [result, setResult] = useState<DraftResult | null>(null);
  const [draftText, setDraftText] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<EvidencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const provenance =
    result?.purpose && result?.generated_at && result?.prompt_version
      ? `AI Draft • ${result.purpose} • ${result.generated_at} • v${result.prompt_version}`
      : null;

  const withProvenance = (text: string, label: string | null) => {
    const trimmed = text.trim();
    if (!label) return trimmed;
    if (trimmed.includes(label)) return trimmed;
    return `${trimmed}\n\n---\n${label}`;
  };

  useEffect(() => {
    if (!clinicId) {
      setAiEnabled(null);
      setAiStatusError(null);
      return;
    }
    let cancelled = false;
    async function loadSettings() {
      setAiStatusError(null);
      try {
        const res = await apiFetch<AiSettings>(`/ai/settings/${encodeURIComponent(clinicId)}`);
        if (!cancelled) setAiEnabled(Boolean(res.enabled));
      } catch (err) {
        if (!cancelled) {
          setAiEnabled(null);
          setAiStatusError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId || !clientId || !periodStart || !periodEnd) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await apiFetch<EvidencePreview>("/ai/progress-summary/preview", {
          method: "POST",
          body: JSON.stringify({ clinicId, clientId, periodStart, periodEnd }),
          headers: { "Content-Type": "application/json" },
        });
        if (!cancelled) setPreview(res);
      } catch (err) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [clinicId, clientId, periodStart, periodEnd]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setApplyStatus(null);
    setResult(null);
    setDraftText("");
    try {
      const res = await apiFetch<DraftResult>("/ai/progress-summary", {
        method: "POST",
        body: JSON.stringify({ clinicId, clientId, periodStart, periodEnd }),
        headers: { "Content-Type": "application/json" },
      });
      setResult(res);
      setDraftText(res.text ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!result?.apply_target_response_id) return;
    if (!draftText.trim()) return;
    setApplying(true);
    setApplyStatus(null);
    try {
      const payloadText = withProvenance(draftText, provenance);
      await apiFetch("/feedback/create", {
        method: "POST",
        body: JSON.stringify({ responseId: result.apply_target_response_id, text: payloadText }),
        headers: { "Content-Type": "application/json" },
      });
      setDraftText(payloadText);
      setApplyStatus("Draft saved to feedback.");
    } catch (err) {
      setApplyStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }

  const noEvidence = preview?.reviewed_response_count === 0;
  const generateDisabled =
    !clinicId || !clientId || loading || aiEnabled === false || previewLoading || noEvidence;
  const applyDisabled =
    applying || !isTherapist || !draftText.trim() || !result?.apply_target_response_id;

  return (
    <RequireRole roles={["CLINIC_ADMIN", "admin", "therapist"]}>
      <PageLayout
        title="Progress Summary Draft"
        subtitle="Draft a neutral progress summary from reviewed evidence."
        actions={
          <Button variant="primary" onClick={handleGenerate} isLoading={loading} disabled={generateDisabled}>
            Generate draft
          </Button>
        }
        filters={
          <FilterBar>
            <div className="min-w-[220px]">
              <label className="text-label text-app-muted">Clinic ID</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
            </div>
            <div className="min-w-[220px]">
              <label className="text-label text-app-muted">Client ID</label>
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client UUID" />
            </div>
            <div className="min-w-[160px]">
              <label className="text-label text-app-muted">Period start</label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="min-w-[160px]">
              <label className="text-label text-app-muted">Period end</label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </FilterBar>
        }
      >
        <Alert variant="info">
          Draft only. Clinician review required.
        </Alert>
        {aiEnabled === false && (
          <Alert variant="warning">AI is disabled for this clinic.</Alert>
        )}
        {aiStatusError && (
          <Alert variant="danger" title="AI settings unavailable">{aiStatusError}</Alert>
        )}
        {error && <Alert variant="danger" title="AI request failed">{error}</Alert>}
        {previewError && (
          <Alert variant="danger" title="Evidence preview failed">{previewError}</Alert>
        )}
        {previewLoading && <Alert variant="info">Loading evidence preview…</Alert>}
        {noEvidence && (
          <Alert variant="warning">No reviewed evidence found for this period.</Alert>
        )}

        {preview && (
          <Card>
            <CardHeader>
              <CardTitle>Evidence used</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-app-muted">
              <div>
                Reviewed responses:{" "}
                <span className="text-app-text">{preview.reviewed_response_count}</span>
              </div>
              {preview.items.length > 0 ? (
                <div className="space-y-2">
                  {preview.items.map((item, idx) => (
                    <div key={`${item.response_date}-${idx}`} className="rounded-lg bg-app-surface-2 p-3">
                      <div className="text-app-text">
                        {item.assignment_title || "Assignment"}
                      </div>
                      <div className="text-xs text-app-muted">
                        Response {item.response_date} • Reviewed {item.reviewed_at}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>No reviewed responses in this period.</div>
              )}
            </CardContent>
          </Card>
        )}

        {!loading && !result && (
          <Alert variant="info">Draft output will appear after you generate a request.</Alert>
        )}

        {result?.denial_reason && (
          <Alert variant="danger">Request denied: {result.denial_reason}</Alert>
        )}

        {result && !result.denial_reason && (
          <div className="space-y-4">
            <Alert variant="info">
              {result.disclaimer || "Draft only. Clinician review required."}
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Draft summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={6}
                />
                <div className="flex items-center gap-2">
                  <Button variant="primary" onClick={handleApply} disabled={applyDisabled} isLoading={applying}>
                    Apply draft
                  </Button>
                  {!isTherapist && (
                    <span className="text-xs text-app-muted">Apply is therapist-only.</span>
                  )}
                </div>
                {applyStatus && (
                  <div className="text-xs text-app-muted">{applyStatus}</div>
                )}
                {provenance && (
                  <div className="text-xs text-app-muted">{provenance}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Evidence refs</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-app-muted">
                {result.evidence_refs?.length
                  ? result.evidence_refs.map((ref, idx) => (
                      <div key={idx}>{ref}</div>
                    ))
                  : "No evidence refs provided."}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Redaction stats</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-app-muted">
                <pre className="rounded-lg bg-app-surface-2 p-3 text-xs text-app-text">
                  {JSON.stringify(result.redaction_stats, null, 2)}
                </pre>
                <div>Sanitized hash: <span className="text-app-text">{result.sanitized_hash}</span></div>
                {provenance && (
                  <div className="mt-2 text-xs text-app-muted">{provenance}</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </PageLayout>
    </RequireRole>
  );
}
