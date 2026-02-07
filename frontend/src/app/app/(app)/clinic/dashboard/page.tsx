"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clinicDashboard, clinicInviteClient, clinicInviteTherapist, clinicListTherapists } from "@/lib/clinic-api";
import { ClinicDashboard } from "@/lib/types/clinic";
import { useSelectedClientId } from "@/lib/client-selection";
import { useClinicSession } from "../clinic-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";

export default function ClinicDashboardPage() {
  const router = useRouter();
  const { loading: sessionLoading, role } = useClinicSession();
  const { clientId: selectedClientId } = useSelectedClientId();
  const [data, setData] = useState<ClinicDashboard | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7d");
  const [inviteTherapistOpen, setInviteTherapistOpen] = useState(false);
  const [inviteClientOpen, setInviteClientOpen] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [therapistEmail, setTherapistEmail] = useState("");
  const [therapistName, setTherapistName] = useState("");
  const [therapistInviteToken, setTherapistInviteToken] = useState<string | null>(null);
  const [therapistInviteCopied, setTherapistInviteCopied] = useState<string | null>(null);

  const [clientEmail, setClientEmail] = useState("");
  const [clientTherapistId, setClientTherapistId] = useState("");
  const [clientInviteToken, setClientInviteToken] = useState<string | null>(null);
  const [clientInviteCopied, setClientInviteCopied] = useState<string | null>(null);
  const [therapistOptions, setTherapistOptions] = useState<{ id: string; label: string }[]>([]);

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

  useEffect(() => {
    if (role !== "CLINIC_ADMIN") return;
    if (!data?.clinic?.id) return;
    let active = true;
    clinicListTherapists({ limit: 50 })
      .then((res) => {
        if (!active) return;
        setTherapistOptions(
          (res.items ?? []).map((t) => ({ id: t.id, label: t.fullName || t.email })),
        );
      })
      .catch(() => {
        if (!active) return;
        setTherapistOptions([]);
      });
    return () => {
      active = false;
    };
  }, [data?.clinic?.id, role]);

  async function handleInviteTherapist() {
    if (role !== "CLINIC_ADMIN") return;
    setInviteError(null);
    setInviteStatus(null);
    setTherapistInviteToken(null);
    setTherapistInviteCopied(null);
    try {
      const res = await clinicInviteTherapist({
        email: therapistEmail.trim(),
        fullName: therapistName.trim() || undefined,
      });
      setTherapistInviteToken(res.token);
      setInviteStatus("Therapist invite created.");
      setTherapistEmail("");
      setTherapistName("");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleInviteClient() {
    if (role !== "CLINIC_ADMIN") return;
    setInviteError(null);
    setInviteStatus(null);
    setClientInviteToken(null);
    setClientInviteCopied(null);
    try {
      const res = (await clinicInviteClient({
        email: clientEmail.trim(),
        therapistId: clientTherapistId || undefined,
      })) as { token?: string; expires_at?: string };
      if (res?.token) setClientInviteToken(res.token);
      setInviteStatus("Client invite created.");
      setClientEmail("");
      setClientTherapistId("");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err));
    }
  }

  const therapistInviteLink = useMemo(() => {
    if (!therapistInviteToken) return null;
    if (typeof window === "undefined") return null;
    return `${window.location.origin}/auth/accept-clinic-invite?token=${encodeURIComponent(therapistInviteToken)}`;
  }, [therapistInviteToken]);

  const clientInviteLink = useMemo(() => {
    if (!clientInviteToken) return null;
    if (typeof window === "undefined") return null;
    return `${window.location.origin}/auth/accept-invite?token=${encodeURIComponent(clientInviteToken)}`;
  }, [clientInviteToken]);

  async function copyInvite(link: string | null, setter: (value: string | null) => void) {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setter("Copied!");
      setTimeout(() => setter(null), 1500);
    } catch {
      setter("Could not copy.");
      setTimeout(() => setter(null), 2000);
    }
  }

  const clientQuery = selectedClientId
    ? `?clientId=${encodeURIComponent(selectedClientId)}`
    : "";
  const clientRequiredTitle = selectedClientId ? undefined : "Select a client first.";

  const maybeTooltip = (label: string | undefined, disabled: boolean, node: React.ReactNode) => {
    if (!disabled || !label) return node;
    return (
      <Tooltip label={label}>
        <span className="inline-flex">{node}</span>
      </Tooltip>
    );
  };

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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
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

      {status && <p className="text-sm text-app-danger whitespace-pre-wrap">{status}</p>}
      {inviteError && <p className="text-sm text-app-danger whitespace-pre-wrap">{inviteError}</p>}
      {inviteStatus && <p className="text-sm text-app-muted whitespace-pre-wrap">{inviteStatus}</p>}

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

          <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Activity stream</CardTitle>
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
                  <CardTitle>Operations pipeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-app-muted">
                  <div className="flex items-center justify-between">
                    <span>Active therapists</span>
                    <span className="text-app-text font-medium">{data.counts.therapists}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Active clients</span>
                    <span className="text-app-text font-medium">{data.counts.clients}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Responses captured</span>
                    <span className="text-app-text font-medium">{data.counts.responses}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Check-ins captured</span>
                    <span className="text-app-text font-medium">{data.counts.checkinsLast7d}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Action center</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-app-muted mb-2">
                      Invites
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary" onClick={() => setInviteTherapistOpen(true)}>
                        Invite Therapist
                      </Button>
                      <Button variant="secondary" onClick={() => setInviteClientOpen(true)}>
                        Invite Client
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-app-muted mb-2">
                      Review & reporting
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => router.push("/app/review-queue")}>
                        Review Queue
                      </Button>
                      {maybeTooltip(
                        clientRequiredTitle,
                        !selectedClientId,
                        <Button
                          variant="secondary"
                          onClick={() => router.push(`/app/reports/aer${clientQuery}`)}
                          disabled={!selectedClientId}
                        >
                          Generate AER
                        </Button>,
                      )}
                      {maybeTooltip(
                        clientRequiredTitle,
                        !selectedClientId,
                        <Button
                          variant="secondary"
                          onClick={() => router.push(`/app/reports/submission${clientQuery}`)}
                          disabled={!selectedClientId}
                        >
                          Submission Bundle
                        </Button>,
                      )}
                    </div>
                    {!selectedClientId && (
                      <div className="mt-2 text-xs text-app-muted">Select a client to export reports.</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-app-muted mb-2">
                      Library
                    </div>
                    <Button variant="secondary" onClick={() => router.push("/app/library")}>
                      Add Library Content
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Directories & oversight</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-sm text-app-muted">
                  <Link className="text-app-accent" href="/app/clients">
                    Clients
                  </Link>
                  <Link className="text-app-accent" href="/app/clinic/therapists">
                    Therapists
                  </Link>
                  <Link className="text-app-accent" href="/app/escalations">
                    Escalations
                  </Link>
                  <Link className="text-app-accent" href="/app/reports/supervisor-weekly">
                    Supervisor Weekly
                  </Link>
                  <Link className="text-app-accent" href="/app/external-access">
                    External Access
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={inviteTherapistOpen}
        onClose={() => setInviteTherapistOpen(false)}
        title="Invite therapist"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setInviteTherapistOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleInviteTherapist} disabled={!therapistEmail.trim()}>
              Send invite
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            placeholder="Therapist email"
            value={therapistEmail}
            onChange={(e) => setTherapistEmail(e.target.value)}
            type="email"
          />
          <Input
            placeholder="Full name (optional)"
            value={therapistName}
            onChange={(e) => setTherapistName(e.target.value)}
          />
          {therapistInviteToken && (
            <div className="rounded-md border border-app-border bg-app-surface-2 p-3 text-xs text-app-muted break-all">
              <div className="font-medium text-app-text">Invite link</div>
              {therapistInviteLink ? (
                <a className="text-app-accent hover:underline" href={therapistInviteLink}>
                  {therapistInviteLink}
                </a>
              ) : (
                <div>Invite token: {therapistInviteToken}</div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => copyInvite(therapistInviteLink, setTherapistInviteCopied)}
                >
                  Copy link
                </Button>
                {therapistInviteCopied && (
                  <span className="text-xs text-app-muted">{therapistInviteCopied}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={inviteClientOpen}
        onClose={() => setInviteClientOpen(false)}
        title="Invite client"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setInviteClientOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleInviteClient} disabled={!clientEmail.trim()}>
              Send invite
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            placeholder="Client email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            type="email"
          />
          <div>
            <label className="text-label text-app-muted">Assign therapist (optional)</label>
            <Select value={clientTherapistId} onChange={(e) => setClientTherapistId(e.target.value)}>
              <option value="">Unassigned</option>
              {therapistOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          {clientInviteToken && (
            <div className="rounded-md border border-app-border bg-app-surface-2 p-3 text-xs text-app-muted break-all">
              <div className="font-medium text-app-text">Invite link</div>
              {clientInviteLink ? (
                <a className="text-app-accent hover:underline" href={clientInviteLink}>
                  {clientInviteLink}
                </a>
              ) : (
                <div>Invite token: {clientInviteToken}</div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => copyInvite(clientInviteLink, setClientInviteCopied)}
                >
                  Copy link
                </Button>
                {clientInviteCopied && (
                  <span className="text-xs text-app-muted">{clientInviteCopied}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
