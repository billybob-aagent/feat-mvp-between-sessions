"use client";

import { useMemo, useState } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonTable } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

type EscalationRow = {
  id: string;
  clientId: string;
  reason: string;
  status: "OPEN" | "RESOLVED";
  sla?: { age_hours?: number; overdue?: boolean };
};

type EscalationListResponse = {
  rows?: EscalationRow[];
};

export default function EscalationsPage() {
  const today = useMemo(() => new Date(), []);
  const [clinicId, setClinicId] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [start, setStart] = useState(toDateInput(new Date(today.getTime() - 29 * 86400000)));
  const [end, setEnd] = useState(toDateInput(today));
  const [limit, setLimit] = useState("50");

  const [rows, setRows] = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPayload, setCreatePayload] = useState({
    clientId: "",
    periodStart: start,
    periodEnd: end,
    reason: "MISSED_INTERVENTIONS",
    note: "",
    assignToTherapistId: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleFetch() {
    if (!clinicId) {
      setError("Clinic ID is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ status, start, end, limit });
      const res = await apiFetch<EscalationListResponse>(`/supervisor-actions/escalations/${encodeURIComponent(clinicId)}?${qs.toString()}`);
      setRows(res.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve() {
    if (!resolveId || !clinicId) return;
    setResolveError(null);
    try {
      await apiFetch(`/supervisor-actions/escalate/${encodeURIComponent(resolveId)}/resolve`, {
        method: "POST",
        body: JSON.stringify({ clinicId, note: resolveNote || null }),
        headers: { "Content-Type": "application/json" },
      });
      setResolveOpen(false);
      setResolveNote("");
      await handleFetch();
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCreate() {
    if (!clinicId) {
      setCreateError("Clinic ID is required.");
      return;
    }
    if (!createPayload.clientId) {
      setCreateError("Client ID is required.");
      return;
    }
    setCreateError(null);
    try {
      await apiFetch("/supervisor-actions/escalate", {
        method: "POST",
        body: JSON.stringify({
          clinicId,
          clientId: createPayload.clientId,
          periodStart: createPayload.periodStart,
          periodEnd: createPayload.periodEnd,
          reason: createPayload.reason,
          note: createPayload.note || null,
          assignToTherapistId: createPayload.assignToTherapistId || null,
        }),
        headers: { "Content-Type": "application/json" },
      });
      setCreateOpen(false);
      setCreatePayload({
        clientId: "",
        periodStart: start,
        periodEnd: end,
        reason: "MISSED_INTERVENTIONS",
        note: "",
        assignToTherapistId: "",
      });
      await handleFetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <RequireRole roles={["CLINIC_ADMIN", "admin"]}>
      <PageLayout
        title="Escalations"
        subtitle="Review and resolve supervisor escalations with SLA tracking."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleFetch} isLoading={loading} disabled={!clinicId}>
              Refresh list
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)} disabled={!clinicId}>
              New escalation
            </Button>
          </div>
        }
        filters={
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-label text-app-muted">Clinic ID</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
            </div>
            <div>
              <label className="text-label text-app-muted">Status</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="RESOLVED">Resolved</option>
                <option value="ALL">All</option>
              </Select>
            </div>
            <div>
              <label className="text-label text-app-muted">Limit</label>
              <Input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="50" />
            </div>
            <div>
              <label className="text-label text-app-muted">Start</label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="text-label text-app-muted">End</label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        }
      >
        {error && <Alert variant="danger" title="Escalations failed">{error}</Alert>}
        {loading ? (
          <SkeletonTable />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Escalation list</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 && (
                <Alert variant="info">No escalations found for the selected period.</Alert>
              )}
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Age (hours)</TableHead>
                    <TableHead>Overdue</TableHead>
                    <TableHead>Actions</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.id}</TableCell>
                      <TableCell>{row.clientId}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === "OPEN" ? "warning" : "success"}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.sla?.age_hours?.toFixed?.(2) ?? row.sla?.age_hours}</TableCell>
                      <TableCell>
                        <Badge variant={row.sla?.overdue ? "danger" : "neutral"}>
                          {row.sla?.overdue ? "Overdue" : "On time"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.status === "OPEN" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setResolveId(row.id);
                              setResolveOpen(true);
                            }}
                          >
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog
          open={resolveOpen}
          onClose={() => setResolveOpen(false)}
          title="Resolve escalation"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResolveOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleResolve}>
                Resolve
              </Button>
            </div>
          }
        >
          {resolveError && <Alert variant="danger">{resolveError}</Alert>}
          <div className="space-y-3">
            <div className="text-sm text-app-muted">Escalation ID: {resolveId}</div>
            <div>
              <label className="text-label text-app-muted">Resolution note (optional)</label>
              <Textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} rows={4} />
            </div>
          </div>
        </Dialog>

        <Dialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Create escalation"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreate}>
                Create
              </Button>
            </div>
          }
        >
          {createError && <Alert variant="danger">{createError}</Alert>}
          <div className="grid gap-3">
            <div>
              <label className="text-label text-app-muted">Client ID</label>
              <Input
                value={createPayload.clientId}
                onChange={(e) => setCreatePayload({ ...createPayload, clientId: e.target.value })}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-label text-app-muted">Period start</label>
                <Input
                  type="date"
                  value={createPayload.periodStart}
                  onChange={(e) => setCreatePayload({ ...createPayload, periodStart: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label text-app-muted">Period end</label>
                <Input
                  type="date"
                  value={createPayload.periodEnd}
                  onChange={(e) => setCreatePayload({ ...createPayload, periodEnd: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-label text-app-muted">Reason</label>
              <Select
                value={createPayload.reason}
                onChange={(e) => setCreatePayload({ ...createPayload, reason: e.target.value })}
              >
                <option value="MISSED_INTERVENTIONS">Missed interventions</option>
                <option value="LOW_COMPLETION">Low completion</option>
                <option value="NO_ACTIVITY">No activity</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div>
              <label className="text-label text-app-muted">Assign to therapist (optional)</label>
              <Input
                value={createPayload.assignToTherapistId}
                onChange={(e) => setCreatePayload({ ...createPayload, assignToTherapistId: e.target.value })}
                placeholder="Therapist UUID"
              />
            </div>
            <div>
              <label className="text-label text-app-muted">Note (optional)</label>
              <Textarea
                value={createPayload.note}
                onChange={(e) => setCreatePayload({ ...createPayload, note: e.target.value })}
                rows={4}
              />
            </div>
          </div>
        </Dialog>
      </PageLayout>
    </RequireRole>
  );
}
