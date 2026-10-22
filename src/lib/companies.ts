import { apiFetchServer } from "@/lib/api-client";
import { Company } from "@/lib/database.types";
import { DEFAULT_COMPANY_CODE, resolveCompanyCode } from "@/lib/company-utils";

export { DEFAULT_COMPANY_CODE, resolveCompanyCode, withCompanyQuery } from "@/lib/company-utils";

type CompaniesResponse = { companies: Company[] };
type PeriodsResponse = {
  periods: { id: string; company_id: string; status: string }[];
};

export async function fetchCompanies(): Promise<Company[]> {
  const res = await apiFetchServer<CompaniesResponse>("/api/catalog/companies", {
    method: "GET",
    next: { revalidate: 60 },
  });
  return res.data?.companies ?? [];
}

/** Companies that currently have a browsable auction (active or finished). */
export async function fetchCompaniesWithAuction(): Promise<Company[]> {
  const [companiesRes, periodsRes] = await Promise.all([
    apiFetchServer<CompaniesResponse>("/api/catalog/companies", {
      method: "GET",
      next: { revalidate: 60 },
    }),
    apiFetchServer<PeriodsResponse>("/api/catalog/periods", {
      method: "GET",
      next: { revalidate: 30 },
    }),
  ]);

  const list = companiesRes.data?.companies ?? [];
  if (list.length === 0) return [];

  const companyIdsWithAuction = new Set(
    (periodsRes.data?.periods ?? [])
      .filter((p) => p.status === "active" || p.status === "finished")
      .map((p) => p.company_id)
  );

  const filtered = list.filter((company) =>
    companyIdsWithAuction.has(company.id)
  );

  return filtered.length > 0 ? filtered : list;
}

export async function fetchCompanyById(id: string): Promise<Company | null> {
  const companies = await fetchCompanies();
  return companies.find((c) => c.id === id) ?? null;
}

export async function fetchCompanyByCode(code: string): Promise<Company | null> {
  const companies = await fetchCompanies();
  return (
    companies.find((c) => c.code.toLowerCase() === code.toLowerCase()) ?? null
  );
}
