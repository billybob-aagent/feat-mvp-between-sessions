"use client";

import { useEffect, useState } from "react";
import { clinicBilling } from "@/lib/clinic-api";
import { ClinicBilling } from "@/lib/types/clinic";
import { useClinicSession } from "../clinic-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ClinicBillingPage() {
  const { loading: sessionLoading, role } = useClinicSession();
  const [data, setData] = useState<ClinicBilling | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (role !== "CLINIC_ADMIN") return;
    setLoading(true);
    setStatus(null);
    clinicBilling()
      .then((res) => setData(res))
      .catch((e) => setStatus(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [sessionLoading, role]);

  return (
    <main className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Billing</h1>
          <p className="text-sm text-app-muted">Subscription settings for the clinic.</p>
        </div>
      </div>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}
      {(sessionLoading || loading) && (
        <p className="text-sm text-app-muted">Loading...</p>
      )}
      {!loading && data && (
        <Card>
          <CardContent className="flex items-center justify-between">
            <div className="text-sm text-app-muted">
              Billing is not configured yet for clinic {data.clinicId}.
            </div>
            <Button type="button" disabled>
              Configure billing
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
