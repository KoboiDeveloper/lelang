import { apiFetchServer, getServerToken } from "@/lib/api-client";
import { sendWinnerNotificationEmail } from "@/lib/email";
import { fetchCompanyById } from "@/lib/companies";
import { AuctionBankAccount, AuctionPeriod } from "@/lib/database.types";

export type WinnerNotificationRow = {
  bidder_id: string;
  bidder_email: string | null;
  bidder_name: string;
  public_alias: string;
  item_id: string;
  lot_number: string;
  item_name: string;
  last_price: number;
};

export type WinnerEmailRecipient = {
  email: string;
  name: string;
  alias: string;
  items: {
    lotNumber: string;
    itemName: string;
    price: number;
  }[];
};

export function groupWinnerNotifications(
  rows: WinnerNotificationRow[]
): WinnerEmailRecipient[] {
  const map = new Map<string, WinnerEmailRecipient>();

  for (const row of rows) {
    const email = row.bidder_email?.trim().toLowerCase();
    if (!email) continue;

    const item = {
      lotNumber: row.lot_number,
      itemName: row.item_name,
      price: Number(row.last_price),
    };

    const existing = map.get(row.bidder_id);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    map.set(row.bidder_id, {
      email,
      name: row.bidder_name,
      alias: row.public_alias,
      items: [item],
    });
  }

  return Array.from(map.values());
}

export type SendWinnerEmailsResult = {
  sent: number;
  skippedNoEmail: number;
  totalWinners: number;
  alreadySent: boolean;
};

type PeriodsResponse = { periods: AuctionPeriod[] };
type NotificationsResponse = { notifications: WinnerNotificationRow[] };
type BankAccountsResponse = {
  accounts: Array<
    AuctionBankAccount & {
      banks?: { id: string; code: string; name: string } | null;
      bank?: { id: string; code: string; name: string } | null;
    }
  >;
};

export async function sendWinnerEmailsForPeriod(
  periodId: string,
  options?: { force?: boolean }
): Promise<SendWinnerEmailsResult> {
  const token = await getServerToken();

  const periodsRes = await apiFetchServer<PeriodsResponse>(
    "/api/catalog/periods",
    { method: "GET", token }
  );
  const period =
    (periodsRes.data?.periods ?? []).find((p) => p.id === periodId) ?? null;

  if (!period) {
    throw new Error("Periode tidak ditemukan");
  }

  if (period.status !== "finished") {
    throw new Error("Email pemenang hanya dapat dikirim saat periode berstatus Finished");
  }

  if (period.winner_emails_sent_at && !options?.force) {
    return {
      sent: 0,
      skippedNoEmail: 0,
      totalWinners: 0,
      alreadySent: true,
    };
  }

  const rowsRes = await apiFetchServer<NotificationsResponse>(
    `/api/items/meta/period-winner-notifications/${periodId}`,
    { method: "GET", token }
  );

  if (!rowsRes.ok) {
    throw new Error(rowsRes.error ?? "Gagal memuat notifikasi pemenang");
  }

  const rows = rowsRes.data?.notifications ?? [];
  const recipients = groupWinnerNotifications(rows);

  const uniqueBiddersWithoutEmail = new Set(
    rows.filter((row) => !row.bidder_email).map((row) => row.bidder_id)
  ).size;

  const banksRes = await apiFetchServer<BankAccountsResponse>(
    `/api/catalog/bank-accounts?company_id=${encodeURIComponent(period.company_id)}`,
    { method: "GET", token }
  );

  const activeAccounts = (banksRes.data?.accounts ?? []).map((account) => ({
    ...account,
    banks: account.banks ?? account.bank ?? null,
  }));

  const company = await fetchCompanyById(period.company_id);
  const companyShortName = company?.short_name ?? "E-Lelang";
  const companyName = company?.name ?? "E-Lelang";

  let sent = 0;
  for (const recipient of recipients) {
    const totalAmount = recipient.items.reduce((sum, item) => sum + item.price, 0);
    await sendWinnerNotificationEmail({
      to: recipient.email,
      recipientName: recipient.name,
      companyShortName,
      companyName,
      periodCode: period.code,
      periodTitle: period.title,
      items: recipient.items,
      totalAmount,
      bankAccounts: activeAccounts.map((account) => ({
        bankName: account.banks?.name ?? "Bank",
        accountNumber: account.account_number,
        accountHolder: account.account_holder,
        notes: account.notes,
      })),
    });
    sent += 1;
  }

  if (sent > 0 || recipients.length === 0) {
    const patchRes = await apiFetchServer(
      `/api/catalog/periods/${periodId}`,
      {
        method: "PATCH",
        token,
        body: { winner_emails_sent_at: new Date().toISOString() },
      }
    );
    if (!patchRes.ok) {
      throw new Error(patchRes.error ?? "Gagal menandai email pemenang terkirim");
    }
  }

  return {
    sent,
    skippedNoEmail: uniqueBiddersWithoutEmail,
    totalWinners: recipients.length,
    alreadySent: false,
  };
}
