import { apiFetchServer } from "@/lib/api-client";
import {
  AuctionPeriod,
  BankAccountWithBank,
  Company,
} from "@/lib/database.types";
import { fetchCompanies } from "@/lib/companies";
import { fetchActiveBankAccounts } from "@/lib/bank-accounts";

export type WinnerRow = {
  itemId: string;
  lotNumber: string;
  itemName: string;
  startingPrice: number;
  lastPrice: number;
  winnerName: string | null;
  winnerAlias: string | null;
  photoPath: string | null;
  periodCode: string;
  periodTitle: string;
};

export type CompanyWinnerGroup = {
  company: Company;
  period: AuctionPeriod;
  periods: AuctionPeriod[];
  rows: WinnerRow[];
  bankAccounts: BankAccountWithBank[];
};

type PeriodsResponse = { periods: AuctionPeriod[] };
type WinnersResponse = {
  winners: Array<{
    item_id: string;
    lot_number: string;
    item_name: string;
    starting_price: number;
    last_price: number;
    winner_name: string | null;
    winner_alias: string | null;
    photo_path: string | null;
  }>;
};

export async function fetchFinishedPeriods(
  companyId: string
): Promise<AuctionPeriod[]> {
  const res = await apiFetchServer<PeriodsResponse>(
    `/api/catalog/periods?company_id=${encodeURIComponent(companyId)}`,
    { method: "GET", next: { revalidate: 60 } }
  );
  return (res.data?.periods ?? [])
    .filter((p) => p.status === "finished" || p.status === "cancelled")
    .sort(
      (a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime()
    );
}

export async function fetchWinners(
  companyId: string,
  periodId?: string
): Promise<{
  period: AuctionPeriod | null;
  rows: WinnerRow[];
}> {
  const periodsRes = await apiFetchServer<PeriodsResponse>(
    `/api/catalog/periods?company_id=${encodeURIComponent(companyId)}`,
    { method: "GET", next: { revalidate: 60 } }
  );
  const periods = periodsRes.data?.periods ?? [];

  let period: AuctionPeriod | null = null;
  if (periodId) {
    period = periods.find((p) => p.id === periodId) ?? null;
  } else {
    period =
      periods
        .filter((p) => p.status === "finished")
        .sort(
          (a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime()
        )[0] ?? null;
  }

  if (!period) {
    return { period: null, rows: [] };
  }

  const winnersRes = await apiFetchServer<WinnersResponse>(
    `/api/items/meta/period-winners/${period.id}`,
    { method: "GET", next: { revalidate: 60 } }
  );

  const winnerRows = winnersRes.data?.winners ?? [];
  if (!winnerRows.length) {
    return { period, rows: [] };
  }

  const rows: WinnerRow[] = winnerRows.map((row) => ({
    itemId: row.item_id,
    lotNumber: row.lot_number,
    itemName: row.item_name,
    startingPrice: Number(row.starting_price),
    lastPrice: Number(row.last_price),
    winnerName: row.winner_name,
    winnerAlias: row.winner_alias,
    photoPath: row.photo_path,
    periodCode: period.code,
    periodTitle: period.title,
  }));

  return { period, rows };
}

export async function fetchCompanyWinnerGroups(options?: {
  companyCode?: string;
  periodId?: string;
}): Promise<CompanyWinnerGroup[]> {
  const companies = await fetchCompanies();
  const filteredCompanies = options?.companyCode
    ? companies.filter((company) => company.code === options.companyCode)
    : companies;

  const groups: CompanyWinnerGroup[] = [];

  for (const company of filteredCompanies) {
    const periods = await fetchFinishedPeriods(company.id);
    const finishedPeriods = periods.filter((period) => period.status === "finished");
    if (finishedPeriods.length === 0) continue;

    const selectedPeriod =
      (options?.periodId
        ? finishedPeriods.find((period) => period.id === options.periodId)
        : null) ?? finishedPeriods[0];

    const { period, rows } = await fetchWinners(company.id, selectedPeriod.id);
    if (!period) continue;

    const bankAccounts =
      period.status === "finished"
        ? await fetchActiveBankAccounts(company.id)
        : [];

    groups.push({
      company,
      period,
      periods: finishedPeriods,
      rows,
      bankAccounts,
    });
  }

  return groups;
}
