"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { StatCard } from "@/components/page/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/use-me";
import {
  clinicDashboard,
  clinicInviteClient,
  clinicInviteTherapist,
  clinicListTherapists,
} from "@/lib/clinic-api";
import { useLocalStorageState } from "@/lib/use-local-storage";
import { useSelectedClientId } from "@/lib/client-selection";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClinicDashboard } from "@/lib/types/clinic";

export default function DashboardPage() {
  const { me } = useMe();
  const router = useRouter();
  const role = me?.role ?? null;
  const isClinicAdmin = role === "CLINIC_ADMIN";
  const isAdmin = role === "admin";
  const canManageClinic = isClinicAdmin || isAdmin;
  const { clientId: selectedClientId } = useSelectedClientId();
  const [data, setData] = useState<ClinicDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicId, setClinicId] = useLocalStorageState("bs.clinic.id", "");

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
    const canLoad = me?.role === "CLINIC_ADMIN";
    if (!canLoad) return;

    setLoading(true);
    setError(null);

    clinicDashboard()
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [me?.role]);

  useEffect(() => {
    if (data?.clinic?.id) setClinicId(data.clinic.id);
  }, [data?.clinic?.id, setClinicId]);

  useEffect(() => {
    if (!canManageClinic) return;
    if (isAdmin && !clinicId) return;
    let active = true;

    clinicListTherapists({ limit: 50, clinicId: isAdmin ? clinicId : undefined })
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
  }, [canManageClinic, clinicId, isAdmin]);

  async function handleInviteTherapist() {
    if (!canManageClinic) return;
    if (isAdmin && !clinicId) {
      setInviteError("Select a clinic context first.");
      return;
    }
    setInviteError(null);
    setInviteStatus(null);
    setTherapistInviteToken(null);
    setTherapistInviteCopied(null);
    try {
      const payload: { email: string; fullName?: string; clinicId?: string } = {
        email: therapistEmail.trim(),
        fullName: therapistName.trim() || undefined,
      };
      if (isAdmin && clinicId) payload.clinicId = clinicId;
      const res = await clinicInviteTherapist(payload);
      setTherapistInviteToken(res.token);
      setInviteStatus("Therapist invite created.");
      setTherapistEmail("");
      setTherapistName("");
      if (isClinicAdmin) {
        await clinicDashboard().then((dash) => setData(dash));
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleInviteClient() {
    if (!canManageClinic) return;
    if (isAdmin && !clinicId) {
      setInviteError("Select a clinic context first.");
      return;
    }
    setInviteError(null);
    setInviteStatus(null);
    setClientInviteToken(null);
    setClientInviteCopied(null);
    try {
      const payload: { email: string; therapistId?: string; clinicId?: string } = {
        email: clientEmail.trim(),
        therapistId: clientTherapistId || undefined,
      };
      if (isAdmin && clinicId) payload.clinicId = clinicId;
      const res = (await clinicInviteClient(payload)) as { token?: string; expires_at?: string };
      if (res?.token) setClientInviteToken(res.token);
      setInviteStatus("Client invite created.");
      setClientEmail("");
      setClientTherapistId("");
      if (isClinicAdmin) {
        await clinicDashboard().then((dash) => setData(dash));
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err));
    }
  }

  const clientQuery = selectedClientId
    ? `?clientId=${encodeURIComponent(selectedClientId)}`
    : "";

  const clientRequiredTitle = selectedClientId ? undefined : "Select a client first.";
  const canInvite = canManageClinic && (!isAdmin || !!clinicId);
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
    <RequireRole roles={["CLINIC_ADMIN", "admin", "therapist"]}>
      <PageLayout
        title="Dashboard"
        subtitle="Clinic-level operational overview and report entry points."
        actions={
          canManageClinic ? undefined : (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => router.push("/app/therapist/dashboard")}>
                Therapist dashboard
              </Button>
            </div>
          )
        }
      >
        {error && <Alert variant="danger" title="Failed to load dashboard">{error}</Alert>}

        {loading && (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        )}

        {inviteError && (
          <Alert variant="danger" title="Invite failed">
            {inviteError}
          </Alert>
        )}
        {inviteStatus && (
          <Alert variant="success" title="Invite status">
            {inviteStatus}
          </Alert>
        )}

        {!loading && !data && (
          <Alert variant="info" title="No clinic metrics loaded">
            For therapist roles, this dashboard is read-only. Use the Reports and AI Assist
            sections to work with client data.
          </Alert>
        )}

        {!loading && data && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="Therapists" value={data.counts.therapists} />
              <StatCard label="Clients" value={data.counts.clients} />
              <StatCard label="Assignments" value={data.counts.assignments} />
              <StatCard label="Responses (7d)" value={data.counts.responses} />
            </div>

            {data.counts.therapists === 0 && data.counts.clients === 0 && (
              <Alert variant="info" title="Invite a therapist or client to start">
                Your clinic is ready. Invite staff or clients to begin capturing between-session evidence.
              </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
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
                      <span>Assignments assigned</span>
                      <span className="text-app-text font-medium">{data.counts.assignments}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Responses captured</span>
                      <span className="text-app-text font-medium">{data.counts.responses}</span>
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
                    {canManageClinic && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-app-muted mb-2">
                          Invites
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {maybeTooltip(
                            !canInvite ? "Select a clinic context first." : undefined,
                            !canInvite,
                            <Button
                              variant="primary"
                              onClick={() => setInviteTherapistOpen(true)}
                              disabled={!canInvite}
                            >
                              Invite Therapist
                            </Button>,
                          )}
                          {maybeTooltip(
                            !canInvite ? "Select a clinic context first." : undefined,
                            !canInvite,
                            <Button
                              variant="secondary"
                              onClick={() => setInviteClientOpen(true)}
                              disabled={!canInvite}
                            >
                              Invite Client
                            </Button>,
                          )}
                        </div>
                      </div>
                    )}
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
                            Download Submission Bundle
                          </Button>,
                        )}
                      </div>
                      {!selectedClientId && (
                        <div className="mt-2 text-xs text-app-muted">
                          Select a client to export reports.
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-app-muted mb-2">
                        Library
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => router.push(isAdmin ? "/app/admin/library" : "/app/library")}
                      >
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
                    <Link className="text-app-accent" href="/app/clinic/therapists">
                      Therapists directory
                    </Link>
                    <Link className="text-app-accent" href="/app/clients">
                      Clients
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
                  <Button type="button" variant="secondary" onClick={() => copyInvite(therapistInviteLink, setTherapistInviteCopied)}>
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
              <Select
                value={clientTherapistId}
                onChange={(e) => setClientTherapistId(e.target.value)}
              >
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
                  <Button type="button" variant="secondary" onClick={() => copyInvite(clientInviteLink, setClientInviteCopied)}>
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
      </PageLayout>
    </RequireRole>
  );
}
