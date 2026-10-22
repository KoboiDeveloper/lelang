import { apiFetchServer } from "@/lib/api-client";
import { Bank } from "@/lib/database.types";

type BanksResponse = {
  banks: Array<{
    id: string;
    code: string;
    name: string;
    sortOrder?: number;
    sort_order?: number;
    createdAt?: string;
    created_at?: string;
  }>;
};

export async function fetchBanks(): Promise<Bank[]> {
  const res = await apiFetchServer<BanksResponse>("/api/catalog/banks", {
    method: "GET",
    next: { revalidate: 300 },
  });

  return (res.data?.banks ?? []).map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    sort_order: b.sort_order ?? b.sortOrder ?? 0,
    created_at: b.created_at ?? b.createdAt ?? new Date(0).toISOString(),
  }));
}
