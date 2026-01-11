"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  client: {
    id: string;
    fullName: string;
    email: string;
  };
};

export default function TherapistReviewPage() {
  const { me, loading: sessionLoading } = useMe();
  const [items, setItems] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (me?.role !== "therapist") return;

    let active = true;
    setLoading(true);
    setStatus(null);

    apiFetch("/assignments/therapist?status=published&limit=50")
      .then((data) => {
        if (!active) return;
        const rows = Array.isArray((data as any)?.items) ? (data as any).items : [];
        setItems(rows);
      })
      .catch((e) => {
        if (!active) return;
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(msg);
        setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sessionLoading, me]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Review</h1>
          <p className="text-sm text-app-muted">
            Open a check-in to review the newest responses.
          </p>
        </div>
        <Link href="/app/therapist/assignments" className="text-sm text-app-muted hover:text-app-text">
          Manage assignments
        </Link>
      </div>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}

      {(sessionLoading || loading) && (
        <p className="text-sm text-app-muted">Loading...</p>
      )}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="text-sm text-app-muted">
            No published assignments yet.
          </CardContent>
        </Card>
      )}

      {!loading && items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Check-in</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.title}</div>
                  {a.description ? (
                    <div className="text-xs text-app-muted line-clamp-2">
                      {a.description}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{a.client.fullName}</div>
                  <div className="text-xs text-app-muted">{a.client.email}</div>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-2 text-xs text-app-text shadow-soft hover:bg-app-surface-2"
                    href={`/app/therapist/assignments/${a.id}/responses`}
                  >
                    Open review
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
