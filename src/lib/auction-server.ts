import { apiFetchServer } from "@/lib/api-client";
import { AuctionPeriod } from "@/lib/database.types";

type PeriodsResponse = { periods: AuctionPeriod[] };

export async function fetchDisplayPeriod(
  companyId: string
): Promise<AuctionPeriod | null> {
  const res = await apiFetchServer<PeriodsResponse>(
    `/api/catalog/periods?company_id=${encodeURIComponent(companyId)}`,
    { method: "GET", next: { revalidate: 30 } }
  );

  const periods = res.data?.periods ?? [];
  const active = periods
    .filter((p) => p.status === "active")
    .sort(
      (a, b) =>
        new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
    )[0];
  if (active) return active;

  const finished = periods
    .filter((p) => p.status === "finished")
    .sort(
      (a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime()
    )[0];

  return finished ?? null;
}
