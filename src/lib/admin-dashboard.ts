import { apiFetch, getClientToken } from "@/lib/api-client";
import type { AuctionItem, AuctionPeriod, ItemPhoto } from "@/lib/database.types";

export type CompanyAssetTotals = {
  itemCount: number;
  startingTotal: number;
  /** Sum of highest bid per item (items without bids = 0). */
  biddingTotal: number;
  /** Sum of starting_price for items that already have bids. */
  biddingBaseTotal: number;
  itemsWithBids: number;
  paidTotal: number;
  unpaidBiddingTotal: number;
  paidItemCount: number;
  unpaidItemCount: number;
};

export type DashboardPeriodSummary = AuctionPeriod & {
  itemCount: number;
  unbidCount: number;
};

export function emptyCompanyAssetTotals(): CompanyAssetTotals {
  return {
    itemCount: 0,
    startingTotal: 0,
    biddingTotal: 0,
    biddingBaseTotal: 0,
    itemsWithBids: 0,
    paidTotal: 0,
    unpaidBiddingTotal: 0,
    paidItemCount: 0,
    unpaidItemCount: 0,
  };
}

type PeriodsResponse = { periods: AuctionPeriod[] };
type ItemsPageResponse = {
  items: {
    item: AuctionItem;
    photos: ItemPhoto[];
    bidCount: number;
  }[];
  total: number;
};

async function fetchCompanyPeriods(companyId: string): Promise<AuctionPeriod[]> {
  const res = await apiFetch<PeriodsResponse>(
    `/api/catalog/periods?company_id=${encodeURIComponent(companyId)}`,
    { method: "GET", token: getClientToken() }
  );
  return res.data?.periods ?? [];
}

async function fetchPeriodItems(periodId: string) {
  const res = await apiFetch<ItemsPageResponse>(
    `/api/items?period_id=${encodeURIComponent(periodId)}&offset=0&limit=1000`,
    { method: "GET", token: getClientToken() }
  );
  return res.data?.items ?? [];
}

export async function fetchCompanyAssetTotals(
  companyId: string,
  periodId?: string | null
): Promise<CompanyAssetTotals> {
  const periods = await fetchCompanyPeriods(companyId);
  const targetPeriods = periodId
    ? periods.filter((p) => p.id === periodId)
    : periods;

  if (targetPeriods.length === 0) return emptyCompanyAssetTotals();

  const pages = await Promise.all(
    targetPeriods.map((p) => fetchPeriodItems(p.id))
  );
  const itemList = pages.flat();

  if (itemList.length === 0) return emptyCompanyAssetTotals();

  let startingTotal = 0;
  let biddingTotal = 0;
  let biddingBaseTotal = 0;
  let paidTotal = 0;
  let unpaidBiddingTotal = 0;
  let paidItemCount = 0;
  let unpaidItemCount = 0;
  let itemsWithBids = 0;

  for (const row of itemList) {
    const item = row.item;
    const starting = Number(item.starting_price) || 0;
    const current = Number(item.current_price) || starting;
    const hasBids = (row.bidCount ?? 0) > 0;

    startingTotal += starting;

    if (hasBids) {
      itemsWithBids += 1;
      biddingTotal += current;
      biddingBaseTotal += starting;
    }

    const winValue = hasBids ? current : starting;

    if (item.payment_confirmed) {
      paidTotal += winValue;
      paidItemCount += 1;
    } else if (hasBids) {
      unpaidBiddingTotal += current;
      unpaidItemCount += 1;
    }
  }

  return {
    itemCount: itemList.length,
    startingTotal,
    biddingTotal,
    biddingBaseTotal,
    itemsWithBids,
    paidTotal,
    unpaidBiddingTotal,
    paidItemCount,
    unpaidItemCount,
  };
}

export async function fetchDashboardPeriods(
  companyId: string
): Promise<DashboardPeriodSummary[]> {
  const list = await fetchCompanyPeriods(companyId);
  if (list.length === 0) return [];

  const pages = await Promise.all(list.map((p) => fetchPeriodItems(p.id)));
  const itemsByPeriod = new Map(
    list.map((period, idx) => [period.id, pages[idx] ?? []])
  );

  const ranked = [...list].sort((a, b) => {
    const rank = (status: string) => {
      if (status === "active") return 0;
      if (status === "draft") return 1;
      if (status === "finished") return 2;
      return 3;
    };
    const diff = rank(a.status) - rank(b.status);
    if (diff !== 0) return diff;
    return new Date(b.start_at).getTime() - new Date(a.start_at).getTime();
  });

  return ranked.map((period) => {
    const items = itemsByPeriod.get(period.id) ?? [];
    const itemCount = items.length;
    const unbidCount = items.filter((row) => (row.bidCount ?? 0) === 0).length;
    return { ...period, itemCount, unbidCount };
  });
}

export async function fetchDashboardStats(companyId: string): Promise<{
  itemCount: number;
  bidCount: number;
  periodCount: number;
  bidderCount: number;
}> {
  const [periods, biddersRes] = await Promise.all([
    fetchCompanyPeriods(companyId),
    apiFetch<{ bidders: { companyId?: string; company_id?: string }[] }>(
      "/api/admin/bidders",
      { method: "GET", token: getClientToken() }
    ),
  ]);

  const pages = await Promise.all(periods.map((p) => fetchPeriodItems(p.id)));
  const allItems = pages.flat();
  const itemCount = allItems.length;
  const bidCount = allItems.reduce((sum, row) => sum + (row.bidCount ?? 0), 0);
  const bidderCount = (biddersRes.data?.bidders ?? []).filter(
    (b) => (b.company_id ?? b.companyId) === companyId
  ).length;

  return {
    itemCount,
    bidCount,
    periodCount: periods.length,
    bidderCount,
  };
}
