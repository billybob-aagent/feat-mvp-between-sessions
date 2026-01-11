"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ClientItem = {
  id: string;
  fullName: string;
  email: string;
};

type AssignmentDetail = {
  id: string;
};

export default function NewAssignmentPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [createEmail, setCreateEmail] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<string>("");

  async function loadClients() {
    setLoading(true);
    setStatus(null);
    try {
      const data = (await apiFetch("/clients/mine")) as ClientItem[];
      const list = Array.isArray(data) ? data : [];
      setClients(list);
      if (!clientId && list.length > 0) setClientId(list[0].id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus(null);

    try {
      const payload = {
        clientId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : undefined,
      };

      const created = (await apiFetch("/assignments", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as AssignmentDetail;

      router.replace(`/app/therapist/assignments/${created.id}/edit`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setSaving(false);
    }
  }

  const inviteLink = inviteToken
    ? `${window.location.origin}/auth/accept-invite?token=${encodeURIComponent(inviteToken)}`
    : null;

  async function submitInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteStatus(null);
    setInviteToken(null);
    setInviteExpiresAt(null);

    try {
      const res = (await apiFetch("/invites/create", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })) as { token: string; expires_at?: string };
      setInviteToken(res.token);
      setInviteExpiresAt(res.expires_at ?? null);
      setInviteStatus("Invite created. Email send pending.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setInviteStatus(msg);
    }
  }

  async function submitCreateClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (creatingClient) return;
    setCreatingClient(true);
    setInviteStatus(null);

    try {
      const created = (await apiFetch("/clients/create", {
        method: "POST",
        body: JSON.stringify({
          email: createEmail.trim(),
          fullName: createFullName.trim(),
          password: createPassword,
        }),
      })) as ClientItem;

      setCreateEmail("");
      setCreateFullName("");
      setCreatePassword("");
      await loadClients();
      if (created?.id) setClientId(created.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setInviteStatus(msg);
    } finally {
      setCreatingClient(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">New assignment</h1>
          <p className="text-sm text-app-muted">
            Create a draft assignment for a client.
          </p>
        </div>
        <Link href="/app/therapist/assignments" className="text-sm text-app-muted hover:text-app-text">
          Back to assignments
        </Link>
      </div>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}

      {loading ? (
        <p className="text-sm text-app-muted">Loading...</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assignment details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="text-label text-app-muted">Client</label>
                  <Select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.email})
                      </option>
                    ))}
                  </Select>
                  {clients.length === 0 && (
                    <p className="mt-2 text-xs text-app-muted">
                      No clients yet. Add one below to continue.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-label text-app-muted">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Assignment title"
                    required
                  />
                </div>

                <div>
                  <label className="text-label text-app-muted">Description</label>
                  <textarea
                    className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft"
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Instructions for the client"
                  />
                </div>

                <div>
                  <label className="text-label text-app-muted">Due date (optional)</label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <Button type="submit" variant="primary" disabled={saving || !clientId}>
                  {saving ? "Saving..." : "Create draft"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Invite client</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitInvite} className="space-y-3">
                  <div>
                    <label className="text-label text-app-muted">Client email</label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="client@example.com"
                      required
                    />
                  </div>
                  <Button type="submit">Create invite</Button>
                </form>

                {inviteStatus && (
                  <p className="mt-3 text-sm text-app-muted whitespace-pre-wrap">
                    {inviteStatus}
                  </p>
                )}

                {inviteLink && (
                  <div className="mt-3 rounded-md border border-app-border bg-app-surface-2 p-3 text-xs">
                    <div className="font-medium text-app-muted">Invite link</div>
                    <div className="break-all text-app-text">{inviteLink}</div>
                    {inviteExpiresAt && (
                      <div className="text-app-muted mt-1">
                        Expires: {new Date(inviteExpiresAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Create client</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitCreateClient} className="space-y-3">
                  <div>
                    <label className="text-label text-app-muted">Client email</label>
                    <Input
                      type="email"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      placeholder="client@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-label text-app-muted">Full name</label>
                    <Input
                      value={createFullName}
                      onChange={(e) => setCreateFullName(e.target.value)}
                      placeholder="Client name"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-label text-app-muted">Password</label>
                    <Input
                      type="password"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      placeholder="Temporary password"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={creatingClient}>
                    {creatingClient ? "Creating..." : "Create client"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
