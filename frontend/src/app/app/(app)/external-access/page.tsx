"use client";

import { useState } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { ErrorState } from "@/components/page/ErrorState";
import { EmptyState } from "@/components/page/EmptyState";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { useLocalStorageState } from "@/lib/use-local-storage";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

type TokenRow = {
  token_id: string;
  report_type: string;
  expires_at: string;
  url: string;
  created_at: string;
};

type ExternalAccessTokenResponse = {
  token_id: string;
  report_type: string;
  expires_at: string;
  url: string;
};

type ExternalRevokeResponse = {
  token_id: string;
  revoked_at: string | null;
};

export default function ExternalAccessPage() {
  const [clinicId, setClinicId] = useLocalStorageState("bs.clinic.id", "");
  const [clientId, setClientId] = useState("");
  const [start, setStart] = useLocalStorageState("bs.external.start", daysAgoIso(30));
  const [end, setEnd] = useLocalStorageState("bs.external.end", todayIso());
  const [program, setProgram] = useState("");
  const [format, setFormat] = useState("pdf");
  const [ttlMinutes, setTtlMinutes] = useState("60");
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function handleCreate() {
    if (!clinicId || !clientId) {
      setError("Clinic ID and Client ID are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<ExternalAccessTokenResponse>("/external-access/aer", {
        method: "POST",
        body: JSON.stringify({
          clinicId,
          clientId,
          start,
          end,
          program: program.trim() || null,
          format,
          ttlMinutes: ttlMinutes ? Number(ttlMinutes) : undefined,
        }),
        headers: { "Content-Type": "application/json" },
      });
      setTokens((prev) => [
        {
          token_id: res.token_id,
          report_type: res.report_type,
          expires_at: res.expires_at,
          url: res.url,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(tokenId: string) {
    setRevokeError(null);
    try {
      await apiFetch<ExternalRevokeResponse>("/external-access/revoke", {
        method: "POST",
        body: JSON.stringify({ tokenId }),
        headers: { "Content-Type": "application/json" },
      });
      setTokens((prev) => prev.filter((t) => t.token_id !== tokenId));
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore copy failures
    }
  }

  return (
    <RequireRole roles={["CLINIC_ADMIN", "admin"]}>
      <PageLayout
        title="External Access"
        subtitle="Issue and revoke time-limited external AER access tokens."
        actions={
          <Button variant="primary" onClick={handleCreate} isLoading={loading} disabled={!clinicId || !clientId}>
            Issue token
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
            <div className="min-w-[180px]">
              <label className="text-label text-app-muted">Program (optional)</label>
              <Input value={program} onChange={(e) => setProgram(e.target.value)} placeholder="Program name" />
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
              <label className="text-label text-app-muted">Format</label>
              <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <label className="text-label text-app-muted">TTL minutes</label>
              <Input value={ttlMinutes} onChange={(e) => setTtlMinutes(e.target.value)} placeholder="60" />
            </div>
          </FilterBar>
        }
      >
        {error && <ErrorState title="Token issuance failed" message={error} />}
        {revokeError && <ErrorState title="Revoke failed" message={revokeError} />}

        <Card>
          <CardHeader>
            <CardTitle>Issued tokens</CardTitle>
          </CardHeader>
          <CardContent>
            {tokens.length === 0 ? (
              <EmptyState
                title="No tokens issued"
                description="Issue a token to share external AER access."
              />
            ) : (
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Token ID</TableHead>
                    <TableHead>Report</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Actions</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {tokens.map((token) => (
                    <TableRow key={token.token_id}>
                      <TableCell className="font-medium">{token.token_id}</TableCell>
                      <TableCell>
                        <Badge variant={token.report_type === "AER_PDF" ? "info" : "neutral"}>
                          {token.report_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{token.created_at}</TableCell>
                      <TableCell>{token.expires_at}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1">
                          <span className="truncate max-w-[260px]">{token.url}</span>
                          <button
                            type="button"
                            className="text-app-accent"
                            onClick={() => handleCopy(token.url)}
                          >
                            Copy URL
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => handleRevoke(token.token_id)}>
                          Revoke
                        </Button>
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
            <CardTitle>Usage logs</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="info">
              Usage log retrieval is not exposed via API yet. This panel is reserved for future auditing.
            </Alert>
          </CardContent>
        </Card>
      </PageLayout>
    </RequireRole>
  );
}
