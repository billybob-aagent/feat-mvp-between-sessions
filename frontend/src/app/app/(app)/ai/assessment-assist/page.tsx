"use client";

import { useState } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";

type DraftSection = { title: string; content: string };
type EvidenceMapping = { input_key: string; used_in_section: string };

type AssessmentResult = {
  assistant?: string;
  version?: string;
  disclaimer?: string;
  draft_sections?: DraftSection[];
  gaps_questions?: string[];
  evidence_mapping?: EvidenceMapping[];
  sources_used?: string[];
  sanitized_hash?: string;
  redaction_stats?: Record<string, number>;
  denial_reason?: string;
};

export default function AssessmentAssistPage() {
  const [clinicId, setClinicId] = useState("");
  const [clientId, setClientId] = useState("");
  const [assessmentType, setAssessmentType] = useState("ASAM");
  const [inputs, setInputs] = useState(
    JSON.stringify(
      {
        D1: "No acute withdrawal reported.",
        D2: "Reports hypertension; compliant with meds.",
        D3: "Anxiety symptoms 3x/week.",
      },
      null,
      2,
    ),
  );
  const [note, setNote] = useState("Draft summary requested for clinician review.");

  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(inputs);
      const res = await apiFetch<AssessmentResult>("/ai/assessment-assist", {
        method: "POST",
        body: JSON.stringify({
          clinicId,
          clientId,
          assessment_type: assessmentType,
          inputs: parsed,
          note: note || null,
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
        title="Assessment Draft Assist"
        subtitle="Generate draft assessment sections for clinician review."
        actions={
          <Button variant="primary" onClick={handleRun} isLoading={loading} disabled={!clinicId || !clientId}>
            Generate draft
          </Button>
        }
        filters={
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-label text-app-muted">Clinic ID</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
            </div>
            <div>
              <label className="text-label text-app-muted">Client ID</label>
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client UUID" />
            </div>
            <div>
              <label className="text-label text-app-muted">Assessment type</label>
              <Select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)}>
                <option value="ASAM">ASAM</option>
                <option value="BIOPSYCHOSOCIAL">Biopsychosocial</option>
                <option value="MENTAL_STATUS">Mental status</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
          </div>
        }
      >
        <Alert variant="info">
          Draft only. Outputs require clinician review and cannot be used as diagnosis or treatment recommendations.
        </Alert>
        {error && <Alert variant="danger" title="AI request failed">{error}</Alert>}

        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-label text-app-muted">Structured inputs (JSON)</label>
              <Textarea rows={8} value={inputs} onChange={(e) => setInputs(e.target.value)} />
            </div>
            <div>
              <label className="text-label text-app-muted">Note (optional)</label>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
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
            <Alert variant="info">{result.disclaimer || "AI-generated draft for clinician review."}</Alert>
            <Card>
              <CardHeader>
                <CardTitle>Draft sections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.draft_sections?.map((section, idx) => (
                  <div key={idx} className="rounded-lg border border-app-border bg-app-surface-2 p-3">
                    <div className="text-sm font-medium text-app-text">{section.title}</div>
                    <div className="text-sm text-app-muted mt-1">{section.content}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Gaps & questions</CardTitle>
              </CardHeader>
              <CardContent>
                {result.gaps_questions?.length ? (
                  <ul className="list-disc pl-5 text-sm text-app-muted space-y-1">
                    {result.gaps_questions.map((gap: string, idx: number) => (
                      <li key={idx}>{gap}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-app-muted">No gaps flagged.</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Evidence mapping</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-app-muted">
                {result.evidence_mapping?.length ? (
                  result.evidence_mapping.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Badge variant="neutral">{item.input_key}</Badge>
                      <span>-&gt;</span>
                      <span>{item.used_in_section}</span>
                    </div>
                  ))
                ) : (
                  <div>No mappings provided.</div>
                )}
                <div className="mt-2">Sanitized hash: <span className="text-app-text">{result.sanitized_hash}</span></div>
              </CardContent>
            </Card>
          </div>
        )}
      </PageLayout>
    </RequireRole>
  );
}
