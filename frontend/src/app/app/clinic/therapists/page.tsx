"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clinicCreateTherapist, clinicInviteTherapist, clinicListTherapists } from "@/lib/clinic-api";
import { ClinicTherapistListItem } from "@/lib/types/clinic";
import { useClinicSession } from "../clinic-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ClinicTherapistsPage() {
  const { loading: sessionLoading, role } = useClinicSession();
  const [items, setItems] = useState<ClinicTherapistListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "disabled">("all");
  const [limit, setLimit] = useState(25);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createOrganization, setCreateOrganization] = useState("");
  const [createTimezone, setCreateTimezone] = useState("");

  async function loadFirstPage() {
    setLoading(true);
    setStatus(null);
    try {
      const data = await clinicListTherapists({
        q: query.trim() || undefined,
        limit,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setStatus(null);
    try {
      const data = await clinicListTherapists({
        q: query.trim() || undefined,
        limit,
        cursor: nextCursor,
      });
      const newItems = Array.isArray(data.items) ? data.items : [];
      setItems((prev) => [...prev, ...newItems]);
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (sessionLoading) return;
    if (role !== "CLINIC_ADMIN") return;
    loadFirstPage();
  }, [sessionLoading, role, limit]);

  const visibleItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => (filter === "disabled" ? item.isDisabled : !item.isDisabled));
  }, [items, filter]);

  const inviteLink = useMemo(() => {
    if (!inviteToken) return null;
    return `${window.location.origin}/auth/accept-clinic-invite?token=${encodeURIComponent(
      inviteToken,
    )}`;
  }, [inviteToken]);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteStatus(null);
    setInviteToken(null);
    setInviteExpiresAt(null);

    try {
      const res = await clinicInviteTherapist({
        email: inviteEmail.trim(),
        fullName: inviteFullName.trim() || undefined,
      });
      setInviteToken(res.token);
      setInviteExpiresAt(res.expiresAt);
      setInviteStatus("Invite created. Email send pending.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setInviteStatus(msg);
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setInviteStatus(null);
    try {
      await clinicCreateTherapist({
        email: createEmail.trim(),
        fullName: createFullName.trim(),
        password: createPassword,
        organization: createOrganization.trim() || undefined,
        timezone: createTimezone.trim() || undefined,
      });
      setCreateEmail("");
      setCreateFullName("");
      setCreatePassword("");
      setCreateOrganization("");
      setCreateTimezone("");
      await loadFirstPage();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setInviteStatus(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-h2">Therapists</h1>
          <p className="text-sm text-app-muted mt-1">
            Manage therapist accounts and caseload visibility.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link className="text-app-muted hover:text-app-text" href="/app/clinic/dashboard">
            Back to dashboard
          </Link>
        </div>
      </div>

      {status && <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>}

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Invite therapist</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitInvite} className="space-y-3">
              <div>
                <label className="block text-label text-app-muted mb-1">Email</label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="therapist@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-label text-app-muted mb-1">Full name (optional)</label>
                <Input
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="Therapist name"
                />
              </div>
              <Button type="submit">Create invite</Button>
            </form>

            {inviteStatus && (
              <p className="mt-3 text-sm text-app-muted whitespace-pre-wrap">{inviteStatus}</p>
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
            <CardTitle>Create therapist</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitCreate} className="space-y-3">
              <div>
                <label className="block text-label text-app-muted mb-1">Email</label>
                <Input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="therapist@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-label text-app-muted mb-1">Full name</label>
                <Input
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  placeholder="Therapist name"
                  required
                />
              </div>
              <div>
                <label className="block text-label text-app-muted mb-1">Password</label>
                <Input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Temporary password"
                  required
                />
              </div>
              <div>
                <label className="block text-label text-app-muted mb-1">Organization (optional)</label>
                <Input
                  value={createOrganization}
                  onChange={(e) => setCreateOrganization(e.target.value)}
                  placeholder="Clinic or practice"
                />
              </div>
              <div>
                <label className="block text-label text-app-muted mb-1">Timezone (optional)</label>
                <Input
                  value={createTimezone}
                  onChange={(e) => setCreateTimezone(e.target.value)}
                  placeholder="UTC"
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create therapist"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="block text-label text-app-muted mb-1">Search</label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search therapists"
              onBlur={loadFirstPage}
              disabled={loading || loadingMore}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-label text-app-muted mb-1">Status</label>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "active" | "disabled")}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </Select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-label text-app-muted mb-1">Page size</label>
            <Select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </Select>
          </div>
          <div className="ml-auto text-xs text-app-muted">
            Showing <span className="font-medium">{visibleItems.length}</span>
            {nextCursor ? <span className="ml-2">(more available)</span> : null}
          </div>
        </CardContent>
      </Card>

      {(sessionLoading || loading) && <p className="text-sm text-app-muted">Loading...</p>}

      {!loading && visibleItems.length === 0 && (
        <Card>
          <CardContent className="text-sm text-app-muted">
            No therapists found.
            <div className="mt-3">
              <Link
                href="/app/clinic/dashboard"
                className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-2 text-sm text-app-text hover:bg-app-surface-2"
              >
                Return to dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {visibleItems.length > 0 && (
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Therapist</TableHead>
              <TableHead>Caseload</TableHead>
              <TableHead>Assignments</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.fullName}</div>
                  <div className="text-xs text-app-muted">{item.email}</div>
                </TableCell>
                <TableCell>{item.clientCount}</TableCell>
                <TableCell>{item.assignmentCount}</TableCell>
                <TableCell>
                  <Badge variant={item.isDisabled ? "warning" : "success"}>
                    {item.isDisabled ? "Disabled" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                    href={`/app/clinic/therapists/${item.id}`}
                  >
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
