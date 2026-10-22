import { apiFetchServer } from "@/lib/api-client";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LotsGrid } from "@/components/lots-grid";
import { CompanySwitcher } from "@/components/home/company-switcher";
import { StripedHeroBackground } from "@/components/striped-hero-background";
import { AuctionItem, AuctionPeriod, ItemPhoto } from "@/lib/database.types";
import {
  fetchCompaniesWithAuction,
  fetchCompanyByCode,
  resolveCompanyCode,
} from "@/lib/companies";

type PeriodsResponse = { periods: Pick<AuctionPeriod, "id">[] };
type ItemsPageResponse = {
  items: {
    item: AuctionItem;
    photos: ItemPhoto[];
    bidCount: number;
  }[];
};

export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company: companyParam } = await searchParams;
  const companies = await fetchCompaniesWithAuction();
  const companyCode = resolveCompanyCode(companyParam, companies);
  const company =
    (await fetchCompanyByCode(companyCode)) ?? companies[0] ?? null;

  if (!company) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="container-app flex flex-1 items-center justify-center py-20 text-slate-500">
          Perusahaan belum dikonfigurasi.
        </main>
        <Footer />
      </div>
    );
  }

  const periodsRes = await apiFetchServer<PeriodsResponse>(
    `/api/catalog/periods?company_id=${encodeURIComponent(company.id)}`,
    { method: "GET", next: { revalidate: 30 } }
  );
  const periodIds = (periodsRes.data?.periods ?? []).map((p) => p.id);

  const pages = await Promise.all(
    periodIds.map((periodId) =>
      apiFetchServer<ItemsPageResponse>(
        `/api/items?period_id=${encodeURIComponent(periodId)}&offset=0&limit=500`,
        { method: "GET", next: { revalidate: 30 } }
      )
    )
  );

  const itemsWithPhotos = pages
    .flatMap((page) => page.data?.items ?? [])
    .filter((row) => ["active", "ready", "sold"].includes(row.item.status))
    .sort((a, b) => a.item.lot_number.localeCompare(b.item.lot_number));

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <CompanySwitcher
        companies={companies}
        activeCompany={company}
        basePath="/lots"
      />
      <main className="flex-1">
        <div className="relative overflow-hidden border-b border-[var(--border)] bg-white">
          <StripedHeroBackground />
          <div className="container-app relative py-10 sm:py-14">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              {company.short_name}
            </p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Semua Lot</h1>
            <p className="mt-2 text-slate-500">
              {itemsWithPhotos.length} barang tersedia untuk dilelang
            </p>
          </div>
        </div>
        <div className="container-app py-10">
          {itemsWithPhotos.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-slate-500">Belum ada lot tersedia.</p>
            </div>
          ) : (
            <LotsGrid companyId={company.id} items={itemsWithPhotos} />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
