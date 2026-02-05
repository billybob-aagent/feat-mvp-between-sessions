"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AssignmentDetail = {
  id: string;
  dueDate: string | null;
  title: string;
  description: string | null;
  responseCount?: number;
  librarySource?: {
    itemId: string;
    version: number | null;
    title: string | null;
    slug: string | null;
    contentType: string | null;
  } | null;
};

type MyResponseMeta = {
  id: string;
  createdAt?: string | null;
  reviewedAt?: string | null;
  flaggedAt?: string | null;
  mood: number;
};

function draftKey(assignmentId: string) {
  return `draft:assignment:${assignmentId}`;
}

export default function ClientAssignmentDetailPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const { me, loading: sessionLoading } = useMe();

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [history, setHistory] = useState<MyResponseMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const [mood, setMood] = useState<number>(5);
  const [reflection, setReflection] = useState<string>("");
  const [optionalPrompt, setOptionalPrompt] = useState<string>("");
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);

  const dueLabel = useMemo(() => {
    if (!assignment?.dueDate) return "-";
    return new Date(assignment.dueDate).toLocaleDateString();
  }, [assignment?.dueDate]);

  async function loadAll() {
    setLoading(true);
    setStatus(null);
    setSubmittedOk(false);

    try {
      const a = (await apiFetch(
        `/assignments/mine/${encodeURIComponent(assignmentId)}`,
      )) as AssignmentDetail;
      setAssignment(a);

      const r = (await apiFetch(
        `/responses/client/assignment/${encodeURIComponent(assignmentId)}`,
      )) as MyResponseMeta[];

      setHistory(Array.isArray(r) ? r : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
      setAssignment(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionLoading) return;
    if (me?.role !== "client") return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, sessionLoading, me]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(assignmentId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        mood?: number;
        reflection?: string;
        optionalPrompt?: string;
      };
      if (typeof parsed.mood === "number") setMood(parsed.mood);
      if (typeof parsed.reflection === "string") setReflection(parsed.reflection);
      if (typeof parsed.optionalPrompt === "string") setOptionalPrompt(parsed.optionalPrompt);
    } catch {
      // ignore
    }
  }, [assignmentId]);

  function saveDraft(message = "Draft saved") {
    try {
      localStorage.setItem(
        draftKey(assignmentId),
        JSON.stringify({ mood, reflection, optionalPrompt }),
      );
      setDraftStatus(message);
    } catch {
      // ignore
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setSubmittedOk(false);

    const trimmed = reflection.trim();
    if (!trimmed) {
      setStatus("Please write a response before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/responses/submit", {
        method: "POST",
        body: JSON.stringify({
          assignmentId,
          mood,
          text: trimmed,
          prompt: optionalPrompt.trim() || undefined,
        }),
        headers: { "Content-Type": "application/json" },
      });

      try {
        localStorage.removeItem(draftKey(assignmentId));
      } catch {
        // ignore
      }

      setReflection("");
      setOptionalPrompt("");
      setMood(5);
      setDraftStatus(null);
      setSubmittedOk(true);

      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey(assignmentId));
    } catch {
      // ignore
    }
    setReflection("");
    setOptionalPrompt("");
    setMood(5);
    setDraftStatus("Draft cleared");
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Check-in</h1>
          <p className="text-sm text-app-muted">
            Share a short reflection when you are ready.
          </p>
        </div>
        <Link href="/app/client/assignments" className="text-sm text-app-muted hover:text-app-text">
          Back to check-ins
        </Link>
      </div>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}
      {submittedOk && (
        <div className="mb-4 rounded-md border border-app-border bg-app-surface-2 p-3 text-sm text-app-muted">
          Submitted successfully. Your therapist will review it before your next session.
        </div>
      )}
      {draftStatus && (
        <div className="mb-4 rounded-md border border-app-border bg-app-surface-2 p-3 text-sm text-app-muted">
          {draftStatus}
        </div>
      )}

      {(sessionLoading || loading) && (
        <p className="text-sm text-app-muted">Loading...</p>
      )}

      {!loading && assignment && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{assignment.title}</CardTitle>
              <p className="text-xs text-app-muted">Due: {dueLabel}</p>
            </CardHeader>
            <CardContent>
              {assignment.librarySource ? (
                <div className="mb-3 rounded-md border border-app-border bg-app-surface-2 p-3 text-xs text-app-muted">
                  Source:{" "}
                  <span className="font-medium text-app-text">
                    {assignment.librarySource.title ?? assignment.librarySource.slug ?? assignment.librarySource.itemId}
                  </span>
                  {assignment.librarySource.version ? ` (v${assignment.librarySource.version})` : ""}
                  <div className="mt-2">
                    <Link
                      href={`/app/library/items/${encodeURIComponent(assignment.librarySource.itemId)}`}
                      className="text-app-accent hover:underline"
                    >
                      View library item
                    </Link>
                  </div>
                </div>
              ) : null}
              <div className="text-sm text-app-text whitespace-pre-wrap border border-app-border rounded-md p-3">
                {assignment.description ?? "-"}
              </div>
              <div className="mt-4 text-xs text-app-muted">
                Submissions so far: <span className="font-medium text-app-text">
                  {assignment.responseCount ?? history.length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Check-in</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="rounded-md border border-app-border bg-app-surface-2 p-3 text-xs text-app-muted">
                  Only your therapist can see this. This is not for emergencies.
                </div>

                <div>
                  <label className="text-label text-app-muted">
                    1) On a scale of 0-10, how are you feeling today?
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={mood}
                    onChange={(e) => setMood(Number(e.target.value))}
                    className="w-full"
                    disabled={submitting}
                  />
                  <div className="text-sm text-app-muted">Current: {mood}</div>
                </div>

                <div>
                  <label className="text-label text-app-muted">
                    2) A short reflection
                  </label>
                  <textarea
                    className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft"
                    rows={6}
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="What felt most important since your last session?"
                    disabled={submitting}
                  />
                </div>

                <textarea
                  className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft"
                  rows={4}
                  value={optionalPrompt}
                  onChange={(e) => setOptionalPrompt(e.target.value)}
                  placeholder="3) Anything else you want your therapist to know? (optional)"
                  disabled={submitting}
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button type="button" onClick={() => saveDraft()} disabled={submitting}>
                      Save draft
                    </Button>
                    <Button type="button" onClick={clearDraft} disabled={submitting}>
                      Clear draft
                    </Button>
                  </div>

                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </form>

              <div className="mt-6">
                <h3 className="text-sm font-semibold">Recent check-ins</h3>

                {history.length === 0 ? (
                  <p className="mt-2 text-sm text-app-muted">No check-ins yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {history.map((r) => (
                      <div key={r.id} className="rounded-md border border-app-border p-3">
                        <div className="text-sm font-medium">Submitted</div>
                        <div className="text-xs text-app-muted mt-1">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
                        </div>
                        <div className="text-xs text-app-muted mt-1">Mood: {r.mood}</div>
                        <div className="text-xs text-app-muted mt-1 break-all">ID: {r.id}</div>
                        <div className="text-xs text-app-muted mt-2">
                          {r.reviewedAt ? "Reviewed by therapist" : "Not reviewed yet"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
