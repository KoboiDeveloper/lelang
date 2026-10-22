import {
  normalizeAuthToken,
  TOKEN_COOKIE,
  TOKEN_MAX_AGE_SEC,
} from "@/lib/auth-cookie";

export { TOKEN_COOKIE };
export const TOKEN_STORAGE_KEY = "lelang_token";

/** Absolute BE URL (server / proxy / photos). Always from env. */
export function getBackendBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100").replace(
    /\/$/,
    ""
  );
}

/**
 * Base for API calls.
 * Browser uses same-origin (`""`) so Next can rewrite/proxy to BE and avoid CORS
 * when FE and BE are on different hosts (e.g. Coolify).
 * Server always hits BE directly.
 */
export function getApiBase(): string {
  if (typeof window !== "undefined") return "";
  return getBackendBase();
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
      // Ensure Set-Cookie from same-origin auth routes is accepted.
      credentials: "same-origin",
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
    return normalizeAuthToken(jar.get(TOKEN_COOKIE)?.value);
  } catch {
    return null;
  }
}

function readBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  return normalizeAuthToken(match.slice(name.length + 1));
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
    const fromStorage = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (fromStorage) return fromStorage;
  } catch {
    // ignore
  }
  return readBrowserCookie(TOKEN_COOKIE);
}

export function setClientToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore
  }
  // Mirror cookie for middleware/SSR (login API also Set-Cookie).
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TOKEN_COOKIE}=${token}; Path=/; Max-Age=${TOKEN_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

export function clearClientToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(
    () => undefined
  );
}

export function photoProxyUrl(storagePath: string): string {
  const path = storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
  return `${getApiBase()}/api/files/proxy?path=${encodeURIComponent(path)}`;
}
