"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/use-me";
import { useLocalStorageState } from "@/lib/use-local-storage";
import {
  clinicDashboard,
  clinicInviteClient,
  clinicInviteTherapist,
  clinicListClientInvites,
  clinicListClients,
  clinicListTherapistInvites,
  clinicListTherapists,
  clinicUpdateSettings,
} from "@/lib/clinic-api";
import { clinicianListAssignments, createAssignmentFromLibrary, libraryItems } from "@/lib/api";
import type { LibraryItemListRow } from "@/lib/types/library";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { NotAuthorized } from "@/components/page/NotAuthorized";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type BasicClinic = {
  id: string;
  name: string;
  timezone: string;
};

type TherapistOption = {
  id: string;
  name: string;
};

type ClientOption = {
  id: string;
  name: string;
};

type LibraryItemOption = {
  id: string;
  title: string;
  contentType: string | null;
};

export default function OnboardingPage() {
  const { me, loading: meLoading } = useMe();
  const isClinicAdmin = me?.role === "CLINIC_ADMIN";
  const isAdmin = me?.role === "admin";
  const canAccess = isClinicAdmin || isAdmin;

  const [clinicId, setClinicId] = useLocalStorageState("bs.clinic.id", "");

  const [clinic, setClinic] = useState<BasicClinic | null>(null);
  const [assignmentsExist, setAssignmentsExist] = useState(false);
  const [therapists, setTherapists] = useState<TherapistOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [library, setLibrary] = useState<LibraryItemOption[]>([]);
  const [therapistInvites, setTherapistInvites] = useState(0);
  const [clientInvites, setClientInvites] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [clinicName, setClinicName] = useState("");
  const [clinicTimezone, setClinicTimezone] = useState("");

  const [therapistEmail, setTherapistEmail] = useState("");
  const [therapistName, setTherapistName] = useState("");
  const [therapistInviteToken, setTherapistInviteToken] = useState<string | null>(null);

  const [clientEmail, setClientEmail] = useState("");
  const [clientTherapistId, setClientTherapistId] = useState("");

  const [assignmentClientId, setAssignmentClientId] = useState("");
  const [assignmentItemId, setAssignmentItemId] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");
  const [assignmentDueDate, setAssignmentDueDate] = useState("");

  const stepClinicReady = clinicName.trim().length > 0 && clinicTimezone.trim().length > 0;
  const stepTherapistReady = therapists.length > 0 || therapistInvites > 0;
  const stepClientReady = clients.length > 0 || clientInvites > 0;
  const stepAssignmentReady = assignmentsExist;

  const canLoad = useMemo(() => {
    if (!canAccess) return false;
    if (isAdmin && !clinicId) return false;
    return true;
  }, [canAccess, isAdmin, clinicId]);

  const loadData = useCallback(async () => {
    if (!canLoad) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      let clinicInfo: BasicClinic | null = null;
      if (isClinicAdmin) {
        const dash = await clinicDashboard();
        clinicInfo = {
          id: dash.clinic.id,
          name: dash.clinic.name,
          timezone: dash.clinic.timezone,
        };
        if (!clinicId) setClinicId(dash.clinic.id);
        setAssignmentsExist((dash.counts?.assignments ?? 0) > 0);
      }

      const [therapistRes, clientRes, therapistInviteRes, clientInviteRes, libraryRes, assignmentsRes] =
        await Promise.all([
          clinicListTherapists({ limit: 50, clinicId: isAdmin ? clinicId : undefined }),
          clinicListClients({ limit: 50, clinicId: isAdmin ? clinicId : undefined }),
          clinicListTherapistInvites({ clinicId: isAdmin ? clinicId : undefined }),
          clinicListClientInvites({ clinicId: isAdmin ? clinicId : undefined }),
          libraryItems({ status: "PUBLISHED", clinicId: isAdmin ? clinicId : undefined }),
          clinicianListAssignments({ limit: 1, clinicId: isAdmin ? clinicId : undefined }),
        ]);

      setTherapists(
        (therapistRes.items ?? []).map((t) => ({
          id: t.id,
          name: t.fullName || t.email,
        })),
      );
      setClients(
        (clientRes.items ?? []).map((c) => ({
          id: c.id,
          name: c.fullName || c.email,
        })),
      );
      setTherapistInvites(therapistInviteRes.length);
      setClientInvites(clientInviteRes.length);

      const libraryPayload = libraryRes as { items?: LibraryItemListRow[] };
      const libraryRows = Array.isArray(libraryPayload.items) ? libraryPayload.items : [];
      setLibrary(
        libraryRows.map((item) => ({
          id: item.id,
          title: item.title,
          contentType: item.contentType ?? null,
        })),
      );

      const assignmentPayload = assignmentsRes as { items?: unknown[] };
      setAssignmentsExist((assignmentPayload.items ?? []).length > 0);

      if (clinicInfo) {
        setClinic(clinicInfo);
        setClinicName(clinicInfo.name || "");
        setClinicTimezone(clinicInfo.timezone || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [canLoad, clinicId, isAdmin, isClinicAdmin, setClinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSaveClinic() {
    if (!isClinicAdmin) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await clinicUpdateSettings({
        name: clinicName.trim(),
        timezone: clinicTimezone.trim(),
      });
      setClinic({ id: res.clinic.id, name: res.clinic.name, timezone: res.clinic.timezone });
      setClinicName(res.clinic.name);
      setClinicTimezone(res.clinic.timezone);
      setStatus("Clinic basics saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteTherapist() {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const payload: { email: string; fullName?: string; clinicId?: string } = {
        email: therapistEmail.trim(),
        fullName: therapistName.trim() || undefined,
      };
      if (isAdmin && clinicId) payload.clinicId = clinicId;
      const res = await clinicInviteTherapist(payload);
      setTherapistInviteToken(res.token);
      setStatus("Therapist invite created.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteClient() {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const payload: { email: string; therapistId?: string; clinicId?: string } = {
        email: clientEmail.trim(),
        therapistId: clientTherapistId || undefined,
      };
      if (isAdmin && clinicId) payload.clinicId = clinicId;
      await clinicInviteClient(payload);
      setStatus("Client invite created.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign() {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      await createAssignmentFromLibrary({
        clinicId: isAdmin ? clinicId : undefined,
        clientId: assignmentClientId,
        libraryItemId: assignmentItemId,
        note: assignmentNote.trim() || undefined,
        dueDate: assignmentDueDate || undefined,
      });
      setStatus("Assignment created.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (meLoading) {
    return <div className="text-sm text-app-muted">Loading...</div>;
  }

  if (!canAccess) {
    return <NotAuthorized message="Onboarding is available to clinic admins and admins." />;
  }

  return (
    <PageLayout
      title="Clinic Onboarding"
      subtitle="Complete the first clinic setup steps in under 10 minutes."
      actions={
        <Button variant="secondary" onClick={loadData} disabled={loading || !canLoad}>
          Refresh
        </Button>
      }
      filters={
        <FilterBar>
          <div className="min-w-[240px]">
            <label className="text-label text-app-muted">Clinic ID</label>
            <Input
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              placeholder="Clinic UUID"
              disabled={isClinicAdmin}
            />
          </div>
          <div className="flex items-end text-xs text-app-muted">
            {isAdmin && !clinicId && "Admin requires a clinic ID to load onboarding."}
            {isClinicAdmin && clinic?.id && (
              <span>Clinic loaded: {clinic?.id}</span>
            )}
          </div>
        </FilterBar>
      }
    >
      <Alert variant="info" title="Pilot Mode">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>Pilot Mode:</span>
          <Link className="text-app-text underline" href="/app/onboarding">
            Seed
          </Link>
          <span>→</span>
          <Link className="text-app-text underline" href="/app/review-queue">
            Review Queue
          </Link>
          <span>→</span>
          <Link className="text-app-text underline" href="/app/reports/aer">
            Generate AER
          </Link>
          <span>→</span>
          <Link className="text-app-text underline" href="/app/pilot">
            View Metrics
          </Link>
        </div>
      </Alert>

      {error && <Alert variant="danger" title="Onboarding error">{error}</Alert>}
      {status && <Alert variant="success">{status}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span>1) Clinic basics</span>
            <Badge variant={stepClinicReady ? "success" : "warning"}>
              {stepClinicReady ? "Complete" : "Pending"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>2) Staff invite sent</span>
            <Badge variant={stepTherapistReady ? "success" : "warning"}>
              {stepTherapistReady ? "Complete" : "Pending"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>3) Client invite sent</span>
            <Badge variant={stepClientReady ? "success" : "warning"}>
              {stepClientReady ? "Complete" : "Pending"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>4) First assignment sent</span>
            <Badge variant={stepAssignmentReady ? "success" : "warning"}>
              {stepAssignmentReady ? "Complete" : "Pending"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Clinic basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-label text-app-muted">Clinic name</label>
            <Input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              disabled={!isClinicAdmin}
            />
          </div>
          <div>
            <label className="text-label text-app-muted">Timezone</label>
            <Input
              value={clinicTimezone}
              onChange={(e) => setClinicTimezone(e.target.value)}
              disabled={!isClinicAdmin}
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <Button variant="primary" onClick={handleSaveClinic} disabled={!isClinicAdmin || loading}>
              Save clinic basics
            </Button>
            {!isClinicAdmin && (
              <span className="text-xs text-app-muted">Clinic admin permissions required.</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Invite staff</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-label text-app-muted">Therapist email</label>
            <Input value={therapistEmail} onChange={(e) => setTherapistEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-label text-app-muted">Full name (optional)</label>
            <Input value={therapistName} onChange={(e) => setTherapistName(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="primary" onClick={handleInviteTherapist} disabled={loading || !therapistEmail.trim()}>
              Send invite
            </Button>
          </div>
          {therapistInviteToken && (
            <div className="md:col-span-3 text-xs text-app-muted">
              Invite token: <span className="text-app-text">{therapistInviteToken}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Invite a client</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-label text-app-muted">Client email</label>
            <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-label text-app-muted">Assign to therapist</label>
            <Select value={clientTherapistId} onChange={(e) => setClientTherapistId(e.target.value)}>
              <option value="">Select therapist</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="primary"
              onClick={handleInviteClient}
              disabled={loading || !clientEmail.trim() || !clientTherapistId}
            >
              Send invite
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 4: Assign the first library item</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-label text-app-muted">Client</label>
            <Select value={assignmentClientId} onChange={(e) => setAssignmentClientId(e.target.value)}>
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-label text-app-muted">Library item</label>
            <Select value={assignmentItemId} onChange={(e) => setAssignmentItemId(e.target.value)}>
              <option value="">Select item</option>
              {library.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} {item.contentType ? `(${item.contentType})` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-label text-app-muted">Due date (optional)</label>
            <Input type="date" value={assignmentDueDate} onChange={(e) => setAssignmentDueDate(e.target.value)} />
          </div>
          <div>
            <label className="text-label text-app-muted">Note (optional)</label>
            <Input value={assignmentNote} onChange={(e) => setAssignmentNote(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <Button
              variant="primary"
              onClick={handleAssign}
              disabled={loading || !assignmentClientId || !assignmentItemId}
            >
              Create assignment
            </Button>
            {library.length === 0 && (
              <span className="text-xs text-app-muted">No published library items found.</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-app-muted">
          <Link className="text-app-text hover:underline" href="/app/clients">
            Go to clients
          </Link>
          <Link className="text-app-text hover:underline" href="/app/review-queue">
            Go to review queue
          </Link>
          <Link className="text-app-text hover:underline" href="/app/reports/aer">
            Generate an AER
          </Link>
          <Link className="text-app-text hover:underline" href="/app/reports/supervisor-weekly">
            Generate supervisor weekly packet
          </Link>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
