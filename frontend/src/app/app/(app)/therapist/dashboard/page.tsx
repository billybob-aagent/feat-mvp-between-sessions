"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useSelectedClientId } from "@/lib/client-selection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";

type Prompt = { id: string; title: string; content: string };

type InviteResponse = {
  token: string;
  expires_at: string;
};

type ClientItem = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
};

type ActivityItem = {
  id: string;
  type: "assignment" | "response" | "checkin";
  description: string;
  createdAt: string;
};

export default function TherapistDashboard() {
  const router = useRouter();
  const { clientId: selectedClientId } = useSelectedClientId();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteData, setInviteData] = useState<InviteResponse | null>(null);

  const [assignClientId, setAssignClientId] = useState("");
  const [assignPromptId, setAssignPromptId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState<string>("");
  const [assignStatus, setAssignStatus] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [status, setStatus] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const inviteLink = useMemo(() => {
    if (!inviteData?.token) return null;
    return `${window.location.origin}/auth/accept-invite?token=${encodeURIComponent(
      inviteData.token,
    )}`;
  }, [inviteData]);

  const activity: ActivityItem[] = [];

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

  async function loadPrompts() {
    try {
      const data = (await apiFetch("/prompts")) as Prompt[];
      setPrompts(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }

  async function loadClients() {
    try {
      const data = (await apiFetch("/clients/mine")) as ClientItem[];
      setClients(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadPrompts();
    loadClients();
  }, []);

  useEffect(() => {
    if (!assignClientId && clients.length > 0) setAssignClientId(clients[0].id);
  }, [clients, assignClientId]);

  useEffect(() => {
    if (!assignPromptId && prompts.length > 0) setAssignPromptId(prompts[0].id);
  }, [prompts, assignPromptId]);

  async function createPrompt(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setAssignStatus(null);

    try {
      await apiFetch("/prompts/create", {
        method: "POST",
        body: JSON.stringify({ title, content }),
      });

      setTitle("");
      setContent("");
      await loadPrompts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    }
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setAssignStatus(null);
    setCopyStatus(null);
    setInviteData(null);

    try {
      const res = (await apiFetch("/invites/create", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })) as InviteResponse;

      setInviteData(res);
      setInviteEmail("");
      await loadClients();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(null), 1500);
    } catch {
      setCopyStatus("Could not copy (browser blocked clipboard).");
      setTimeout(() => setCopyStatus(null), 2500);
    }
  }

  async function assignPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (assigning) return;

    setAssignStatus(null);
    setStatus(null);

    if (!assignClientId) {
      setAssignStatus("Pick a client first.");
      return;
    }
    if (!assignPromptId) {
      setAssignStatus("Pick a prompt first.");
      return;
    }

    setAssigning(true);
    try {
      const dueDateIso =
        assignDueDate && assignDueDate.trim().length > 0
          ? new Date(`${assignDueDate}T00:00:00`).toISOString()
          : undefined;

      await apiFetch("/assignments/create", {
        method: "POST",
        body: JSON.stringify({
          clientId: assignClientId,
          promptId: assignPromptId,
          dueDate: dueDateIso,
        }),
      });

      const client = clients.find((c) => c.id === assignClientId);
      const prompt = prompts.find((p) => p.id === assignPromptId);

      setAssignStatus(
        `Assigned "${prompt?.title ?? "prompt"}" to ${client?.fullName ?? "client"}.`,
      );
      setAssignDueDate("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAssignStatus(msg);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h1">Therapist dashboard</h1>
          <p className="text-sm text-app-muted mt-1">
            A calm overview of caseload activity, recent signals, and quick actions.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            className="text-app-muted hover:text-app-text"
            href="/app/therapist/assignments"
          >
            View assignments
          </Link>
          <Link className="text-app-muted hover:text-app-text" href="/app/therapist/audit">
            Audit trail
          </Link>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedClientId && (
            <div className="text-sm text-app-muted">Select a client to begin.</div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {maybeTooltip(
              clientRequiredTitle,
              !selectedClientId,
              <Button
                variant="primary"
                onClick={() => router.push(`/app/library${clientQuery}`)}
                disabled={!selectedClientId}
              >
                Assign from Library
              </Button>,
            )}
            {maybeTooltip(
              clientRequiredTitle,
              !selectedClientId,
              <Button
                variant="secondary"
                onClick={() =>
                  selectedClientId ? router.push(`/app/clients/${selectedClientId}`) : null
                }
                disabled={!selectedClientId}
              >
                Send Check-in
              </Button>,
            )}
            <Button
              variant="secondary"
              onClick={() => router.push(`/app/review-queue${clientQuery}`)}
            >
              Review Queue
            </Button>
            {maybeTooltip(
              clientRequiredTitle,
              !selectedClientId,
              <Button
                variant="secondary"
                onClick={() => router.push(`/app/ai/adherence-assist${clientQuery}`)}
                disabled={!selectedClientId}
              >
                Draft Feedback (AI)
              </Button>,
            )}
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
                onClick={() =>
                  selectedClientId ? router.push(`/app/clients/${selectedClientId}`) : null
                }
                disabled={!selectedClientId}
              >
                View Client Profile
              </Button>,
            )}
          </div>
        </CardContent>
      </Card>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent>
            <div className="text-label text-app-muted">Active assignments</div>
            <div className="text-2xl font-semibold mt-2">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-label text-app-muted">Pending responses</div>
            <div className="text-2xl font-semibold mt-2">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-label text-app-muted">Check-ins this week</div>
            <div className="text-2xl font-semibold mt-2">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-label text-app-muted">Alerts</div>
            <div className="mt-2">
              <Badge variant="neutral">No alerts</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="text-sm text-app-muted">
              No recent activity yet. Responses and check-ins will appear here.
            </div>
          ) : (
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
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create invite</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createInvite} className="space-y-3">
              <Input
                placeholder="Client email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                type="email"
              />

              <Button type="submit" variant="primary">
                Create invite
              </Button>
            </form>

            {inviteData && inviteLink && (
              <Card className="mt-4">
                <CardContent>
                  <div className="text-sm font-medium">Invite link</div>

                  <div className="mt-2 text-sm break-all">
                    <a
                      className="text-app-accent hover:underline"
                      href={inviteLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {inviteLink}
                    </a>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Button type="button" onClick={copyInviteLink} variant="secondary">
                      Copy
                    </Button>
                    {copyStatus && (
                      <span className="text-xs text-app-muted">{copyStatus}</span>
                    )}
                  </div>

                  {inviteData.expires_at && (
                    <div className="mt-2 text-xs text-app-muted">
                      Expires: {new Date(inviteData.expires_at).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createPrompt} className="space-y-3">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <textarea
                className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text placeholder:text-app-muted shadow-soft"
                placeholder="Content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />

              <Button type="submit" variant="primary">
                Save prompt
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Assign prompt to client</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={assignPrompt} className="grid md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-label text-app-muted mb-1">Client</label>
              <Select
                value={assignClientId}
                onChange={(e) => setAssignClientId(e.target.value)}
              >
                {clients.length === 0 ? (
                  <option value="">No clients yet</option>
                ) : (
                  clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.email})
                    </option>
                  ))
                )}
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-label text-app-muted mb-1">Prompt</label>
              <Select
                value={assignPromptId}
                onChange={(e) => setAssignPromptId(e.target.value)}
              >
                {prompts.length === 0 ? (
                  <option value="">No prompts yet</option>
                ) : (
                  prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))
                )}
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-label text-app-muted mb-1">Due date (optional)</label>
              <Input
                type="date"
                value={assignDueDate}
                onChange={(e) => setAssignDueDate(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 flex items-end gap-2">
              <Button
                type="submit"
                variant="primary"
                disabled={assigning || clients.length === 0 || prompts.length === 0}
              >
                {assigning ? "Assigning..." : "Assign"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setAssignStatus(null);
                  loadClients();
                  loadPrompts();
                }}
              >
                Refresh lists
              </Button>
            </div>
          </form>

          {assignStatus && (
            <p className="mt-3 text-sm text-app-muted whitespace-pre-wrap">{assignStatus}</p>
          )}

          <p className="mt-3 text-xs text-app-muted">
            Test as the client at{" "}
            <a className="text-app-accent hover:underline" href="/app/client/assignments">
              /app/client/assignments
            </a>{" "}
            (in a different browser/profile or after logging out and logging in as the client).
          </p>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Your prompts</CardTitle>
        </CardHeader>
        <CardContent>
          {prompts.length === 0 ? (
            <div className="text-sm text-app-muted">No prompts yet.</div>
          ) : (
            <div className="space-y-2">
              {prompts.map((p) => (
                <Card key={p.id}>
                  <CardContent>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-sm text-app-muted mt-1">{p.content}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
