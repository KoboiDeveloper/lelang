import { apiFetch, getClientToken } from "@/lib/api-client";
import type { Database } from "@/lib/database.types";

export type ItemCategory = Database["public"]["Tables"]["item_categories"]["Row"];

type CategoriesResponse = {
  categories: Array<{
    id: string;
    name: string;
    sortOrder?: number;
    sort_order?: number;
    isActive?: boolean;
    is_active?: boolean;
    createdAt?: string;
    created_at?: string;
  }>;
};

export async function fetchItemCategories(): Promise<ItemCategory[]> {
  const res = await apiFetch<CategoriesResponse>("/api/catalog/categories", {
    method: "GET",
    token: getClientToken(),
  });

  if (!res.ok) {
    throw new Error(res.error ?? "Gagal memuat kategori");
  }

  return (res.data?.categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sort_order ?? c.sortOrder ?? 0,
    is_active: c.is_active ?? c.isActive ?? true,
    created_at: c.created_at ?? c.createdAt ?? new Date(0).toISOString(),
  }));
}
