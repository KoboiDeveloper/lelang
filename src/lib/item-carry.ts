import { apiFetch, getClientToken } from "@/lib/api-client";
import type { AuctionItem, AuctionPeriod, ItemPhoto } from "@/lib/database.types";
import { getPhotoUrl } from "@/lib/format";

export type CarryUnbidResult = {
  sourcePeriodId: string;
  sourcePeriodCode: string;
  carried: number;
  failed: number;
};

type PeriodsResponse = { periods: AuctionPeriod[] };
type ItemsPageResponse = {
  items: { item: AuctionItem; photos: ItemPhoto[]; bidCount: number }[];
};

function token() {
  return getClientToken();
}

/** Cari periode sumber: finished terbaru di perusahaan yang sama. */
export async function findCarrySourcePeriod(
  companyId: string
): Promise<{ id: string; code: string } | null> {
  const res = await apiFetch<PeriodsResponse>(
    `/api/catalog/periods?company_id=${encodeURIComponent(companyId)}&status=finished`,
    { method: "GET", token: token() }
  );
  const list = [...(res.data?.periods ?? [])].sort(
    (a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime()
  );
  const source = list[0];
  return source ? { id: source.id, code: source.code } : null;
}

export async function fetchUnbidItemsForPeriod(
  periodId: string
): Promise<AuctionItem[]> {
  const res = await apiFetch<ItemsPageResponse>(
    `/api/items?period_id=${encodeURIComponent(periodId)}&offset=0&limit=1000`,
    { method: "GET", token: token() }
  );
  return (res.data?.items ?? [])
    .filter((row) => (row.bidCount ?? 0) === 0)
    .filter((row) =>
      ["active", "ready", "draft", "unsold"].includes(row.item.status)
    )
    .map((row) => row.item);
}

async function copyItemPhotos(sourceItemId: string, targetItemId: string) {
  const detail = await apiFetch<{ photos: ItemPhoto[] }>(
    `/api/items/${sourceItemId}`,
    { method: "GET", token: token() }
  );
  const sourcePhotos = detail.data?.photos ?? [];
  const t = token();
  if (!t) return;

  for (const photo of sourcePhotos) {
    try {
      const response = await fetch(getPhotoUrl(photo.storage_path));
      if (!response.ok) continue;
      const blob = await response.blob();
      const formData = new FormData();
      formData.append(
        "file",
        new File([blob], `photo-${photo.sort_order}.jpg`, {
          type: blob.type || "image/jpeg",
        })
      );
      formData.append("item_id", targetItemId);
      formData.append("sort_order", String(photo.sort_order));
      await apiFetch("/api/files/upload", {
        method: "POST",
        token: t,
        formData,
      });
    } catch {
      // Skip individual photo failures.
    }
  }
}

/** Duplikasi barang belum di-bid dari periode finished ke periode baru. */
export async function carryUnbidItemsToPeriod({
  companyId,
  targetPeriodId,
  sourcePeriodId,
}: {
  companyId: string;
  targetPeriodId: string;
  sourcePeriodId?: string | null;
}): Promise<CarryUnbidResult | null> {
  let source: { id: string; code: string } | null = null;

  if (sourcePeriodId != null) {
    const res = await apiFetch<PeriodsResponse>(
      `/api/catalog/periods?company_id=${encodeURIComponent(companyId)}`,
      { method: "GET", token: token() }
    );
    const found = (res.data?.periods ?? []).find((p) => p.id === sourcePeriodId);
    source = found ? { id: found.id, code: found.code } : null;
  } else {
    source = await findCarrySourcePeriod(companyId);
  }

  if (!source) return null;

  const unbidItems = await fetchUnbidItemsForPeriod(source.id);
  if (unbidItems.length === 0) {
    return {
      sourcePeriodId: source.id,
      sourcePeriodCode: source.code,
      carried: 0,
      failed: 0,
    };
  }

  let carried = 0;
  let failed = 0;
  const t = token();

  for (const item of unbidItems) {
    const res = await apiFetch<{ item: AuctionItem }>("/api/items", {
      method: "POST",
      token: t,
      body: {
        period_id: targetPeriodId,
        item_name: item.item_name,
        category: item.category,
        description: item.description,
        item_condition: item.item_condition,
        status: "draft",
        starting_price: item.starting_price,
        bid_increment: item.bid_increment,
      },
    });

    if (!res.ok || !res.data?.item) {
      failed += 1;
      continue;
    }

    await copyItemPhotos(item.id, res.data.item.id);
    carried += 1;
  }

  return {
    sourcePeriodId: source.id,
    sourcePeriodCode: source.code,
    carried,
    failed,
  };
}
