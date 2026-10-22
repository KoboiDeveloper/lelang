"use client";

import { useEffect, useState } from "react";
import { apiFetch, getClientToken } from "@/lib/api-client";
import { AuctionPeriod } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PeriodItemsPanel } from "@/components/admin/period-items-panel";
import { PeriodWinnerEmailBar } from "@/components/admin/period-winner-email-bar";
import { toast } from "sonner";
import { Plus, Pencil, Calendar, ArrowLeft, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminCompanyId } from "@/components/admin/admin-company-context";
import { cn } from "@/lib/utils";
import {
  carryUnbidItemsToPeriod,
  fetchUnbidItemsForPeriod,
  findCarrySourcePeriod,
} from "@/lib/item-carry";

const emptyPeriodForm = {
  code: "",
  title: "",
  description: "",
  start_at: "",
  end_at: "",
  status: "draft",
};

type RightPanel = "items" | "period-form";
type MobileView = "list" | "detail";

function PeriodFormFields({
  form,
  setForm,
  loading,
  onSubmit,
  onCancel,
  isCreate,
  carryUnbid,
  setCarryUnbid,
  carrySourceLabel,
  carryUnbidCount,
}: {
  form: typeof emptyPeriodForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyPeriodForm>>;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isCreate?: boolean;
  carryUnbid?: boolean;
  setCarryUnbid?: (value: boolean) => void;
  carrySourceLabel?: string | null;
  carryUnbidCount?: number;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Kode</Label>
        <Input
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="AUG-2026"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="finished">Finished</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Judul</Label>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Deskripsi</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Mulai</Label>
        <Input
          type="datetime-local"
          value={form.start_at}
          onChange={(e) => setForm({ ...form, start_at: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Selesai</Label>
        <Input
          type="datetime-local"
          value={form.end_at}
          onChange={(e) => setForm({ ...form, end_at: e.target.value })}
          required
        />
      </div>
      {isCreate && carrySourceLabel && (carryUnbidCount ?? 0) > 0 && (
        <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
              checked={Boolean(carryUnbid)}
              onChange={(e) => setCarryUnbid?.(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-amber-950">
                Bawa barang belum di-bid dari periode {carrySourceLabel}
              </span>
              <span className="mt-1 block text-xs text-amber-800/90">
                {carryUnbidCount} barang tanpa bid akan dibuat ulang di periode
                baru (status draft, foto ikut disalin).
              </span>
            </span>
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}

export default function PeriodsMasterDetailPage() {
  const [periods, setPeriods] = useState<AuctionPeriod[]>([]);
  const [itemCountByPeriod, setItemCountByPeriod] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPeriodForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("items");
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [loading, setLoading] = useState(false);
  const [deletingPeriod, setDeletingPeriod] = useState(false);
  const [deletePeriodTarget, setDeletePeriodTarget] = useState<AuctionPeriod | null>(null);
  const [carryUnbid, setCarryUnbid] = useState(false);
  const [carrySource, setCarrySource] = useState<{ id: string; code: string } | null>(null);
  const [carryUnbidCount, setCarryUnbidCount] = useState(0);
  const companyId = useAdminCompanyId();

  const selectedPeriod = periods.find((p) => p.id === selectedId) ?? null;

  async function loadItemCounts(periodList: AuctionPeriod[]) {
    if (periodList.length === 0) {
      setItemCountByPeriod({});
      return;
    }
    const pages = await Promise.all(
      periodList.map((period) =>
        apiFetch<{ total: number }>(
          `/api/items?period_id=${encodeURIComponent(period.id)}&offset=0&limit=1`,
          { method: "GET", token: getClientToken() }
        )
      )
    );
    const counts: Record<string, number> = {};
    periodList.forEach((period, idx) => {
      counts[period.id] = pages[idx]?.data?.total ?? 0;
    });
    setItemCountByPeriod(counts);
  }

  async function loadPeriods() {
    const res = await apiFetch<{ periods: AuctionPeriod[] }>(
      `/api/catalog/periods?company_id=${encodeURIComponent(companyId)}`,
      { method: "GET", token: getClientToken() }
    );
    const list = [...(res.data?.periods ?? [])].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setPeriods(list);
    await loadItemCounts(list);
    if (list.length > 0 && !selectedId) {
      setSelectedId(list[0].id);
    }
  }

  useEffect(() => {
    loadPeriods();
  }, [companyId]);

  function toLocalDatetime(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  function startEditPeriod(period: AuctionPeriod) {
    setSelectedId(period.id);
    setEditingId(period.id);
    setForm({
      code: period.code,
      title: period.title,
      description: period.description ?? "",
      start_at: toLocalDatetime(period.start_at),
      end_at: toLocalDatetime(period.end_at),
      status: period.status,
    });
    setRightPanel("period-form");
    setMobileView("detail");
  }

  async function loadCarryOptions() {
    const source = await findCarrySourcePeriod(companyId);
    if (!source) {
      setCarrySource(null);
      setCarryUnbidCount(0);
      setCarryUnbid(false);
      return;
    }
    const unbidItems = await fetchUnbidItemsForPeriod(source.id);
    setCarrySource(source);
    setCarryUnbidCount(unbidItems.length);
    setCarryUnbid(unbidItems.length > 0);
  }

  function startAddPeriod() {
    setEditingId(null);
    setForm(emptyPeriodForm);
    setRightPanel("period-form");
    setMobileView("detail");
    void loadCarryOptions();
  }

  function cancelPeriodForm() {
    setEditingId(null);
    setForm(emptyPeriodForm);
    setCarryUnbid(false);
    setCarrySource(null);
    setCarryUnbidCount(0);
    setRightPanel("items");
    setMobileView("list");
  }

  function selectPeriod(id: string) {
    setSelectedId(id);
    setRightPanel("items");
    setEditingId(null);
    setForm(emptyPeriodForm);
    setMobileView("detail");
  }

  function backToList() {
    setMobileView("list");
    setRightPanel("items");
    setEditingId(null);
    setForm(emptyPeriodForm);
  }

  async function handlePeriodSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const previousPeriod = editingId
      ? periods.find((period) => period.id === editingId) ?? null
      : null;
    const becameFinished =
      form.status === "finished" && previousPeriod?.status !== "finished";

    const payload = {
      code: form.code.trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      status: form.status,
      company_id: companyId,
    };

    const res = editingId
      ? await apiFetch<{ period: AuctionPeriod }>(
          `/api/catalog/periods/${editingId}`,
          { method: "PATCH", token: getClientToken(), body: payload }
        )
      : await apiFetch<{ period: AuctionPeriod }>("/api/catalog/periods", {
          method: "POST",
          token: getClientToken(),
          body: payload,
        });

    setLoading(false);

    if (!res.ok || !res.data?.period) {
      toast.error(res.error ?? "Gagal menyimpan periode");
      return;
    }

    const data = res.data.period;
    toast.success(editingId ? "Periode diperbarui" : "Periode dibuat");

    const isCreate = !editingId;
    const carrySourceId = carrySource?.id ?? null;
    const shouldCarry = Boolean(isCreate && carryUnbid && carrySourceId && data);

    setEditingId(null);
    setForm(emptyPeriodForm);
    setCarryUnbid(false);
    setCarrySource(null);
    setCarryUnbidCount(0);
    setRightPanel("items");
    setMobileView("detail");
    await loadPeriods();
    if (data) setSelectedId(data.id);

    if (shouldCarry && data && carrySourceId) {
      try {
        const result = await carryUnbidItemsToPeriod({
          companyId,
          targetPeriodId: data.id,
          sourcePeriodId: carrySourceId,
        });
        if (result && result.carried > 0) {
          toast.success(
            `${result.carried} barang belum di-bid dari ${result.sourcePeriodCode} dibawa ke periode baru`
          );
          await loadPeriods();
        } else if (result && result.failed > 0) {
          toast.error(`Gagal membawa ${result.failed} barang ke periode baru`);
        }
      } catch {
        toast.error("Periode dibuat, tetapi gagal membawa barang belum di-bid");
      }
    }

    if (becameFinished && data) {
      try {
        const response = await fetch("/api/admin/send-winner-emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodId: data.id }),
        });
        const result = await response.json();
        if (!response.ok) {
          toast.error(result.error ?? "Gagal mengirim email pemenang otomatis");
        } else if (!result.alreadySent) {
          toast.success(`Email pemenang dikirim ke ${result.sent} orang`);
          await loadPeriods();
        }
      } catch {
        toast.error("Periode ditutup, tetapi gagal mengirim email otomatis");
      }
    }
  }

  function requestDeletePeriod(period: AuctionPeriod) {
    const itemCount = itemCountByPeriod[period.id] ?? 0;
    if (itemCount > 0) {
      toast.error("Periode masih memiliki barang. Hapus semua barang terlebih dahulu.");
      return;
    }
    setDeletePeriodTarget(period);
  }

  async function confirmDeletePeriod() {
    if (!deletePeriodTarget) return;

    const deletedId = deletePeriodTarget.id;
    setDeletingPeriod(true);

    const res = await apiFetch(`/api/catalog/periods/${deletedId}`, {
      method: "DELETE",
      token: getClientToken(),
    });

    setDeletingPeriod(false);
    setDeletePeriodTarget(null);

    if (!res.ok) {
      toast.error(res.error ?? "Gagal menghapus periode");
      return;
    }

    toast.success("Periode dihapus");

    if (selectedId === deletedId) {
      setSelectedId(null);
      setRightPanel("items");
      setMobileView("list");
    }

    await loadPeriods();
  }

  const periodFormContent = (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 lg:hidden"
          onClick={cancelPeriodForm}
          aria-label="Kembali"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden h-8 w-8 p-0 lg:inline-flex"
          onClick={cancelPeriodForm}
          aria-label="Kembali"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-slate-900">
          {editingId ? "Edit Periode" : "Tambah Periode"}
        </h2>
      </div>
      <Card>
        <CardContent className="pt-6">
          <PeriodFormFields
            form={form}
            setForm={setForm}
            loading={loading}
            onSubmit={handlePeriodSubmit}
            onCancel={cancelPeriodForm}
            isCreate={!editingId}
            carryUnbid={carryUnbid}
            setCarryUnbid={setCarryUnbid}
            carrySourceLabel={carrySource?.code ?? null}
            carryUnbidCount={carryUnbidCount}
          />
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="flex flex-col lg:min-h-0 lg:flex-1">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Periode Lelang</h1>
          <p className="text-sm text-slate-500">Kelola periode dan barang lelang</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="w-full shrink-0 whitespace-nowrap sm:w-auto"
          onClick={startAddPeriod}
        >
          <Plus className="h-4 w-4" />
          Tambah Periode
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
        {/* Master: period list */}
        <div
          className={cn(
            "flex flex-col rounded-2xl border border-[var(--border)] bg-white lg:w-80 lg:shrink-0 lg:overflow-hidden",
            mobileView === "detail" ? "hidden lg:flex" : "flex",
            "lg:min-h-[480px]"
          )}
        >
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Daftar Periode</p>
            <p className="text-xs text-slate-500">{periods.length} periode</p>
          </div>
          <div className="p-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {periods.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Calendar className="h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">Belum ada periode</p>
              </div>
            ) : (
              periods.map((period) => (
                <div
                  key={period.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectPeriod(period.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") selectPeriod(period.id);
                  }}
                  className={cn(
                    "mb-1 flex w-full cursor-pointer items-start justify-between gap-2 rounded-xl p-3 text-left transition-colors",
                    selectedId === period.id && rightPanel === "items"
                      ? "bg-indigo-50 ring-1 ring-indigo-200"
                      : "hover:bg-slate-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[var(--primary)]">
                        {period.code}
                      </span>
                      <Badge status={period.status} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">
                      {period.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(period.start_at)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {(itemCountByPeriod[period.id] ?? 0) === 0
                        ? "Belum ada barang"
                        : `${itemCountByPeriod[period.id]} barang`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label="Edit periode"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditPeriod(period);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0",
                        (itemCountByPeriod[period.id] ?? 0) === 0
                          ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                          : "text-slate-300"
                      )}
                      aria-label="Hapus periode"
                      title={
                        (itemCountByPeriod[period.id] ?? 0) === 0
                          ? "Hapus periode"
                          : "Hapus semua barang terlebih dahulu"
                      }
                      disabled={(itemCountByPeriod[period.id] ?? 0) > 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDeletePeriod(period);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail: desktop */}
        <div className="hidden min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-white lg:flex lg:flex-col lg:min-h-[480px]">
          {rightPanel === "period-form" ? (
            <div className="overflow-y-auto p-4 sm:p-5">{periodFormContent}</div>
          ) : selectedPeriod ? (
            <div className="flex flex-col lg:min-h-0 lg:flex-1">
              <PeriodWinnerEmailBar period={selectedPeriod} onSent={loadPeriods} />
              <PeriodItemsPanel
                key={selectedPeriod.id}
                period={selectedPeriod}
                periodId={selectedPeriod.id}
                onItemsChange={() => loadItemCounts(periods)}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-slate-500">
              Pilih periode untuk melihat barang
            </div>
          )}
        </div>

        {/* Detail: mobile */}
        <div
          className={cn(
            "rounded-2xl border border-[var(--border)] bg-white lg:hidden",
            mobileView === "list" && "hidden"
          )}
        >
          {mobileView === "detail" && rightPanel === "period-form" ? (
            <div className="p-4">{periodFormContent}</div>
          ) : mobileView === "detail" && selectedPeriod ? (
            <div>
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={backToList}
                  aria-label="Kembali ke daftar"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {selectedPeriod.title}
                  </p>
                  <p className="font-mono text-xs text-[var(--primary)]">
                    {selectedPeriod.code}
                  </p>
                </div>
              </div>
              <PeriodWinnerEmailBar period={selectedPeriod} onSent={loadPeriods} />
              <PeriodItemsPanel
                key={selectedPeriod.id}
                period={selectedPeriod}
                periodId={selectedPeriod.id}
                onItemsChange={() => loadItemCounts(periods)}
              />
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={deletePeriodTarget !== null}
        title="Hapus Periode"
        message={
          deletePeriodTarget
            ? `Yakin ingin menghapus periode "${deletePeriodTarget.code} — ${deletePeriodTarget.title}"? Tindakan ini tidak dapat dibatalkan.`
            : ""
        }
        confirmLabel="Hapus"
        loading={deletingPeriod}
        onConfirm={confirmDeletePeriod}
        onCancel={() => !deletingPeriod && setDeletePeriodTarget(null)}
      />
    </div>
  );
}
