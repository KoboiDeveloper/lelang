"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Profile } from "@/lib/database.types";
import { isStaffRole } from "@/lib/roles";
import {
  clearSession,
  fetchMe,
  getStoredUser,
  getToken,
  onAuthChange,
  sessionUserToProfile,
} from "@/lib/session";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export function NavbarAuth({ profile: profileProp }: { profile?: Profile | null }) {
  const [profile, setProfile] = useState<Profile | null>(profileProp ?? null);
  const [loading, setLoading] = useState(!profileProp);
  const router = useRouter();

  useEffect(() => {
    setProfile(profileProp ?? null);
    if (profileProp !== undefined) {
      setLoading(false);
    }
  }, [profileProp]);

  useEffect(() => {
    if (profileProp !== undefined) return;

    async function loadProfile() {
      const token = getToken();
      if (!token) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const stored = getStoredUser();
      if (stored) {
        setProfile(sessionUserToProfile(stored));
        setLoading(false);
      }
      const user = await fetchMe(token);
      setProfile(user ? sessionUserToProfile(user) : null);
      setLoading(false);
    }

    void loadProfile();
    return onAuthChange(() => {
      void loadProfile();
    });
  }, [profileProp]);

  async function handleLogout() {
    clearSession();
    setProfile(null);
    router.refresh();
  }

  if (loading) {
    return <div className="hidden h-9 w-9 lg:block" />;
  }

  if (profile) {
    const profileHref = profile.role === "bidder"
      ? "/bid-saya"
      : isStaffRole(profile.role)
        ? "/admin"
        : "/";

    return (
      <div className="hidden items-center gap-2 lg:flex lg:gap-3">
        <Link
          href={profileHref}
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-1.5"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100">
            <User className="h-3.5 w-3.5 text-[var(--primary)]" />
          </div>
          <div className="text-left leading-tight">
            <p className="max-w-[120px] truncate text-sm font-medium text-slate-900">
              {profile.full_name}
            </p>
            <p className="text-xs capitalize text-slate-500">{profile.role}</p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-1.5 px-3"
          aria-label="Keluar"
        >
          <LogOut className="h-4 w-4" />
          <span>Keluar</span>
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => router.push("/login")} className="hidden lg:inline-flex">
      Login
    </Button>
  );
}
