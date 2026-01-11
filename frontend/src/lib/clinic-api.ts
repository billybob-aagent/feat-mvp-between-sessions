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
} from "@/lib/types/clinic";

export async function clinicDashboard(): Promise<ClinicDashboard> {
  return apiFetch("/clinic/dashboard");
}

export async function clinicListTherapists(params: {
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: ClinicTherapistListItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  return apiFetch(`/clinic/therapists?${qs.toString()}`);
}

export async function clinicGetTherapist(id: string): Promise<ClinicTherapistDetail> {
  return apiFetch(`/clinic/therapists/${encodeURIComponent(id)}`);
}

export async function clinicListClients(params: {
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: ClinicClientListItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  return apiFetch(`/clinic/clients?${qs.toString()}`);
}

export async function clinicGetClient(id: string): Promise<ClinicClientDetail> {
  return apiFetch(`/clinic/clients/${encodeURIComponent(id)}`);
}

export async function clinicListAssignments(params: {
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: ClinicAssignmentListItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  return apiFetch(`/clinic/assignments?${qs.toString()}`);
}

export async function clinicListResponses(params: {
  q?: string;
  reviewed?: "all" | "reviewed" | "unreviewed";
  flagged?: "all" | "flagged" | "unflagged";
  limit?: number;
  cursor?: string;
}): Promise<{ items: ClinicResponseListItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.reviewed) qs.set("reviewed", params.reviewed);
  if (params.flagged) qs.set("flagged", params.flagged);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  return apiFetch(`/clinic/responses?${qs.toString()}`);
}

export async function clinicListCheckins(params: {
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: ClinicCheckinListItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
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
