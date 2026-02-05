"use client";

import { useState } from "react";
import { useLocalStorageState } from "@/lib/use-local-storage";
import { apiFetch } from "@/lib/api";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { NotAvailableBanner } from "@/components/page/NotAvailableBanner";
import { ErrorState } from "@/components/page/ErrorState";
import { EmptyState } from "@/components/page/EmptyState";
import { TableSkeleton } from "@/components/page/Skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPercent } from "@/lib/format";

type WeeklyPacketSummary = {
  clients_in_scope?: number;
  interventions_assigned?: number;
  completion_rate?: number;
  noncompliance_rate?: number;
};

type WeeklyRollup = {
  summary?: WeeklyPacketSummary;
  not_available?: string[];
};

type WeeklyClientRow = {
  rank: number;
  client_id: string;
  display_id?: string | null;
  risk_flag?: "high" | "watch" | "ok" | string;
  completion_rate?: number;
  missed?: number;
  escalation?: { status?: string; overdue?: boolean; escalation_id?: string | null };
  internal_links?: { aer_json?: string; aer_pdf?: string };
  external_links?: { aer_json?: string; aer_pdf?: string } | null;
};

type WeeklyEscalationRow = {
  escalation_id: string;
  client_id: string;
  reason: string;
  status: string;
  created_at: string;
  sla?: { age_hours?: number; overdue?: boolean };
  links?: { resolve?: string };
};

type WeeklyEscalations = {
  open_count?: number;
  overdue_count?: number;
  rows?: WeeklyEscalationRow[];
};

type WeeklyPacket = {
  rollup?: WeeklyRollup;
  top_risk_clients?: WeeklyClientRow[];
  escalations?: WeeklyEscalations;
  not_available?: string[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const riskVariant = (risk?: string) => {
  if (risk === "high") return "danger";
  if (risk === "watch") return "warning";
  return "neutral";
};

export default function SupervisorWeeklyPage() {
  const [clinicId, setClinicId] = useLocalStorageState("bs.clinic.id", "");
  const [program, setProgram] = useState("");
  const [start, setStart] = useLocalStorageState("bs.weekly.start", daysAgoIso(7));
  const [end, setEnd] = useLocalStorageState("bs.weekly.end", todayIso());
  const [top, setTop] = useLocalStorageState("bs.weekly.top", 10);
  const [includeExternal, setIncludeExternal] = useState("false");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeeklyPacket | null>(null);

  async function handleGenerate() {
    if (!clinicId) {
      setError("Clinic ID is required.");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const qs = new URLSearchParams({
        start,
        end,
        top: String(top),
        includeExternalLinks: includeExternal,
      });
      if (program.trim()) qs.set("program", program.trim());
      const res = await apiFetch<WeeklyPacket>(
        `/reports/supervisor-weekly-packet/${encodeURIComponent(clinicId)}?${qs.toString()}`,
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageLayout
      title="Supervisor Weekly Packet"
      subtitle="Weekly risk packet with escalation overlay and rollup summary."
      actions={
        <Button variant="primary" onClick={handleGenerate} disabled={!clinicId || loading}>
          {loading ? "Generating..." : "Generate packet"}
        </Button>
      }
    >

      <FilterBar>
        <div className="min-w-[220px]">
          <label className="text-label text-app-muted">Clinic ID</label>
          <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
        </div>
        <div className="min-w-[180px]">
          <label className="text-label text-app-muted">Program (optional)</label>
          <Input value={program} onChange={(e) => setProgram(e.target.value)} placeholder="Program name" />
          <div className="text-xs text-app-muted mt-1">Best-effort filter.</div>
        </div>
        <div className="min-w-[120px]">
          <label className="text-label text-app-muted">Top clients</label>
          <Input value={String(top)} onChange={(e) => setTop(Number(e.target.value))} />
        </div>
        <div className="min-w-[160px]">
          <label className="text-label text-app-muted">Start</label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="min-w-[160px]">
          <label className="text-label text-app-muted">End</label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="min-w-[180px]">
          <label className="text-label text-app-muted">External links</label>
          <Select value={includeExternal} onChange={(e) => setIncludeExternal(e.target.value)}>
            <option value="false">Disabled</option>
            <option value="true">Include external tokens</option>
          </Select>
          <div className="text-xs text-app-muted mt-1">Admins only; tokens are time-limited.</div>
        </div>
      </FilterBar>

      {error && (
        <ErrorState title="Packet failed" message={error} actionLabel="Retry" onAction={handleGenerate} />
      )}

      {loading && <TableSkeleton rows={6} />}

      {!loading && !data && !error && (
        <EmptyState
          title="Generate weekly packet"
          description="Enter a clinic ID and date range to view supervisor summary."
        />
      )}

      {data && (
        <div className="space-y-4">
          {data.not_available?.length ? <NotAvailableBanner items={data.not_available} /> : null}

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Clients in scope</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {data.rollup?.summary?.clients_in_scope ?? 0}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Open escalations</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {data.escalations?.open_count ?? 0}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Overdue escalations</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {data.escalations?.overdue_count ?? 0}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top risk clients</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.top_risk_clients?.length === 0 && (
                <div className="p-4">
                  <EmptyState title="No top-risk clients" description="Try expanding the date range." />
                </div>
              )}
              {data.top_risk_clients && data.top_risk_clients.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead>Missed</TableHead>
                      <TableHead>Escalation</TableHead>
                      <TableHead>Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.top_risk_clients.map((row) => (
                      <TableRow key={row.client_id}>
                        <TableCell>{row.rank}</TableCell>
                        <TableCell>{row.client_id}</TableCell>
                        <TableCell>
                          <Badge variant={riskVariant(row.risk_flag)}>{row.risk_flag ?? "ok"}</Badge>
                        </TableCell>
                        <TableCell>{formatPercent(row.completion_rate)}</TableCell>
                        <TableCell>{row.missed ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant={row.escalation?.status === "OPEN" ? "warning" : "neutral"}>
                            {row.escalation?.status ?? "NONE"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="space-y-1">
                            <a className="text-app-accent" href={row.internal_links?.aer_json}>
                              AER JSON
                            </a>
                            <a className="text-app-accent" href={row.internal_links?.aer_pdf}>
                              AER PDF
                            </a>
                            {row.external_links && (
                              <div className="space-y-1">
                                <a className="text-app-accent" href={row.external_links?.aer_json}>
                                  External JSON
                                </a>
                                <a className="text-app-accent" href={row.external_links?.aer_pdf}>
                                  External PDF
                                </a>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Escalations overlay</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.escalations?.rows?.length === 0 && (
                <div className="p-4">
                  <EmptyState title="No escalations" description="Escalations will appear here when created." />
                </div>
              )}
              {data.escalations?.rows && data.escalations.rows.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Escalation</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Overdue</TableHead>
                      <TableHead>Resolve</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.escalations.rows.map((row) => (
                      <TableRow key={row.escalation_id}>
                        <TableCell>{row.reason}</TableCell>
                        <TableCell>{row.client_id}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "OPEN" ? "warning" : "neutral"}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-app-muted">
                          {row.created_at}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.sla?.overdue ? "danger" : "neutral"}>
                            {row.sla?.overdue ? "Overdue" : "On track"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.links?.resolve ? (
                            <a className="text-app-accent text-xs" href={row.links.resolve}>
                              Resolve
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
