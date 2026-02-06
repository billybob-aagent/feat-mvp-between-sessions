// frontend/src/lib/api.ts

type ApiErrorPayload =
  | {
      message?: string | string[];
      error?: string;
      statusCode?: number;
      [key: string]: unknown;
    }
  | string
  | null;

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload;

  constructor(status: number, message: string, payload: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:4000/api/v1";

function buildUrl(path: string) {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${BASE_URL}${path}`;
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeErrorMessage(status: number, payload: ApiErrorPayload) {
  if (!payload) return `Request failed (${status})`;

  const data = typeof payload === "object" && payload !== null ? payload : {};
  const msg = (data as { message?: string | string[] }).message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string" && msg.trim().length > 0) return msg;

  const err = (data as { error?: string }).error;
  if (typeof err === "string" && err.trim().length > 0) return err;

  return `Request failed (${status})`;
}

/**
 * Backwards-compatible low-level fetch wrapper.
 * Some existing pages/components likely import { apiFetch } from "@/lib/api".
 */
type ApiFetchInit = RequestInit & {
  json?: unknown;
  skipAuthRedirect?: boolean;
  skipAuthRefresh?: boolean;
  __retry?: boolean;
};

export async function apiFetch<T = unknown>(
  path: string,
  init?: ApiFetchInit,
): Promise<T> {
  const { json: jsonBody, skipAuthRedirect, skipAuthRefresh, __retry, ...rest } = init ?? {};
  const headers = {
    "Content-Type": "application/json",
    ...(rest.headers || {}),
  };
  const url = buildUrl(path);
  const res = await fetch(url, {
    ...rest,
    body: jsonBody === undefined ? rest.body : JSON.stringify(jsonBody),
    headers,
    credentials: "include", // REQUIRED for cookie auth
  });

  const payload = (await parseJsonSafe(res)) as ApiErrorPayload;

  if (res.status === 401 && !skipAuthRefresh) {
    const isAuthRoute =
      path.startsWith("/auth/login") ||
      path.startsWith("/auth/refresh") ||
      path.startsWith("/auth/register") ||
      path.startsWith("/auth/register-client");

    if (!isAuthRoute && !__retry) {
      const refreshed = await refreshOnce();
      if (refreshed) {
        return apiFetch<T>(path, { ...init, __retry: true });
      }
    }
  }

  if (res.status === 401 && !skipAuthRedirect && typeof window !== "undefined") {
    const next = `${window.location.pathname}${window.location.search}`;
    const target = `/auth/login?next=${encodeURIComponent(next)}`;
    window.location.href = target;
  }

  if (!res.ok) {
    const message = normalizeErrorMessage(res.status, payload);
    throw new ApiError(res.status, message, payload);
  }

  return payload as T;
}

export async function apiDownload(path: string): Promise<{
  blob: Blob;
  filename: string | null;
  contentType: string | null;
  size: number | null;
}> {
  const url = buildUrl(path);
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    const payload = (await parseJsonSafe(res)) as ApiErrorPayload;
    const message = normalizeErrorMessage(res.status, payload);
    throw new ApiError(res.status, message, payload);
  }

  const blob = await res.blob();
  const contentType = res.headers.get("content-type");
  const sizeHeader = res.headers.get("content-length");
  const size = sizeHeader ? Number(sizeHeader) : null;
  const disposition = res.headers.get("content-disposition") || "";
  const filenameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  const filename = filenameMatch?.[1] ?? null;

  return { blob, filename, contentType, size };
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(buildUrl("/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  return apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// Generic helpers
export function apiGet<T = unknown>(path: string) {
  return request<T>("GET", path);
}
export function apiPost<T = unknown>(path: string, body?: unknown) {
  return request<T>("POST", path, body);
}
export function apiPut<T = unknown>(path: string, body?: unknown) {
  return request<T>("PUT", path, body);
}
export function apiPatch<T = unknown>(path: string, body?: unknown) {
  return request<T>("PATCH", path, body);
}
export function apiDelete<T = unknown>(path: string) {
  return request<T>("DELETE", path);
}

// ---- Auth (MATCHES BACKEND ROUTES) ----
export async function login(email: string, password: string) {
  return apiPost("/auth/login", { email, password });
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const str = String(value);
    if (str.length === 0) continue;
    qs.set(key, str);
  }
  const out = qs.toString();
  return out ? `?${out}` : "";
}

// ---- Library (Clinical Content) ----
export function libraryCollections(clinicId?: string | null) {
  return apiGet(`/library/collections${buildQuery({ clinicId: clinicId ?? null })}`);
}

export function libraryItems(filters: {
  collectionId?: string | null;
  type?: string | null;
  status?: string | null;
  q?: string | null;
  domain?: string | null;
  modality?: string | null;
  population?: string | null;
  complexity?: string | null;
  sessionUse?: string | null;
  clinicId?: string | null;
}) {
  return apiGet(
    `/library/items${buildQuery({
      collectionId: filters.collectionId ?? null,
      type: filters.type ?? null,
      status: filters.status ?? null,
      q: filters.q ?? null,
      domain: filters.domain ?? null,
      modality: filters.modality ?? null,
      population: filters.population ?? null,
      complexity: filters.complexity ?? null,
      sessionUse: filters.sessionUse ?? null,
      clinicId: filters.clinicId ?? null,
    })}`,
  );
}

export function libraryItem(id: string, clinicId?: string | null) {
  return apiGet(`/library/items/${encodeURIComponent(id)}${buildQuery({ clinicId: clinicId ?? null })}`);
}

export function libraryCreateItem(payload: unknown) {
  return apiPost("/library/items", payload);
}

export function libraryUpdateItem(id: string, payload: unknown) {
  return apiPatch(`/library/items/${encodeURIComponent(id)}`, payload);
}

export function libraryPublishItem(id: string, payload: unknown) {
  return apiPost(`/library/items/${encodeURIComponent(id)}/publish`, payload);
}

export function libraryArchiveItem(id: string) {
  return apiPost(`/library/items/${encodeURIComponent(id)}/archive`, {});
}

export function librarySubmitItem(id: string) {
  return apiPost(`/library/items/${encodeURIComponent(id)}/submit`, {});
}

export function libraryStartReview(id: string) {
  return apiPost(`/library/items/${encodeURIComponent(id)}/start-review`, {});
}

export function libraryApproveItem(id: string) {
  return apiPost(`/library/items/${encodeURIComponent(id)}/approve`, {});
}

export function libraryRejectItem(id: string, payload: { reason: string }) {
  return apiPost(`/library/items/${encodeURIComponent(id)}/reject`, payload);
}

export function libraryReviewQueue(params: { status?: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED"; clinicId?: string | null }) {
  return apiGet(`/library/review-queue${buildQuery({ status: params.status ?? null, clinicId: params.clinicId ?? null })}`);
}

export function librarySearch(q: string, limit?: number, clinicId?: string | null) {
  return apiGet(`/library/search${buildQuery({ q, limit: limit ?? null, clinicId: clinicId ?? null })}`);
}

export function libraryRagQuery(payload: unknown) {
  return apiPost("/library/rag/query", payload);
}

export function libraryListSignatureRequests(filters: {
  status?: string | null;
  clientId?: string | null;
  itemId?: string | null;
  limit?: number | null;
  clinicId?: string | null;
}) {
  return apiGet(
    `/library/forms/signature-requests${buildQuery({
      status: filters.status ?? null,
      clientId: filters.clientId ?? null,
      itemId: filters.itemId ?? null,
      limit: filters.limit ?? null,
      clinicId: filters.clinicId ?? null,
    })}`,
  );
}

export function libraryCreateSignatureRequest(itemId: string, payload: { clientId: string; dueAt?: string }) {
  return apiPost(`/library/forms/${encodeURIComponent(itemId)}/signature-requests`, payload);
}

export async function registerTherapist(email: string, password: string, fullName: string) {
  return apiPost("/auth/register/therapist", { email, password, fullName });
}

export async function registerClientFromInvite(token: string, password: string, fullName: string) {
  return apiPost("/auth/register/client", { token, password, fullName });
}

export async function refresh() {
  return apiPost("/auth/refresh", {});
}

export async function logout() {
  return apiPost("/auth/logout", {});
}

// ---- Assignments ----
export async function clientListMyAssignments() {
  return apiGet("/assignments/mine");
}

export async function therapistListMyAssignments() {
  return apiGet("/assignments/therapist");
}

export async function createAssignmentFromLibrary(payload: {
  clinicId?: string | null;
  clientId: string;
  libraryItemId: string;
  dueDate?: string | null;
  note?: string | null;
  program?: string | null;
  assignmentTitleOverride?: string | null;
}) {
  return apiPost("/assignments/from-library", payload);
}

export async function clinicianListAssignments(params: {
  clinicId?: string | null;
  clientId?: string | null;
  status?: "active" | "completed" | "all";
  limit?: number;
}) {
  return apiGet(
    `/assignments${buildQuery({
      clinicId: params.clinicId ?? null,
      clientId: params.clientId ?? null,
      status: params.status ?? null,
      limit: params.limit ?? null,
    })}`,
  );
}

// ---- Pilot Metrics ----
export function pilotMetrics(params: { clinicId: string; start: string; end: string }) {
  const qs = new URLSearchParams({ start: params.start, end: params.end });
  return apiGet(`/metrics/pilot/${encodeURIComponent(params.clinicId)}?${qs.toString()}`);
}

// ---- Responses ----
export async function clientSubmitResponse(dto: {
  assignmentId: string;
  mood: number;
  text: string;
  prompt?: string;
  voiceKey?: string;
}) {
  return apiPost("/responses/submit", dto);
}

// ---- Review Queue ----
export function reviewQueueList(params: {
  clinicId?: string;
  q?: string;
  reviewed?: "all" | "reviewed" | "unreviewed";
  flagged?: "all" | "flagged" | "unflagged";
  limit?: number;
}) {
  return apiGet(
    `/review-queue${buildQuery({
      clinicId: params.clinicId ?? null,
      q: params.q ?? null,
      reviewed: params.reviewed ?? null,
      flagged: params.flagged ?? null,
      limit: params.limit ?? null,
    })}`,
  );
}

export function reviewQueueMarkReviewed(payload: {
  responseIds: string[];
  therapistNote?: string;
}) {
  return apiPost("/review-queue/mark-reviewed", payload);
}

export async function therapistListResponsesByAssignment(assignmentId: string) {
  return apiGet(`/responses/therapist/assignment/${assignmentId}`);
}

export async function therapistGetResponseDecrypted(responseId: string) {
  return apiGet(`/responses/therapist/${responseId}`);
}
