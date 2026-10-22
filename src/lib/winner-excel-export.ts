import { apiFetch, getClientToken } from "@/lib/api-client";
import { AuctionPeriod, BankAccountWithBank } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";
import { getBankName } from "@/lib/bank-utils";

type WinnerRow = {
  item_id: string;
  lot_number: string;
  item_name: string;
  starting_price: number;
  last_price: number;
  winner_name: string | null;
  winner_alias: string | null;
  photo_path: string | null;
};

type WinnerNotificationRow = {
  bidder_id: string;
  bidder_email: string | null;
  bidder_name: string;
  public_alias: string;
  item_id: string;
  lot_number: string;
  item_name: string;
  last_price: number;
};

type CompaniesResponse = {
  companies: Array<{ id: string; short_name: string; name: string }>;
};

type WinnersResponse = { winners: WinnerRow[] };
type NotificationsResponse = { notifications: WinnerNotificationRow[] };
type BankAccountsResponse = {
  accounts: Array<{
    id: string;
    company_id?: string;
    companyId?: string;
    bank_id?: string;
    bankId?: string;
    account_holder?: string;
    accountHolder?: string;
    account_number?: string;
    accountNumber?: string;
    is_active?: boolean;
    isActive?: boolean;
    notes?: string | null;
    created_at?: string;
    createdAt?: string;
    created_by?: string | null;
    createdBy?: string | null;
    updated_at?: string;
    updatedAt?: string;
    updated_by?: string | null;
    updatedBy?: string | null;
    banks?: { id: string; code: string; name: string } | null;
    bank?: { id: string; code: string; name: string } | null;
  }>;
};

function mapBankAccounts(
  accounts: BankAccountsResponse["accounts"],
  companyId: string
): BankAccountWithBank[] {
  return accounts.map((a) => {
    const bank = a.banks ?? a.bank ?? null;
    return {
      id: a.id,
      company_id: a.company_id ?? a.companyId ?? companyId,
      bank_id: a.bank_id ?? a.bankId ?? bank?.id ?? "",
      account_holder: a.account_holder ?? a.accountHolder ?? "",
      account_number: a.account_number ?? a.accountNumber ?? "",
      is_active: a.is_active ?? a.isActive ?? true,
      notes: a.notes ?? null,
      created_at: a.created_at ?? a.createdAt ?? new Date(0).toISOString(),
      created_by: a.created_by ?? a.createdBy ?? null,
      updated_at: a.updated_at ?? a.updatedAt ?? new Date(0).toISOString(),
      updated_by: a.updated_by ?? a.updatedBy ?? null,
      banks: bank ? { id: bank.id, code: bank.code, name: bank.name } : null,
    };
  });
}

export async function fetchWinnerExportData(period: AuctionPeriod) {
  const token = getClientToken();

  const [companiesRes, winnersRes, notificationsRes, banksRes] =
    await Promise.all([
      apiFetch<CompaniesResponse>("/api/catalog/companies", {
        method: "GET",
        token,
      }),
      apiFetch<WinnersResponse>(
        `/api/items/meta/period-winners/${period.id}`,
        { method: "GET", token }
      ),
      apiFetch<NotificationsResponse>(
        `/api/items/meta/period-winner-notifications/${period.id}`,
        { method: "GET", token }
      ),
      apiFetch<BankAccountsResponse>(
        `/api/catalog/bank-accounts?company_id=${encodeURIComponent(period.company_id)}`,
        { method: "GET", token }
      ),
    ]);

  if (!winnersRes.ok) {
    throw new Error(winnersRes.error ?? "Gagal memuat pemenang");
  }
  if (!banksRes.ok) {
    throw new Error(banksRes.error ?? "Gagal memuat rekening bank");
  }

  const company =
    (companiesRes.data?.companies ?? []).find((c) => c.id === period.company_id) ??
    null;

  return {
    period,
    company,
    winners: winnersRes.data?.winners ?? [],
    notifications: notificationsRes.data?.notifications ?? [],
    bankAccounts: mapBankAccounts(
      banksRes.data?.accounts ?? [],
      period.company_id
    ),
  };
}

export async function downloadWinnerExcel(period: AuctionPeriod) {
  const data = await fetchWinnerExportData(period);
  const XLSX = await import("xlsx");

  const infoRows = [
    ["LAPORAN PEMENANG LELANG"],
    [],
    ["Perusahaan", data.company?.name ?? "-"],
    ["Kode Perusahaan", data.company?.short_name ?? "-"],
    ["Kode Periode", data.period.code],
    ["Judul Periode", data.period.title],
    ["Status", data.period.status],
    ["Mulai", formatDateTime(data.period.start_at)],
    ["Selesai", formatDateTime(data.period.end_at)],
    ["Total Barang Menang", data.winners.filter((row) => row.winner_alias).length],
    ["Diekspor", formatDateTime(new Date().toISOString())],
    [],
  ];

  const winnerHeader = [
    "No",
    "Lot",
    "Nama Barang",
    "Harga Awal",
    "Harga Menang",
    "Alias Pemenang",
    "Nama Pemenang",
    "Email Pemenang",
  ];

  const emailByBidder = new Map<string, string>();
  for (const row of data.notifications) {
    if (row.bidder_email) {
      emailByBidder.set(row.bidder_id, row.bidder_email);
    }
  }

  const bidderIdByItem = new Map(
    data.notifications.map((row) => [row.item_id, row.bidder_id])
  );

  const winnerRows = data.winners.map((row, index) => {
    const bidderId = bidderIdByItem.get(row.item_id);
    return [
      index + 1,
      row.lot_number,
      row.item_name,
      Number(row.starting_price),
      Number(row.last_price),
      row.winner_alias ?? "-",
      row.winner_name ?? "-",
      bidderId ? emailByBidder.get(bidderId) ?? "-" : "-",
    ];
  });

  const bankHeader = ["Bank", "Nomor Rekening", "Atas Nama", "Keterangan"];
  const bankRows = data.bankAccounts.map((account) => [
    getBankName(account),
    account.account_number,
    account.account_holder,
    account.notes ?? "-",
  ]);

  const summaryMap = new Map<
    string,
    { name: string; alias: string; email: string; items: number; total: number }
  >();

  for (const row of data.notifications) {
    const existing = summaryMap.get(row.bidder_id);
    const price = Number(row.last_price);
    if (existing) {
      existing.items += 1;
      existing.total += price;
      continue;
    }
    summaryMap.set(row.bidder_id, {
      name: row.bidder_name,
      alias: row.public_alias,
      email: row.bidder_email ?? "-",
      items: 1,
      total: price,
    });
  }

  const summaryHeader = [
    "Nama Pemenang",
    "Alias",
    "Email",
    "Jumlah Barang",
    "Total Pembayaran",
  ];
  const summaryRows = Array.from(summaryMap.values()).map((row) => [
    row.name,
    row.alias,
    row.email,
    row.items,
    row.total,
  ]);

  const workbook = XLSX.utils.book_new();
  const winnersSheet = XLSX.utils.aoa_to_sheet([
    ...infoRows,
    winnerHeader,
    ...winnerRows,
  ]);
  const banksSheet = XLSX.utils.aoa_to_sheet([bankHeader, ...bankRows]);
  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows]);

  winnersSheet["!cols"] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 22 },
    { wch: 28 },
  ];
  banksSheet["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 28 }];
  summarySheet["!cols"] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(workbook, winnersSheet, "Pemenang");
  XLSX.utils.book_append_sheet(workbook, banksSheet, "Rekening");
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan Pemenang");

  const safeCode = period.code.replace(/[^\w-]+/g, "_");
  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `pemenang-${safeCode}-${dateStamp}.xlsx`);
}
