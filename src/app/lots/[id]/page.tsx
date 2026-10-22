import { notFound } from "next/navigation";
import { apiFetchServer } from "@/lib/api-client";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { BidForm } from "@/components/bid-form";
import { BidFeed } from "@/components/bid-feed";
import { LivePrice } from "@/components/live-price";
import { PhotoCarousel } from "@/components/photo-carousel";
import { CountdownTimer } from "@/components/countdown-timer";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/format";
import { isPeriodBiddingOpen, isPeriodClosed } from "@/lib/auction";
import { Lock } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { LotDetailNav } from "@/components/lot-detail-nav";
import { ScrollToTopOnMount } from "@/components/scroll-to-top-on-mount";
import { fetchNextLotItem } from "@/lib/lot-navigation";
import { buildCatalogReturnHref } from "@/lib/catalog-view-state";
import { fetchCompanyById } from "@/lib/companies";
import type { AuctionItem, AuctionPeriod, ItemPhoto } from "@/lib/database.types";

type ItemDetailResponse = {
  item: AuctionItem;
  photos: ItemPhoto[];
  period: AuctionPeriod;
};

export default async function LotDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { id } = await params;
  const { category: categoryParam } = await searchParams;
  const category = categoryParam?.trim() || null;

  const res = await apiFetchServer<ItemDetailResponse>(`/api/items/${id}`, {
    method: "GET",
    next: { revalidate: 10 },
  });

  if (!res.ok || !res.data?.item) notFound();

  const { item, photos, period } = res.data;

  const nextItem = await fetchNextLotItem({
    periodId: item.period_id,
    currentLotNumber: item.lot_number,
    category,
  });

  const company = period
    ? await fetchCompanyById(period.company_id)
    : null;
  const catalogReturnHref = buildCatalogReturnHref({
    companyCode: company?.code,
    focusItemId: item.id,
  });

  const biddingOpen = isPeriodBiddingOpen(period);
  const periodClosed = isPeriodClosed(period);

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTopOnMount />
      <Navbar />
      <main className="flex-1">
        <div className="border-b border-[var(--border)] bg-white">
          <div className="container-app py-4">
            <LotDetailNav
              nextItem={nextItem}
              category={category}
              catalogReturnHref={catalogReturnHref}
            />
          </div>
        </div>

        {periodClosed && (
          <div className="border-b border-slate-200 bg-slate-800 text-white">
            <div className="container-app flex items-center gap-3 py-3 text-sm">
              <Lock className="h-4 w-4 shrink-0" />
              <p>
                Periode lelang <strong>{period?.code}</strong> telah selesai — penawaran
                ditutup.
              </p>
            </div>
          </div>
        )}

        <div className="container-app py-6 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            <div className="space-y-6">
              <PhotoCarousel photos={photos ?? []} alt={item.item_name} />
              <BidFeed itemId={item.id} />
            </div>

            <div className="space-y-5">
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                      {item.lot_number}
                    </span>
                    <Badge status={item.status} />
                    {periodClosed && (
                      <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-white">
                        Closed
                      </span>
                    )}
                    {item.category && (
                      <span className="text-sm text-slate-500">{item.category}</span>
                    )}
                  </div>
                  <FavoriteButton itemId={item.id} />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  {item.item_name}
                </h1>
                {period && (
                  <p className="mt-2 text-sm text-slate-500">{period.title}</p>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6">
                <p className="text-sm text-slate-500">Harga saat ini</p>
                <LivePrice itemId={item.id} initialPrice={item.current_price} />
                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-5">
                  <div>
                    <p className="text-xs text-slate-500">Harga awal</p>
                    <p className="font-medium text-slate-900">
                      {formatRupiah(item.starting_price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Kelipatan bid</p>
                    <p className="font-medium text-slate-900">
                      {formatRupiah(item.bid_increment)}
                    </p>
                  </div>
                </div>
                {biddingOpen && period && (
                  <div className="mt-5 border-t border-[var(--border)] pt-5">
                    <p className="mb-2 text-xs text-slate-500">Berakhir dalam</p>
                    <CountdownTimer endAt={period.end_at} />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 sm:p-5">
                <p>{item.description}</p>
                {item.item_condition && (
                  <p className="mt-3 border-t border-[var(--border)] pt-3">
                    <span className="font-medium text-slate-700">Kondisi: </span>
                    {item.item_condition}
                  </p>
                )}
              </div>

              <BidForm item={item} period={period} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
