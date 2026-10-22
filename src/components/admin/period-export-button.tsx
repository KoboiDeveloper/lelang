"use client";

import { useState } from "react";
import { AuctionPeriod } from "@/lib/database.types";
import { downloadPeriodExcel } from "@/lib/period-excel-export";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Download } from "lucide-react";
import { toast } from "sonner";

type ExportImageMode = "with_images" | "no_images";

export function PeriodExportButton({
  period,
  itemCount = 0,
  category = "all",
  className,
}: {
  period: AuctionPeriod;
  itemCount?: number;
  category?: string;
  className?: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [imageMode, setImageMode] = useState<ExportImageMode>("with_images");
  const categoryLabel = !category || category === "all" ? "Semua" : category;
  const withImages = imageMode === "with_images";

  async function handleExport() {
    if (itemCount === 0) {
      toast.error(
        category && category !== "all"
          ? `Belum ada barang di kategori ${category}`
          : "Belum ada barang untuk diekspor"
      );
      return;
    }

    setExporting(true);
    try {
      toast.message(
        withImages
          ? `Menyiapkan Excel + foto (${categoryLabel}), mohon tunggu...`
          : `Menyiapkan Excel tanpa foto (${categoryLabel})...`
      );
      await downloadPeriodExcel(period, category, {
        includeImages: withImages,
      });
      toast.success(
        withImages
          ? `Excel + foto berhasil diunduh — ${categoryLabel}`
          : `Excel tanpa foto berhasil diunduh — ${categoryLabel}`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengekspor data periode"
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={`flex w-full flex-col gap-2 sm:w-auto sm:flex-row ${className ?? ""}`}>
      <Select
        value={imageMode}
        onChange={(e) => setImageMode(e.target.value as ExportImageMode)}
        className="h-9 w-full sm:w-40"
        aria-label="Mode export Excel"
        disabled={exporting || itemCount === 0}
      >
        <option value="with_images">Dengan foto</option>
        <option value="no_images">Tanpa foto</option>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full whitespace-nowrap sm:w-auto"
        disabled={exporting || itemCount === 0}
        onClick={() => void handleExport()}
        title={`Export kategori: ${categoryLabel}`}
      >
        <Download className="h-4 w-4" />
        {exporting ? "Mengekspor..." : "Export Excel"}
      </Button>
    </div>
  );
}
