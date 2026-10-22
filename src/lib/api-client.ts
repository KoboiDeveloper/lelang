export const TOKEN_COOKIE = "lelang_token";
export const TOKEN_STORAGE_KEY = "lelang_token";

export function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100").replace(
    /\/$/,
    ""
  );
}

export type ApiFetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  formData?: FormData;
  headers?: HeadersInit;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  signal?: AbortSignal;
};

export type ApiResult<T> = {
  data: T;
  ok: boolean;
  status: number;
  error?: string;
};

function buildUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = getApiBase();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers);
  const token = options.token;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(buildUrl(path), {
      method: options.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      cache: options.cache,
      next: options.next,
      signal: options.signal,
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const errObj = parsed as { error?: string; message?: string } | null;
      const error =
        (errObj && typeof errObj === "object" && (errObj.error || errObj.message)) ||
        `Request failed (${res.status})`;
      return {
        data: parsed as T,
        ok: false,
        status: res.status,
        error: String(error),
      };
    }

    return { data: parsed as T, ok: true, status: res.status };
  } catch (err) {
    return {
      data: null as T,
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** Read JWT from cookie (server components / route handlers). */
export async function getServerToken(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    return jar.get(TOKEN_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/** Server-side fetch with Authorization from cookie when available. */
export async function apiFetchServer<T = unknown>(
  path: string,
  options: Omit<ApiFetchOptions, "token"> & { token?: string | null } = {}
): Promise<ApiResult<T>> {
  const token =
    options.token !== undefined ? options.token : await getServerToken();
  return apiFetch<T>(path, { ...options, token });
}

export function getClientToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setClientToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore
  }
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function clearClientToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function photoProxyUrl(storagePath: string): string {
  const path = storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
  return `${getApiBase()}/api/files/proxy?path=${encodeURIComponent(path)}`;
}
