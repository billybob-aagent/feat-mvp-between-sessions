"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { apiFetch } from "@/lib/api";
import { clinicListClients } from "@/lib/clinic-api";
import type { ClinicClientListItem } from "@/lib/types/clinic";
import { useLocalStorageState } from "@/lib/use-local-storage";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { EmptyState } from "@/components/page/EmptyState";
import { ErrorState } from "@/components/page/ErrorState";
import { TableSkeleton } from "@/components/page/Skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";

type TherapistClient = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
};

type BulkAssignPayload = {
  mode: "custom" | "prompt";
  title: string;
  description: string;
  promptId: string;
  dueDate: string;
};

type PromptOption = {
  id: string;
  title: string;
};

function isClinicClientRow(
  row: ClinicClientListItem | TherapistClient,
): row is ClinicClientListItem {
  return "assignmentCount" in row;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function ClientsHubPage() {
  const { me } = useMe();
  const router = useRouter();
  const role = me?.role ?? null;
  const isTherapist = role === "therapist";
  const isClinicAdmin = role === "CLINIC_ADMIN";

  const [query, setQuery] = useState("");
  const [limit, setLimit] = useLocalStorageState<number>("bs.clients.limit", 25);
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [items, setItems] = useState<ClinicClientListItem[]>([]);
  const [therapistItems, setTherapistItems] = useState<TherapistClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkCheckinOpen, setBulkCheckinOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkPayload, setBulkPayload] = useState<BulkAssignPayload>({
    mode: "custom",
    title: "",
    description: "",
    promptId: "",
    dueDate: "",
  });
  const [promptOptions, setPromptOptions] = useState<PromptOption[]>([]);

  const canBulkAssign = isTherapist;
  const canBulkCheckins = isTherapist;

  const visibleRows = useMemo(() => {
    const base = isTherapist ? therapistItems : items;
    const search = query.trim().toLowerCase();
    if (!search) return base;
    return base.filter((row) => {
      const name = row.fullName ?? "";
      const email = row.email ?? "";
      return name.toLowerCase().includes(search) || email.toLowerCase().includes(search);
    });
  }, [items, therapistItems, query, isTherapist]);

  const allSelected = selectedIds.length > 0 && selectedIds.length === visibleRows.length;

  const loadClinicClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clinicListClients({
        q: query.trim() || undefined,
        limit,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      // pagination cursor reserved for future use
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query, limit]);

  const loadTherapistClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await apiFetch("/clients/mine")) as TherapistClient[];
      setTherapistItems(Array.isArray(res) ? res : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setTherapistItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPrompts = useCallback(async () => {
    if (!isTherapist) return;
    try {
      const res = (await apiFetch("/prompts")) as PromptOption[];
      setPromptOptions(Array.isArray(res) ? res : []);
      if (!bulkPayload.promptId && res?.[0]?.id) {
        setBulkPayload((prev) => ({ ...prev, promptId: res[0].id }));
      }
    } catch {
      // ignore
    }
  }, [bulkPayload.promptId, isTherapist]);

  useEffect(() => {
    if (isClinicAdmin) {
      loadClinicClients();
    } else if (isTherapist) {
      loadTherapistClients();
    } else {
      setLoading(false);
    }
  }, [isClinicAdmin, isTherapist, loadClinicClients, loadTherapistClients]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  function toggleSelection(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleRows.map((row) => row.id));
    }
  }

  async function bulkAssign() {
    if (!canBulkAssign || bulkAssigning) return;
    setBulkAssigning(true);
    setBulkStatus(null);
    try {
      const dueDateIso =
        bulkPayload.dueDate.trim().length > 0
          ? new Date(`${bulkPayload.dueDate}T00:00:00`).toISOString()
          : undefined;

      if (bulkPayload.mode === "prompt") {
        for (const clientId of selectedIds) {
          await apiFetch("/assignments/create", {
            method: "POST",
            body: JSON.stringify({
              clientId,
              promptId: bulkPayload.promptId,
              dueDate: dueDateIso,
            }),
          });
        }
      } else {
        for (const clientId of selectedIds) {
          await apiFetch("/assignments", {
            method: "POST",
            body: JSON.stringify({
              clientId,
              title: bulkPayload.title.trim(),
              description: bulkPayload.description.trim() || undefined,
              dueDate: dueDateIso,
            }),
          });
        }
      }

      setBulkStatus(`Assigned to ${selectedIds.length} client(s).`);
      setBulkAssignOpen(false);
      setSelectedIds([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setBulkStatus(msg);
    } finally {
      setBulkAssigning(false);
    }
  }

  async function bulkRequestCheckins() {
    if (!canBulkCheckins || bulkAssigning) return;
    setBulkAssigning(true);
    setBulkStatus(null);
    try {
      const dueDateIso =
        bulkPayload.dueDate.trim().length > 0
          ? new Date(`${bulkPayload.dueDate}T00:00:00`).toISOString()
          : undefined;

      for (const clientId of selectedIds) {
        await apiFetch("/assignments", {
          method: "POST",
          body: JSON.stringify({
            clientId,
            title: bulkPayload.title.trim() || "Check-in request",
            description:
              bulkPayload.description.trim() ||
              "Please complete your between-session check-in.",
            dueDate: dueDateIso,
          }),
        });
      }

      setBulkStatus(`Check-in requests sent to ${selectedIds.length} client(s).`);
      setBulkCheckinOpen(false);
      setSelectedIds([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setBulkStatus(msg);
    } finally {
      setBulkAssigning(false);
    }
  }

  const rows = visibleRows;

  return (
    <PageLayout
      title="Clients"
      subtitle="Primary operational hub for assignments, check-ins, responses, and AER artifacts."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setBulkAssignOpen(true)} disabled={!canBulkAssign || selectedIds.length === 0}>
            Bulk assign
          </Button>
          <Button variant="secondary" onClick={() => setBulkCheckinOpen(true)} disabled={!canBulkCheckins || selectedIds.length === 0}>
            Bulk request check-ins
          </Button>
        </div>
      }
    >

      <FilterBar
        actions={
          <div className="text-xs text-app-muted">
            Selected <span className="text-app-text font-medium">{selectedIds.length}</span>
          </div>
        }
      >
        <div className="min-w-[220px]">
          <label className="text-label text-app-muted">Search</label>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="text-label text-app-muted">Status</label>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <label className="text-label text-app-muted">Program</label>
          <Select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}>
            <option value="all">All programs (best-effort)</option>
            <option value="iop">IOP</option>
            <option value="php">PHP</option>
            <option value="op">OP</option>
          </Select>
        </div>
        <div className="min-w-[140px]">
          <label className="text-label text-app-muted">Page size</label>
          <Select
            value={String(limit)}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </Select>
        </div>
      </FilterBar>

      {error && (
        <ErrorState title="Unable to load clients" message={error} actionLabel="Retry" onAction={isClinicAdmin ? loadClinicClients : loadTherapistClients} />
      )}

      {loading && <TableSkeleton rows={6} />}

      {!loading && rows.length === 0 && (
        <EmptyState
          title="No clients yet"
          description="Invite or create a client to begin the between-session workflow."
          action={
            isTherapist ? (
              <Button variant="primary" onClick={() => router.push("/app/therapist/dashboard")}>
                Invite clients
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading && rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      aria-label="Select all clients"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Therapist</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>Responses</TableHead>
                  <TableHead>Check-ins</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const id = row.id;
                  const isSelected = selectedIds.includes(id);
                  const name = row.fullName ?? "Client";
                  const email = row.email ?? "";
                  const therapistName = isClinicClientRow(row)
                    ? row.therapistName ?? row.therapistId
                    : "-";
                  const assignmentCount = isClinicClientRow(row) ? row.assignmentCount : "—";
                  const responseCount = isClinicClientRow(row) ? row.responseCount : "—";
                  const checkinCount = isClinicClientRow(row) ? row.checkinCount : "—";
                  return (
                    <TableRow key={id} className={isSelected ? "bg-app-surface-2" : undefined}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(id)}
                          aria-label={`Select ${name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-app-muted">{email}</div>
                      </TableCell>
                      <TableCell className="text-sm text-app-muted">
                        {therapistName}
                      </TableCell>
                      <TableCell>{assignmentCount}</TableCell>
                      <TableCell>{responseCount}</TableCell>
                      <TableCell>{checkinCount}</TableCell>
                      <TableCell className="text-sm text-app-muted">
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                          href={`/app/clients/${id}`}
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={bulkAssignOpen}
        onClose={() => setBulkAssignOpen(false)}
        title="Bulk assign"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-app-muted">
              {selectedIds.length} client(s) selected
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setBulkAssignOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={!canBulkAssign || bulkAssigning} onClick={bulkAssign}>
                {bulkAssigning ? "Assigning..." : "Assign"}
              </Button>
            </div>
          </div>
        }
      >
        {!canBulkAssign ? (
          <p className="text-sm text-app-muted">
            Bulk assign is available to therapist roles.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-label text-app-muted">Assignment source</label>
              <Select
                value={bulkPayload.mode}
                onChange={(event) =>
                  setBulkPayload((prev) => ({
                    ...prev,
                    mode: event.target.value as BulkAssignPayload["mode"],
                  }))
                }
              >
                <option value="custom">Custom draft</option>
                <option value="prompt">Library prompt</option>
              </Select>
            </div>
            {bulkPayload.mode === "prompt" ? (
              <div>
                <label className="text-label text-app-muted">Prompt</label>
                <Select
                  value={bulkPayload.promptId}
                  onChange={(event) =>
                    setBulkPayload((prev) => ({ ...prev, promptId: event.target.value }))
                  }
                >
                  {promptOptions.map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.title}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-label text-app-muted">Title</label>
                  <Input
                    value={bulkPayload.title}
                    onChange={(event) =>
                      setBulkPayload((prev) => ({ ...prev, title: event.target.value }))
                    }
                    placeholder="Assignment title"
                  />
                </div>
                <div>
                  <label className="text-label text-app-muted">Description</label>
                  <textarea
                    className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft"
                    rows={4}
                    value={bulkPayload.description}
                    onChange={(event) =>
                      setBulkPayload((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Instructions for the client"
                  />
                </div>
              </>
            )}
            <div>
              <label className="text-label text-app-muted">Due date (optional)</label>
              <Input
                type="date"
                value={bulkPayload.dueDate}
                onChange={(event) =>
                  setBulkPayload((prev) => ({ ...prev, dueDate: event.target.value }))
                }
              />
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={bulkCheckinOpen}
        onClose={() => setBulkCheckinOpen(false)}
        title="Bulk request check-ins"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-app-muted">
              {selectedIds.length} client(s) selected
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setBulkCheckinOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={!canBulkCheckins || bulkAssigning} onClick={bulkRequestCheckins}>
                {bulkAssigning ? "Sending..." : "Send requests"}
              </Button>
            </div>
          </div>
        }
      >
        {!canBulkCheckins ? (
          <p className="text-sm text-app-muted">
            Bulk check-in requests are available to therapist roles.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-label text-app-muted">Title</label>
              <Input
                value={bulkPayload.title}
                onChange={(event) =>
                  setBulkPayload((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Check-in request"
              />
            </div>
            <div>
              <label className="text-label text-app-muted">Message</label>
              <textarea
                className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft"
                rows={4}
                value={bulkPayload.description}
                onChange={(event) =>
                  setBulkPayload((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Instructions for the client"
              />
            </div>
            <div>
              <label className="text-label text-app-muted">Due date (optional)</label>
              <Input
                type="date"
                value={bulkPayload.dueDate}
                onChange={(event) =>
                  setBulkPayload((prev) => ({ ...prev, dueDate: event.target.value }))
                }
              />
            </div>
          </div>
        )}
      </Dialog>

      {bulkStatus && (
        <div className="mt-4 text-sm text-app-muted">{bulkStatus}</div>
      )}
    </PageLayout>
  );
}
