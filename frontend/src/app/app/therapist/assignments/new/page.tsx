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

              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving..." : "Create draft"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
