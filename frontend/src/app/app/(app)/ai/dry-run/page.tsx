"use client";

import { useState } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";

type DryRunResult = {
  ok?: boolean;
  status?: "ALLOWED" | "DENIED";
  denial_reason?: string;
  sanitized_payload?: Record<string, unknown>;
  redaction_stats?: Record<string, number>;
  sanitized_hash?: string;
};

export default function AiDryRunPage() {
  const [clinicId, setClinicId] = useState("");
  const [purpose, setPurpose] = useState("ADHERENCE_REVIEW");
  const [payload, setPayload] = useState(
    JSON.stringify(
      {
        client_response: "My email is test@example.com and phone is 617-555-1212.",
      },
      null,
      2,
    ),
  );
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(payload);
      const res = await apiFetch<DryRunResult>("/ai/dry-run", {
        method: "POST",
        body: JSON.stringify({ clinicId, purpose, payload: parsed }),
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
        title="AI Dry Run"
        subtitle="Validate redaction and policy outcomes without contacting any provider."
        actions={
          <Button variant="primary" onClick={handleRun} isLoading={loading} disabled={!clinicId}>
            Run dry-run
          </Button>
        }
        filters={
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-label text-app-muted">Clinic ID</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
            </div>
            <div>
              <label className="text-label text-app-muted">Purpose</label>
              <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                <option value="DOCUMENTATION">Documentation</option>
                <option value="ADHERENCE_REVIEW">Adherence review</option>
                <option value="SUPERVISOR_SUMMARY">Supervisor summary</option>
              </Select>
            </div>
          </div>
        }
      >
        {error && <Alert variant="danger" title="Dry run failed">{error}</Alert>}

        <Card>
          <CardHeader>
            <CardTitle>Payload</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea rows={8} value={payload} onChange={(e) => setPayload(e.target.value)} />
          </CardContent>
        </Card>

        {!loading && !result && (
          <Alert variant="info">Run a dry-run to see sanitized output and redaction stats.</Alert>
        )}

        {result && (
          <div className="space-y-4">
            <Alert variant={result.status === "ALLOWED" ? "success" : "danger"}>
              Status: {result.status}
              {result.denial_reason && ` - ${result.denial_reason}`}
            </Alert>
            <Card>
              <CardHeader>
                <CardTitle>Sanitized payload</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[420px] overflow-auto rounded-lg bg-app-surface-2 p-4 text-xs text-app-text">
                  {JSON.stringify(result.sanitized_payload, null, 2)}
                </pre>
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
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Sanitized hash</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-app-muted">
                {result.sanitized_hash}
              </CardContent>
            </Card>
          </div>
        )}
      </PageLayout>
    </RequireRole>
  );
}
