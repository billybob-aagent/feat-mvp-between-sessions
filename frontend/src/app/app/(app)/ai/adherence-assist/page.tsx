"use client";

import { useMemo, useState } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

type EvidenceSnippet = {
  text: string;
  reason: string;
  source_ids?: string[];
};

type AdherenceResult = {
  assistant?: string;
  version?: string;
  disclaimer?: string;
  criteria_match?: "MET" | "PARTIAL" | "NOT_MET" | "UNCLEAR";
  confidence?: "LOW" | "MEDIUM" | "HIGH";
  evidence_snippets?: EvidenceSnippet[];
  missing_elements?: string[];
  suggested_clinician_feedback_draft?: string;
  sources_used?: string[];
  sanitized_hash?: string;
  redaction_stats?: Record<string, number>;
  denial_reason?: string;
};

export default function AdherenceAssistPage() {
  const today = useMemo(() => new Date(), []);
  const [clinicId, setClinicId] = useState("");
  const [clientId, setClientId] = useState("");
  const [periodStart, setPeriodStart] = useState(toDateInput(new Date(today.getTime() - 7 * 86400000)));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(today));
  const [completionCriteria, setCompletionCriteria] = useState("Describe two coping skills you practiced and how they helped.");
  const [clientResponse, setClientResponse] = useState("I used deep breathing and journaling when I felt overwhelmed.");
  const [assignmentTitle, setAssignmentTitle] = useState("Coping Skills Practice");
  const [program, setProgram] = useState("");

  const [result, setResult] = useState<AdherenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch<AdherenceResult>("/ai/adherence-assist", {
        method: "POST",
        body: JSON.stringify({
          clinicId,
          clientId,
          periodStart,
          periodEnd,
          completion_criteria: completionCriteria,
          client_response: clientResponse,
          context: {
            assignment_title: assignmentTitle || null,
            program: program || null,
          },
        }),
        headers: { "Content-Type": "application/json" },
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireRole roles={["CLINIC_ADMIN", "admin", "therapist"]}>
      <PageLayout
        title="Adherence Evidence Assist"
        subtitle="Draft adherence evidence summaries for clinician review."
        actions={
          <Button variant="primary" onClick={handleRun} isLoading={loading} disabled={!clinicId || !clientId}>
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
            <div className="min-w-[220px]">
              <label className="text-label text-app-muted">Assignment title (optional)</label>
              <Input value={assignmentTitle} onChange={(e) => setAssignmentTitle(e.target.value)} />
            </div>
            <div className="min-w-[200px]">
              <label className="text-label text-app-muted">Program (optional)</label>
              <Input value={program} onChange={(e) => setProgram(e.target.value)} />
            </div>
          </FilterBar>
        }
      >
        <Alert variant="info">
          Draft only. Outputs require clinician review and cannot be used as diagnosis or treatment recommendations.
        </Alert>
        {error && <Alert variant="danger" title="AI request failed">{error}</Alert>}

        <Card>
          <CardHeader>
            <CardTitle>Draft inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-label text-app-muted">Completion criteria</label>
              <Textarea value={completionCriteria} onChange={(e) => setCompletionCriteria(e.target.value)} rows={3} />
            </div>
            <div>
              <label className="text-label text-app-muted">Client response</label>
              <Textarea value={clientResponse} onChange={(e) => setClientResponse(e.target.value)} rows={4} />
            </div>
          </CardContent>
        </Card>

        {!loading && !result && (
          <Alert variant="info">Draft output will appear after you generate a request.</Alert>
        )}

        {result?.denial_reason && (
          <Alert variant="danger">Request denied: {result.denial_reason}</Alert>
        )}

        {result && !result.denial_reason && (
          <div className="space-y-4">
            <Alert variant="info">
              {result.disclaimer || "AI-generated draft for clinician review."}
            </Alert>
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="info">{result.criteria_match}</Badge>
                  <Badge variant="neutral">{result.confidence}</Badge>
                </div>
                <div className="text-app-muted">Suggested feedback:</div>
                <p>{result.suggested_clinician_feedback_draft}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Evidence snippets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {result.evidence_snippets?.length ? (
                  result.evidence_snippets.map((snippet, idx) => (
                    <div key={idx} className="rounded-lg border border-app-border bg-app-surface-2 p-3">
                      <div className="text-app-text">&quot;{snippet.text}&quot;</div>
                      <div className="text-xs text-app-muted mt-1">{snippet.reason}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-app-muted">No evidence snippets provided.</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Redaction + sources</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-app-muted space-y-2">
                <div>Sanitized hash: <span className="text-app-text">{result.sanitized_hash}</span></div>
                <pre className="rounded-lg bg-app-surface-2 p-3 text-xs text-app-text">
                  {JSON.stringify(result.redaction_stats, null, 2)}
                </pre>
                <div>Sources used: {result.sources_used?.length ? result.sources_used.join(", ") : "None"}</div>
              </CardContent>
            </Card>
          </div>
        )}
      </PageLayout>
    </RequireRole>
  );
}
