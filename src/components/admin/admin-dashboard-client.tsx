"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminCompanyId } from "@/components/admin/admin-company-context";
import {
  fetchCompanyAssetTotals,
  fetchDashboardPeriods,
  fetchDashboardStats,
  type CompanyAssetTotals,
  type DashboardPeriodSummary,
} from "@/lib/admin-dashboard";
import { AssetValueChart } from "@/components/admin/asset-value-chart";
import { PaymentStatusChart } from "@/components/admin/payment-status-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { Package, Gavel, Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardStats = {
  itemCount: number;
  bidCount: number;
  periodCount: number;
  bidderCount: number;
};

export function AdminDashboardClient({
  initialTotals,
  initialPeriods,
  initialStats,
}: {
  initialTotals: CompanyAssetTotals;
  initialPeriods: DashboardPeriodSummary[];
  initialStats: DashboardStats;
}) {
  const companyId = useAdminCompanyId();
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [totals, setTotals] = useState(initialTotals);
  const [periods, setPeriods] = useState(initialPeriods);
  const [stats, setStats] = useState(initialStats);
  const [loadingTotals, setLoadingTotals] = useState(false);

  const loadStats = useCallback(async () => {
    const next = await fetchDashboardStats(companyId);
    setStats(next);
  }, [companyId]);

  useEffect(() => {
    setPeriodFilter("all");
    void loadStats();
  }, [companyId, loadStats]);

  useEffect(() => {
    let cancelled = false;

    async function reload() {
      setLoadingTotals(true);
      const nextPeriodId = periodFilter === "all" ? null : periodFilter;
      const [nextTotals, nextPeriods] = await Promise.all([
        fetchCompanyAssetTotals(companyId, nextPeriodId),
        fetchDashboardPeriods(companyId),
      ]);
      if (cancelled) return;
      setTotals(nextTotals);
      setPeriods(nextPeriods);
      setLoadingTotals(false);
    }

    void reload();
    return () => {
      cancelled = true;
    };
  }, [companyId, periodFilter]);

  const upcomingPeriods = periods.filter(
    (period) => period.status === "active" || period.status === "draft"
  );
  const closedPeriods = periods.filter((period) => period.status === "finished");

  const statCards = [
    { label: "Total Barang", value: stats.itemCount, icon: Package },
    { label: "Total Bid", value: stats.bidCount, icon: Gavel },
    { label: "Periode", value: stats.periodCount, icon: Calendar },
    { label: "Bidder", value: stats.bidderCount, icon: Users },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">
            Ringkasan platform lelang perusahaan Anda
          </p>
        </div>
        <div className="w-full sm:w-64">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            Filter periode
          </label>
          <Select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
          >
            <option value="all">Semua periode</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.code} — {period.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
                <Icon className="h-6 w-6 text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={cn("grid gap-6", loadingTotals && "opacity-70")}>
        <AssetValueChart totals={totals} />
        <PaymentStatusChart totals={totals} />
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Periode</h2>
          <p className="text-sm text-slate-500">
            Periode aktif/draft di atas, periode selesai di bawah
          </p>
        </div>

        {upcomingPeriods.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Periode selanjutnya / aktif
            </p>
            <div className="space-y-3">
              {upcomingPeriods.map((period) => (
                <PeriodSummaryCard key={period.id} period={period} highlight />
              ))}
            </div>
          </div>
        )}

        {closedPeriods.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Periode selesai
            </p>
            <div className="space-y-3">
              {closedPeriods.map((period) => (
                <PeriodSummaryCard key={period.id} period={period} />
              ))}
            </div>
          </div>
        )}

        {upcomingPeriods.length === 0 && closedPeriods.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-500">
              Belum ada periode lelang.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PeriodSummaryCard({
  period,
  highlight,
}: {
  period: DashboardPeriodSummary;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        highlight && "border-indigo-200 bg-indigo-50/40 ring-1 ring-indigo-100"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{period.title}</CardTitle>
          <Badge status={period.status} />
          <span className="text-xs font-medium text-slate-500">{period.code}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-600">
        {period.description && <p>{period.description}</p>}
        <p>
          {formatDateTime(period.start_at)} — {formatDateTime(period.end_at)}
        </p>
        <p className="text-xs text-slate-500">
          {period.itemCount} barang
          {period.unbidCount > 0 ? ` · ${period.unbidCount} belum di-bid` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
