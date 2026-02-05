"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clinicDashboard,
  clinicDisableUser,
  clinicInviteTherapist,
  clinicListTherapistInvites,
  clinicListTherapists,
  clinicResendTherapistInvite,
  clinicRevokeTherapistInvite,
} from "@/lib/clinic-api";
import { useMe } from "@/lib/use-me";
import type { ClinicInviteListItem, ClinicTherapistListItem } from "@/lib/types/clinic";
import { PageHeader } from "@/components/page/PageHeader";
import { FilterBar } from "@/components/page/FilterBar";
import { EmptyState } from "@/components/page/EmptyState";
import { ErrorState } from "@/components/page/ErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { NotAuthorized } from "@/components/page/NotAuthorized";

type StaffRow =
  | {
      kind: "therapist";
      id: string;
      userId: string;
      name: string;
      email: string;
      createdAt: string;
      isDisabled: boolean;
      clientCount: number;
    }
  | {
      kind: "invite";
      id: string;
      email: string;
      createdAt: string;
      status: string;
      isExpired: boolean;
      expiresAt: string;
    };

const statusOptions = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
  { value: "disabled", label: "Disabled" },
];

function statusBadge(row: StaffRow) {
  if (row.kind === "therapist") {
    return row.isDisabled ? (
      <Badge variant="danger">Disabled</Badge>
    ) : (
      <Badge variant="success">Active</Badge>
    );
  }

  if (row.isExpired) return <Badge variant="warning">Expired</Badge>;
  if (row.status === "revoked") return <Badge variant="danger">Revoked</Badge>;
  if (row.status === "accepted") return <Badge variant="info">Accepted</Badge>;
  return <Badge variant="warning">Invited</Badge>;
}

export default function ClinicStaffPage() {
  const { me, loading: meLoading } = useMe();
  const [clinicId, setClinicId] = useState<string>("");
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [limit, setLimit] = useState(50);
  const [staff, setStaff] = useState<ClinicTherapistListItem[]>([]);
  const [invites, setInvites] = useState<ClinicInviteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const role = me?.role ?? null;
  const isAdmin = role === "admin";
  const canManage = role === "CLINIC_ADMIN" || role === "admin";

  const loadClinic = useCallback(async () => {
    if (!canManage) return;
    if (isAdmin) return;
    const data = await clinicDashboard();
    setClinicId(data.clinic.id);
    setClinicName(data.clinic.name);
  }, [canManage, isAdmin]);

  const loadData = useCallback(async () => {
    if (!canManage) return;
    if (isAdmin && !clinicId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [therapistsData, invitesData] = await Promise.all([
        clinicListTherapists({ q: query.trim() || undefined, limit, clinicId: isAdmin ? clinicId.trim() : undefined }),
        clinicListTherapistInvites({ clinicId: isAdmin ? clinicId.trim() : undefined }),
      ]);
      setStaff(therapistsData.items || []);
      setInvites(invitesData || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [canManage, clinicId, isAdmin, limit, query]);

  useEffect(() => {
    if (meLoading) return;
    if (!canManage) return;
    loadClinic().catch(() => {});
  }, [meLoading, canManage, loadClinic]);

  useEffect(() => {
    if (meLoading) return;
    if (!canManage) return;
    loadData().catch(() => {});
  }, [meLoading, canManage, loadData]);

  const rows = useMemo<StaffRow[]>(() => {
    const staffRows: StaffRow[] = staff.map((item) => ({
      kind: "therapist",
      id: item.id,
      userId: item.userId,
      name: item.fullName,
      email: item.email,
      createdAt: item.createdAt,
      isDisabled: item.isDisabled,
      clientCount: item.clientCount,
    }));

    const inviteRows: StaffRow[] = invites.map((inv) => ({
      kind: "invite",
      id: inv.id,
      email: inv.email,
      createdAt: inv.createdAt,
      status: inv.status,
      isExpired: inv.isExpired,
      expiresAt: inv.expiresAt,
    }));

    return [...staffRows, ...inviteRows].sort((a, b) => {
      const aKey = a.kind === "invite" ? `1-${a.email}` : `0-${a.name}`;
      const bKey = b.kind === "invite" ? `1-${b.email}` : `0-${b.name}`;
      return aKey.localeCompare(bKey);
    });
  }, [staff, invites]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((row) => {
      if (statusFilter === "active") {
        return row.kind === "therapist" && !row.isDisabled;
      }
      if (statusFilter === "disabled") {
        return row.kind === "therapist" && row.isDisabled;
      }
      if (row.kind !== "invite") return false;
      if (statusFilter === "invited") {
        return row.status === "pending" && !row.isExpired;
      }
      if (statusFilter === "expired") return row.isExpired;
      if (statusFilter === "revoked") return row.status === "revoked";
      return true;
    });
  }, [rows, statusFilter]);

  async function handleInviteSubmit() {
    setActionMessage(null);
    try {
      const res = await clinicInviteTherapist({
        email: inviteEmail.trim(),
        fullName: inviteName.trim() || undefined,
        clinicId: isAdmin ? clinicId.trim() : undefined,
      });
      setInviteEmail("");
      setInviteName("");
      setInviteOpen(false);
      setActionMessage(`Invite created. Expires at ${res.expiresAt ?? "unknown"}.`);
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setActionMessage(msg);
    }
  }

  async function handleDisableUser(userId: string) {
    setActionMessage(null);
    try {
      await clinicDisableUser({ userId, clinicId: isAdmin ? clinicId.trim() : undefined });
      setActionMessage("User disabled.");
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setActionMessage(msg);
    }
  }

  async function handleResend(inviteId: string) {
    setActionMessage(null);
    try {
      await clinicResendTherapistInvite({ inviteId, clinicId: isAdmin ? clinicId.trim() : undefined });
      setActionMessage("Invite resent.");
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setActionMessage(msg);
    }
  }

  async function handleRevoke(inviteId: string) {
    setActionMessage(null);
    try {
      await clinicRevokeTherapistInvite({ inviteId, clinicId: isAdmin ? clinicId.trim() : undefined });
      setActionMessage("Invite revoked.");
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setActionMessage(msg);
    }
  }

  if (!meLoading && !canManage) {
    return <NotAuthorized message="Clinic admin access required." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        subtitle="Manage therapist access, invitations, and disabled accounts."
        actions={
          <Button type="button" onClick={() => setInviteOpen(true)}>
            Invite therapist
          </Button>
        }
      />

      {actionMessage && (
        <Alert variant="info" className="max-w-3xl">
          {actionMessage}
        </Alert>
      )}

      <FilterBar
        actions={
          <Button type="button" variant="ghost" onClick={loadData}>
            Refresh
          </Button>
        }
      >
        {isAdmin ? (
          <div className="min-w-[240px]">
            <label className="block text-label text-app-muted mb-1">Clinic ID</label>
            <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Clinic UUID" />
          </div>
        ) : (
          <div className="min-w-[240px]">
            <label className="block text-label text-app-muted mb-1">Clinic</label>
            <Input value={clinicName ?? ""} readOnly />
          </div>
        )}
        <div className="min-w-[220px]">
          <label className="block text-label text-app-muted mb-1">Search</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search therapists"
            onBlur={loadData}
          />
        </div>
        <div className="min-w-[180px]">
          <label className="block text-label text-app-muted mb-1">Status</label>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-label text-app-muted mb-1">Page size</label>
          <Select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Select>
        </div>
      </FilterBar>

      {error && <ErrorState message={error} />}

      {loading && (
        <Card>
          <CardContent className="space-y-3 py-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredRows.length === 0 && (
        <EmptyState title="No staff found" description="Try adjusting your filters or invite a therapist." />
      )}

      {!loading && !error && filteredRows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={`${row.kind}-${row.id}`}>
                    <TableCell>
                      {row.kind === "therapist" ? (
                        <div>
                          <div className="font-medium text-app-text">{row.name}</div>
                          <div className="text-xs text-app-muted">{row.clientCount} clients</div>
                        </div>
                      ) : (
                        <div className="font-medium text-app-text">Invite</div>
                      )}
                    </TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{statusBadge(row)}</TableCell>
                    <TableCell className="text-xs text-app-muted">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.kind === "therapist" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={row.isDisabled}
                          onClick={() => handleDisableUser(row.userId)}
                        >
                          Disable
                        </Button>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button type="button" variant="ghost" onClick={() => handleResend(row.id)}>
                            Resend
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => handleRevoke(row.id)}>
                            Revoke
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite therapist"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleInviteSubmit}>
              Send invite
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-label text-app-muted mb-1">Email</label>
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="therapist@example.com" />
          </div>
          <div>
            <label className="block text-label text-app-muted mb-1">Full name (optional)</label>
            <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Therapist name" />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
