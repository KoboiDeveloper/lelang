"use client";

import { useEffect, useState } from "react";
import { apiFetch, getClientToken } from "@/lib/api-client";
import { BidderProfile } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BidderBidsPanel } from "@/components/admin/bidder-bids-panel";
import { useAdminCompanyId } from "@/components/admin/admin-company-context";
import { fetchCompanyBiddersWithBids } from "@/lib/admin-bidders";
import { toast } from "sonner";
import { Plus, Users, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const emptyForm = {
  employee_nik: "",
  ktp: "",
  full_name: "",
  public_alias: "",
  is_active: true,
};

type RightPanel = "bids" | "bidder-form";
type MobileView = "list" | "detail";

function BidderFormFields({
  form,
  setForm,
  loading,
  onSubmit,
  onCancel,
}: {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>NIK Karyawan</Label>
        <Input
          value={form.employee_nik}
          onChange={(e) => setForm({ ...form, employee_nik: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>NIK KTP</Label>
        <Input
          type="password"
          value={form.ktp}
          onChange={(e) => setForm({ ...form, ktp: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Nama Lengkap</Label>
        <Input
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Alias Publik</Label>
        <Input
          value={form.public_alias}
          onChange={(e) => setForm({ ...form, public_alias: e.target.value })}
          placeholder="Bidder A"
          required
        />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          id="is_active"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          className="rounded"
        />
        <Label htmlFor="is_active">Aktif</Label>
      </div>
      <div className="flex gap-2 sm:col-span-2">
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

export default function BiddersMasterDetailPage() {
  const [bidders, setBidders] = useState<BidderProfile[]>([]);
  const [bidCountByBidder, setBidCountByBidder] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [rightPanel, setRightPanel] = useState<RightPanel>("bids");
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [loading, setLoading] = useState(false);
  const companyId = useAdminCompanyId();

  const selectedBidder = bidders.find((bidder) => bidder.id === selectedId) ?? null;

  async function loadBidders() {
    try {
      const { bidders: list, bidCounts } =
        await fetchCompanyBiddersWithBids(companyId);

      setBidders(list);
      setBidCountByBidder(bidCounts);

      setSelectedId((current) => {
        if (current && list.some((bidder) => bidder.id === current)) {
          return current;
        }
        return list[0]?.id ?? null;
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat daftar bidder"
      );
      setBidders([]);
      setBidCountByBidder({});
      setSelectedId(null);
    }
  }

  useEffect(() => {
    loadBidders();
  }, [companyId]);

  function startAddBidder() {
    setForm(emptyForm);
    setRightPanel("bidder-form");
    setMobileView("detail");
  }

  function cancelBidderForm() {
    setForm(emptyForm);
    setRightPanel("bids");
    setMobileView(selectedId ? "detail" : "list");
  }

  function selectBidder(id: string) {
    setSelectedId(id);
    setRightPanel("bids");
    setMobileView("detail");
  }

  function backToList() {
    setMobileView("list");
    setRightPanel("bids");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await apiFetch("/api/admin/bidders", {
      method: "POST",
      token: getClientToken(),
      body: {
        employee_nik: form.employee_nik.trim(),
        ktp: form.ktp.trim(),
        full_name: form.full_name.trim(),
        public_alias: form.public_alias.trim(),
        is_active: form.is_active,
        company_id: companyId,
      },
    });

    setLoading(false);

    if (!res.ok) {
      toast.error(res.error ?? "Gagal menyimpan bidder");
      return;
    }

    toast.success("Bidder berhasil disimpan");
    setForm(emptyForm);
    setRightPanel("bids");
    setMobileView("detail");
    await loadBidders();
  }

  const bidderFormContent = (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={cancelBidderForm}
          aria-label="Kembali"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-slate-900">Tambah Bidder</h2>
      </div>
      <Card>
        <CardContent className="pt-6">
          <BidderFormFields
            form={form}
            setForm={setForm}
            loading={loading}
            onSubmit={handleSubmit}
            onCancel={cancelBidderForm}
          />
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="flex flex-col lg:min-h-0 lg:flex-1">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Bidder</h1>
          <p className="text-sm text-slate-500">Kelola peserta lelang yang pernah mengajukan penawaran pada barang perusahaan ini</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="w-full shrink-0 whitespace-nowrap sm:w-auto"
          onClick={startAddBidder}
        >
          <Plus className="h-4 w-4" />
          Tambah Bidder
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
        <div
          className={cn(
            "flex flex-col rounded-2xl border border-[var(--border)] bg-white lg:w-80 lg:shrink-0 lg:overflow-hidden",
            mobileView === "detail" ? "hidden lg:flex" : "flex",
            "lg:min-h-[480px]"
          )}
        >
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Daftar Bidder</p>
            <p className="text-xs text-slate-500">{bidders.length} bidder</p>
          </div>
          <div className="p-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {bidders.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Users className="h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">
                  Belum ada bidder yang mengajukan penawaran pada barang perusahaan ini
                </p>
              </div>
            ) : (
              bidders.map((bidder) => (
                <div
                  key={bidder.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectBidder(bidder.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") selectBidder(bidder.id);
                  }}
                  className={cn(
                    "mb-1 w-full cursor-pointer rounded-xl p-3 text-left transition-colors",
                    selectedId === bidder.id && rightPanel === "bids"
                      ? "bg-indigo-50 ring-1 ring-indigo-200"
                      : "hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--primary)]">
                      {bidder.employee_nik}
                    </span>
                    <Badge status={bidder.is_active ? "active" : "cancelled"} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">
                    {bidder.full_name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Alias: {bidder.public_alias}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {(bidCountByBidder[bidder.id] ?? 0) === 0
                      ? "Belum ada penawaran"
                      : `${bidCountByBidder[bidder.id]} penawaran`}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="hidden min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-white lg:flex lg:flex-col lg:min-h-[480px]">
          {rightPanel === "bidder-form" ? (
            <div className="overflow-y-auto p-4 sm:p-5">{bidderFormContent}</div>
          ) : selectedBidder ? (
            <div className="flex flex-col lg:min-h-0 lg:flex-1">
              <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
                <p className="font-semibold text-slate-900">{selectedBidder.full_name}</p>
                <p className="text-sm text-slate-500">
                  {selectedBidder.employee_nik} &bull; {selectedBidder.public_alias}
                </p>
              </div>
              <BidderBidsPanel
                key={selectedBidder.id}
                bidderId={selectedBidder.id}
                companyId={companyId}
                onBidsChange={() => loadBidders()}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-slate-500">
              Pilih bidder untuk melihat penawaran
            </div>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl border border-[var(--border)] bg-white lg:hidden",
            mobileView === "list" && "hidden"
          )}
        >
          {mobileView === "detail" && rightPanel === "bidder-form" ? (
            <div className="p-4">{bidderFormContent}</div>
          ) : mobileView === "detail" && selectedBidder ? (
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
                    {selectedBidder.full_name}
                  </p>
                  <p className="font-mono text-xs text-[var(--primary)]">
                    {selectedBidder.employee_nik}
                  </p>
                </div>
              </div>
              <BidderBidsPanel
                key={selectedBidder.id}
                bidderId={selectedBidder.id}
                companyId={companyId}
                onBidsChange={() => loadBidders()}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
