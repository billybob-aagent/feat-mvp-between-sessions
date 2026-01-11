// frontend/src/lib/api.ts

type ApiErrorPayload =
  | { message?: string | string[]; error?: string; statusCode?: number }
  | any;

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

async function parseJsonSafe(res: Response) {
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

  const msg = (payload as any)?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string" && msg.trim().length > 0) return msg;

  const err = (payload as any)?.error;
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

export async function apiFetch<T = any>(
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

  const payload = await parseJsonSafe(res);

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
export function apiGet<T = any>(path: string) {
  return request<T>("GET", path);
}
export function apiPost<T = any>(path: string, body?: unknown) {
  return request<T>("POST", path, body);
}
export function apiPut<T = any>(path: string, body?: unknown) {
  return request<T>("PUT", path, body);
}
export function apiPatch<T = any>(path: string, body?: unknown) {
  return request<T>("PATCH", path, body);
}
export function apiDelete<T = any>(path: string) {
  return request<T>("DELETE", path);
}

// ---- Auth (MATCHES BACKEND ROUTES) ----
export async function login(email: string, password: string) {
  return apiPost("/auth/login", { email, password });
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

export async function therapistListResponsesByAssignment(assignmentId: string) {
  return apiGet(`/responses/therapist/assignment/${assignmentId}`);
}

export async function therapistGetResponseDecrypted(responseId: string) {
  return apiGet(`/responses/therapist/${responseId}`);
}
