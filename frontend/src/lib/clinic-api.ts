import { apiFetch } from "@/lib/api";
import {
  ClinicAssignmentListItem,
  ClinicBilling,
  ClinicCheckinListItem,
  ClinicClientDetail,
  ClinicClientListItem,
  ClinicDashboard,
  ClinicResponseListItem,
  ClinicSettings,
  ClinicTherapistDetail,
  ClinicTherapistListItem,
  ClinicTherapistInvite,
  ClinicTherapistCreateResult,
  ClinicInviteListItem,
} from "@/lib/types/clinic";

export async function clinicDashboard(): Promise<ClinicDashboard> {
  return apiFetch("/clinic/dashboard");
}

export async function clinicListTherapists(params: {
  q?: string;
  limit?: number;
  cursor?: string;
  clinicId?: string;
}): Promise<{ items: ClinicTherapistListItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.clinicId) qs.set("clinicId", params.clinicId);
  return apiFetch(`/clinic/therapists?${qs.toString()}`);
}

export async function clinicGetTherapist(id: string): Promise<ClinicTherapistDetail> {
  return apiFetch(`/clinic/therapists/${encodeURIComponent(id)}`);
}

export async function clinicInviteTherapist(dto: {
  email: string;
  fullName?: string;
  clinicId?: string;
}): Promise<ClinicTherapistInvite> {
  const res = await apiFetch<{ token: string; expires_at: string | null }>(
    "/clinic/therapists/invite",
    {
      method: "POST",
      body: JSON.stringify(dto),
      headers: { "Content-Type": "application/json" },
    },
  );

  return { token: res.token, expiresAt: res.expires_at ?? null };
}

export async function clinicCreateTherapist(dto: {
  email: string;
  fullName: string;
  password: string;
  organization?: string;
  timezone?: string;
}): Promise<ClinicTherapistCreateResult> {
  return apiFetch("/clinic/therapists", {
    method: "POST",
    body: JSON.stringify(dto),
    headers: { "Content-Type": "application/json" },
  });
}

export async function clinicListClients(params: {
  q?: string;
  limit?: number;
  cursor?: string;
  clinicId?: string;
}): Promise<{ items: ClinicClientListItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.clinicId) qs.set("clinicId", params.clinicId);
  return apiFetch(`/clinic/clients?${qs.toString()}`);
}

export async function clinicListTherapistInvites(params: {
  status?: string;
  clinicId?: string;
}): Promise<ClinicInviteListItem[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.clinicId) qs.set("clinicId", params.clinicId);
  return apiFetch(`/clinic/therapists/invites?${qs.toString()}`);
}

export async function clinicResendTherapistInvite(params: {
  inviteId: string;
  clinicId?: string;
}) {
  const qs = new URLSearchParams();
  if (params.clinicId) qs.set("clinicId", params.clinicId);
  return apiFetch(`/clinic/therapists/invites/${encodeURIComponent(params.inviteId)}/resend?${qs.toString()}`, {
    method: "POST",
  });
}

export async function clinicRevokeTherapistInvite(params: {
  inviteId: string;
  clinicId?: string;
}) {
  const qs = new URLSearchParams();
  if (params.clinicId) qs.set("clinicId", params.clinicId);
  return apiFetch(`/clinic/therapists/invites/${encodeURIComponent(params.inviteId)}/revoke?${qs.toString()}`, {
    method: "POST",
  });
}

export async function clinicInviteClient(dto: {
  email: string;
  therapistId?: string;
  clinicId?: string;
}) {
  return apiFetch("/clinic/clients/invite", {
    method: "POST",
    body: JSON.stringify(dto),
    headers: { "Content-Type": "application/json" },
  });
}

export async function clinicListClientInvites(params: {
  status?: string;
  clinicId?: string;
}): Promise<ClinicInviteListItem[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.clinicId) qs.set("clinicId", params.clinicId);
  return apiFetch(`/clinic/clients/invites?${qs.toString()}`);
}

export async function clinicResendClientInvite(params: {
  inviteId: string;
  clinicId?: string;
}) {
  const qs = new URLSearchParams();
  if (params.clinicId) qs.set("clinicId", params.clinicId);
  return apiFetch(`/clinic/clients/invites/${encodeURIComponent(params.inviteId)}/resend?${qs.toString()}`, {
    method: "POST",
  });
}

export async function clinicRevokeClientInvite(params: {
  inviteId: string;
  clinicId?: string;
}) {
  const qs = new URLSearchParams();
  if (params.clinicId) qs.set("clinicId", params.clinicId);
  return apiFetch(`/clinic/clients/invites/${encodeURIComponent(params.inviteId)}/revoke?${qs.toString()}`, {
    method: "POST",
  });
}

export async function clinicDisableUser(params: { userId: string; clinicId?: string }) {
  const qs = new URLSearchParams();
  if (params.clinicId) qs.set("clinicId", params.clinicId);
  return apiFetch(`/clinic/users/${encodeURIComponent(params.userId)}/disable?${qs.toString()}`, {
    method: "POST",
  });
}

export async function clinicGetClient(id: string): Promise<ClinicClientDetail> {
  return apiFetch(`/clinic/clients/${encodeURIComponent(id)}`);
}

export async function clinicListAssignments(params: {
  q?: string;
  limit?: number;
  cursor?: string;
  clientId?: string;
}): Promise<{ items: ClinicAssignmentListItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.clientId) qs.set("clientId", params.clientId);
  return apiFetch(`/clinic/assignments?${qs.toString()}`);
}

export async function clinicListResponses(params: {
  q?: string;
  reviewed?: "all" | "reviewed" | "unreviewed";
  flagged?: "all" | "flagged" | "unflagged";
  limit?: number;
  cursor?: string;
  clientId?: string;
}): Promise<{ items: ClinicResponseListItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.reviewed) qs.set("reviewed", params.reviewed);
  if (params.flagged) qs.set("flagged", params.flagged);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.clientId) qs.set("clientId", params.clientId);
  return apiFetch(`/clinic/responses?${qs.toString()}`);
}

export async function clinicListCheckins(params: {
  q?: string;
  limit?: number;
  cursor?: string;
  clientId?: string;
}): Promise<{ items: ClinicCheckinListItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.clientId) qs.set("clientId", params.clientId);
  return apiFetch(`/clinic/checkins?${qs.toString()}`);
}

export async function clinicBilling(): Promise<ClinicBilling> {
  return apiFetch("/clinic/billing");
}

export async function clinicUpdateSettings(dto: {
  name?: string;
  timezone?: string;
  logoUrl?: string;
  primaryColor?: string;
}): Promise<ClinicSettings> {
  return apiFetch("/clinic/settings", {
    method: "PATCH",
    body: JSON.stringify(dto),
    headers: { "Content-Type": "application/json" },
  });
}
