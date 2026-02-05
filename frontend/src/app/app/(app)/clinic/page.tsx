"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clinicDashboard, clinicInviteTherapist, clinicListClients, clinicListTherapists, clinicUpdateSettings } from "@/lib/clinic-api";
import type { ClinicDashboard, ClinicClientListItem, ClinicTherapistListItem } from "@/lib/types/clinic";

export default function ClinicPage() {
  const [tab, setTab] = useState("settings");
  const [dashboard, setDashboard] = useState<ClinicDashboard | null>(null);
  const [therapists, setTherapists] = useState<ClinicTherapistListItem[]>([]);
  const [clients, setClients] = useState<ClinicClientListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState({ name: "", timezone: "" });
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    clinicDashboard()
      .then((res) => {
        setDashboard(res);
        setSettings({ name: res.clinic.name, timezone: res.clinic.timezone });
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const loadTherapists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clinicListTherapists({ limit: 50 });
      setTherapists(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clinicListClients({ limit: 50 });
      setClients(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "therapists" && therapists.length === 0) {
      loadTherapists();
    }
    if (tab === "clients" && clients.length === 0) {
      loadClients();
    }
  }, [tab, therapists.length, clients.length, loadTherapists, loadClients]);

  async function handleSaveSettings() {
    setLoading(true);
    setError(null);
    try {
      const res = await clinicUpdateSettings({ name: settings.name, timezone: settings.timezone });
      setSettingsStatus(`Updated ${res.clinic.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    setLoading(true);
    setError(null);
    try {
      const res = await clinicInviteTherapist({ email: inviteEmail, fullName: inviteName || undefined });
      setInviteToken(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireRole roles={["CLINIC_ADMIN"]}>
      <PageLayout
        title="Clinic Management"
        subtitle="Manage clinic settings, therapists, and clients."
        actions={
          <Button variant="secondary" onClick={() => {
            if (tab === "therapists") loadTherapists();
            if (tab === "clients") loadClients();
          }}>
            Refresh
          </Button>
        }
        filters={
          <Tabs
            items={[
              { id: "settings", label: "Settings" },
              { id: "therapists", label: "Therapists" },
              { id: "clients", label: "Clients" },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      >
        {error && <Alert variant="danger" title="Clinic error">{error}</Alert>}
        {settingsStatus && <Alert variant="success">{settingsStatus}</Alert>}

        {tab === "settings" && (
          <Card>
            <CardHeader>
              <CardTitle>Clinic settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-label text-app-muted">Clinic name</label>
                <Input value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
              </div>
              <div>
                <label className="text-label text-app-muted">Timezone</label>
                <Input value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={handleSaveSettings} isLoading={loading}>
                  Save settings
                </Button>
                {dashboard && (
                  <span className="text-xs text-app-muted">Clinic ID: {dashboard.clinic.id}</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "therapists" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Invite therapist</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="text-label text-app-muted">Email</label>
                  <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-label text-app-muted">Full name (optional)</label>
                  <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button variant="primary" onClick={handleInvite} isLoading={loading}>
                    Create invite
                  </Button>
                </div>
                {inviteToken && (
                  <div className="md:col-span-3 text-xs text-app-muted">
                    Invite token: <span className="text-app-text">{inviteToken}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Therapists</CardTitle>
              </CardHeader>
              <CardContent>
                {therapists.length === 0 && (
                  <Alert variant="info">No therapists loaded yet.</Alert>
                )}
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Clients</TableHead>
                      <TableHead>Assignments</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {therapists.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.fullName}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.clientCount}</TableCell>
                        <TableCell>{row.assignmentCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "clients" && (
          <Card>
            <CardHeader>
              <CardTitle>Clients</CardTitle>
            </CardHeader>
            <CardContent>
              {clients.length === 0 && <Alert variant="info">No clients loaded yet.</Alert>}
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Therapist</TableHead>
                    <TableHead>Responses</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {clients.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.fullName}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.therapistName ?? row.therapistId}</TableCell>
                      <TableCell>{row.responseCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </PageLayout>
    </RequireRole>
  );
}
