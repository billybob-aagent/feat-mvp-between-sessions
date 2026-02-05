"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clinicDashboard } from "@/lib/clinic-api";
import { ClinicDashboard } from "@/lib/types/clinic";
import { useClinicSession } from "../clinic-session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ClinicDashboardPage() {
  const { loading: sessionLoading, role } = useClinicSession();
  const [data, setData] = useState<ClinicDashboard | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7d");

  useEffect(() => {
    if (sessionLoading) return;
    if (role !== "CLINIC_ADMIN") return;
    setLoading(true);
    setStatus(null);
    clinicDashboard()
      .then((res) => setData(res))
      .catch((e) => setStatus(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [sessionLoading, role]);

  const activity = useMemo(
    () => [
      {
        id: "a-1",
        type: "assignment",
        summary: "Assignment activity will appear here.",
        createdAt: new Date().toISOString(),
      },
    ],
    [],
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-h2">{data?.clinic.name ?? "Clinic dashboard"}</h1>
          <p className="text-sm text-app-muted mt-1">
            Operational overview for your clinic.
          </p>
        </div>
        <div className="min-w-[220px]">
          <label className="block text-label text-app-muted mb-1">Date range</label>
          <Select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </Select>
        </div>
      </div>

      {status && <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>}

      {(sessionLoading || loading) && <p className="text-sm text-app-muted">Loading...</p>}

      {!loading && data && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent>
                <div className="text-label text-app-muted">Therapists</div>
                <div className="text-2xl font-semibold mt-2">{data.counts.therapists}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-label text-app-muted">Clients</div>
                <div className="text-2xl font-semibold mt-2">{data.counts.clients}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-label text-app-muted">Responses (7d)</div>
                <div className="text-2xl font-semibold mt-2">{data.counts.responses}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-label text-app-muted">Check-ins (7d)</div>
                <div className="text-2xl font-semibold mt-2">{data.counts.checkinsLast7d}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>Type</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>When</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {activity.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.type}</TableCell>
                        <TableCell>{item.summary}</TableCell>
                        <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-app-muted">Invite therapist</div>
                <Badge variant="info">Stub</Badge>
                <Link
                  href="/app/clinic/billing"
                  className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-2 text-sm text-app-text hover:bg-app-surface-2"
                >
                  View billing
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
