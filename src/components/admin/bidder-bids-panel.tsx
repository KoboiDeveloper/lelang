"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, getClientToken } from "@/lib/api-client";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { toast } from "sonner";
import { Gavel, Trash2 } from "lucide-react";

type BidderBidRow = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  auction_items: {
    id: string;
    lot_number: string;
    item_name: string;
    starting_price: number;
    current_price: number;
    auction_periods: {
      code: string;
      title: string;
      status: string;
    } | null;
  } | null;
};

type BidsResponse = {
  bids: BidderBidRow[];
  total: number;
};

export function BidderBidsPanel({
  bidderId,
  companyId,
  onBidsChange,
}: {
  bidderId: string;
  companyId?: string;
  onBidsChange?: () => void;
}) {
  const [bids, setBids] = useState<BidderBidRow[]>([]);
  const [bidsTotal, setBidsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BidderBidRow | null>(null);

  useEffect(() => {
    setPage(1);
  }, [bidderId, companyId]);

  async function loadBids() {
    setLoading(true);

    const from = (page - 1) * DEFAULT_PAGE_SIZE;
    const params = new URLSearchParams({
      bidder_id: bidderId,
      offset: String(from),
      limit: String(DEFAULT_PAGE_SIZE),
    });
    if (companyId) params.set("company_id", companyId);

    const res = await apiFetch<BidsResponse>(`/api/admin/bids?${params}`, {
      method: "GET",
      token: getClientToken(),
    });

    setLoading(false);

    if (!res.ok) {
      toast.error(res.error ?? "Gagal memuat penawaran");
      setBids([]);
      setBidsTotal(0);
      return;
    }

    setBids(res.data?.bids ?? []);
    setBidsTotal(res.data?.total ?? 0);
  }

  useEffect(() => {
    loadBids();
  }, [bidderId, companyId, page]);

  async function confirmDeleteBid() {
    if (!deleteTarget) return;

    setDeleting(true);
    const res = await apiFetch(`/api/items/bids/${deleteTarget.id}`, {
      method: "DELETE",
      token: getClientToken(),
    });
    setDeleting(false);
    setDeleteTarget(null);

    if (!res.ok) {
      toast.error(res.error ?? "Gagal menghapus penawaran");
      return;
    }

    toast.success("Penawaran dihapus");
    if (bids.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      await loadBids();
    }
    onBidsChange?.();
  }

  return (
    <div className="flex flex-col lg:min-h-0 lg:flex-1">
      <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5 sm:py-4">
        <h2 className="font-semibold text-slate-900">Riwayat Penawaran</h2>
        <p className="text-sm text-slate-500">
          {companyId
            ? `${bidsTotal} penawaran pada barang perusahaan ini`
            : `${bidsTotal} penawaran tercatat`}
        </p>
      </div>

      <div className="p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Memuat penawaran...</p>
        ) : bidsTotal === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Gavel className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              {companyId
                ? "Belum ada penawaran bidder ini pada barang perusahaan ini."
                : "Belum ada penawaran dari bidder ini."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {bids.map((bid) => {
                const item = bid.auction_items;
                const period = item?.auction_periods;
                return (
                  <div
                    key={bid.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-white p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[var(--primary)]">
                          {item?.lot_number ?? "—"}
                        </span>
                        <Badge status={bid.status} />
                        {period && <Badge status={period.status} />}
                      </div>
                      {item ? (
                        <Link
                          href={`/lots/${item.id}`}
                          className="mt-1 block truncate font-medium text-slate-900 hover:text-[var(--primary)]"
                        >
                          {item.item_name}
                        </Link>
                      ) : (
                        <p className="mt-1 truncate font-medium text-slate-900">Barang tidak ditemukan</p>
                      )}
                      {period && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {period.code} — {period.title}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <div>
                          <span className="text-slate-400">Penawaran: </span>
                          <span className="font-semibold text-slate-900">
                            {formatRupiah(bid.amount)}
                          </span>
                        </div>
                        {item && (
                          <div>
                            <span className="text-slate-400">Harga terkini: </span>
                            <span className="font-medium text-emerald-700">
                              {formatRupiah(item.current_price)}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDateTime(bid.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label="Hapus penawaran"
                      onClick={() => setDeleteTarget(bid)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Pagination
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={bidsTotal}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Penawaran"
        message={
          deleteTarget
            ? `Yakin ingin menghapus penawaran ${formatRupiah(deleteTarget.amount)} untuk ${deleteTarget.auction_items?.lot_number ?? "barang ini"}? Harga terkini barang akan disesuaikan ulang.`
            : ""
        }
        confirmLabel="Hapus"
        loading={deleting}
        onConfirm={confirmDeleteBid}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}
