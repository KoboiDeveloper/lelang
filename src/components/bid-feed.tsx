"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, getClientToken } from "@/lib/api-client";
import { BidFeedEntry } from "@/lib/database.types";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { subscribeItemBidUpdates } from "@/lib/bid-events";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BidFeed({ itemId }: { itemId: string }) {
  const [bids, setBids] = useState<BidFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBids = useCallback(async () => {
    const res = await apiFetch<{ bids: BidFeedEntry[] }>(
      `/api/items/${itemId}/bids`,
      { method: "GET", token: getClientToken() }
    );
    if (res.ok && res.data?.bids) setBids(res.data.bids);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    void loadBids();

    const unsubscribe = subscribeItemBidUpdates(itemId, () => {
      void loadBids();
    });

    const interval = setInterval(() => {
      void loadBids();
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [itemId, loadBids]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Penawaran</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        ) : bids.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Belum ada penawaran.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {bids.map((bid, i) => (
              <div
                key={`${bid.bidder_alias}-${bid.bid_time}-${bid.amount}-${i}`}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{bid.bidder_alias}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(bid.bid_time)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{formatRupiah(bid.amount)}</p>
                  <Badge status={bid.bid_status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
