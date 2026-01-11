"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type UserListItem = {
  id: string;
  email: string;
  role: string;
  isDisabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  therapistName: string | null;
  clientName: string | null;
};

type UserDetail = {
  id: string;
  email: string;
  role: string;
  isDisabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  therapist: { id: string; fullName: string; organization: string | null } | null;
  client: { id: string; fullName: string } | null;
};

export default function AdminUsersPage() {
  const { me, loading: sessionLoading } = useMe();
  const [items, setItems] = useState<UserListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [limit, setLimit] = useState(25);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadFirstPage() {
    setLoading(true);
    setStatus(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      const data = (await apiFetch(
        `/admin/users?${params.toString()}`,
      )) as { items: UserListItem[]; nextCursor: string | null };
      setItems(Array.isArray(data?.items) ? data.items : []);
      setNextCursor(data?.nextCursor ?? null);
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
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("cursor", nextCursor);
      const data = (await apiFetch(
        `/admin/users?${params.toString()}`,
      )) as { items: UserListItem[]; nextCursor: string | null };
      const newItems = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => [...prev, ...newItems]);
      setNextCursor(data?.nextCursor ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setLoadingMore(false);
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    try {
      const data = (await apiFetch(
        `/admin/users/${encodeURIComponent(id)}`,
      )) as UserDetail;
      setDetail(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function updateStatus(id: string, disabled: boolean) {
    setStatus(null);
    try {
      await apiFetch(`/admin/users/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ disabled }),
        headers: { "Content-Type": "application/json" },
      });
      await loadFirstPage();
      if (selectedId === id) await loadDetail(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    }
  }

  async function updateRole(id: string, role: string) {
    setStatus(null);
    try {
      await apiFetch(`/admin/users/${encodeURIComponent(id)}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
        headers: { "Content-Type": "application/json" },
      });
      await loadFirstPage();
      if (selectedId === id) await loadDetail(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    }
  }

  useEffect(() => {
    if (sessionLoading) return;
    if (me?.role !== "admin") return;
    loadFirstPage();
  }, [sessionLoading, me, limit]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    loadDetail(selectedId);
  }, [selectedId]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Users</h1>
          <p className="text-sm text-app-muted">
            Manage roles and access across the platform.
          </p>
        </div>
      </div>

      {status && (
        <p className="mb-4 text-sm text-app-danger whitespace-pre-wrap">{status}</p>
      )}

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px]">
            <label className="text-label text-app-muted">Page size</label>
            <Select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={loading || loadingMore}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </Select>
          </div>
          <div className="ml-auto text-xs text-app-muted">
            Showing <span className="font-medium text-app-text">{items.length}</span>
            {nextCursor ? <span className="ml-2">(more available)</span> : null}
          </div>
        </CardContent>
      </Card>

      {(sessionLoading || loading) && (
        <p className="text-sm text-app-muted">Loading...</p>
      )}

      {!loading && items.length === 0 && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">No users found</div>
              <p className="text-sm text-app-muted">Try refreshing the list.</p>
            </div>
            <Button type="button" onClick={loadFirstPage}>
              Reload list
            </Button>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <div className="grid md:grid-cols-3 gap-6">
          <section className="md:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Profiles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.email}</div>
                      <div className="text-xs text-app-muted">
                        Created {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.isDisabled ? "Disabled" : "Active"}</TableCell>
                    <TableCell className="text-xs text-app-muted">
                      Therapist: {user.therapistName ?? "-"}
                      <br />
                      Client: {user.clientName ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button type="button" onClick={() => setSelectedId(user.id)}>
                          Details
                        </Button>
                        <Button
                          type="button"
                          onClick={() => updateStatus(user.id, !user.isDisabled)}
                          variant="secondary"
                        >
                          {user.isDisabled ? "Enable" : "Disable"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {nextCursor && (
              <div className="mt-4 flex justify-end">
                <Button type="button" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </section>

          <section>
            <Card>
              <CardHeader>
                <CardTitle>User detail</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedId && (
                  <p className="text-sm text-app-muted">Select a user.</p>
                )}
                {selectedId && detailLoading && (
                  <p className="text-sm text-app-muted">Loading...</p>
                )}
                {detail && (
                  <div className="text-sm">
                    <div className="font-medium">{detail.email}</div>
                    <div className="text-xs text-app-muted mt-1">Role: {detail.role}</div>
                    <div className="text-xs text-app-muted mt-1">
                      Status: {detail.isDisabled ? "Disabled" : "Active"}
                    </div>
                    <div className="text-xs text-app-muted mt-1">
                      Created: {new Date(detail.createdAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-app-muted mt-1">
                      Last login: {detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString() : "-"}
                    </div>

                    <div className="mt-3">
                      <label className="text-label text-app-muted">Change role</label>
                      <Select
                        value={detail.role}
                        onChange={(e) => updateRole(detail.id, e.target.value)}
                      >
                        <option value="therapist">therapist</option>
                        <option value="client">client</option>
                        <option value="admin">admin</option>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </main>
  );
}
