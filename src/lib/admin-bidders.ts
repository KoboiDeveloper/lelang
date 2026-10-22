import { apiFetch, getClientToken } from "@/lib/api-client";
import type { BidderProfile } from "@/lib/database.types";

type BiddersWithBidsResponse = {
  bidders: BidderProfile[];
  bid_counts?: Record<string, number>;
};

export async function fetchCompanyBiddersWithBids(
  companyId: string
): Promise<{ bidders: BidderProfile[]; bidCounts: Record<string, number> }> {
  const res = await apiFetch<BiddersWithBidsResponse>(
    `/api/admin/bidders?company_id=${encodeURIComponent(companyId)}&with_bids=1`,
    { method: "GET", token: getClientToken() }
  );
  if (!res.ok) {
    throw new Error(res.error ?? "Gagal memuat daftar bidder");
  }
  return {
    bidders: res.data?.bidders ?? [],
    bidCounts: res.data?.bid_counts ?? {},
  };
}

/** @deprecated use fetchCompanyBiddersWithBids */
export async function fetchBidderIdsWithCompanyBids(
  companyId: string
): Promise<string[]> {
  const { bidders } = await fetchCompanyBiddersWithBids(companyId);
  return bidders.map((b) => b.id);
}

/** @deprecated use fetchCompanyBiddersWithBids */
export async function countCompanyBidsByBidder(
  companyId: string,
  _bidderIds: string[]
): Promise<Record<string, number>> {
  const { bidCounts } = await fetchCompanyBiddersWithBids(companyId);
  return bidCounts;
}
