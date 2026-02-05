"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  dueDate: string | null;
  createdAt: string;
  status: "draft" | "published";
  publishedAt: string | null;
  title: string;
  description: string | null;
  client: ClientItem;
};

export default function EditAssignmentPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const router = useRouter();

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<string>("");

  async function loadAll() {
    setLoading(true);
    setStatus(null);
    try {
      const [assignmentData, clientData] = await Promise.all([
        apiFetch(`/assignments/therapist/${encodeURIComponent(assignmentId)}`),
        apiFetch("/clients/mine"),
      ]);

      const detail = assignmentData as AssignmentDetail;
      const list = Array.isArray(clientData) ? (clientData as ClientItem[]) : [];

      setAssignment(detail);
      setClients(list);

      setClientId(detail.client.id);
      setTitle(detail.title);
      setDescription(detail.description ?? "");
      setDueDate(detail.dueDate ? detail.dueDate.slice(0, 10) : "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
      setAssignment(null);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus(null);

    try {
      const payload = {
        clientId,
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
      };

      const updated = (await apiFetch(
        `/assignments/therapist/${encodeURIComponent(assignmentId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      )) as AssignmentDetail;

      setAssignment(updated);
      setStatus("Saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(nextPublished: boolean) {
    if (saving) return;
    setSaving(true);
    setStatus(null);

    try {
      const updated = (await apiFetch(
        `/assignments/therapist/${encodeURIComponent(assignmentId)}/publish`,
        {
          method: "PATCH",
          body: JSON.stringify({ published: nextPublished }),
        },
      )) as AssignmentDetail;

      setAssignment(updated);
      setStatus(nextPublished ? "Published" : "Unpublished");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-sm text-app-muted">Loading...</p>
      </main>
    );
  }

  if (!assignment) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-10">
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm text-app-muted">Assignment not found.</p>
            <Link href="/app/therapist/assignments" className="text-sm text-app-muted hover:text-app-text">
              Back to assignments
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const published = assignment.status === "published";

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Edit assignment</h1>
          <p className="text-sm text-app-muted">Update details and publish when ready.</p>
        </div>
        <Link href="/app/therapist/assignments" className="text-sm text-app-muted hover:text-app-text">
          Back to assignments
        </Link>
      </div>

      <div className="mb-4 text-xs text-app-muted">
        Status: {published ? "Published" : "Draft"}
        {assignment.publishedAt
          ? ` • Published ${new Date(assignment.publishedAt).toLocaleDateString()}`
          : ""}
      </div>

      {status && (
        <p className="mb-4 text-sm text-app-muted whitespace-pre-wrap">{status}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assignment details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
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

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>

              <Button
                type="button"
                onClick={() => togglePublish(!published)}
                disabled={saving}
                variant="secondary"
              >
                {published ? "Unpublish" : "Publish"}
              </Button>

              <Button
                type="button"
                onClick={() => router.replace(`/app/therapist/assignments/${assignmentId}/responses`)}
                variant="ghost"
              >
                View responses
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
