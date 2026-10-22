"use client";

import { useEffect, useState } from "react";
import { apiFetch, getClientToken } from "@/lib/api-client";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useAdminCompanyId } from "@/components/admin/admin-company-context";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";

type BidReport = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  auction_items: { lot_number: string; item_name: string } | null;
  bidder_profiles: { public_alias: string; full_name: string } | null;
};

type BidsResponse = {
  bids: BidReport[];
  total: number;
};

export default function ReportsPage() {
  const [bids, setBids] = useState<BidReport[]>([]);
  const [bidsTotal, setBidsTotal] = useState(0);
  const [bidsPage, setBidsPage] = useState(1);
  const [bidsLoading, setBidsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const companyId = useAdminCompanyId();

  useEffect(() => {
    setBidsPage(1);
  }, [companyId]);

  useEffect(() => {
    async function loadBids() {
      setBidsLoading(true);
      const from = (bidsPage - 1) * DEFAULT_PAGE_SIZE;
      const params = new URLSearchParams({
        company_id: companyId,
        offset: String(from),
        limit: String(DEFAULT_PAGE_SIZE),
      });

      const res = await apiFetch<BidsResponse>(`/api/admin/bids?${params}`, {
        method: "GET",
        token: getClientToken(),
      });

      setBidsLoading(false);

      if (!res.ok) {
        setBids([]);
        setBidsTotal(0);
        return;
      }

      setBids(res.data?.bids ?? []);
      setBidsTotal(res.data?.total ?? 0);
    }

    loadBids();
  }, [companyId, bidsPage]);

  async function exportCsv() {
    setExporting(true);
    const res = await apiFetch<BidsResponse>(
      `/api/admin/bids?company_id=${encodeURIComponent(companyId)}&offset=0&limit=500`,
      { method: "GET", token: getClientToken() }
    );
    setExporting(false);

    const allBids = res.data?.bids ?? [];
    const header = "Lot,Barang,Bidder,Alias,Nominal,Status,Waktu\n";
    const rows = allBids
      .map((b) => {
        const lot = b.auction_items?.lot_number ?? "";
        const item = b.auction_items?.item_name ?? "";
        const bidder = b.bidder_profiles?.full_name ?? "";
        const alias = b.bidder_profiles?.public_alias ?? "";
        return `"${lot}","${item}","${bidder}","${alias}",${b.amount},"${b.status}","${b.created_at}"`;
      })
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-lelang-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Laporan</h1>
          <p className="text-sm text-slate-500">Riwayat penawaran</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="w-full sm:w-auto"
          onClick={exportCsv}
          disabled={exporting || bidsTotal === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Mengekspor..." : "Export CSV"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Penawaran ({bidsTotal})</CardTitle>
        </CardHeader>
        <CardContent>
          {bidsLoading ? (
            <p className="text-sm text-slate-500">Memuat penawaran...</p>
          ) : bidsTotal === 0 ? (
            <p className="text-sm text-slate-500">Belum ada penawaran.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-slate-500">
                      <th className="pb-3 pr-4">Lot</th>
                      <th className="pb-3 pr-4">Barang</th>
                      <th className="pb-3 pr-4">Bidder</th>
                      <th className="pb-3 pr-4">Nominal</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bids.map((bid) => (
                      <tr
                        key={bid.id}
                        className="border-b border-[var(--border)] text-slate-700"
                      >
                        <td className="py-3 pr-4 font-mono text-[var(--primary)]">
                          {bid.auction_items?.lot_number}
                        </td>
                        <td className="py-3 pr-4">{bid.auction_items?.item_name}</td>
                        <td className="py-3 pr-4">
                          {bid.bidder_profiles?.public_alias}
                        </td>
                        <td className="py-3 pr-4 font-semibold text-slate-900">
                          {formatRupiah(bid.amount)}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge status={bid.status} />
                        </td>
                        <td className="py-3">{formatDateTime(bid.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={bidsPage}
                pageSize={DEFAULT_PAGE_SIZE}
                total={bidsTotal}
                onPageChange={setBidsPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
