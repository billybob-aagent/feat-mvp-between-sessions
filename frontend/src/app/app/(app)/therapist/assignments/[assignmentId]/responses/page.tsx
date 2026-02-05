"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ResponseRow = {
  id: string;
  assignmentId: string;
  clientId: string;
  createdAt?: string | null;
  voiceStorageKey?: string | null;
  mood: number;

  reviewedAt?: string | null;
  reviewedById?: string | null;
  flaggedAt?: string | null;
  starredAt?: string | null;
  lastAccessedAt?: string | null;
  hasTherapistNote?: boolean;
  promptPresent?: boolean;
  recentResponses?: {
    id: string;
    createdAt: string | null;
    mood: number;
    reviewedAt: string | null;
    flaggedAt: string | null;
    starredAt: string | null;
  }[];

  client?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
  } | null;
};

type DecryptedResponse = {
  id: string;
  assignmentId: string;
  clientId: string;
  createdAt?: string | null;
  voiceStorageKey?: string | null;
  mood: number;

  reviewedAt?: string | null;
  reviewedById?: string | null;
  flaggedAt?: string | null;
  starredAt?: string | null;
  lastAccessedAt?: string | null;
  therapistNote?: string | null;

  client?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
  } | null;

  text: string;
  prompt?: string | null;
};

type ListResponse = {
  items: ResponseRow[];
  nextCursor: string | null;
};

export default function TherapistAssignmentResponsesPage({
  params,
}: {
  params: { assignmentId: string };
}) {
  const assignmentId = params.assignmentId;
  const { me, loading: sessionLoading } = useMe();

  const [items, setItems] = useState<ResponseRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decrypted, setDecrypted] = useState<DecryptedResponse | null>(null);

  const [acting, setActing] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [sendingReminder, setSendingReminder] = useState(false);

  const [reviewedFilter, setReviewedFilter] = useState<
    "all" | "reviewed" | "unreviewed"
  >("unreviewed");
  const [flaggedFilter, setFlaggedFilter] = useState<
    "all" | "flagged" | "unflagged"
  >("all");
  const [limit, setLimit] = useState<number>(20);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  const selectedRow = useMemo(
    () => items.find((r) => r.id === selectedId) ?? null,
    [items, selectedId],
  );

  function buildListUrl(cursor?: string | null) {
    const qs = new URLSearchParams();
    qs.set("reviewed", reviewedFilter);
    qs.set("flagged", flaggedFilter);
    qs.set("limit", String(limit));
    if (debouncedQuery.trim()) qs.set("q", debouncedQuery.trim());
    if (cursor) qs.set("cursor", cursor);
    return `/responses/therapist/assignment/${encodeURIComponent(
      assignmentId,
    )}?${qs.toString()}`;
  }

  const listReqSeq = useRef(0);
  const listAbortRef = useRef<AbortController | null>(null);

  async function loadFirstPage() {
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;

    const seq = ++listReqSeq.current;

    setLoading(true);
    setStatus(null);

    setItems([]);
    setNextCursor(null);

    setSelectedId(null);
    setDecrypted(null);
    setNoteDraft("");

    try {
      const data = (await apiFetch(buildListUrl(null), {
        method: "GET",
        signal: controller.signal,
      } as RequestInit)) as ListResponse;

      if (seq !== listReqSeq.current) return;

      setItems(Array.isArray(data?.items) ? data.items : []);
      setNextCursor(data?.nextCursor ?? null);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (seq !== listReqSeq.current) return;

      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
      setItems([]);
      setNextCursor(null);
    } finally {
      if (seq === listReqSeq.current) {
        setLoading(false);
      }
    }
  }

  async function loadMore() {
    if (!nextCursor) return;

    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;

    const seq = ++listReqSeq.current;

    setLoadingMore(true);
    setStatus(null);

    try {
      const data = (await apiFetch(buildListUrl(nextCursor), {
        method: "GET",
        signal: controller.signal,
      } as RequestInit)) as ListResponse;

      if (seq !== listReqSeq.current) return;

      const newItems = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => [...prev, ...newItems]);
      setNextCursor(data?.nextCursor ?? null);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (seq !== listReqSeq.current) return;

      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      if (seq === listReqSeq.current) {
        setLoadingMore(false);
      }
    }
  }

  async function refreshKeepSelection() {
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;

    const seq = ++listReqSeq.current;

    setStatus(null);

    try {
      const data = (await apiFetch(buildListUrl(null), {
        method: "GET",
        signal: controller.signal,
      } as RequestInit)) as ListResponse;

      if (seq !== listReqSeq.current) return;

      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);
      setNextCursor(data?.nextCursor ?? null);

      if (selectedId) {
        const updated = nextItems.find((x) => x.id === selectedId);
        if (!updated) {
          setSelectedId(null);
          setDecrypted(null);
          setNoteDraft("");
        } else {
          setDecrypted((prev) =>
            prev
              ? {
                  ...prev,
                  reviewedAt: updated.reviewedAt ?? prev.reviewedAt ?? null,
                  reviewedById: updated.reviewedById ?? prev.reviewedById ?? null,
                  flaggedAt: updated.flaggedAt ?? prev.flaggedAt ?? null,
                  starredAt: updated.starredAt ?? prev.starredAt ?? null,
                  lastAccessedAt: updated.lastAccessedAt ?? prev.lastAccessedAt ?? null,
                  therapistNote: updated.hasTherapistNote
                    ? prev.therapistNote ?? ""
                    : null,
                }
              : prev,
          );
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (seq !== listReqSeq.current) return;

      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    }
  }

  async function sendReminder() {
    setSendingReminder(true);
    setStatus(null);
    try {
      await apiFetch(
        `/assignments/therapist/${encodeURIComponent(assignmentId)}/remind`,
        { method: "POST" },
      );
      setStatus("Reminder sent to the client.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setSendingReminder(false);
    }
  }

  async function decryptOne(responseId: string) {
    setDecrypting(true);
    setStatus(null);
    setDecrypted(null);

    try {
      const data = (await apiFetch(
        `/responses/therapist/${encodeURIComponent(responseId)}`,
      )) as DecryptedResponse;

      setDecrypted(data);
      setSelectedId(responseId);
      setNoteDraft(data.therapistNote ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setDecrypting(false);
    }
  }

  async function markReviewed() {
    if (!selectedId) return;
    setActing(true);
    setStatus(null);

    try {
      await apiFetch(
        `/responses/therapist/${encodeURIComponent(selectedId)}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({ therapistNote: noteDraft || undefined }),
          headers: { "Content-Type": "application/json" },
        },
      );

      await refreshKeepSelection();

      setDecrypted((prev) =>
        prev
          ? {
              ...prev,
              reviewedAt: new Date().toISOString(),
              therapistNote: noteDraft || null,
            }
          : prev,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setActing(false);
    }
  }

  async function toggleFlag() {
    if (!selectedId) return;
    setActing(true);
    setStatus(null);

    try {
      const res = (await apiFetch(
        `/responses/therapist/${encodeURIComponent(selectedId)}/flag`,
        { method: "PATCH" },
      )) as { id: string; flaggedAt: string | null };

      await refreshKeepSelection();

      setDecrypted((prev) =>
        prev ? { ...prev, flaggedAt: res?.flaggedAt ?? null } : prev,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setActing(false);
    }
  }

  async function toggleStar() {
    if (!selectedId) return;
    setActing(true);
    setStatus(null);

    try {
      const res = (await apiFetch(
        `/responses/therapist/${encodeURIComponent(selectedId)}/star`,
        { method: "PATCH" },
      )) as { id: string; starredAt: string | null };

      await refreshKeepSelection();

      setDecrypted((prev) =>
        prev ? { ...prev, starredAt: res?.starredAt ?? null } : prev,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setActing(false);
    }
  }

  async function saveNoteOnly() {
    if (!selectedId) return;
    setActing(true);
    setStatus(null);

    try {
      await apiFetch(
        `/responses/therapist/${encodeURIComponent(selectedId)}/note`,
        {
          method: "PATCH",
          body: JSON.stringify({ therapistNote: noteDraft || undefined }),
          headers: { "Content-Type": "application/json" },
        },
      );

      await refreshKeepSelection();

      setDecrypted((prev) =>
        prev ? { ...prev, therapistNote: noteDraft || null } : prev,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setActing(false);
    }
  }

  useEffect(() => {
    if (sessionLoading) return;
    if (me?.role !== "therapist") return;
    loadFirstPage();

    return () => {
      listAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assignmentId,
    reviewedFilter,
    flaggedFilter,
    limit,
    debouncedQuery,
    sessionLoading,
    me,
  ]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Review</h1>
          <div className="text-xs text-app-muted mt-1 break-all">
            Assignment ID: {assignmentId}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={sendReminder}
            disabled={loading || loadingMore || acting || decrypting || sendingReminder}
            variant="secondary"
          >
            {sendingReminder ? "Sending..." : "Send reminder"}
          </Button>
          <Button
            type="button"
            onClick={refreshKeepSelection}
            disabled={loading || loadingMore || acting || decrypting}
          >
            Refresh
          </Button>
          <Link
            href="/app/therapist/review"
            className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-2 text-sm text-app-text shadow-soft hover:bg-app-surface-2"
          >
            Back to review
          </Link>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px]">
            <label className="text-label text-app-muted">Search</label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients"
              disabled={loading || loadingMore || acting || decrypting}
            />
          </div>

          <div>
            <label className="text-label text-app-muted">Reviewed</label>
            <Select
              value={reviewedFilter}
              onChange={(e) =>
                setReviewedFilter(e.target.value as "all" | "reviewed" | "unreviewed")
              }
              disabled={loading || acting || decrypting}
            >
              <option value="all">All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="reviewed">Reviewed</option>
            </Select>
          </div>

          <div>
            <label className="text-label text-app-muted">Flagged</label>
            <Select
              value={flaggedFilter}
              onChange={(e) =>
                setFlaggedFilter(e.target.value as "all" | "flagged" | "unflagged")
              }
              disabled={loading || acting || decrypting}
            >
              <option value="all">All</option>
              <option value="flagged">Flagged only</option>
              <option value="unflagged">Unflagged only</option>
            </Select>
          </div>

          <div>
            <label className="text-label text-app-muted">Page size</label>
            <Select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={loading || acting || decrypting}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </div>

          <div className="ml-auto text-xs text-app-muted">
            Showing <span className="font-medium text-app-text">{items.length}</span> result(s)
            {nextCursor ? <span className="ml-2">(more available)</span> : null}
          </div>
        </CardContent>
      </Card>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}

      {(sessionLoading || loading) && (
        <p className="text-sm text-app-muted">Loading...</p>
      )}

      {!loading && items.length === 0 && (
        <Card className="mb-6">
          <CardContent>
            <div className="text-sm font-medium">No responses match your filters</div>
            <div className="mt-2 text-xs text-app-muted">
              Try changing filters or ask the client to submit a response.
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && items.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Newest submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map((r) => {
                  const when = r.createdAt
                    ? new Date(r.createdAt).toLocaleString()
                    : "-";
                  const active = selectedId === r.id;

                  const clientName = r.client?.fullName ?? "Client";
                  const clientEmail = r.client?.email ?? "";

                  const isReviewed = !!r.reviewedAt;
                  const isFlagged = !!r.flaggedAt;
                  const isStarred = !!r.starredAt;

                  return (
                    <div
                      key={r.id}
                      className={`rounded-md border border-app-border p-3 ${
                        active ? "bg-app-surface-2" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium">
                          {clientName}
                          {clientEmail ? (
                            <span className="text-xs text-app-muted"> ({clientEmail})</span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {isReviewed ? <Badge variant="success">Reviewed</Badge> : null}
                          {isFlagged ? <Badge variant="danger">Flagged</Badge> : null}
                          {isStarred ? <Badge variant="info">Starred</Badge> : null}
                        </div>
                      </div>

                      <div className="text-xs text-app-muted mt-1">
                        Submitted: {when} • Mood: {r.mood}
                      </div>

                      {r.lastAccessedAt ? (
                        <div className="text-xs text-app-muted mt-1">
                          Last accessed: {new Date(r.lastAccessedAt).toLocaleString()}
                        </div>
                      ) : (
                        <div className="text-xs text-app-muted mt-1">Not accessed yet</div>
                      )}

                      <div className="mt-2 text-xs text-app-muted break-all">
                        Response ID: {r.id}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => decryptOne(r.id)}
                          disabled={decrypting || acting}
                        >
                          {decrypting && active ? "Decrypting..." : "Decrypt & view"}
                        </Button>

                        <Link
                          href={`/app/therapist/session-prep?assignmentId=${encodeURIComponent(
                            assignmentId,
                          )}&clientId=${encodeURIComponent(r.clientId)}`}
                          className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-2 text-xs text-app-text shadow-soft hover:bg-app-surface-2"
                        >
                          Session prep
                        </Link>

                        {r.voiceStorageKey ? (
                          <span className="text-xs text-app-muted">
                            Voice: {r.voiceStorageKey}
                          </span>
                        ) : (
                          <span className="text-xs text-app-muted">No voice</span>
                        )}

                        {r.hasTherapistNote ? (
                          <Badge variant="warning">Has note</Badge>
                        ) : null}
                        {r.promptPresent ? <Badge variant="neutral">Extra prompt</Badge> : null}
                      </div>

                      {r.recentResponses && r.recentResponses.length > 0 ? (
                        <div className="mt-3 text-xs text-app-muted">
                          Recent check-ins:
                          <div className="mt-2 flex flex-wrap gap-2">
                            {r.recentResponses.map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex items-center gap-1 rounded-full border border-app-border px-2 py-1"
                              >
                                {item.createdAt
                                  ? new Date(item.createdAt).toLocaleDateString()
                                  : "-"}
                                <span className="text-app-text">· {item.mood}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-app-muted">
                  {nextCursor ? "More results available." : "End of results."}
                </div>
                {nextCursor ? (
                  <Button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore || acting || decrypting}
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Decrypted text</CardTitle>
            </CardHeader>
            <CardContent>
              {!decrypted && (
                <div className="text-sm text-app-muted">
                  Click <span className="font-medium text-app-text">Decrypt & view</span> to read
                  a response.
                </div>
              )}

              {decrypted && (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        {decrypted.client?.fullName ?? "Client"}
                        {decrypted.client?.email ? (
                          <span className="text-xs text-app-muted"> ({decrypted.client.email})</span>
                        ) : null}
                      </div>

                      <div className="text-xs text-app-muted mt-1">
                        Submitted: {decrypted.createdAt ? new Date(decrypted.createdAt).toLocaleString() : "-"}
                      </div>
                      <div className="text-xs text-app-muted mt-1">Mood: {decrypted.mood}</div>
                      {decrypted.lastAccessedAt ? (
                        <div className="text-xs text-app-muted mt-1">
                          Last accessed: {new Date(decrypted.lastAccessedAt).toLocaleString()}
                        </div>
                      ) : null}

                      <div className="mt-2 text-xs text-app-muted break-all">
                        Response ID: {decrypted.id}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {decrypted.reviewedAt ? <Badge variant="success">Reviewed</Badge> : null}
                      {decrypted.flaggedAt ? <Badge variant="danger">Flagged</Badge> : null}
                      {decrypted.starredAt ? <Badge variant="info">Starred</Badge> : null}
                    </div>
                  </div>

                  <div className="mt-3 border border-app-border rounded-md p-3 whitespace-pre-wrap text-sm">
                    {decrypted.text}
                  </div>

                  {decrypted.prompt ? (
                    <div className="mt-3 border border-app-border rounded-md p-3 text-sm">
                      <div className="text-xs text-app-muted mb-2">Optional prompt</div>
                      <div className="whitespace-pre-wrap">{decrypted.prompt}</div>
                    </div>
                  ) : null}

                  <div className="mt-4 border border-app-border rounded-md p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">Therapist actions</div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={toggleFlag}
                          disabled={acting || decrypting}
                        >
                          {decrypted.flaggedAt ? "Unflag" : "Flag"}
                        </Button>

                        <Button
                          type="button"
                          onClick={toggleStar}
                          disabled={acting || decrypting}
                          variant="secondary"
                        >
                          {decrypted.starredAt ? "Unstar" : "Star"}
                        </Button>

                        <Button
                          type="button"
                          onClick={markReviewed}
                          disabled={acting || decrypting}
                          variant="primary"
                        >
                          Mark reviewed
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="text-label text-app-muted">
                        Internal therapist note (private)
                      </label>
                      <textarea
                        className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft"
                        rows={4}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Optional note for your review/follow-up..."
                        disabled={acting || decrypting}
                      />

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-xs text-app-muted">
                          {selectedRow?.hasTherapistNote
                            ? "Saved note exists."
                            : "No saved note yet."}
                        </div>

                        <Button
                          type="button"
                          onClick={saveNoteOnly}
                          disabled={acting || decrypting}
                        >
                          Save note
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-app-muted">
                    Tip: &quot;Mark reviewed&quot; also saves the note (if provided).
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
