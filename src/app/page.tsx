import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HomeCatalog } from "@/components/home/home-catalog";
import { CompanySwitcher } from "@/components/home/company-switcher";
import { fetchCategories, fetchItemsPage } from "@/lib/items";
import { fetchDisplayPeriod } from "@/lib/auction-server";
import {
  fetchCompaniesWithAuction,
  fetchCompanyByCode,
  resolveCompanyCode,
} from "@/lib/companies";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; focus?: string }>;
}) {
  const { company: companyParam, focus: focusParam } = await searchParams;
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

  const period = await fetchDisplayPeriod(company.id);
  const categories = await fetchCategories(period?.id);
  const initialCategory = categories[0]?.name ?? "";
  const catalogTotal = categories.reduce((sum, category) => sum + category.count, 0);
  const { items, hasMore } = await fetchItemsPage({
    periodId: period?.id,
    category: initialCategory || null,
    offset: 0,
    limit: 12,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <CompanySwitcher companies={companies} activeCompany={company} />
      <main className="flex-1">
        <HomeCatalog
          key={`${company.id}-${period?.id ?? "none"}-${focusParam ?? "nofocus"}`}
          company={company}
          period={period}
          categories={categories}
          initialItems={items}
          initialHasMore={hasMore}
          totalItems={catalogTotal}
          initialCategory={initialCategory}
          focusItemId={focusParam?.trim() || null}
        />
      </main>
      <Footer />
    </div>
  );
}
