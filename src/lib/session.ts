"use client";

import {
  apiFetch,
  clearClientToken,
  getClientToken,
  setClientToken,
} from "@/lib/api-client";
import type { Profile } from "@/lib/database.types";

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  companyId: string | null;
  fullName: string;
  username: string;
};

const USER_STORAGE_KEY = "lelang_user";

export function sessionUserToProfile(user: SessionUser): Profile {
  return {
    id: user.id,
    username: user.username,
    full_name: user.fullName,
    employee_nik: null,
    role: user.role,
    company_id: user.companyId ?? "",
    is_active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

export function getToken(): string | null {
  return getClientToken();
}

export function getStoredUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: SessionUser): void {
  setClientToken(token);
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lelang-auth-change"));
  }
}

export function clearSession(): void {
  clearClientToken();
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lelang-auth-change"));
  }
}

export async function fetchMe(
  token?: string | null
): Promise<SessionUser | null> {
  const t = token ?? getToken();
  if (!t) return null;
  const res = await apiFetch<{ user: SessionUser }>("/api/auth/me", {
    method: "GET",
    token: t,
  });
  // Only wipe local session on auth failure — not on transient network errors.
  if (res.status === 401 || res.status === 403) {
    clearSession();
    return null;
  }
  if (!res.ok || !res.data?.user) {
    return null;
  }
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data.user));
  } catch {
    // ignore
  }
  return res.data.user;
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ user: SessionUser; token: string } | { error: string }> {
  const res = await apiFetch<{ token: string; user: SessionUser }>(
    "/api/auth/login",
    {
      method: "POST",
      body: { email, password },
    }
  );
  if (!res.ok || !res.data?.token || !res.data?.user) {
    return { error: res.error ?? "Login gagal" };
  }
  setSession(res.data.token, res.data.user);
  return { token: res.data.token, user: res.data.user };
}

export function onAuthChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("lelang-auth-change", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("lelang-auth-change", handler);
    window.removeEventListener("storage", handler);
  };
}
