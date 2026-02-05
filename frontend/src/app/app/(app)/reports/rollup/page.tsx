"use client";

import { useMemo, useState } from "react";
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

type RollupSummary = {
  clients_in_scope?: number;
  interventions_assigned?: number;
  completion_rate?: number;
  noncompliance_rate?: number;
};

type RollupClientRow = {
  client_id: string;
  display_id?: string | null;
  assigned?: number;
  completed?: number;
  partial?: number;
  missed?: number;
  late?: number;
  completion_rate?: number;
  risk_flag?: "high" | "watch" | "ok" | string;
  last_activity_at?: string | null;
};

type AerRollupResponse = {
  summary?: RollupSummary;
  client_rows?: RollupClientRow[];
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

export default function AerRollupPage() {
  const [clinicId, setClinicId] = useLocalStorageState("bs.clinic.id", "");
  const [program, setProgram] = useState("");
  const [start, setStart] = useLocalStorageState("bs.rollup.start", daysAgoIso(30));
  const [end, setEnd] = useLocalStorageState("bs.rollup.end", todayIso());
  const [limit, setLimit] = useLocalStorageState("bs.rollup.limit", 100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AerRollupResponse | null>(null);
  const [sortKey, setSortKey] = useState<"risk" | "completion" | "missed" | "client">("risk");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: "risk" | "completion" | "missed" | "client") {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    if (!data?.client_rows) return [];
    const rows = [...data.client_rows];
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortKey === "risk") {
        const order = { high: 0, watch: 1, ok: 2 } as Record<string, number>;
        const aRisk = order[a.risk_flag ?? "ok"] ?? 3;
        const bRisk = order[b.risk_flag ?? "ok"] ?? 3;
        return (aRisk - bRisk) * dir;
      }
      if (sortKey === "completion") {
        return ((a.completion_rate ?? 0) - (b.completion_rate ?? 0)) * dir;
      }
      if (sortKey === "missed") {
        return ((a.missed ?? 0) - (b.missed ?? 0)) * dir;
      }
      return String(a.client_id).localeCompare(String(b.client_id)) * dir;
    });
    return rows;
  }, [data, sortKey, sortDir]);

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
        limit: String(limit),
      });
      if (program.trim()) qs.set("program", program.trim());
      const res = await apiFetch<AerRollupResponse>(
        `/reports/aer-rollup/${encodeURIComponent(clinicId)}?${qs.toString()}`,
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
      title="AER Rollup"
      subtitle="Program-level adherence summary for supervisory review."
      actions={
        <Button variant="primary" onClick={handleGenerate} disabled={!clinicId || loading}>
          {loading ? "Generating..." : "Generate rollup"}
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
          <label className="text-label text-app-muted">Limit</label>
          <Input value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))} />
        </div>
        <div className="min-w-[160px]">
          <label className="text-label text-app-muted">Start</label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="min-w-[160px]">
          <label className="text-label text-app-muted">End</label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="min-w-[160px]">
          <label className="text-label text-app-muted">Sort</label>
          <Select
            value={sortKey}
            onChange={(e) =>
              setSortKey(e.target.value as "risk" | "completion" | "missed" | "client")
            }
          >
            <option value="risk">Risk</option>
            <option value="completion">Completion rate</option>
            <option value="missed">Missed</option>
            <option value="client">Client ID</option>
          </Select>
          <Select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
            className="mt-2"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </Select>
        </div>
      </FilterBar>

      {error && (
        <ErrorState title="Rollup failed" message={error} actionLabel="Retry" onAction={handleGenerate} />
      )}

      {loading && <TableSkeleton rows={6} />}

      {!loading && !data && !error && (
        <EmptyState
          title="Generate a rollup"
          description="Enter a clinic ID and date range to review adherence risk."
        />
      )}

      {data && (
        <div className="space-y-4">
          {data.not_available?.length ? <NotAvailableBanner items={data.not_available} /> : null}

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Clients in scope</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {data.summary?.clients_in_scope ?? 0}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Interventions assigned</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {data.summary?.interventions_assigned ?? 0}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Completion rate</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatPercent(data.summary?.completion_rate)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Noncompliance rate</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatPercent(data.summary?.noncompliance_rate)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Client rows</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sortedRows.length === 0 && (
                <div className="p-4">
                  <EmptyState title="No clients returned" description="Adjust filters and retry." />
                </div>
              )}
              {sortedRows.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("client")}>
                          Client ID
                        </button>
                      </TableHead>
                      <TableHead>Display</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("missed")}>
                          Missed
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("completion")}>
                          Completion
                        </button>
                      </TableHead>
                      <TableHead>Risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((row) => (
                      <TableRow key={row.client_id}>
                        <TableCell className="text-xs text-app-muted">{row.client_id}</TableCell>
                        <TableCell>{row.display_id ?? "-"}</TableCell>
                        <TableCell>{row.assigned ?? 0}</TableCell>
                        <TableCell>{row.completed ?? 0}</TableCell>
                        <TableCell>{row.missed ?? 0}</TableCell>
                        <TableCell>{formatPercent(row.completion_rate)}</TableCell>
                        <TableCell>
                          <Badge variant={riskVariant(row.risk_flag)}>
                            {row.risk_flag ?? "ok"}
                          </Badge>
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
