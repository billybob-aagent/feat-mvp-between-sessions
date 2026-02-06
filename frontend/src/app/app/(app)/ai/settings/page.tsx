"use client";

import { useState } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

type AiSettings = {
  clinicId: string;
  enabled: boolean;
  updatedAt?: string | null;
};

export default function AiSettingsPage() {
  const [clinicId, setClinicId] = useState("");
  const [enabled, setEnabled] = useState("false");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    if (!clinicId) {
      setError("Clinic ID is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AiSettings>(`/ai/settings/${encodeURIComponent(clinicId)}`);
      setEnabled(String(Boolean(res.enabled)));
      setStatus(`Loaded settings for clinic ${clinicId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!clinicId) {
      setError("Clinic ID is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AiSettings>(`/ai/settings/${encodeURIComponent(clinicId)}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: enabled === "true" }),
        headers: { "Content-Type": "application/json" },
      });
      setStatus(`Updated: enabled=${res.enabled}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireRole roles={["CLINIC_ADMIN", "admin"]}>
      <PageLayout
        title="AI Settings"
        subtitle="Enable or disable AI tooling per clinic."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleLoad} isLoading={loading} disabled={!clinicId}>
              Load
            </Button>
            <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!clinicId}>
              Save
            </Button>
          </div>
        }
        filters={
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-label text-app-muted">Clinic ID</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
            </div>
            <div>
              <label className="text-label text-app-muted">AI Enabled</label>
              <Select value={enabled} onChange={(e) => setEnabled(e.target.value)}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </Select>
            </div>
          </div>
        }
      >
        {error && <Alert variant="danger" title="Settings failed">{error}</Alert>}
        {status && <Alert variant="success" title="Status">{status}</Alert>}

        <Card>
          <CardHeader>
            <CardTitle>Policy notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-app-muted space-y-2">
            <p>AI assist is draft-only and subject to clinic-level enablement.</p>
            <p>Client-facing AI is disabled in this phase.</p>
          </CardContent>
        </Card>
      </PageLayout>
    </RequireRole>
  );
}
