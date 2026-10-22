import { apiFetchServer } from "@/lib/api-client";
import { AuctionItem, ItemPhoto } from "@/lib/database.types";

export const PAGE_SIZE = 12;

export type ItemWithPhotos = {
  item: AuctionItem;
  photos: ItemPhoto[];
  bidCount: number;
};

type ItemsPageResponse = {
  items: ItemWithPhotos[];
  hasMore: boolean;
  total: number;
};

export async function fetchItemsPage({
  periodId,
  category,
  offset,
  limit = PAGE_SIZE,
}: {
  periodId?: string;
  category?: string | null;
  offset: number;
  limit?: number;
}): Promise<{
  items: ItemWithPhotos[];
  hasMore: boolean;
  total: number;
}> {
  if (!periodId) {
    return { items: [], hasMore: false, total: 0 };
  }

  const params = new URLSearchParams({
    period_id: periodId,
    offset: String(offset),
    limit: String(limit),
  });
  if (category && category !== "all") {
    params.set("category", category);
  }

  const res = await apiFetchServer<ItemsPageResponse>(
    `/api/items?${params.toString()}`,
    { method: "GET", next: { revalidate: 15 } }
  );

  if (!res.ok) {
    return { items: [], hasMore: false, total: 0 };
  }

  return {
    items: res.data?.items ?? [],
    hasMore: Boolean(res.data?.hasMore),
    total: res.data?.total ?? 0,
  };
}

export async function fetchCategories(
  periodId?: string
): Promise<{ name: string; count: number }[]> {
  if (!periodId) return [];

  // Aggregate categories from a large page of items for this period
  const res = await apiFetchServer<ItemsPageResponse>(
    `/api/items?period_id=${encodeURIComponent(periodId)}&offset=0&limit=500`,
    { method: "GET", next: { revalidate: 30 } }
  );

  const counts = new Map<string, number>();
  for (const row of res.data?.items ?? []) {
    const cat = row.item.category || "Lainnya";
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
