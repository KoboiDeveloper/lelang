"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getClientToken } from "@/lib/api-client";
import { getToken } from "@/lib/session";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Gavel, Package, ArrowRight, Wallet, Trophy } from "lucide-react";

type MyBid = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  item_id: string;
};

type ItemInfo = {
  id: string;
  lot_number: string;
  item_name: string;
  starting_price: number;
  current_price: number;
  period_id: string;
  period_code: string;
  period_status: string;
};

type Outcome = "leading" | "outbid" | "won" | "lost";

type StatusFilter = "all" | "leading" | "outbid" | "won";

type GroupedItemBids = {
  itemId: string;
  highestBid: MyBid;
  bidCount: number;
  lastBidAt: string;
  allBids: MyBid[];
  outcome: Outcome;
};

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "won", label: "Menang" },
  { value: "leading", label: "Terdepan" },
  { value: "outbid", label: "Terkalahkan" },
];

function isPeriodFinished(status: string) {
  return status === "finished" || status === "cancelled";
}

function resolveOutcome(
  itemBids: MyBid[],
  item: ItemInfo | undefined
): Outcome {
  if (itemBids.some((bid) => bid.status === "winner")) return "won";

  const highestValid = [...itemBids]
    .filter((bid) => bid.status !== "cancelled")
    .sort((a, b) => b.amount - a.amount)[0];

  if (!item || !highestValid) return "outbid";

  const isLeading =
    highestValid.amount >= item.current_price &&
    (highestValid.status === "valid" || highestValid.status === "winner");

  if (isPeriodFinished(item.period_status)) {
    return isLeading ? "won" : "lost";
  }

  return isLeading ? "leading" : "outbid";
}

function outcomeBadgeStatus(outcome: Outcome): string {
  switch (outcome) {
    case "won":
      return "winner";
    case "leading":
      return "valid";
    case "lost":
      return "cancelled";
    default:
      return "outbid";
  }
}

function outcomeLabel(outcome: Outcome): string {
  switch (outcome) {
    case "won":
      return "Menang";
    case "leading":
      return "Terdepan";
    case "lost":
      return "Kalah";
    default:
      return "Terkalahkan";
  }
}

function groupBidsByItem(
  bids: MyBid[],
  items: Record<string, ItemInfo>
): GroupedItemBids[] {
  const map = new Map<string, MyBid[]>();

  for (const bid of bids) {
    const list = map.get(bid.item_id) ?? [];
    list.push(bid);
    map.set(bid.item_id, list);
  }

  return Array.from(map.entries())
    .map(([itemId, itemBids]) => {
      const allBids = [...itemBids].sort((a, b) => b.amount - a.amount);
      const highestBid = allBids[0];
      const lastBidAt = [...itemBids].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0].created_at;

      return {
        itemId,
        highestBid,
        bidCount: itemBids.length,
        lastBidAt,
        allBids,
        outcome: resolveOutcome(itemBids, items[itemId]),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastBidAt).getTime() - new Date(a.lastBidAt).getTime()
    );
}

export default function BidSayaPage() {
  const [bids, setBids] = useState<MyBid[]>([]);
  const [items, setItems] = useState<Record<string, ItemInfo>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const router = useRouter();

  const periodOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of Object.values(items)) {
      if (!map.has(item.period_id)) {
        map.set(item.period_id, item.period_code);
      }
    }
    return Array.from(map.entries())
      .map(([id, code]) => ({ id, code }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [items]);

  const groupedBids = useMemo(
    () => groupBidsByItem(bids, items),
    [bids, items]
  );

  const periodScopedBids = useMemo(() => {
    if (periodFilter === "all") return groupedBids;
    return groupedBids.filter(
      (row) => items[row.itemId]?.period_id === periodFilter
    );
  }, [groupedBids, items, periodFilter]);

  const filteredBids = useMemo(() => {
    if (statusFilter === "all") return periodScopedBids;
    return periodScopedBids.filter((row) => row.outcome === statusFilter);
  }, [periodScopedBids, statusFilter]);

  const wonRows = useMemo(
    () => periodScopedBids.filter((row) => row.outcome === "won"),
    [periodScopedBids]
  );

  const leadingRows = useMemo(
    () => periodScopedBids.filter((row) => row.outcome === "leading"),
    [periodScopedBids]
  );

  const estimateRows = useMemo(() => {
    if (statusFilter === "leading") return leadingRows;
    if (statusFilter === "won") return wonRows;
    // Default (Semua / lainnya): total potensi = menang + terdepan
    if (statusFilter === "all") return [...wonRows, ...leadingRows];
    return [];
  }, [statusFilter, leadingRows, wonRows]);

  const paymentEstimate = useMemo(() => {
    return estimateRows.reduce((sum, row) => {
      const item = items[row.itemId];
      const amount = item?.current_price ?? row.highestBid.amount;
      return sum + amount;
    }, 0);
  }, [estimateRows, items]);

  const estimateTitle =
    statusFilter === "leading"
      ? "Estimasi jika menang"
      : statusFilter === "won"
        ? "Estimasi pembayaran"
        : "Estimasi total";

  const estimateHint =
    statusFilter === "leading"
      ? `Total harga terkini dari ${leadingRows.length} barang terdepan`
      : statusFilter === "won"
        ? `Total harga menang dari ${wonRows.length} barang`
        : `Menang + terdepan (${estimateRows.length} barang)`;

  const summaryCount =
    statusFilter === "leading"
      ? leadingRows.length
      : statusFilter === "won"
        ? wonRows.length
        : wonRows.length;

  const summaryCountLabel =
    statusFilter === "leading" ? "Barang terdepan" : "Barang dimenangkan";

  const filterCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: periodScopedBids.length,
      won: 0,
      leading: 0,
      outbid: 0,
    };
    for (const row of periodScopedBids) {
      if (row.outcome === "lost") continue;
      counts[row.outcome] += 1;
    }
    return counts;
  }, [periodScopedBids]);

  useEffect(() => {
    async function load() {
      const token = getToken() ?? getClientToken();
      if (!token) {
        router.replace("/login?redirect=/bid-saya");
        return;
      }

      const res = await apiFetch<{ bids: unknown[] }>("/api/bidder/bids", {
        method: "GET",
        token,
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login?redirect=/bid-saya");
          return;
        }
        setBids([]);
        setLoading(false);
        return;
      }

      const rawBids = res.data?.bids ?? [];
      if (rawBids.length === 0) {
        setBids([]);
        setLoading(false);
        return;
      }

      const allBids: MyBid[] = [];
      const map: Record<string, ItemInfo> = {};
      const visibleItemIds = new Set<string>();

      for (const entry of rawBids) {
        const b = entry as Record<string, unknown>;
        const item = b.item as Record<string, unknown> | undefined;
        const period = item?.period as Record<string, unknown> | undefined;

        const itemId = String(b.itemId ?? b.item_id ?? item?.id ?? "");
        const periodStatus = String(period?.status ?? "");
        if (
          periodStatus === "cancelled" ||
          periodStatus === "archived" ||
          periodStatus === "draft"
        ) {
          continue;
        }

        allBids.push({
          id: String(b.id),
          amount: Number(b.amount),
          status: String(b.status),
          created_at: String(b.createdAt ?? b.created_at ?? ""),
          item_id: itemId,
        });

        if (item && itemId) {
          visibleItemIds.add(itemId);
          map[itemId] = {
            id: itemId,
            lot_number: String(item.lotNumber ?? item.lot_number ?? ""),
            item_name: String(item.itemName ?? item.item_name ?? ""),
            starting_price: Number(item.startingPrice ?? item.starting_price ?? 0),
            current_price: Number(item.currentPrice ?? item.current_price ?? 0),
            period_id: String(
              item.periodId ?? item.period_id ?? period?.id ?? ""
            ),
            period_code: String(period?.code ?? "—"),
            period_status: periodStatus,
          };
        }
      }

      setBids(allBids.filter((bid) => visibleItemIds.has(bid.item_id)));
      setItems(map);
      setLoading(false);
    }

    void load();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="border-b border-[var(--border)] bg-white">
          <div className="container-app py-8 sm:py-10">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
                <Gavel className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  Bid Saya
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Ringkasan penawaran Anda per barang lelang
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container-app py-8">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : groupedBids.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 py-16 text-center">
              <Package className="h-12 w-12 text-slate-300" />
              <p className="mt-4 font-medium text-slate-700">
                Belum ada penawaran
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Mulai bid pada barang lelang yang aktif
              </p>
              <Link
                href="/lots"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white"
              >
                Lihat Semua Lot
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {periodOptions.length > 1 && (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    type="button"
                    onClick={() => setPeriodFilter("all")}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      periodFilter === "all"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white text-slate-600 ring-1 ring-[var(--border)] hover:bg-slate-50"
                    )}
                  >
                    Semua periode
                  </button>
                  {periodOptions.map((period) => (
                    <button
                      key={period.id}
                      type="button"
                      onClick={() => setPeriodFilter(period.id)}
                      className={cn(
                        "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        periodFilter === period.id
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-white text-slate-600 ring-1 ring-[var(--border)] hover:bg-slate-50"
                      )}
                    >
                      {period.code}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatusFilter(option.value)}
                      className={cn(
                        "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        statusFilter === option.value
                          ? "bg-[var(--primary)] text-white shadow-sm"
                          : "bg-white text-slate-600 ring-1 ring-[var(--border)] hover:bg-slate-50"
                      )}
                    >
                      {option.label} ({filterCounts[option.value]})
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Trophy className="h-4 w-4" />
                    <p className="text-sm font-medium">{summaryCountLabel}</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-amber-950">
                    {summaryCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4">
                  <div className="flex items-center gap-2 text-indigo-800">
                    <Wallet className="h-4 w-4" />
                    <p className="text-sm font-medium">{estimateTitle}</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-indigo-950">
                    {formatRupiah(paymentEstimate)}
                  </p>
                  <p className="mt-1 text-xs text-indigo-700/80">{estimateHint}</p>
                </div>
              </div>

              {filteredBids.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 py-14 text-center">
                  <Package className="h-10 w-10 text-slate-300" />
                  <p className="mt-3 font-medium text-slate-700">
                    Tidak ada barang pada filter ini
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className="mt-4 text-sm font-medium text-[var(--primary)] hover:underline"
                  >
                    Lihat semua bid
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
                  <div className="hidden grid-cols-[1fr_110px_110px_110px_100px] gap-4 border-b border-[var(--border)] bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
                    <span>Barang</span>
                    <span className="text-right">Harga Awal</span>
                    <span className="text-right">Bid Tertinggi</span>
                    <span className="text-right">Harga Terkini</span>
                    <span>Status</span>
                  </div>
                  <ul className="divide-y divide-[var(--border)]">
                    {filteredBids.map(
                      ({
                        itemId,
                        highestBid,
                        bidCount,
                        lastBidAt,
                        allBids,
                        outcome,
                      }) => {
                        const item = items[itemId];

                        return (
                          <li key={itemId}>
                            <Link
                              href={`/lots/${itemId}`}
                              className="block transition-colors hover:bg-slate-50/80"
                            >
                              <div className="hidden items-center gap-4 px-5 py-4 lg:grid lg:grid-cols-[1fr_110px_110px_110px_100px]">
                                <div className="min-w-0">
                                  {item ? (
                                    <>
                                      <span className="font-mono text-xs font-semibold text-[var(--primary)]">
                                        {item.lot_number}
                                      </span>
                                      <p className="truncate font-medium text-slate-900">
                                        {item.item_name}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {item.period_code} &bull; {bidCount}{" "}
                                        penawaran &bull; terakhir{" "}
                                        {formatDateTime(lastBidAt)}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-sm text-slate-500">
                                      Barang tidak tersedia
                                    </p>
                                  )}
                                </div>
                                <p className="text-right text-sm text-slate-600">
                                  {item
                                    ? formatRupiah(item.starting_price)
                                    : "—"}
                                </p>
                                <p className="text-right font-semibold text-slate-900">
                                  {formatRupiah(highestBid.amount)}
                                </p>
                                <p className="text-right text-sm text-slate-600">
                                  {item
                                    ? formatRupiah(item.current_price)
                                    : "—"}
                                </p>
                                <div className="flex flex-col items-start gap-1">
                                  <Badge status={outcomeBadgeStatus(outcome)} />
                                  <span className="text-[11px] font-medium text-slate-500">
                                    {outcomeLabel(outcome)}
                                  </span>
                                </div>
                              </div>

                              <div className="p-4 lg:hidden">
                                {item ? (
                                  <>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <span className="font-mono text-xs font-semibold text-[var(--primary)]">
                                          {item.lot_number}
                                        </span>
                                        <p className="font-medium text-slate-900">
                                          {item.item_name}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                          {item.period_code} &bull; {bidCount}{" "}
                                          penawaran &bull; terakhir{" "}
                                          {formatDateTime(lastBidAt)}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <Badge
                                          status={outcomeBadgeStatus(outcome)}
                                        />
                                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                                          {outcomeLabel(outcome)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                                      <div>
                                        <p className="text-xs text-slate-500">
                                          Harga Awal
                                        </p>
                                        <p className="font-medium text-slate-700">
                                          {formatRupiah(item.starting_price)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500">
                                          Bid Tertinggi
                                        </p>
                                        <p className="font-semibold text-slate-900">
                                          {formatRupiah(highestBid.amount)}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs text-slate-500">
                                          Harga Terkini
                                        </p>
                                        <p className="font-medium text-slate-700">
                                          {formatRupiah(item.current_price)}
                                        </p>
                                      </div>
                                    </div>
                                    {outcome === "won" && (
                                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                        Estimasi bayar:{" "}
                                        {formatRupiah(item.current_price)}
                                      </p>
                                    )}
                                    {bidCount > 1 && (
                                      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
                                        <p className="text-xs font-medium text-slate-500">
                                          Riwayat bid
                                        </p>
                                        <ul className="mt-1 space-y-0.5">
                                          {allBids.map((bid) => (
                                            <li
                                              key={bid.id}
                                              className="flex justify-between text-xs text-slate-600"
                                            >
                                              <span>
                                                {formatDateTime(bid.created_at)}
                                              </span>
                                              <span>
                                                {formatRupiah(bid.amount)}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-sm text-slate-500">
                                    Barang tidak tersedia
                                  </p>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      }
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
