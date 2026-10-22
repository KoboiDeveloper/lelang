import { apiFetchServer } from "@/lib/api-client";
import { getCompanyCodeById, sendPushToCompany } from "@/lib/push-notify-shared";
import type { AuctionItem } from "@/lib/database.types";

const NOTIFYABLE_ITEM_STATUSES = new Set(["active", "ready"]);

export type AuctionItemInsertRecord = Pick<
  AuctionItem,
  "id" | "period_id" | "lot_number" | "item_name" | "status"
>;

export { verifyPushWebhookSecret } from "@/lib/push-notify-shared";

export function parseAuctionItemInsertPayload(body: unknown): AuctionItemInsertRecord | null {
  if (!body || typeof body !== "object") return null;

  const payload = body as Record<string, unknown>;
  const record =
    payload.record && typeof payload.record === "object"
      ? (payload.record as Record<string, unknown>)
      : payload;

  const id = typeof record.id === "string" ? record.id : null;
  const periodId = typeof record.period_id === "string" ? record.period_id : null;
  const lotNumber = typeof record.lot_number === "string" ? record.lot_number : null;
  const itemName = typeof record.item_name === "string" ? record.item_name : null;
  const status = typeof record.status === "string" ? record.status : null;

  if (!id || !periodId || !lotNumber || !itemName || !status) {
    return null;
  }

  return {
    id,
    period_id: periodId,
    lot_number: lotNumber,
    item_name: itemName,
    status,
  };
}

type ItemDetailResponse = {
  period?: {
    id: string;
    status: string;
    company_id: string;
  } | null;
};

export async function notifyNewAuctionItem(item: AuctionItemInsertRecord) {
  if (!NOTIFYABLE_ITEM_STATUSES.has(item.status)) {
    return { sent: 0, skipped: true, reason: "item_not_public" as const };
  }

  const res = await apiFetchServer<ItemDetailResponse>(`/api/items/${item.id}`, {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error(res.error ?? "Gagal memuat detail item");
  }

  const period = res.data?.period;
  if (!period || period.status !== "active") {
    return { sent: 0, skipped: true, reason: "period_not_active" as const };
  }

  const companyCode = await getCompanyCodeById(period.company_id);

  return sendPushToCompany(period.company_id, companyCode, {
    title: `Barang baru: ${item.lot_number}`,
    body: item.item_name,
    url: `/lots/${item.id}`,
  });
}
