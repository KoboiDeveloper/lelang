"use client";

import { useEffect, useState } from "react";
import { apiFetch, getClientToken } from "@/lib/api-client";
import { BankAccountWithBank, Bank } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminCompanyId } from "@/components/admin/admin-company-context";

const emptyForm = {
  bank_id: "",
  account_number: "",
  account_holder: "",
  notes: "",
  is_active: true,
};

type FormData = typeof emptyForm;

function AccountForm({
  form,
  setForm,
  banks,
  loading,
  title,
  onSubmit,
  onCancel,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  banks: Bank[];
  loading: boolean;
  title: string;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">{title}</p>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Nama Bank</Label>
          <Select
            value={form.bank_id}
            onChange={(e) => setForm({ ...form, bank_id: e.target.value })}
            required
          >
            <option value="" disabled>
              Pilih bank
            </option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Nomor Rekening</Label>
          <Input
            value={form.account_number}
            onChange={(e) => setForm({ ...form, account_number: e.target.value })}
            placeholder="1234567890"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Atas Nama</Label>
          <Input
            value={form.account_holder}
            onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
            placeholder="PT AMS Group"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Keterangan</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Contoh: Cabang Sudirman"
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 sm:col-span-2">
          <div>
            <p className="text-sm font-medium text-slate-900">Aktif untuk Lelang</p>
            <p className="text-xs text-slate-500">
              Rekening aktif akan ditampilkan ke pemenang setelah lelang ditutup
            </p>
          </div>
          <Switch
            checked={form.is_active}
            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
          />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Batal
          </Button>
        </div>
      </form>
    </div>
  );
}

function AccountRow({
  account,
  bankName,
  onEdit,
  onDelete,
  disabled,
}: {
  account: BankAccountWithBank;
  bankName: string;
  onEdit: (account: BankAccountWithBank) => void;
  onDelete: (account: BankAccountWithBank) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-white p-4",
        disabled && "opacity-50"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Landmark className="h-4 w-4 text-[var(--primary)]" />
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            {bankName}
          </span>
          <span className="font-mono text-sm font-semibold text-slate-900">
            {account.account_number}
          </span>
          <Badge status={account.is_active ? "active" : "cancelled"} />
        </div>
        <p className="mt-1 font-medium text-slate-900">{account.account_holder}</p>
        {account.notes && (
          <p className="mt-1 text-sm text-slate-500">{account.notes}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onEdit(account)}
          disabled={disabled}
          aria-label="Edit rekening"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onDelete(account)}
          disabled={disabled}
          aria-label="Hapus rekening"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function RekeningPage() {
  const [accounts, setAccounts] = useState<BankAccountWithBank[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BankAccountWithBank | null>(null);
  const companyId = useAdminCompanyId();

  const isFormOpen = addingNew || editingId !== null;

  async function load() {
    const [accountsRes, banksRes] = await Promise.all([
      apiFetch<{ accounts: BankAccountWithBank[] }>(
        `/api/catalog/bank-accounts?company_id=${encodeURIComponent(companyId)}&include_inactive=1`,
        { method: "GET", token: getClientToken() }
      ),
      apiFetch<{ banks: Bank[] }>("/api/catalog/banks", {
        method: "GET",
        token: getClientToken(),
      }),
    ]);
    const accountList = (accountsRes.data?.accounts ?? []).map((a) => ({
      ...a,
      banks: a.banks ?? null,
    }));
    accountList.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    setAccounts(accountList);
    setBanks(banksRes.data?.banks ?? []);
  }

  useEffect(() => {
    load();
  }, [companyId]);

  function startAdd() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      bank_id: banks[0]?.id ?? "",
    });
    setAddingNew(true);
  }

  function startEdit(account: BankAccountWithBank) {
    setAddingNew(false);
    setEditingId(account.id);
    setForm({
      bank_id: account.bank_id,
      account_number: account.account_number,
      account_holder: account.account_holder,
      notes: account.notes ?? "",
      is_active: account.is_active,
    });
  }

  function cancelForm() {
    setAddingNew(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      bank_id: form.bank_id,
      account_number: form.account_number.trim(),
      account_holder: form.account_holder.trim(),
      notes: form.notes.trim() || null,
      is_active: form.is_active,
      company_id: companyId,
    };

    const res = editingId
      ? await apiFetch(`/api/catalog/bank-accounts/${editingId}`, {
          method: "PATCH",
          token: getClientToken(),
          body: {
            bank_id: payload.bank_id,
            account_number: payload.account_number,
            account_holder: payload.account_holder,
            notes: payload.notes,
            is_active: payload.is_active,
          },
        })
      : await apiFetch("/api/catalog/bank-accounts", {
          method: "POST",
          token: getClientToken(),
          body: payload,
        });

    setLoading(false);

    if (!res.ok) {
      toast.error(res.error ?? "Gagal menyimpan rekening");
      return;
    }

    toast.success(editingId ? "Rekening diperbarui" : "Rekening ditambahkan");
    cancelForm();
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    const res = await apiFetch(`/api/catalog/bank-accounts/${deleteTarget.id}`, {
      method: "DELETE",
      token: getClientToken(),
    });

    setDeleting(false);
    setDeleteTarget(null);

    if (!res.ok) {
      toast.error(res.error ?? "Gagal menghapus rekening");
      return;
    }

    if (editingId === deleteTarget.id) {
      cancelForm();
    }

    toast.success("Rekening dihapus");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Master Rekening</h1>
          <p className="text-sm text-slate-500">
            Rekening pembayaran pemenang lelang perusahaan Anda. Ditampilkan di halaman hasil
            dan email pemenang sesuai perusahaan (AMS / AMV).
          </p>
        </div>
        {!isFormOpen && (
          <Button variant="primary" size="sm" className="w-full sm:w-auto" onClick={startAdd}>
            <Plus className="h-4 w-4" />
            Tambah Rekening
          </Button>
        )}
      </div>

      {accounts.length === 0 && !addingNew ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Landmark className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Belum ada rekening terdaftar.</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={startAdd}>
            <Plus className="h-4 w-4" />
            Tambah Rekening
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) =>
            editingId === account.id ? (
              <AccountForm
                key={account.id}
                form={form}
                setForm={setForm}
                banks={banks}
                loading={loading}
                title={`Edit Rekening — ${account.banks?.name ?? "Bank"} ${account.account_number}`}
                onSubmit={handleSubmit}
                onCancel={cancelForm}
              />
            ) : (
              <AccountRow
                key={account.id}
                account={account}
                bankName={account.banks?.name ?? "Bank"}
                onEdit={startEdit}
                onDelete={setDeleteTarget}
                disabled={isFormOpen}
              />
            )
          )}

          {addingNew && (
            <AccountForm
              form={form}
              setForm={setForm}
              banks={banks}
              loading={loading}
              title="Tambah Rekening Baru"
              onSubmit={handleSubmit}
              onCancel={cancelForm}
            />
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Rekening"
        message={
          deleteTarget
            ? `Yakin ingin menghapus rekening ${deleteTarget.banks?.name ?? "Bank"} ${deleteTarget.account_number} a.n. ${deleteTarget.account_holder}?`
            : ""
        }
        confirmLabel="Hapus"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}
