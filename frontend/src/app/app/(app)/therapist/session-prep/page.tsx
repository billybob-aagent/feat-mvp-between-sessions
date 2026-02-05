"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AssignmentDetail = {
  id: string;
  title: string;
  description: string | null;
  client: {
    id: string;
    fullName: string;
    email: string;
  };
};

type ResponseRow = {
  id: string;
  createdAt: string | null;
  mood: number;
  reviewedAt: string | null;
  flaggedAt: string | null;
  starredAt: string | null;
};

type ResponseList = {
  items: ResponseRow[];
  nextCursor: string | null;
};

type DecryptedResponse = {
  id: string;
  createdAt: string | null;
  mood: number;
  text: string;
  prompt: string | null;
  therapistNote: string | null;
  flaggedAt: string | null;
  starredAt: string | null;
};

export default function TherapistSessionPrepPage() {
  const { me, loading: sessionLoading } = useMe();
  const params = useSearchParams();
  const assignmentId = params.get("assignmentId") ?? "";
  const clientId = params.get("clientId") ?? "";

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [decrypted, setDecrypted] = useState<DecryptedResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const latest = decrypted[0] ?? null;
  const quotes = useMemo(() => extractKeyQuotes(latest?.text ?? ""), [latest?.text]);
  const trend = useMemo(() => {
    if (responses.length < 2) return "same";
    const [first, second] = responses;
    if (!first || !second) return "same";
    if (first.mood > second.mood) return "up";
    if (first.mood < second.mood) return "down";
    return "same";
  }, [responses]);

  useEffect(() => {
    if (sessionLoading) return;
    if (me?.role !== "therapist") return;
    if (!assignmentId || !clientId) return;

    let active = true;
    setLoading(true);
    setStatus(null);

    async function load() {
      try {
        const detail = (await apiFetch(
          `/assignments/therapist/${encodeURIComponent(assignmentId)}`,
        )) as AssignmentDetail;

        if (!active) return;
        if (detail.client.id !== clientId) {
          setStatus("This client does not match the selected assignment.");
          setAssignment(null);
          setResponses([]);
          setDecrypted([]);
          return;
        }
        setAssignment(detail);

        const list = (await apiFetch(
          `/responses/therapist/assignment/${encodeURIComponent(
            assignmentId,
          )}?clientId=${encodeURIComponent(clientId)}&limit=3&reviewed=all&flagged=all`,
        )) as ResponseList;

        const rows = Array.isArray(list?.items) ? list.items : [];
        if (!active) return;
        setResponses(rows);

        const decryptedRows = await Promise.all(
          rows.map((row) =>
            apiFetch<DecryptedResponse>(`/responses/therapist/${encodeURIComponent(row.id)}`),
          ),
        );

        if (!active) return;
        setDecrypted(
          decryptedRows.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          }),
        );
      } catch (e) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(msg);
        setAssignment(null);
        setResponses([]);
        setDecrypted([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [assignmentId, clientId, sessionLoading, me]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Session prep</h1>
          <p className="text-sm text-app-muted">
            Pull key moments from recent check-ins before the session.
          </p>
        </div>
        <Link href="/app/therapist/review" className="text-sm text-app-muted hover:text-app-text">
          Back to review
        </Link>
      </div>

      {!assignmentId || !clientId ? (
        <Card>
          <CardContent className="text-sm text-app-muted">
            Select a client from Review to start session prep.
          </CardContent>
        </Card>
      ) : null}

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}

      {(sessionLoading || loading) && (
        <p className="text-sm text-app-muted">Loading...</p>
      )}

      {!loading && assignment && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{assignment.title}</CardTitle>
              <p className="text-xs text-app-muted">
                Client: {assignment.client.fullName} ({assignment.client.email})
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-app-text whitespace-pre-wrap">
                {assignment.description ?? "No description provided."}
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Mood trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-app-text">
                  {trend === "up" && "Upward from the previous check-in."}
                  {trend === "down" && "Lower than the previous check-in."}
                  {trend === "same" && "Stable compared to the previous check-in."}
                </div>
                {responses[0] ? (
                  <div className="mt-2 text-xs text-app-muted">
                    Latest mood: {responses[0].mood}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Key quotes</CardTitle>
              </CardHeader>
              <CardContent>
                {quotes.length === 0 ? (
                  <p className="text-sm text-app-muted">
                    No quotes available yet. Ask the client to submit a check-in.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm text-app-text">
                    {quotes.map((q) => (
                      <li key={q} className="rounded-md border border-app-border p-3">
                        “{q}”
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              {responses.length === 0 ? (
                <p className="text-sm text-app-muted">No submissions yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mood</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Prep</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-app-muted">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell>{r.mood}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {r.flaggedAt ? <Badge variant="danger">Flagged</Badge> : null}
                            {r.starredAt ? <Badge variant="info">Starred</Badge> : null}
                            {r.reviewedAt ? <Badge variant="success">Reviewed</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs text-app-muted">
                          Response ID: {r.id}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {latest && (
            <Card>
              <CardHeader>
                <CardTitle>Therapist notes</CardTitle>
              </CardHeader>
              <CardContent>
                {latest.therapistNote ? (
                  <div className="text-sm text-app-text whitespace-pre-wrap">
                    {latest.therapistNote}
                  </div>
                ) : (
                  <p className="text-sm text-app-muted">No private notes yet.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}

function extractKeyQuotes(text: string) {
  if (!text) return [];
  const candidates = text
    .split(/[\n\.!?]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 16);

  const sorted = candidates.sort((a, b) => b.length - a.length);
  return sorted.slice(0, 3);
}
