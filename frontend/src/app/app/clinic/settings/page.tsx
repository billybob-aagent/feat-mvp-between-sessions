"use client";

import { useEffect, useState } from "react";
import { clinicUpdateSettings } from "@/lib/clinic-api";
import { ClinicSettings } from "@/lib/types/clinic";
import { useClinicSession } from "../clinic-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ClinicSettingsPage() {
  const { loading: sessionLoading, role } = useClinicSession();
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ClinicSettings | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (role !== "CLINIC_ADMIN") return;
  }, [sessionLoading, role]);

  async function onSave() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await clinicUpdateSettings({});
      setResult(res);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Settings</h1>
          <p className="text-sm text-app-muted">Branding and preferences.</p>
        </div>
      </div>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}
      <Card>
        <CardContent className="space-y-4">
          <div className="text-sm text-app-muted">
            Settings are stubbed for now. Use this area to configure clinic branding later.
          </div>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save (stub)"}
          </Button>
          {result && (
            <div className="text-xs text-app-muted">
              Updated clinic: {result.clinic.name}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
