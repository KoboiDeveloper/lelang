export const TOKEN_COOKIE = "lelang_token";
export const TOKEN_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/** Cookie options for the JWT used by middleware + SSR (`requireStaff`). */
export function authCookieOptions(secure: boolean) {
  return {
    httpOnly: false, // client still mirrors token in localStorage for apiFetch
    path: "/",
    maxAge: TOKEN_MAX_AGE_SEC,
    sameSite: "lax" as const,
    secure,
  };
}

export function clearAuthCookieOptions(secure: boolean) {
  return {
    httpOnly: false,
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
    secure,
  };
}

/** Normalize cookie value (handles legacy encodeURIComponent writes). */
export function normalizeAuthToken(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let token = raw.trim();
  if (!token) return null;
  try {
    if (token.includes("%")) {
      token = decodeURIComponent(token);
    }
  } catch {
    // keep raw
  }
  return token || null;
}
