"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  response_id?: string;
  apply_target_response_id?: string | null;
};

type AiSettings = {
  enabled: boolean;
};

export default function AdherenceAssistPage() {
  const searchParams = useSearchParams();
  const { me } = useMe();
  const isTherapist = me?.role === "therapist";

  const [clinicId, setClinicId] = useState("");
  const [responseId, setResponseId] = useState("");

  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [aiStatusError, setAiStatusError] = useState<string | null>(null);

  const [result, setResult] = useState<DraftResult | null>(null);
  const [draftText, setDraftText] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);

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
    const qsClinic = searchParams.get("clinicId");
    const qsResponse = searchParams.get("responseId");
    if (qsClinic && !clinicId) setClinicId(qsClinic);
    if (qsResponse && !responseId) setResponseId(qsResponse);
  }, [searchParams, clinicId, responseId]);

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

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setApplyStatus(null);
    setResult(null);
    setDraftText("");
    try {
      const res = await apiFetch<DraftResult>("/ai/adherence-feedback", {
        method: "POST",
        body: JSON.stringify({ clinicId, responseId }),
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
        body: JSON.stringify({
          responseId: result.apply_target_response_id,
          text: payloadText,
          source: "ai_draft",
        }),
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

  const generateDisabled = !clinicId || !responseId || loading || aiEnabled === false;
  const applyDisabled =
    applying ||
    !isTherapist ||
    !draftText.trim() ||
    !result?.apply_target_response_id;

  return (
    <RequireRole roles={["CLINIC_ADMIN", "admin", "therapist"]}>
      <PageLayout
        title="Adherence Feedback Draft"
        subtitle="Draft feedback for a reviewed response (draft-only; clinician review required)."
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
            <div className="min-w-[260px]">
              <label className="text-label text-app-muted">Response ID</label>
              <Input value={responseId} onChange={(e) => setResponseId(e.target.value)} placeholder="Reviewed response UUID" />
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
                <CardTitle>Draft feedback</CardTitle>
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
