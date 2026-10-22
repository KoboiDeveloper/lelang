"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, getClientToken } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { subscribeItemBidUpdates } from "@/lib/bid-events";
import { cn } from "@/lib/utils";

export function LivePrice({
  itemId,
  initialPrice,
}: {
  itemId: string;
  initialPrice: number;
}) {
  const [price, setPrice] = useState(initialPrice);
  const [pulse, setPulse] = useState(false);

  const loadPrice = useCallback(async () => {
    const res = await apiFetch<{ current_price: number }>(
      `/api/items/${itemId}/price`,
      { method: "GET", token: getClientToken() }
    );
    if (!res.ok || res.data?.current_price == null) return;

    setPrice((prev) => {
      if (prev !== res.data.current_price) {
        setPulse(true);
        setTimeout(() => setPulse(false), 800);
      }
      return res.data.current_price;
    });
  }, [itemId]);

  useEffect(() => {
    setPrice(initialPrice);
  }, [initialPrice]);

  useEffect(() => {
    void loadPrice();
    const unsubscribe = subscribeItemBidUpdates(itemId, loadPrice);
    const interval = setInterval(() => {
      void loadPrice();
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [itemId, loadPrice]);

  return (
    <p
      className={cn(
        "text-3xl font-bold text-slate-900 transition-all",
        pulse && "scale-[1.02] text-[var(--primary)]"
      )}
    >
      {formatRupiah(price)}
    </p>
  );
}
