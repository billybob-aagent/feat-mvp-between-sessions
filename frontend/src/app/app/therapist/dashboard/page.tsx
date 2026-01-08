"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

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

export default function TherapistDashboard() {
  const router = useRouter();

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteData, setInviteData] = useState<InviteResponse | null>(null);

  // Assign prompt form
  const [assignClientId, setAssignClientId] = useState("");
  const [assignPromptId, setAssignPromptId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState<string>(""); // yyyy-mm-dd
  const [assignStatus, setAssignStatus] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [status, setStatus] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const inviteLink = useMemo(() => {
    if (!inviteData?.token) return null;
    return `${window.location.origin}/auth/accept-invite?token=${encodeURIComponent(
      inviteData.token,
    )}`;
  }, [inviteData]);

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

  // Keep defaults sensible when data loads
  useEffect(() => {
    if (!assignClientId && clients.length > 0) setAssignClientId(clients[0].id);
  }, [clients, assignClientId]);

  useEffect(() => {
    if (!assignPromptId && prompts.length > 0) setAssignPromptId(prompts[0].id);
  }, [prompts, assignPromptId]);

  async function doLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setStatus(null);

    try {
      await apiFetch("/auth/logout", { method: "POST", json: {} });
    } catch {
      // ignore
    } finally {
      router.replace("/auth/login");
    }
  }

  async function createPrompt(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setAssignStatus(null);

    try {
      await apiFetch("/prompts/create", {
        method: "POST",
        json: { title, content },
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
        json: { email: inviteEmail.trim() },
      })) as InviteResponse;

      setInviteData(res);
      setInviteEmail("");
      // New client will appear only after they accept, but reloading doesn’t hurt.
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
        json: {
          clientId: assignClientId,
          promptId: assignPromptId,
          dueDate: dueDateIso,
        },
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
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Therapist Dashboard</h1>

        <button
          type="button"
          onClick={doLogout}
          disabled={loggingOut}
          className="border rounded px-3 py-2 text-sm disabled:opacity-60"
        >
          {loggingOut ? "Logging out..." : "Log out"}
        </button>
      </div>

      {status && (
        <p className="mb-4 text-sm text-red-600 whitespace-pre-wrap">{status}</p>
      )}

      <section className="grid md:grid-cols-2 gap-8">
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Create Invite</h2>

          <form onSubmit={createInvite} className="space-y-2">
            <input
              className="w-full border p-2 rounded"
              placeholder="Client email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              type="email"
            />

            <button
              className="px-4 py-2 bg-black text-white rounded"
              type="submit"
            >
              Create invite
            </button>
          </form>

          {inviteData && inviteLink && (
            <div className="mt-4 border rounded p-3 text-sm">
              <div className="font-medium">Invite link</div>

              <div className="mt-1 break-all">
                <a
                  className="underline"
                  href={inviteLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  {inviteLink}
                </a>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="border rounded px-3 py-1 text-sm"
                  onClick={copyInviteLink}
                >
                  Copy
                </button>
                {copyStatus && (
                  <span className="text-xs text-gray-600">{copyStatus}</span>
                )}
              </div>

              {inviteData.expires_at && (
                <div className="mt-2 text-xs text-gray-500">
                  Expires: {new Date(inviteData.expires_at).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Create Prompt</h2>

          <form onSubmit={createPrompt} className="space-y-2">
            <input
              className="w-full border p-2 rounded"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <textarea
              className="w-full border p-2 rounded"
              placeholder="Content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />

            <button
              className="px-4 py-2 bg-black text-white rounded"
              type="submit"
            >
              Save prompt
            </button>
          </form>
        </div>
      </section>

      <section className="mt-8 border rounded p-4">
        <h2 className="font-semibold mb-3">Assign Prompt to Client</h2>

        <form onSubmit={assignPrompt} className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Client</label>
            <select
              className="w-full border p-2 rounded"
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
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Prompt</label>
            <select
              className="w-full border p-2 rounded"
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
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Due date (optional)</label>
            <input
              type="date"
              className="w-full border p-2 rounded"
              value={assignDueDate}
              onChange={(e) => setAssignDueDate(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 flex items-end gap-2">
            <button
              type="submit"
              disabled={assigning || clients.length === 0 || prompts.length === 0}
              className="px-4 py-2 bg-black text-white rounded disabled:opacity-60"
            >
              {assigning ? "Assigning..." : "Assign"}
            </button>

            <button
              type="button"
              className="px-4 py-2 border rounded"
              onClick={() => {
                setAssignStatus(null);
                loadClients();
                loadPrompts();
              }}
            >
              Refresh lists
            </button>
          </div>
        </form>

        {assignStatus && (
          <p className="mt-3 text-sm whitespace-pre-wrap">{assignStatus}</p>
        )}

        <p className="mt-3 text-xs text-gray-600">
          Test as the client at{" "}
          <a className="underline" href="/app/client/assignment">
            /app/client/assignment
          </a>{" "}
          (in a different browser/profile or after logging out and logging in as the client).
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold mb-2">Your Prompts</h2>

        <ul className="space-y-2">
          {prompts.map((p) => (
            <li key={p.id} className="border rounded p-3">
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-gray-700">{p.content}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

