"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch, getClientToken } from "@/lib/api-client";
import {
  clearSession,
  fetchMe,
  getStoredUser,
  onAuthChange,
  type SessionUser,
} from "@/lib/session";
import { AuctionItem, AuctionPeriod } from "@/lib/database.types";
import { formatRupiah, formatNumberId, parseRupiahInput } from "@/lib/format";
import { isPeriodBiddingOpen, MAX_BIDS_PER_ITEM } from "@/lib/auction";
import { notifyItemBidUpdate } from "@/lib/bid-events";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Gavel, Minus, Plus, Lock, LogIn } from "lucide-react";

type BidderInfo = {
  id: string;
  employeeNik: string;
  fullName: string;
};

export function BidForm({
  item,
  period,
  onSuccess,
}: {
  item: AuctionItem;
  period?: AuctionPeriod | null;
  onSuccess?: () => void;
}) {
  const pathname = usePathname();
  const loginHref = `/login?redirect=${encodeURIComponent(pathname)}`;
  const daftarHref = `/daftar?redirect=${encodeURIComponent(pathname)}`;

  const [currentPrice, setCurrentPrice] = useState(item.current_price);
  const minimum = currentPrice + item.bid_increment;
  const [amount, setAmount] = useState(item.current_price + item.bid_increment);
  const [amountDisplay, setAmountDisplay] = useState(
    formatNumberId(item.current_price + item.bid_increment)
  );
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [bidder, setBidder] = useState<BidderInfo | null>(null);
  const [bidCount, setBidCount] = useState<number | null>(null);

  const remainingBids =
    bidCount === null ? null : Math.max(0, MAX_BIDS_PER_ITEM - bidCount);
  const atMaxBids = remainingBids === 0;

  useEffect(() => {
    async function loadBidder() {
      const token = getClientToken();
      if (!token) {
        setBidder(null);
        setBidCount(null);
        setAuthLoading(false);
        return;
      }

      const user: SessionUser | null =
        getStoredUser() ?? (await fetchMe(token));

      if (!user || user.role !== "bidder") {
        setBidder(null);
        setBidCount(null);
        setAuthLoading(false);
        return;
      }

      setBidder({
        id: user.id,
        employeeNik: "",
        fullName: user.fullName,
      });

      // Load user's bids for this item via bidder/bids
      const bidsRes = await apiFetch<{
        bids: { itemId?: string; item_id?: string; item?: { id: string } }[];
      }>("/api/bidder/bids", { method: "GET", token });

      if (bidsRes.ok && Array.isArray(bidsRes.data?.bids)) {
        const count = bidsRes.data.bids.filter((b) => {
          const id = b.item_id ?? b.itemId ?? b.item?.id;
          return id === item.id;
        }).length;
        setBidCount(count);
      } else {
        setBidCount(0);
      }

      setAuthLoading(false);
    }

    void loadBidder();
    return onAuthChange(() => {
      void loadBidder();
    });
  }, [item.id]);

  useEffect(() => {
    setCurrentPrice(item.current_price);
  }, [item.current_price]);

  useEffect(() => {
    const nextMinimum = currentPrice + item.bid_increment;
    setAmount((prev) => (prev < nextMinimum ? nextMinimum : prev));
    setAmountDisplay((prev) => {
      const parsed = parseRupiahInput(prev);
      return formatNumberId(parsed < nextMinimum ? nextMinimum : parsed);
    });
  }, [currentPrice, item.bid_increment]);

  function updateAmount(value: number) {
    const clamped = Math.max(value, minimum);
    const aligned =
      minimum + Math.ceil((clamped - minimum) / item.bid_increment) * item.bid_increment;
    setAmount(aligned);
    setAmountDisplay(formatNumberId(aligned));
  }

  function handleAmountChange(raw: string) {
    setAmountDisplay(raw);
    const parsed = parseRupiahInput(raw);
    if (parsed > 0) setAmount(parsed);
  }

  function handleAmountBlur() {
    updateAmount(amount);
  }

  const biddingOpen = isPeriodBiddingOpen(period);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const token = getClientToken();
    if (!bidder || !token) {
      toast.error("Silakan login terlebih dahulu");
      return;
    }

    if (atMaxBids) {
      toast.error(`Anda telah mencapai batas maksimal ${MAX_BIDS_PER_ITEM} penawaran untuk barang ini`);
      return;
    }

    if (!biddingOpen) {
      toast.error("Periode lelang telah selesai. Penawaran ditutup.");
      return;
    }

    if (amount < minimum) {
      toast.error(`Minimum penawaran ${formatRupiah(minimum)}`);
      return;
    }

    if ((amount - minimum) % item.bid_increment !== 0) {
      toast.error(`Nominal harus kelipatan ${formatRupiah(item.bid_increment)}`);
      return;
    }

    setLoading(true);
    const res = await apiFetch<{ message?: string }>(
      `/api/items/${item.id}/bids`,
      {
        method: "POST",
        token,
        body: { amount },
      }
    );
    setLoading(false);

    if (!res.ok) {
      if (res.status === 401) {
        clearSession();
        toast.error("Sesi berakhir. Silakan login ulang.");
        return;
      }
      toast.error(res.error ?? "Gagal mengirim penawaran");
      return;
    }

    toast.success(res.data?.message ?? "Penawaran berhasil!");
    setBidCount((count) => (count ?? 0) + 1);
    setCurrentPrice(amount);
    updateAmount(amount + item.bid_increment);
    notifyItemBidUpdate(item.id);
    onSuccess?.();
  }

  if (!biddingOpen) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Lock className="h-5 w-5 text-slate-500" />
          </div>
          <p className="font-medium text-slate-900">Penawaran Ditutup</p>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Periode lelang telah selesai. Tidak dapat mengajukan penawaran untuk barang ini.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (item.status !== "active") {
    return (
      <Card>
        <CardContent className="py-10 text-center text-slate-500">
          Lelang untuk barang ini tidak sedang aktif.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gavel className="h-5 w-5 text-[var(--primary)]" />
          <CardTitle>Ajukan Penawaran</CardTitle>
        </div>
        <p className="text-sm text-slate-500">
          Minimum {formatRupiah(minimum)} &middot; Kelipatan{" "}
          {formatRupiah(item.bid_increment)}
        </p>
      </CardHeader>
      <CardContent>
        {authLoading ? (
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        ) : !bidder ? (
          <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-5 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
              <LogIn className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <p className="text-sm text-slate-600">
              Silahkan{" "}
              <Link href={loginHref} className="font-semibold text-[var(--primary)] hover:underline">
                Login
              </Link>{" "}
              /{" "}
              <Link href={daftarHref} className="font-semibold text-[var(--primary)] hover:underline">
                Daftar
              </Link>{" "}
              jika belum memiliki akun
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">NIK Karyawan</p>
                  <p className="font-mono text-sm font-semibold text-slate-900">
                    {bidder.employeeNik || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Nama Karyawan</p>
                  <p className="text-sm font-semibold text-slate-900">{bidder.fullName}</p>
                </div>
              </div>
            </div>

            <div
              className={`rounded-xl border px-4 py-4 text-center ${
                atMaxBids
                  ? "border-red-200 bg-red-50"
                  : "border-indigo-200 bg-indigo-50/70"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Maks. {MAX_BIDS_PER_ITEM} penawaran per barang
              </p>
              {remainingBids === null ? (
                <p className="mt-1 text-sm text-slate-500">Memuat sisa kesempatan...</p>
              ) : atMaxBids ? (
                <>
                  <p className="mt-1 text-2xl font-bold text-red-700 sm:text-3xl">0</p>
                  <p className="mt-1 text-sm font-medium text-red-700">
                    Anda telah mencapai batas maksimal penawaran untuk barang ini
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-slate-600">Sisa kesempatan bid</p>
                  <p className="text-3xl font-bold text-[var(--primary)] sm:text-4xl">
                    {remainingBids}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    dari {MAX_BIDS_PER_ITEM} penawaran
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Nominal Penawaran</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateAmount(amount - item.bid_increment)}
                  disabled={atMaxBids || amount - item.bid_increment < minimum}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-slate-600 disabled:opacity-40"
                  aria-label="Kurangi"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                    Rp
                  </span>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    value={amountDisplay}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    onBlur={handleAmountBlur}
                    className="pl-10 text-right font-semibold tabular-nums"
                    placeholder="0"
                    required
                    disabled={atMaxBids}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => updateAmount(amount + item.bid_increment)}
                  disabled={atMaxBids}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-slate-600"
                  aria-label="Tambah"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="text-right text-xs text-slate-500">= {formatRupiah(amount)}</p>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading || atMaxBids || remainingBids === null}
            >
              {loading
                ? "Memproses..."
                : atMaxBids
                  ? "Batas Penawaran Tercapai"
                  : "Kirim Penawaran"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
