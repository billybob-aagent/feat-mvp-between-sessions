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

  const aerStart = useLocalStorageState("bs.aer.start", "")[0];
  const aerEnd = useLocalStorageState("bs.aer.end", "")[0];

  const [inviteTherapistOpen, setInviteTherapistOpen] = useState(false);
  const [inviteClientOpen, setInviteClientOpen] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [therapistEmail, setTherapistEmail] = useState("");
  const [therapistName, setTherapistName] = useState("");
  const [therapistInviteToken, setTherapistInviteToken] = useState<string | null>(null);

  const [clientEmail, setClientEmail] = useState("");
  const [clientTherapistId, setClientTherapistId] = useState("");
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
    try {
      const payload: { email: string; therapistId?: string; clinicId?: string } = {
        email: clientEmail.trim(),
        therapistId: clientTherapistId || undefined,
      };
      if (isAdmin && clinicId) payload.clinicId = clinicId;
      await clinicInviteClient(payload);
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

  const aerRangeLabel = useMemo(() => {
    if (aerStart && aerEnd) return `${aerStart} → ${aerEnd}`;
    return "Last 30 days";
  }, [aerStart, aerEnd]);

  const clientQuery = selectedClientId
    ? `?clientId=${encodeURIComponent(selectedClientId)}`
    : "";

  const clientRequiredTitle = selectedClientId ? undefined : "Select a client first.";
  const canInvite = canManageClinic && (!isAdmin || !!clinicId);

  return (
    <RequireRole roles={["CLINIC_ADMIN", "admin", "therapist"]}>
      <PageLayout
        title="Dashboard"
        subtitle="Clinic-level operational overview and report entry points."
        actions={
          canManageClinic ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => router.push(`/app/reports/aer${clientQuery}`)}
                disabled={!selectedClientId}
                title={clientRequiredTitle}
              >
                Generate AER
              </Button>
              <Button variant="secondary" onClick={() => router.push("/app/review-queue")}>
                Review Queue
              </Button>
              <Button variant="secondary" onClick={() => router.push("/app/reports/submission")}>
                Submission Bundle
              </Button>
            </div>
          ) : (
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

        {!loading && data && (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Therapists" value={data.counts.therapists} />
            <StatCard label="Clients" value={data.counts.clients} />
            <StatCard label="Assignments" value={data.counts.assignments} />
            <StatCard label="Responses (7d)" value={data.counts.responses} />
          </div>
        )}

        {!loading && !data && (
          <Alert variant="info" title="No clinic metrics loaded">
            For therapist roles, this dashboard is read-only. Use the Reports and AI Assist
            sections to work with client data.
          </Alert>
        )}

        {!loading && data && data.counts.therapists === 0 && data.counts.clients === 0 && (
          <Alert variant="info" title="Invite a therapist or client to start">
            Your clinic is ready. Invite staff or clients to begin capturing between-session evidence.
          </Alert>
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

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {canManageClinic && (
            <Card className="xl:col-span-4">
              <CardHeader>
                <CardTitle>Clinic admin actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => setInviteTherapistOpen(true)}
                  disabled={!canInvite}
                  title={!canInvite ? "Select a clinic context first." : undefined}
                >
                  Invite Therapist
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setInviteClientOpen(true)}
                  disabled={!canInvite}
                  title={!canInvite ? "Select a clinic context first." : undefined}
                >
                  Invite Client
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push(isAdmin ? "/app/admin/library" : "/app/library")}
                >
                  Add Library Content
                </Button>
                <Button variant="secondary" onClick={() => router.push("/app/review-queue")}>
                  Review Queue
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push(`/app/reports/aer${clientQuery}`)}
                  disabled={!selectedClientId}
                  title={clientRequiredTitle}
                >
                  Generate AER
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push(`/app/reports/submission${clientQuery}`)}
                  disabled={!selectedClientId}
                  title={clientRequiredTitle}
                >
                  Download Submission Bundle
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>AER snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-app-muted">
              <div>Default range: {aerRangeLabel}</div>
              <div>Clinic context: {clinicId || "Set on Reports pages"}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                  href="/app/reports/aer"
                >
                  Generate AER
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                  href="/app/reports/rollup"
                >
                  View rollup
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-app-muted">
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span>Needs review</span>
                  <span className="text-app-text font-medium">{data?.counts.responses ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Overdue check-ins</span>
                  <span className="text-app-text font-medium">—</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Open escalations</span>
                  <span className="text-app-text font-medium">—</span>
                </div>
              </div>
              <div className="text-xs text-app-muted">
                Drill into Clients and Escalations for queue-level detail.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Between Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-app-muted">
              <p>Clients, assignments, check-ins, and response review.</p>
              <div className="flex flex-wrap items-center gap-2">
                <Link className="text-app-accent text-xs" href="/app/clients">
                  Clients
                </Link>
                <Link className="text-app-accent text-xs" href="/app/assignments">
                  Assignments
                </Link>
                <Link className="text-app-accent text-xs" href="/app/responses">
                  Responses
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supervisor workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-app-muted">
              <p>Weekly packet and escalation visibility.</p>
              <div className="flex flex-wrap items-center gap-2">
                <Link className="text-app-accent text-xs" href="/app/reports/supervisor-weekly">
                  Weekly packet
                </Link>
                <Link className="text-app-accent text-xs" href="/app/escalations">
                  Escalations
                </Link>
              </div>
            </CardContent>
          </Card>

          {canManageClinic && (
            <Card className="xl:col-span-4">
              <CardHeader>
                <CardTitle>Operations</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 text-sm text-app-muted">
                <Link
                  href="/app/clinic/therapists"
                  className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                >
                  Therapists directory
                </Link>
                <Link
                  href="/app/clients"
                  className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                >
                  Clients
                </Link>
                <Link
                  href="/app/escalations"
                  className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                >
                  Escalations
                </Link>
                <Link
                  href="/app/reports/supervisor-weekly"
                  className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                >
                  Supervisor Weekly
                </Link>
                <Link
                  href="/app/external-access"
                  className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                >
                  External Access
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

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
                Invite token: {therapistInviteToken}
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
          </div>
        </Dialog>
      </PageLayout>
    </RequireRole>
  );
}
