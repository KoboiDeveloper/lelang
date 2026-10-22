"use client";

import { useEffect, useMemo, useState } from "react";
import { PhotoImage } from "@/components/photo-image";
import { apiFetch, getClientToken } from "@/lib/api-client";
import { getStoredUser } from "@/lib/session";
import { PeriodExportButton } from "@/components/admin/period-export-button";
import { AuctionItem, AuctionPeriod, ItemPhoto } from "@/lib/database.types";
import { formatRupiah, formatNumberId, parseRupiahInput, getPhotoUrl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Upload, Package, X, Trash2, ImageOff, Search, Copy } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { PhotoSourcePicker } from "@/components/admin/photo-source-picker";
import { ImagePreviewDialog } from "@/components/image-preview-dialog";
import { compressImageFile } from "@/lib/image-compress";
import { canEditPricing } from "@/lib/roles";
import { getBidIncrementByStartingPrice } from "@/lib/bid-increment";
import { nextDuplicateItemName } from "@/lib/item-duplicate";
import { fetchItemCategories } from "@/lib/item-categories";
import type { ItemCategory } from "@/lib/database.types";
import { CategoryFilter } from "@/components/category-filter";

type ItemsPageResponse = {
  items: { item: AuctionItem; photos: ItemPhoto[]; bidCount: number }[];
  total: number;
};

type BidFilterKey = "all" | "no_bids" | "has_bids";

const MAX_PHOTOS = 5;
const ITEMS_PAGE_SIZE = 20;

const BID_FILTER_OPTIONS: { value: BidFilterKey; label: string }[] = [
  { value: "all", label: "Semua bid" },
  { value: "no_bids", label: "Belum di-bid" },
  { value: "has_bids", label: "Sudah di-bid" },
];

type ItemSortKey =
  | "lot"
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc"
  | "paid_first"
  | "unpaid_first";

const ITEM_SORT_OPTIONS: { value: ItemSortKey; label: string }[] = [
  { value: "lot", label: "No. Lot" },
  { value: "name_asc", label: "Nama A–Z" },
  { value: "name_desc", label: "Nama Z–A" },
  { value: "price_asc", label: "Harga terendah" },
  { value: "price_desc", label: "Harga tertinggi" },
  { value: "paid_first", label: "Sudah dibayar" },
  { value: "unpaid_first", label: "Belum dibayar" },
];

function compareLotNumber(a: string, b: string): number {
  const numA = Number(a.match(/(\d+)\s*$/)?.[1] ?? Number.MAX_SAFE_INTEGER);
  const numB = Number(b.match(/(\d+)\s*$/)?.[1] ?? Number.MAX_SAFE_INTEGER);
  if (numA !== numB) return numA - numB;
  return a.localeCompare(b, "id");
}

function sortAuctionItems(items: AuctionItem[], sortKey: ItemSortKey): AuctionItem[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "name_asc":
        return a.item_name.localeCompare(b.item_name, "id", { sensitivity: "base" });
      case "name_desc":
        return b.item_name.localeCompare(a.item_name, "id", { sensitivity: "base" });
      case "price_asc":
        return a.starting_price - b.starting_price || compareLotNumber(a.lot_number, b.lot_number);
      case "price_desc":
        return b.starting_price - a.starting_price || compareLotNumber(a.lot_number, b.lot_number);
      case "paid_first": {
        const paidA = a.payment_confirmed ? 0 : 1;
        const paidB = b.payment_confirmed ? 0 : 1;
        return paidA - paidB || compareLotNumber(a.lot_number, b.lot_number);
      }
      case "unpaid_first": {
        const unpaidA = a.payment_confirmed ? 1 : 0;
        const unpaidB = b.payment_confirmed ? 1 : 0;
        return unpaidA - unpaidB || compareLotNumber(a.lot_number, b.lot_number);
      }
      case "lot":
      default:
        return compareLotNumber(a.lot_number, b.lot_number);
    }
  });
  return sorted;
}

const emptyItemForm = {
  lot_number: "",
  item_name: "",
  category: "",
  description: "",
  item_condition: "",
  starting_price: "0",
  bid_increment: String(getBidIncrementByStartingPrice(0)),
  status: "draft",
  payment_confirmed: false,
};

function formatLotNumber(n: number): string {
  return `LOT ${String(n).padStart(3, "0")}`;
}

function getNextLotNumber(items: AuctionItem[]): string {
  let max = 0;
  for (const item of items) {
    const match = item.lot_number.match(/(\d+)\s*$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return formatLotNumber(max + 1);
}

const LOCKED_STATUSES = ["sold", "unsold", "cancelled"];

type ItemFormData = typeof emptyItemForm;

function RupiahInput({
  value,
  onChange,
  onBlurAlign,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlurAlign?: (parsed: number) => number;
  required?: boolean;
}) {
  const [display, setDisplay] = useState(() =>
    formatNumberId(parseRupiahInput(value || "0"))
  );

  useEffect(() => {
    setDisplay(formatNumberId(parseRupiahInput(value || "0")));
  }, [value]);

  function handleChange(raw: string) {
    setDisplay(raw);
    onChange(String(parseRupiahInput(raw)));
  }

  function handleBlur() {
    let parsed = parseRupiahInput(display);
    if (onBlurAlign) parsed = onBlurAlign(parsed);
    onChange(String(parsed));
    setDisplay(formatNumberId(parsed));
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
        Rp
      </span>
      <Input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className="pl-9 text-right tabular-nums"
        placeholder="0"
        required={required}
      />
    </div>
  );
}

function RupiahReadOnly({ value }: { value: string }) {
  return (
    <div className="flex h-9 items-center justify-end rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm tabular-nums text-slate-600">
      {formatRupiah(Number(value) || 0)}
    </div>
  );
}

function CategoryBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-600/20">
      {name}
    </span>
  );
}

function ItemForm({
  form,
  setForm,
  photos,
  editingId,
  currentPrice,
  loading,
  uploading,
  onSubmit,
  onCancel,
  onPhotoUpload,
  onPhotoDelete,
  title,
  isNew,
  canEditPricing,
  categories,
}: {
  form: ItemFormData;
  setForm: React.Dispatch<React.SetStateAction<ItemFormData>>;
  photos: ItemPhoto[];
  editingId: string | null;
  currentPrice?: number;
  loading: boolean;
  uploading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onPhotoUpload: (file: File) => void;
  onPhotoDelete: (photo: ItemPhoto) => void;
  title: string;
  isNew?: boolean;
  canEditPricing: boolean;
  categories: ItemCategory[];
}) {
  const isActive = form.status === "active";
  const statusLocked = LOCKED_STATUSES.includes(form.status);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-xl sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          onClick={onCancel}
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 sm:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <p className="text-xs text-slate-500">No. Lot</p>
              <p className="font-mono text-sm font-semibold text-[var(--primary)]">
                {form.lot_number || "—"}
              </p>
              {isNew && (
                <p className="text-[11px] text-slate-400">Otomatis berurutan</p>
              )}
            </div>
            {form.category && <CategoryBadge name={form.category} />}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {statusLocked ? (
              <Badge status={form.status} />
            ) : (
              <div className="flex items-center gap-2.5">
                <Label htmlFor="item-active" className="text-sm text-slate-600">
                  Aktif
                </Label>
                <Switch
                  id="item-active"
                  checked={isActive}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, status: checked ? "active" : "draft" })
                  }
                />
              </div>
            )}
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-2.5">
                <Label htmlFor="item-paid" className="text-sm text-slate-600">
                  Konfirmasi Bayar
                </Label>
                <Switch
                  id="item-paid"
                  checked={form.payment_confirmed}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, payment_confirmed: checked })
                  }
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Tandai jika pemenang sudah bayar
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Nama Barang</Label>
          <Input
            value={form.item_name}
            onChange={(e) => setForm({ ...form, item_name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Kategori</Label>
          <Select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          >
            <option value="">Pilih kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Kondisi</Label>
          <Input
            value={form.item_condition}
            onChange={(e) => setForm({ ...form, item_condition: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Deskripsi</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Harga Awal</Label>
          {canEditPricing ? (
            <RupiahInput
              value={form.starting_price}
              onChange={(v) =>
                setForm({
                  ...form,
                  starting_price: v,
                  bid_increment: String(
                    getBidIncrementByStartingPrice(Number(v) || 0)
                  ),
                })
              }
              onBlurAlign={(n) => Math.max(0, n)}
              required
            />
          ) : (
            <>
              <RupiahReadOnly value={form.starting_price} />
              <p className="text-xs text-slate-500">Hanya Akunting yang dapat mengubah</p>
            </>
          )}
        </div>
        {editingId && currentPrice !== undefined && currentPrice > Number(form.starting_price) && (
          <div className="space-y-1.5">
            <Label>Harga Terkini</Label>
            <RupiahReadOnly value={String(currentPrice)} />
            <p className="text-xs text-slate-500">
              Diperbarui otomatis dari penawaran bidder
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Kelipatan Bid</Label>
          {canEditPricing ? (
            <>
              <RupiahInput
                value={form.bid_increment}
                onChange={(v) => setForm({ ...form, bid_increment: v })}
                onBlurAlign={(n) => {
                  const allowed = [3000, 5000, 10000];
                  return allowed.reduce((best, cur) =>
                    Math.abs(cur - n) < Math.abs(best - n) ? cur : best
                  );
                }}
                required
              />
              <p className="text-xs text-slate-500">
                Saran otomatis: ≤50rb=3rb · ≤150rb=5rb · &gt;150rb=10rb
              </p>
            </>
          ) : (
            <>
              <RupiahReadOnly value={form.bid_increment} />
              <p className="text-xs text-slate-500">Hanya Akunting yang dapat mengubah</p>
            </>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label>
              Foto ({photos.length}/{MAX_PHOTOS})
            </Label>
            {!editingId && (
              <span className="text-xs text-slate-500">Simpan dulu untuk upload foto</span>
            )}
          </div>

          {editingId ? (
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, photoIndex) => (
                <div
                  key={photo.id}
                  className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--border)]"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(photoIndex)}
                    className="relative h-full w-full cursor-zoom-in"
                    aria-label={`Preview foto ${photoIndex + 1}`}
                  >
                    <PhotoImage
                      src={getPhotoUrl(photo.storage_path)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPhotoDelete(photo)}
                    className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
                    aria-label="Hapus foto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <PhotoSourcePicker
                  uploading={uploading}
                  onSelect={onPhotoUpload}
                />
              )}
            </div>
          ) : (
            <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white text-xs text-slate-400">
              <Upload className="mr-1.5 h-4 w-4" />
              Maks. {MAX_PHOTOS} foto setelah disimpan
            </div>
          )}
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

      {previewIndex !== null && (
        <ImagePreviewDialog
          images={photos}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
          alt={form.item_name || "Barang lelang"}
        />
      )}
    </div>
  );
}

function ItemRow({
  item,
  thumbnailPath,
  bidCount = 0,
  onEdit,
  onDuplicate,
  onDelete,
  duplicating,
}: {
  item: AuctionItem;
  thumbnailPath?: string | null;
  bidCount?: number;
  onEdit: (item: AuctionItem) => void;
  onDuplicate: (item: AuctionItem) => void;
  onDelete: (item: AuctionItem) => void;
  duplicating?: boolean;
}) {
  const hasBids = bidCount > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(item);
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 sm:gap-4 sm:p-4"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-slate-100 sm:h-16 sm:w-16">
        {thumbnailPath ? (
          <PhotoImage
            src={getPhotoUrl(thumbnailPath)}
            alt={item.item_name}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-slate-400">
            <ImageOff className="h-5 w-5" aria-hidden />
            <span className="text-[9px] font-medium leading-none">No image</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[var(--primary)]">
            {item.lot_number}
          </span>
          {item.category && <CategoryBadge name={item.category} />}
          {item.payment_confirmed && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
              Lunas
            </span>
          )}
          {!hasBids ? (
            <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-600/20">
              Belum bid
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-600/20">
              {bidCount} bid
            </span>
          )}
        </div>
        <h3 className="mt-1 truncate font-medium text-slate-900">{item.item_name}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
          <p className="text-slate-500">
            <span className="text-slate-400">Harga awal: </span>
            {formatRupiah(item.starting_price)}
          </p>
          {hasBids && (
            <p className="font-medium text-emerald-700">
              <span className="font-normal text-slate-400">Terkini: </span>
              {formatRupiah(item.current_price)}
            </p>
          )}
        </div>
      </div>
      <div className="ml-3 flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(item);
          }}
          aria-label="Edit barang"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate(item);
          }}
          disabled={duplicating}
          aria-label="Duplikasi barang"
          title="Duplikasi barang"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item);
          }}
          aria-label="Hapus barang"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function PeriodItemsPanel({
  period,
  periodId,
  onItemsChange,
}: {
  period: AuctionPeriod;
  periodId: string;
  onItemsChange?: () => void;
}) {
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [itemThumbnails, setItemThumbnails] = useState<Record<string, string>>({});
  const [bidCountByItem, setBidCountByItem] = useState<Record<string, number>>({});
  const [photos, setPhotos] = useState<ItemPhoto[]>([]);
  const [form, setForm] = useState(emptyItemForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCurrentPrice, setEditingCurrentPrice] = useState<number | undefined>();
  const [addingNew, setAddingNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AuctionItem | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<ItemSortKey>("lot");
  const [bidFilter, setBidFilter] = useState<BidFilterKey>("all");

  const canEditPricingRole = canEditPricing(userRole);
  const isFormOpen = addingNew || editingId !== null;

  async function loadItems() {
    const res = await apiFetch<ItemsPageResponse>(
      `/api/items?period_id=${encodeURIComponent(periodId)}&offset=0&limit=1000`,
      { method: "GET", token: getClientToken() }
    );
    const rows = res.data?.items ?? [];
    const nextItems = rows.map((row) => row.item);
    const thumbnails: Record<string, string> = {};
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.item.id] = row.bidCount ?? 0;
      const first = row.photos?.[0];
      if (first?.storage_path) {
        thumbnails[row.item.id] = first.storage_path;
      }
    }
    setItems(nextItems);
    setItemThumbnails(thumbnails);
    setBidCountByItem(counts);
  }

  async function refreshItemThumbnail(itemId: string) {
    const res = await apiFetch<{ photos: ItemPhoto[] }>(`/api/items/${itemId}`, {
      method: "GET",
      token: getClientToken(),
    });
    const path = res.data?.photos?.[0]?.storage_path;

    setItemThumbnails((prev) => {
      const next = { ...prev };
      if (path) {
        next[itemId] = path;
      } else {
        delete next[itemId];
      }
      return next;
    });
  }

  async function loadPhotos(itemId: string) {
    const res = await apiFetch<{ photos: ItemPhoto[] }>(`/api/items/${itemId}`, {
      method: "GET",
      token: getClientToken(),
    });
    setPhotos(res.data?.photos ?? []);
  }

  useEffect(() => {
    loadItems();
    setAddingNew(false);
    setEditingId(null);
    setEditingCurrentPrice(undefined);
    setPhotos([]);
    setActiveCategory("all");
    setSearchQuery("");
    setSortKey("lot");
    setBidFilter("all");
    setPage(1);
  }, [periodId]);

  useEffect(() => {
    if (!isFormOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFormOpen]);

  useEffect(() => {
    fetchItemCategories()
      .then(setCategories)
      .catch(() => toast.error("Gagal memuat master kategori"));
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    setUserRole(stored?.role ?? null);
  }, []);

  useEffect(() => {
    if (editingId) {
      loadPhotos(editingId);
    } else if (!addingNew) {
      setPhotos([]);
    }
  }, [editingId, addingNew]);

  function startEdit(item: AuctionItem) {
    setAddingNew(false);
    setEditingId(item.id);
    setEditingCurrentPrice(item.current_price);
    setForm({
      lot_number: item.lot_number,
      item_name: item.item_name,
      category: item.category ?? "",
      description: item.description,
      item_condition: item.item_condition ?? "",
      starting_price: String(item.starting_price),
      bid_increment: String(item.bid_increment),
      status: item.status,
      payment_confirmed: Boolean(item.payment_confirmed),
    });
  }

  async function allocateLotNumber(): Promise<string | null> {
    const res = await apiFetch<{ lot_number: string }>(
      `/api/items/meta/next-lot/${periodId}`,
      { method: "GET", token: getClientToken() }
    );
    if (!res.ok || !res.data?.lot_number) {
      toast.error(res.error ?? "Gagal mengambil nomor lot");
      return null;
    }
    return res.data.lot_number;
  }

  async function startAdd() {
    setEditingId(null);
    setEditingCurrentPrice(undefined);
    setPhotos([]);

    const lotNumber = (await allocateLotNumber()) ?? getNextLotNumber(items);
    setForm({
      ...emptyItemForm,
      lot_number: lotNumber,
    });
    setAddingNew(true);
  }

  function cancelForm() {
    setAddingNew(false);
    setEditingId(null);
    setEditingCurrentPrice(undefined);
    setForm(emptyItemForm);
    setPhotos([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const startingPrice = Number(form.starting_price);
    const bidIncrement = Number(form.bid_increment) || getBidIncrementByStartingPrice(startingPrice);

    const basePayload: {
      item_name: string;
      category: string | null;
      description: string;
      item_condition: string | null;
      status: string;
      payment_confirmed: boolean;
      payment_confirmed_at: string | null;
      starting_price?: number;
      bid_increment?: number;
    } = {
      item_name: form.item_name.trim(),
      category: form.category.trim() || null,
      description: form.description.trim(),
      item_condition: form.item_condition.trim() || null,
      status: form.status,
      payment_confirmed: form.payment_confirmed,
      payment_confirmed_at: form.payment_confirmed
        ? new Date().toISOString()
        : null,
    };

    if (canEditPricingRole) {
      basePayload.starting_price = startingPrice;
      basePayload.bid_increment = bidIncrement;
    }

    if (editingId) {
      const existing = items.find((item) => item.id === editingId);
      basePayload.payment_confirmed_at = form.payment_confirmed
        ? existing?.payment_confirmed && existing.payment_confirmed_at
          ? existing.payment_confirmed_at
          : new Date().toISOString()
        : null;

      const res = await apiFetch<{ item: AuctionItem }>(
        `/api/items/${editingId}`,
        {
          method: "PATCH",
          token: getClientToken(),
          body: basePayload,
        }
      );
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error ?? "Gagal memperbarui barang");
        return;
      }
      toast.success("Barang diperbarui");
      await loadItems();
      cancelForm();
    } else {
      const res = await apiFetch<{ item: AuctionItem }>("/api/items", {
        method: "POST",
        token: getClientToken(),
        body: {
          period_id: periodId,
          item_name: form.item_name.trim(),
          category: form.category.trim() || null,
          description: form.description.trim(),
          item_condition: form.item_condition.trim() || null,
          status: form.status,
          starting_price: canEditPricingRole ? startingPrice : 0,
          bid_increment: canEditPricingRole ? bidIncrement : 1000,
        },
      });
      setLoading(false);
      if (!res.ok || !res.data?.item) {
        const message = res.error?.includes("lot")
          ? "Nomor lot bentrok, coba simpan lagi"
          : res.error ?? "Gagal menambah barang";
        toast.error(message);
        return;
      }

      let data = res.data.item;

      if (form.payment_confirmed) {
        const payRes = await apiFetch<{ item: AuctionItem }>(
          `/api/items/${data.id}`,
          {
            method: "PATCH",
            token: getClientToken(),
            body: {
              payment_confirmed: true,
              payment_confirmed_at: new Date().toISOString(),
            },
          }
        );
        if (payRes.data?.item) data = payRes.data.item;
        else data = { ...data, payment_confirmed: true };
      }
      toast.success(
        `Barang ${data.lot_number} ditambahkan — tambahkan foto (maks. 5)`
      );
      await loadItems();
      onItemsChange?.();
      setAddingNew(false);
      setEditingId(data.id);
      setForm((prev) => ({ ...prev, lot_number: data.lot_number }));
      setPhotos([]);
    }
  }

  async function handlePhotoUpload(file: File) {
    if (!editingId) {
      toast.error("Simpan barang terlebih dahulu");
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      toast.error(`Maksimal ${MAX_PHOTOS} foto`);
      return;
    }

    setUploading(true);

    let uploadFile: File;
    try {
      uploadFile = await compressImageFile(file);
    } catch (error) {
      setUploading(false);
      toast.error(error instanceof Error ? error.message : "Gagal mengompres foto");
      return;
    }

    const token = getClientToken();
    if (!token) {
      setUploading(false);
      toast.error("Sesi berakhir. Silakan login ulang.");
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile, uploadFile.name || "photo.jpg");
    formData.append("item_id", editingId);
    formData.append("sort_order", String(photos.length + 1));

    const res = await apiFetch("/api/files/upload", {
      method: "POST",
      token,
      formData,
    });

    setUploading(false);

    if (!res.ok) {
      toast.error(res.error ?? "Gagal upload foto");
      return;
    }

    toast.success("Foto berhasil diupload");
    await loadPhotos(editingId);
    await refreshItemThumbnail(editingId);
  }

  async function handlePhotoDelete(photo: ItemPhoto) {
    if (!editingId) return;

    const token = getClientToken();
    if (!token) {
      toast.error("Sesi berakhir. Silakan login ulang.");
      return;
    }

    const res = await apiFetch("/api/files", {
      method: "DELETE",
      token,
      body: { path: photo.storage_path, photo_id: photo.id },
    });

    if (!res.ok) {
      toast.error(res.error ?? "Gagal menghapus foto");
      return;
    }

    toast.success("Foto dihapus");
    await loadPhotos(editingId);
    await refreshItemThumbnail(editingId);
  }

  function requestDeleteItem(item: AuctionItem) {
    setDeleteTarget(item);
  }

  async function handleDuplicateItem(item: AuctionItem) {
    if (duplicatingId) return;
    setDuplicatingId(item.id);

    try {
      const createRes = await apiFetch<{ item: AuctionItem }>("/api/items", {
        method: "POST",
        token: getClientToken(),
        body: {
          period_id: periodId,
          item_name: nextDuplicateItemName(item.item_name),
          category: item.category,
          description: item.description,
          item_condition: item.item_condition,
          status: "draft",
          starting_price: item.starting_price,
          bid_increment: item.bid_increment,
        },
      });

      if (!createRes.ok || !createRes.data?.item) {
        toast.error(createRes.error ?? "Gagal menduplikasi barang");
        return;
      }

      const created = createRes.data.item;
      const sourceRes = await apiFetch<{ photos: ItemPhoto[] }>(
        `/api/items/${item.id}`,
        { method: "GET", token: getClientToken() }
      );
      const token = getClientToken();

      for (const photo of sourceRes.data?.photos ?? []) {
        try {
          const response = await fetch(getPhotoUrl(photo.storage_path));
          if (!response.ok || !token) continue;
          const blob = await response.blob();
          const formData = new FormData();
          formData.append(
            "file",
            new File([blob], `photo-${photo.sort_order}.jpg`, {
              type: blob.type || "image/jpeg",
            })
          );
          formData.append("item_id", created.id);
          formData.append("sort_order", String(photo.sort_order));
          await apiFetch("/api/files/upload", {
            method: "POST",
            token,
            formData,
          });
        } catch {
          // Skip photo copy failures; item itself already created.
        }
      }

      toast.success(`Duplikat dibuat: ${created.lot_number} — ${created.item_name}`);
      await loadItems();
      onItemsChange?.();
      startEdit(created);
    } finally {
      setDuplicatingId(null);
    }
  }

  async function confirmDeleteItem() {
    if (!deleteTarget) return;

    setDeleting(true);

    const detail = await apiFetch<{ photos: ItemPhoto[] }>(
      `/api/items/${deleteTarget.id}`,
      { method: "GET", token: getClientToken() }
    );
    const token = getClientToken();
    for (const photo of detail.data?.photos ?? []) {
      if (!token) break;
      await apiFetch("/api/files", {
        method: "DELETE",
        token,
        body: { path: photo.storage_path, photo_id: photo.id },
      });
    }

    const res = await apiFetch(`/api/items/${deleteTarget.id}`, {
      method: "DELETE",
      token: getClientToken(),
    });

    setDeleting(false);
    setDeleteTarget(null);

    if (!res.ok) {
      toast.error(res.error ?? "Gagal menghapus barang");
      return;
    }

    if (editingId === deleteTarget.id) {
      cancelForm();
    }

    toast.success("Barang dihapus");
    await loadItems();
    onItemsChange?.();
  }

  const categoryFilterOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.category) continue;
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }

    return categories
      .map((category) => ({
        name: category.name,
        count: counts.get(category.name) ?? 0,
      }))
      .filter((category) => category.count > 0);
  }, [items, categories]);

  const unbidCount = useMemo(
    () => items.filter((item) => (bidCountByItem[item.id] ?? 0) === 0).length,
    [items, bidCountByItem]
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) {
        return false;
      }
      const bids = bidCountByItem[item.id] ?? 0;
      if (bidFilter === "no_bids" && bids > 0) return false;
      if (bidFilter === "has_bids" && bids === 0) return false;
      if (!query) return true;
      return item.item_name.toLowerCase().includes(query);
    });
    return sortAuctionItems(filtered, sortKey);
  }, [items, activeCategory, searchQuery, sortKey, bidFilter, bidCountByItem]);

  const exportItemCount = useMemo(() => {
    if (activeCategory === "all") return items.length;
    return items.filter((item) => item.category === activeCategory).length;
  }, [items, activeCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PAGE_SIZE;
    return filteredItems.slice(start, start + ITEMS_PAGE_SIZE);
  }, [filteredItems, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, searchQuery, sortKey, bidFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const formProps = {
    form,
    setForm,
    photos,
    editingId,
    currentPrice: editingCurrentPrice,
    loading,
    uploading,
    onSubmit: handleSubmit,
    onCancel: cancelForm,
    onPhotoUpload: handlePhotoUpload,
    onPhotoDelete: handlePhotoDelete,
    canEditPricing: canEditPricingRole,
    categories,
  };

  return (
    <div className="flex flex-col lg:min-h-0 lg:flex-1">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">Barang Lelang</h2>
            <p className="text-sm text-slate-500">
              {searchQuery.trim() ||
              activeCategory !== "all" ||
              bidFilter !== "all"
                ? `${filteredItems.length} dari ${items.length} lot`
                : `${items.length} lot dalam periode ini`}
              {unbidCount > 0 ? ` · ${unbidCount} belum di-bid` : ""}
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <PeriodExportButton
              period={period}
              itemCount={exportItemCount}
              category={activeCategory}
            />
            <Button
              variant="primary"
              size="sm"
              className="w-full whitespace-nowrap sm:w-auto"
              onClick={startAdd}
            >
              <Plus className="h-4 w-4" />
              Tambah Barang
            </Button>
          </div>
        </div>
        {items.length > 0 && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama barang..."
                  className="h-10 pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select
                value={bidFilter}
                onChange={(e) => setBidFilter(e.target.value as BidFilterKey)}
                className="h-10 w-full sm:w-44"
                aria-label="Filter status bid"
              >
                {BID_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {option.value === "no_bids" ? ` (${unbidCount})` : ""}
                  </option>
                ))}
              </Select>
              <Select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as ItemSortKey)}
                className="h-10 w-full sm:w-52"
                aria-label="Urutkan barang"
              >
                {ITEM_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Urut: {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <CategoryFilter
              categories={categoryFilterOptions}
              activeCategory={activeCategory}
              totalItems={items.length}
              onChange={setActiveCategory}
            />
          </>
        )}
      </div>

      <div className="flex flex-col p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">Belum ada barang dalam periode ini.</p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4 whitespace-nowrap"
              onClick={startAdd}
            >
              <Plus className="h-4 w-4" />
              Tambah Barang
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              {searchQuery.trim()
                ? `Tidak ada barang dengan nama "${searchQuery.trim()}".`
                : bidFilter === "no_bids"
                  ? "Semua barang sudah memiliki bid."
                  : bidFilter === "has_bids"
                    ? "Belum ada barang yang di-bid."
                    : "Tidak ada barang pada kategori ini."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 whitespace-nowrap"
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
                setBidFilter("all");
              }}
            >
              Tampilkan semua
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {pagedItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  thumbnailPath={itemThumbnails[item.id]}
                  bidCount={bidCountByItem[item.id] ?? 0}
                  onEdit={startEdit}
                  onDuplicate={handleDuplicateItem}
                  onDelete={requestDeleteItem}
                  duplicating={duplicatingId === item.id}
                />
              ))}
            </div>
            <Pagination
              page={currentPage}
              pageSize={ITEMS_PAGE_SIZE}
              total={filteredItems.length}
              onPageChange={setPage}
              className="mt-4"
            />
          </>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
          <button
            type="button"
            aria-label="Tutup form barang"
            className="fixed inset-0 bg-black/40"
            onClick={cancelForm}
          />
          <div className="relative z-10 my-4 w-full max-w-2xl">
            <ItemForm
              {...formProps}
              title={
                addingNew
                  ? "Tambah Barang Baru"
                  : `Edit — ${form.lot_number || "Barang"}`
              }
              isNew={addingNew}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Barang"
        message={
          deleteTarget
            ? `Yakin ingin menghapus "${deleteTarget.lot_number} — ${deleteTarget.item_name}"? Semua penawaran (bid) terkait barang ini juga akan dihapus. Tindakan ini tidak dapat dibatalkan.`
            : ""
        }
        confirmLabel="Hapus"
        loading={deleting}
        onConfirm={confirmDeleteItem}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}
