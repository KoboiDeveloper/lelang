"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Gavel, Menu } from "lucide-react";
import { NavbarAuth } from "@/components/navbar-auth";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";
import { FavoritesMenu } from "@/components/favorites-menu";
import {
  fetchMe,
  getStoredUser,
  getToken,
  onAuthChange,
  sessionUserToProfile,
} from "@/lib/session";
import { Profile } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Beranda" },
  { href: "/lots", label: "Semua Lot" },
  { href: "/hasil", label: "Cek Hasil" },
];

export function Navbar() {
  return (
    <Suspense fallback={<NavbarFallback />}>
      <NavbarContent />
    </Suspense>
  );
}

function NavbarFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/80 backdrop-blur-lg">
      <div className="container-app flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]">
            <Gavel className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-base font-semibold text-slate-900">E-Lelang</span>
        </Link>
      </div>
    </header>
  );
}

function NavbarContent() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const companyQuery = searchParams.get("company");
  const withCompany = (href: string) =>
    companyQuery ? `${href}?company=${companyQuery}` : href;

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) {
        setProfile(null);
        return;
      }
      const stored = getStoredUser();
      if (stored) setProfile(sessionUserToProfile(stored));
      const user = await fetchMe(token);
      setProfile(user ? sessionUserToProfile(user) : null);
    }
    void load();
    return onAuthChange(() => {
      void load();
    });
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isBidder = profile?.role === "bidder";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/80 backdrop-blur-lg">
        <div className="container-app flex h-16 items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Buka menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href={withCompany("/")} className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]">
                <Gavel className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-base font-semibold text-slate-900">E-Lelang</span>
            </Link>

            <nav className="hidden items-center gap-6 lg:flex">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={withCompany(href)}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    pathname === href
                      ? "text-[var(--primary)]"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {label}
                </Link>
              ))}
              {isBidder && (
                <Link
                  href="/bid-saya"
                  className={cn(
                    "text-sm font-medium transition-colors",
                    pathname === "/bid-saya"
                      ? "text-[var(--primary)]"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Bid Saya
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <FavoritesMenu />
            <PushNotificationPrompt variant="navbar" />
            <NavbarAuth profile={profile} />
          </div>
        </div>
      </header>

      <MobileNavDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        profile={profile}
        companyCode={companyQuery}
      />
    </>
  );
}
