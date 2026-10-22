"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  LogOut,
  Gavel,
  Landmark,
  Trophy,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Profile, UserRole } from "@/lib/database.types";
import { ACCOUNTING_ROLES } from "@/lib/roles";
import { clearSession } from "@/lib/session";

const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
  amsOnly?: boolean;
}[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/periods", label: "Periode & Barang", icon: Calendar },
  { href: "/admin/pemenang", label: "Info Pemenang", icon: Trophy },
  { href: "/admin/bidders", label: "Bidder", icon: Users },
  { href: "/admin/users", label: "Semua User", icon: UserCircle, amsOnly: true },
  { href: "/admin/rekening", label: "Rekening", icon: Landmark, roles: ACCOUNTING_ROLES },
  { href: "/admin/reports", label: "Laporan", icon: FileText },
];

export function AdminSidebar({
  profile,
  companyCode,
  collapsed = false,
  mobileOpen = false,
  onMobileClose,
}: {
  profile: Profile;
  companyCode: string;
  collapsed?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    clearSession();
    router.push("/login");
    router.refresh();
  }

  function handleNavClick() {
    onMobileClose?.();
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 grid h-[100dvh] max-h-[100dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-r border-[var(--border)] bg-white transition-all duration-300 ease-in-out",
        "lg:sticky lg:top-0 lg:z-auto lg:shrink-0 lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-[var(--border)]",
          collapsed ? "justify-center px-2" : "gap-2.5 px-4"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]">
          <Gavel className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <span className="truncate font-semibold text-slate-900">Admin</span>
        )}
      </div>

      <nav className="space-y-1 overflow-y-auto overscroll-y-contain p-2">
        {navItems
          .filter(
            (item) =>
              (!item.roles || item.roles.includes(profile.role as UserRole)) &&
              (!item.amsOnly || companyCode === "ams")
          )
          .map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/admin"
              ? pathname === "/admin"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={handleNavClick}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center rounded-xl text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-indigo-50 text-[var(--primary)]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          "border-t border-[var(--border)] bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
          collapsed && "flex flex-col items-center"
        )}
      >
        {!collapsed && (
          <>
            <p className="truncate px-2 text-sm font-medium text-slate-900">
              {profile.full_name}
            </p>
            <p className="mb-2 truncate px-2 text-xs capitalize text-slate-500">
              {profile.role}
            </p>
          </>
        )}
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? "Keluar" : undefined}
          className={cn(
            "flex w-full items-center rounded-xl text-sm text-slate-600 transition-colors hover:bg-slate-50",
            collapsed ? "justify-center px-2 py-2.5" : "gap-2 px-3 py-2.5"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Keluar"}
        </button>
      </div>
    </aside>
  );
}
