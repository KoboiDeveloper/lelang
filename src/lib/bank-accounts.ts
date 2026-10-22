import { apiFetchServer } from "@/lib/api-client";
import { BankAccountWithBank } from "@/lib/database.types";

export { getBankName } from "@/lib/bank-utils";

type AccountsResponse = {
  accounts: Array<{
    id: string;
    companyId?: string;
    company_id?: string;
    bankId?: string;
    bank_id?: string;
    accountHolder?: string;
    account_holder?: string;
    accountNumber?: string;
    account_number?: string;
    isActive?: boolean;
    is_active?: boolean;
    notes?: string | null;
    createdAt?: string;
    created_at?: string;
    createdBy?: string | null;
    created_by?: string | null;
    updatedAt?: string;
    updated_at?: string;
    updatedBy?: string | null;
    updated_by?: string | null;
    bank?: { id: string; code: string; name: string } | null;
  }>;
};

export async function fetchActiveBankAccounts(
  companyId: string
): Promise<BankAccountWithBank[]> {
  const res = await apiFetchServer<AccountsResponse>(
    `/api/catalog/bank-accounts?company_id=${encodeURIComponent(companyId)}`,
    { method: "GET", next: { revalidate: 60 } }
  );

  return (res.data?.accounts ?? []).map((a) => ({
    id: a.id,
    company_id: a.company_id ?? a.companyId ?? companyId,
    bank_id: a.bank_id ?? a.bankId ?? a.bank?.id ?? "",
    account_holder: a.account_holder ?? a.accountHolder ?? "",
    account_number: a.account_number ?? a.accountNumber ?? "",
    is_active: a.is_active ?? a.isActive ?? true,
    notes: a.notes ?? null,
    created_at: a.created_at ?? a.createdAt ?? new Date(0).toISOString(),
    created_by: a.created_by ?? a.createdBy ?? null,
    updated_at: a.updated_at ?? a.updatedAt ?? new Date(0).toISOString(),
    updated_by: a.updated_by ?? a.updatedBy ?? null,
    banks: a.bank
      ? { id: a.bank.id, code: a.bank.code, name: a.bank.name }
      : null,
  }));
}
