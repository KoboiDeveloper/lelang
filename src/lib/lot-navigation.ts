import "server-only";

import { apiFetchServer } from "@/lib/api-client";
import type { NextLotItem } from "@/lib/lot-href";
import type { AuctionItem } from "@/lib/database.types";

export type { NextLotItem };

type ItemsPageResponse = {
  items: { item: AuctionItem }[];
};

export async function fetchNextLotItem({
  periodId,
  currentLotNumber,
  category,
}: {
  periodId: string;
  currentLotNumber: string;
  category?: string | null;
}): Promise<NextLotItem | null> {
  const params = new URLSearchParams({
    period_id: periodId,
    offset: "0",
    limit: "500",
  });
  if (category && category !== "all" && category !== "Lainnya") {
    params.set("category", category);
  }

  const res = await apiFetchServer<ItemsPageResponse>(
    `/api/items?${params.toString()}`,
    { method: "GET", next: { revalidate: 30 } }
  );

  let items = (res.data?.items ?? []).map((row) => row.item);

  if (category === "Lainnya") {
    items = items.filter((i) => !i.category || i.category === "Lainnya");
  }

  const next = items
    .filter((i) => ["active", "ready", "sold"].includes(i.status))
    .filter((i) => i.lot_number > currentLotNumber)
    .sort((a, b) => a.lot_number.localeCompare(b.lot_number))[0];

  if (!next) return null;
  return {
    id: next.id,
    lot_number: next.lot_number,
    item_name: next.item_name,
  };
}
