"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { clinicGetClient } from "@/lib/clinic-api";
import { ClinicClientDetail } from "@/lib/types/clinic";
import { useClinicSession } from "../../clinic-session";
import { Card, CardContent } from "@/components/ui/card";

export default function ClinicClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { loading: sessionLoading, role } = useClinicSession();
  const [detail, setDetail] = useState<ClinicClientDetail | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (role !== "CLINIC_ADMIN") return;
    setLoading(true);
    setStatus(null);
    clinicGetClient(clientId)
      .then((res) => setDetail(res))
      .catch((e) => setStatus(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [sessionLoading, role, clientId]);

  return (
    <main className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Client detail</h1>
          <p className="text-sm text-app-muted">Summary and activity.</p>
        </div>
        <Link href="/app/clinic/clients" className="text-sm text-app-muted hover:text-app-text">
          Back to clients
        </Link>
      </div>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}
      {(sessionLoading || loading) && (
        <p className="text-sm text-app-muted">Loading...</p>
      )}

      {!loading && detail && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2">
              <div className="font-semibold">{detail.fullName}</div>
              <div className="text-xs text-app-muted">{detail.email}</div>
              <div className="text-xs text-app-muted">
                Therapist: {detail.therapistName ?? detail.therapistId}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent>
                <div className="text-xs text-app-muted">Assignments</div>
                <div className="text-2xl font-semibold mt-2">{detail.assignmentCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-xs text-app-muted">Responses</div>
                <div className="text-2xl font-semibold mt-2">{detail.responseCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-xs text-app-muted">Check-ins</div>
                <div className="text-2xl font-semibold mt-2">{detail.checkinCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent>
              <div className="text-sm font-semibold">Recent activity</div>
              <div className="text-xs text-app-muted mt-2">
                Last check-in: {detail.lastCheckinAt ? new Date(detail.lastCheckinAt).toLocaleString() : "-"}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
