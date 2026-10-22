"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package,
  Trophy,
  Gavel,
  LogOut,
  LogIn,
  UserPlus,
  LayoutDashboard,
  X,
} from "lucide-react";
import { Profile } from "@/lib/database.types";
import { isStaffRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { clearSession } from "@/lib/session";
import { useRouter } from "next/navigation";

const publicLinks = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/lots", label: "Semua Lot", icon: Package },
  { href: "/hasil", label: "Cek Hasil", icon: Trophy },
];

const bidderLinks = [
  { href: "/bid-saya", label: "Bid Saya", icon: Gavel },
];

export function MobileNavDrawer({
  open,
  onClose,
  profile,
  companyCode,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  companyCode?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const withCompany = (href: string) =>
    companyCode ? `${href}?company=${companyCode}` : href;

  const isStaff = isStaffRole(profile?.role);
  const isBidder = profile?.role === "bidder";

  async function handleLogout() {
    clearSession();
    onClose();
    router.refresh();
    router.push("/");
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--border)] px-4">
          <span className="font-semibold text-slate-900">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {profile && (
          <div className="border-b border-[var(--border)] px-4 py-4">
            <p className="truncate font-medium text-slate-900">{profile.full_name}</p>
            <p className="text-xs capitalize text-slate-500">{profile.role}</p>
            {profile.employee_nik && (
              <p className="mt-1 font-mono text-xs text-[var(--primary)]">
                NIK: {profile.employee_nik}
              </p>
            )}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Navigasi
          </p>
          {publicLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={withCompany(href)}
              onClick={onClose}
              className={cn(
                "mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-indigo-50 text-[var(--primary)]"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}

          {isBidder && (
            <>
              <p className="mb-2 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Akun Saya
              </p>
              {bidderLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    "mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    pathname === href || pathname.startsWith(`${href}/`)
                      ? "bg-indigo-50 text-[var(--primary)]"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </>
          )}

          {isStaff && (
            <Link
              href="/admin"
              onClick={onClose}
              className="mb-1 mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard Admin
            </Link>
          )}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          {profile ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          ) : (
            <div className="space-y-1">
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <LogIn className="h-4 w-4" />
                Login
              </Link>
              <Link
                href="/daftar"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <UserPlus className="h-4 w-4" />
                Daftar
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
