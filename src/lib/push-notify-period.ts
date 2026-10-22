import { getCompanyCodeById, sendPushToCompany } from "@/lib/push-notify-shared";
import type { AuctionPeriod } from "@/lib/database.types";

export type AuctionPeriodUpdateRecord = Pick<
  AuctionPeriod,
  "id" | "company_id" | "code" | "title" | "status" | "start_at" | "end_at"
>;

export function parsePeriodUpdatePayload(body: unknown): {
  record: AuctionPeriodUpdateRecord;
  oldRecord: AuctionPeriodUpdateRecord;
} | null {
  if (!body || typeof body !== "object") return null;

  const payload = body as Record<string, unknown>;
  const recordRaw =
    payload.record && typeof payload.record === "object"
      ? (payload.record as Record<string, unknown>)
      : null;
  const oldRecordRaw =
    payload.old_record && typeof payload.old_record === "object"
      ? (payload.old_record as Record<string, unknown>)
      : null;

  if (!recordRaw || !oldRecordRaw) return null;

  function parseRecord(raw: Record<string, unknown>): AuctionPeriodUpdateRecord | null {
    const id = typeof raw.id === "string" ? raw.id : null;
    const companyId = typeof raw.company_id === "string" ? raw.company_id : null;
    const code = typeof raw.code === "string" ? raw.code : null;
    const title = typeof raw.title === "string" ? raw.title : null;
    const status = typeof raw.status === "string" ? raw.status : null;
    const startAt = typeof raw.start_at === "string" ? raw.start_at : null;
    const endAt = typeof raw.end_at === "string" ? raw.end_at : null;

    if (!id || !companyId || !code || !title || !status || !startAt || !endAt) {
      return null;
    }

    return {
      id,
      company_id: companyId,
      code,
      title,
      status,
      start_at: startAt,
      end_at: endAt,
    };
  }

  const record = parseRecord(recordRaw);
  const oldRecord = parseRecord(oldRecordRaw);

  if (!record || !oldRecord) return null;

  return { record, oldRecord };
}

export async function notifyAuctionPeriodUpdate(
  record: AuctionPeriodUpdateRecord,
  oldRecord: AuctionPeriodUpdateRecord
) {
  const companyCode = await getCompanyCodeById(record.company_id);
  const becameActive =
    oldRecord.status !== "active" && record.status === "active";
  const becameClosed =
    !["finished", "cancelled"].includes(oldRecord.status) &&
    ["finished", "cancelled"].includes(record.status);

  if (becameActive) {
    return sendPushToCompany(record.company_id, companyCode, {
      title: `Lelang dimulai: ${record.code}`,
      body: `${record.title} sudah aktif. Segera cek katalog barang lelang.`,
      url: "/lots",
    });
  }

  if (becameClosed) {
    const closedLabel = record.status === "cancelled" ? "dibatalkan" : "ditutup";
    return sendPushToCompany(record.company_id, companyCode, {
      title: `Lelang ${closedLabel}: ${record.code}`,
      body: `${record.title} telah berakhir. Cek hasil pemenang sekarang.`,
      url: `/hasil?period=${record.id}`,
    });
  }

  return { sent: 0, skipped: true as const, reason: "no_relevant_change" as const };
}

export async function notifyAuctionPeriodInsert(record: AuctionPeriodUpdateRecord) {
  if (record.status !== "active") {
    return { sent: 0, skipped: true as const, reason: "period_not_active" as const };
  }

  const companyCode = await getCompanyCodeById(record.company_id);
  return sendPushToCompany(record.company_id, companyCode, {
    title: `Lelang dimulai: ${record.code}`,
    body: `${record.title} sudah aktif. Segera cek katalog barang lelang.`,
    url: "/lots",
  });
}

export function parsePeriodInsertPayload(body: unknown): AuctionPeriodUpdateRecord | null {
  if (!body || typeof body !== "object") return null;

  const payload = body as Record<string, unknown>;
  const recordRaw =
    payload.record && typeof payload.record === "object"
      ? (payload.record as Record<string, unknown>)
      : payload;

  const id = typeof recordRaw.id === "string" ? recordRaw.id : null;
  const companyId = typeof recordRaw.company_id === "string" ? recordRaw.company_id : null;
  const code = typeof recordRaw.code === "string" ? recordRaw.code : null;
  const title = typeof recordRaw.title === "string" ? recordRaw.title : null;
  const status = typeof recordRaw.status === "string" ? recordRaw.status : null;
  const startAt = typeof recordRaw.start_at === "string" ? recordRaw.start_at : null;
  const endAt = typeof recordRaw.end_at === "string" ? recordRaw.end_at : null;

  if (!id || !companyId || !code || !title || !status || !startAt || !endAt) {
    return null;
  }

  return {
    id,
    company_id: companyId,
    code,
    title,
    status,
    start_at: startAt,
    end_at: endAt,
  };
}
