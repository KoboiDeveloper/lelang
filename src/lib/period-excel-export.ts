import type ExcelJS from "exceljs";
import { apiFetch, getClientToken } from "@/lib/api-client";
import {
  AuctionItem,
  AuctionPeriod,
  ItemPhoto,
} from "@/lib/database.types";
import { formatDateTime, getPhotoUrl } from "@/lib/format";

type WinnerRow = {
  item_id: string;
  lot_number: string;
  item_name: string;
  starting_price: number;
  last_price: number;
  winner_name: string | null;
  winner_alias: string | null;
  photo_path: string | null;
};

type BidExportRow = {
  id: string;
  item_id: string;
  amount: number;
  status: string;
  created_at: string;
  bidder_profiles: {
    full_name: string;
    public_alias: string;
    employee_nik: string;
  } | null;
};

type ItemsPageResponse = {
  items: Array<{
    item: AuctionItem;
    photos: ItemPhoto[];
    bidCount: number;
  }>;
  hasMore: boolean;
  total: number;
};

type CompaniesResponse = {
  companies: Array<{ id: string; short_name: string; name: string }>;
};

type BidsResponse = {
  bids: BidExportRow[];
  total: number;
};

type WinnersResponse = {
  winners: WinnerRow[];
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Aktif",
  ready: "Siap",
  sold: "Terjual",
  unsold: "Tidak Laku",
  cancelled: "Dibatalkan",
  finished: "Selesai",
};

const THUMB_PX = 72;
const MAX_PHOTOS_IN_EXPORT = 5;

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/** Resize image in browser canvas for compact Excel thumbnails. */
async function makeExcelThumbnail(
  buffer: ArrayBuffer
): Promise<{ buffer: ArrayBuffer; extension: "jpeg" | "png" } | null> {
  if (typeof window === "undefined" || typeof createImageBitmap === "undefined") {
    return { buffer, extension: "jpeg" };
  }

  try {
    const blob = new Blob([buffer]);
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, THUMB_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { buffer, extension: "jpeg" };
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const jpegBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82)
    );
    if (!jpegBlob) return { buffer, extension: "jpeg" };
    return { buffer: await jpegBlob.arrayBuffer(), extension: "jpeg" };
  } catch {
    return { buffer, extension: "jpeg" };
  }
}

export type PeriodExcelExportOptions = {
  includeImages?: boolean;
};

export async function fetchPeriodExportData(
  period: AuctionPeriod,
  category: string | null = null,
  _options: PeriodExcelExportOptions = {}
) {
  const token = getClientToken();

  const itemsParams = new URLSearchParams({
    period_id: period.id,
    offset: "0",
    limit: "1000",
  });
  if (category && category !== "all") {
    itemsParams.set("category", category);
  }

  const [itemsRes, companiesRes] = await Promise.all([
    apiFetch<ItemsPageResponse>(`/api/items?${itemsParams.toString()}`, {
      method: "GET",
      token,
    }),
    apiFetch<CompaniesResponse>("/api/catalog/companies", {
      method: "GET",
      token,
    }),
  ]);

  if (!itemsRes.ok) {
    throw new Error(itemsRes.error ?? "Gagal memuat barang periode");
  }

  const rows = itemsRes.data?.items ?? [];
  const periodItems = rows.map((row) => row.item);
  const itemIds = periodItems.map((item) => item.id);

  const company =
    (companiesRes.data?.companies ?? []).find((c) => c.id === period.company_id) ??
    null;

  let bidCounts: Record<string, number> = {};
  let bids: BidExportRow[] = [];
  const photosByItem = new Map<string, string[]>();

  for (const row of rows) {
    bidCounts[row.item.id] = row.bidCount ?? 0;
    const paths = (row.photos ?? [])
      .slice(0, MAX_PHOTOS_IN_EXPORT)
      .map((photo) => photo.storage_path);
    if (paths.length > 0) {
      photosByItem.set(row.item.id, paths);
    }
  }

  if (itemIds.length > 0) {
    const bidsRes = await apiFetch<BidsResponse>(
      `/api/admin/bids?item_ids=${encodeURIComponent(itemIds.join(","))}&limit=500`,
      { method: "GET", token }
    );
    if (!bidsRes.ok) {
      throw new Error(bidsRes.error ?? "Gagal memuat riwayat bid");
    }
    bids = bidsRes.data?.bids ?? [];
    // Prefer actual bid list counts when available
    const counted: Record<string, number> = {};
    for (const bid of bids) {
      counted[bid.item_id] = (counted[bid.item_id] ?? 0) + 1;
    }
    for (const id of itemIds) {
      if (counted[id] != null) {
        bidCounts[id] = counted[id];
      }
    }
  }

  let winners: WinnerRow[] = [];
  if (period.status === "finished" || period.status === "cancelled") {
    const winnersRes = await apiFetch<WinnersResponse>(
      `/api/items/meta/period-winners/${period.id}`,
      { method: "GET", token }
    );
    if (!winnersRes.ok) {
      throw new Error(winnersRes.error ?? "Gagal memuat pemenang");
    }
    winners = (winnersRes.data?.winners ?? []).filter((row) =>
      itemIds.includes(row.item_id)
    );
  }

  const winnerByItem = new Map(winners.map((row) => [row.item_id, row]));
  const itemById = new Map(periodItems.map((item) => [item.id, item]));

  return {
    period,
    company,
    category: category && category !== "all" ? category : null,
    items: periodItems,
    bids,
    bidCounts,
    winnerByItem,
    itemById,
    photosByItem,
  };
}

export async function downloadPeriodExcel(
  period: AuctionPeriod,
  category: string | null = null,
  options: PeriodExcelExportOptions = {}
) {
  const includeImages = options.includeImages !== false;
  const data = await fetchPeriodExportData(period, category, {
    includeImages,
  });
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "E-Lelang";
  workbook.created = new Date();

  const infoSheet = workbook.addWorksheet("Info");
  infoSheet.columns = [{ width: 22 }, { width: 48 }];
  const infoRows: Array<[string, string | number]> = [
    ["LAPORAN BARANG LELANG", ""],
    ["Perusahaan", data.company?.name ?? "-"],
    ["Kode Perusahaan", data.company?.short_name ?? "-"],
    ["Kode Periode", data.period.code],
    ["Judul Periode", data.period.title],
    ["Status Periode", statusLabel(data.period.status)],
    ["Filter Kategori", data.category ?? "Semua"],
    ["Mode Export", includeImages ? "Dengan foto" : "Tanpa foto"],
    ["Deskripsi", data.period.description ?? "-"],
    ["Mulai", formatDateTime(data.period.start_at)],
    ["Selesai", formatDateTime(data.period.end_at)],
    ["Total Barang", data.items.length],
    ["Diekspor", formatDateTime(new Date().toISOString())],
  ];
  for (const [label, value] of infoRows) {
    infoSheet.addRow([label, value]);
  }
  infoSheet.getRow(1).font = { bold: true, size: 14 };

  const itemsSheet = workbook.addWorksheet("Barang Lelang");
  const photoHeaders = includeImages
    ? Array.from({ length: MAX_PHOTOS_IN_EXPORT }, (_, i) => `Foto ${i + 1}`)
    : [];
  itemsSheet.columns = [
    { header: "No", key: "no", width: 6 },
    ...photoHeaders.map((header, index) => ({
      header,
      key: `foto${index + 1}`,
      width: 12,
    })),
    { header: "Lot", key: "lot", width: 12 },
    { header: "Nama Barang", key: "name", width: 28 },
    { header: "Kategori", key: "category", width: 16 },
    { header: "Kondisi", key: "condition", width: 14 },
    { header: "Deskripsi", key: "description", width: 36 },
    { header: "Harga Awal", key: "starting", width: 14 },
    { header: "Kelipatan Bid", key: "increment", width: 14 },
    { header: "Harga Terakhir", key: "current", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Konfirmasi Bayar", key: "paid", width: 14 },
    { header: "Jumlah Bid", key: "bids", width: 10 },
    { header: "Jumlah Foto", key: "photoCount", width: 11 },
    { header: "Pemenang (Alias)", key: "winnerAlias", width: 16 },
    { header: "Nama Pemenang", key: "winnerName", width: 22 },
    { header: "Harga Menang", key: "winPrice", width: 14 },
    { header: "Dibuat", key: "created", width: 20 },
    { header: "Diperbarui", key: "updated", width: 20 },
  ];
  itemsSheet.getRow(1).font = { bold: true };
  itemsSheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
  itemsSheet.views = [{ state: "frozen", ySplit: 1 }];

  for (let index = 0; index < data.items.length; index++) {
    const item = data.items[index];
    const winner = data.winnerByItem.get(item.id);
    const paths = data.photosByItem.get(item.id) ?? [];
    const excelRow = itemsSheet.addRow({
      no: index + 1,
      lot: item.lot_number,
      name: item.item_name,
      category: item.category ?? "-",
      condition: item.item_condition ?? "-",
      description: item.description,
      starting: item.starting_price,
      increment: item.bid_increment,
      current: item.current_price,
      status: statusLabel(item.status),
      paid: item.payment_confirmed ? "Lunas" : "Belum",
      bids: data.bidCounts[item.id] ?? 0,
      photoCount: paths.length,
      winnerAlias: winner?.winner_alias ?? "-",
      winnerName: winner?.winner_name ?? "-",
      winPrice: winner?.last_price ?? item.current_price,
      created: formatDateTime(item.created_at),
      updated: formatDateTime(item.updated_at),
    });
    excelRow.height = includeImages && paths.length > 0 ? 58 : 18;
    excelRow.alignment = { vertical: "middle" };

    if (!includeImages) continue;

    const rowNumber = excelRow.number;
    for (let photoIndex = 0; photoIndex < paths.length; photoIndex++) {
      const raw = await fetchImageBuffer(getPhotoUrl(paths[photoIndex]));
      if (!raw) continue;
      const thumb = await makeExcelThumbnail(raw);
      if (!thumb) continue;

      const imageId = workbook.addImage({
        // exceljs browser build accepts Uint8Array; types expect Node Buffer
        buffer: new Uint8Array(thumb.buffer) as unknown as ExcelJS.Buffer,
        extension: thumb.extension,
      });

      // Col B = index 1 for Foto 1
      const col = 1 + photoIndex;
      itemsSheet.addImage(imageId, {
        tl: { col: col + 0.15, row: rowNumber - 1 + 0.15 },
        ext: { width: THUMB_PX, height: THUMB_PX },
        editAs: "oneCell",
      });
    }
  }

  const bidsSheet = workbook.addWorksheet("Riwayat Bid");
  bidsSheet.columns = [
    { header: "Lot", key: "lot", width: 12 },
    { header: "Nama Barang", key: "name", width: 28 },
    { header: "NIK Bidder", key: "nik", width: 14 },
    { header: "Nama Bidder", key: "bidder", width: 22 },
    { header: "Alias", key: "alias", width: 16 },
    { header: "Nominal Bid", key: "amount", width: 14 },
    { header: "Status Bid", key: "status", width: 12 },
    { header: "Waktu Bid", key: "time", width: 20 },
  ];
  bidsSheet.getRow(1).font = { bold: true };
  for (const bid of data.bids) {
    const item = data.itemById.get(bid.item_id);
    bidsSheet.addRow({
      lot: item?.lot_number ?? "-",
      name: item?.item_name ?? "-",
      nik: bid.bidder_profiles?.employee_nik ?? "-",
      bidder: bid.bidder_profiles?.full_name ?? "-",
      alias: bid.bidder_profiles?.public_alias ?? "-",
      amount: bid.amount,
      status: statusLabel(bid.status),
      time: formatDateTime(bid.created_at),
    });
  }

  const summarySheet = workbook.addWorksheet("Ringkasan");
  summarySheet.columns = [{ width: 28 }, { width: 22 }];
  const summaryTitle = summarySheet.addRow(["RINGKASAN"]);
  summaryTitle.font = { bold: true, size: 14 };
  summarySheet.addRow([]);
  summarySheet.addRow(["Total Barang", data.items.length]);
  summarySheet.addRow(["Total Bid", data.bids.length]);
  summarySheet.addRow([
    "Total Nilai Harga Terakhir",
    data.items.reduce((sum, item) => sum + Number(item.current_price), 0),
  ]);
  summarySheet.addRow([
    "Total Nilai Menang",
    Array.from(data.winnerByItem.values()).reduce(
      (sum, row) => sum + Number(row.last_price),
      0
    ),
  ]);
  summarySheet.addRow([]);
  summarySheet.addRow(["Catatan"]);
  summarySheet.addRow([
    includeImages
      ? "Foto ditampilkan sebagai thumbnail kecil di kolom. File asli tetap tersedia di storage aplikasi."
      : "Export tanpa foto — kolom gambar tidak disertakan.",
  ]);

  const safeCode = period.code.replace(/[^\w-]+/g, "_");
  const safeCategory = data.category
    ? `-${data.category.replace(/[^\w-]+/g, "_")}`
    : "";
  const imageSuffix = includeImages ? "" : "-no-foto";
  const dateStamp = new Date().toISOString().slice(0, 10);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lelang-${safeCode}${safeCategory}${imageSuffix}-${dateStamp}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
