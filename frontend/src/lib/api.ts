export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  json?: unknown;
  rawBody?: boolean;
  body?: BodyInit | null;
};

// Per-tab cache
let cachedCsrfToken: string | null = null;

function isMutatingMethod(method?: string) {
  const m = (method ?? "GET").toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

function buildUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(buildUrl("/auth/csrf"), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    throw new Error(text || `Failed to fetch CSRF token (${res.status})`);
  }

  let data: any = null;
  if (contentType.includes("application/json") && text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  const token = data?.csrfToken;
  if (!token || typeof token !== "string") {
    throw new Error("CSRF token endpoint returned null/empty token");
  }

  cachedCsrfToken = token;
  return token;
}

function parseErrorMessage(text: string, contentType: string) {
  if (contentType.includes("application/json")) {
    try {
      const data = JSON.parse(text);
      if (typeof data?.message === "string") return data.message;
      if (Array.isArray(data?.message)) return data.message.join("\n");
      return JSON.stringify(data);
    } catch {
      return text;
    }
  }
  return text;
}

async function doFetch(url: string, options: RequestInit) {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    cache: "no-store",
  });
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  return { res, contentType, text };
}

export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const url = buildUrl(path);

  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const hasJson = typeof options.json !== "undefined";
  if (hasJson && options.body) {
    throw new Error("apiFetch: provide either `json` or `body`, not both.");
  }

  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  if (!options.rawBody && !isFormData && hasJson && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const bodyToSend = hasJson ? JSON.stringify(options.json) : options.body;

  // Attach CSRF token for mutating requests
  if (isMutatingMethod(method)) {
    const token = cachedCsrfToken ?? (await fetchCsrfToken());
    headers.set("x-csrf-token", token);
  }

  // First attempt
  const first = await doFetch(url, {
    ...options,
    method,
    headers,
    body: bodyToSend,
  });

  // If CSRF mismatch, csurf returns 403. Don’t rely on message text.
  if (first.res.status === 403 && isMutatingMethod(method)) {
    cachedCsrfToken = null;
    const token = await fetchCsrfToken();
    headers.set("x-csrf-token", token);

    const retry = await doFetch(url, {
      ...options,
      method,
      headers,
      body: bodyToSend,
    });

    if (!retry.res.ok) {
      throw new Error(parseErrorMessage(retry.text || retry.res.statusText, retry.contentType));
    }

    if (!retry.text) return {} as T;
    if (retry.contentType.includes("application/json")) return JSON.parse(retry.text) as T;
    return retry.text as unknown as T;
  }

  if (!first.res.ok) {
    throw new Error(parseErrorMessage(first.text || first.res.statusText, first.contentType));
  }

  if (!first.text) return {} as T;
  if (first.contentType.includes("application/json")) return JSON.parse(first.text) as T;
  return first.text as unknown as T;
}





