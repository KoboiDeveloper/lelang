import Link from "next/link";
import { AuctionItem, ItemPhoto } from "@/lib/database.types";
import { formatRupiah, getPhotoUrl } from "@/lib/format";
import { lotDetailHref } from "@/lib/lot-href";
import { PhotoImage } from "@/components/photo-image";
import { Gavel } from "lucide-react";

export function LotCard({
  item,
  photos,
  bidCount = 0,
  biddingClosed,
  category,
  onNavigate,
}: {
  item: AuctionItem;
  photos?: ItemPhoto[];
  bidCount?: number;
  biddingClosed?: boolean;
  category?: string | null;
  onNavigate?: (itemId: string) => void;
}) {
  const photo = photos?.[0];

  return (
    <Link
      href={lotDetailHref(item.id, category)}
      className="group block"
      onClick={() => onNavigate?.(item.id)}
      onPointerDown={() => onNavigate?.(item.id)}
      onTouchStart={() => onNavigate?.(item.id)}
    >
      <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm transition-shadow hover:shadow-md sm:rounded-2xl">
        <div className="relative aspect-square overflow-hidden bg-slate-100 sm:aspect-[4/3]">
          {photo ? (
            <PhotoImage
              src={getPhotoUrl(photo.storage_path)}
              alt={item.item_name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              sizes="(max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-3xl opacity-40 sm:text-5xl">📦</span>
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-col gap-1 sm:left-3 sm:top-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50/95 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20 backdrop-blur-sm sm:px-2.5 sm:text-xs">
              <Gavel className="h-3 w-3" />
              {bidCount} bid
            </span>
            {biddingClosed && (
              <span className="inline-flex items-center rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold text-white sm:text-xs">
                Closed
              </span>
            )}
            {item.status === "sold" && !biddingClosed && (
              <span className="inline-flex items-center rounded-full bg-indigo-600/90 px-2 py-0.5 text-[10px] font-semibold text-white sm:text-xs">
                Sold
              </span>
            )}
          </div>
          <div className="absolute right-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 backdrop-blur-sm sm:right-3 sm:top-3 sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-xs">
            {item.lot_number}
          </div>
        </div>

        <div className="p-3 sm:p-5">
          {item.category && (
            <span className="mb-1.5 inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-600/20 sm:mb-2 sm:text-xs">
              {item.category}
            </span>
          )}
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 transition-colors group-hover:text-[var(--primary)] sm:text-base">
            {item.item_name}
          </h3>
          <div className="mt-2 flex items-end justify-between border-t border-[var(--border)] pt-2 sm:mt-4 sm:pt-4">
            <div>
              <p className="text-[10px] text-slate-500 sm:text-xs">Harga saat ini</p>
              <p className="text-sm font-bold text-slate-900 sm:text-lg">
                {formatRupiah(item.current_price)}
              </p>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
