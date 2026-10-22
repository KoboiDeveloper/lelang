import { PhotoImage } from "@/components/photo-image";
import Link from "next/link";
import { AuctionPeriod, BankAccountWithBank, Company } from "@/lib/database.types";
import { WinnerRow } from "@/lib/winners";
import { getBankName } from "@/lib/bank-utils";
import { formatRupiah, getPhotoUrl } from "@/lib/format";
import { Landmark, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function CompanyWinnerGroupSection({
  company,
  period,
  periods,
  rows,
  bankAccounts,
  companyCode,
}: {
  company: Company;
  period: AuctionPeriod;
  periods: AuctionPeriod[];
  rows: WinnerRow[];
  bankAccounts: BankAccountWithBank[];
  companyCode: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
      <div className="border-b border-[var(--border)] bg-slate-50 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
              {company.short_name}
            </span>
            <h2 className="mt-2 text-lg font-bold text-slate-900 sm:text-xl">
              {company.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Periode {period.code} — {period.title}
            </p>
          </div>
        </div>

        {periods.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {periods.map((item) => (
              <Link
                key={item.id}
                href={`/hasil?company=${companyCode}&period=${item.id}`}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors sm:text-sm",
                  period.id === item.id
                    ? "bg-[var(--primary)] text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                )}
              >
                {item.code}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {bankAccounts.length > 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                <Landmark className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900">
                  Informasi Pembayaran {company.short_name}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Transfer pembayaran lelang {company.short_name} ke rekening berikut.
                </p>
                <div className="mt-4 space-y-3">
                  {bankAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="rounded-xl border border-emerald-200/80 bg-white px-4 py-3"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        {getBankName(account)}
                      </p>
                      <p className="mt-1 font-mono text-base font-semibold text-slate-900">
                        {account.account_number}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-slate-800">
                        a.n. {account.account_holder}
                      </p>
                      {account.notes && (
                        <p className="mt-1 text-sm text-slate-500">{account.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-slate-500">
            Tidak ada barang dalam periode ini.
          </div>
        ) : (
          <WinnerRowsTable rows={rows} />
        )}
      </div>
    </section>
  );
}

function WinnerRowsTable({ rows }: { rows: WinnerRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <div className="hidden grid-cols-[72px_1fr_120px_140px_140px] gap-4 border-b border-[var(--border)] bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
        <span>Gambar</span>
        <span>Nama Barang</span>
        <span className="text-right">Harga Awal</span>
        <span>Pemenang</span>
        <span className="text-right">Last Price</span>
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {rows.map((row, index) => (
          <li key={row.itemId}>
            <Link
              href={`/lots/${row.itemId}`}
              className="group block transition-colors hover:bg-slate-50/80"
            >
              <div className="hidden items-center gap-4 px-5 py-4 lg:grid lg:grid-cols-[72px_1fr_120px_140px_140px]">
                <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-slate-100">
                  {row.photoPath ? (
                    <PhotoImage
                      src={getPhotoUrl(row.photoPath)}
                      alt={row.itemName}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xl">
                      📦
                    </div>
                  )}
                  {index < 3 && row.winnerAlias && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-mono text-xs font-semibold text-[var(--primary)]">
                    {row.lotNumber}
                  </span>
                  <p className="truncate font-medium text-slate-900 group-hover:text-[var(--primary)]">
                    {row.itemName}
                  </p>
                </div>
                <p className="text-right text-sm text-slate-600">
                  {formatRupiah(row.startingPrice)}
                </p>
                <div className="min-w-0">
                  {row.winnerAlias ? (
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {row.winnerAlias}
                    </p>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </div>
                <p className="text-right text-sm font-bold text-emerald-700">
                  {formatRupiah(row.lastPrice)}
                </p>
              </div>

              <div className="flex gap-3 p-4 lg:hidden">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {row.photoPath ? (
                    <PhotoImage
                      src={getPhotoUrl(row.photoPath)}
                      alt={row.itemName}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl">
                      📦
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] font-semibold text-[var(--primary)]">
                        {row.lotNumber}
                      </span>
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                        {row.itemName}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div>
                      <p className="text-slate-400">Harga Awal</p>
                      <p className="font-medium text-slate-700">
                        {formatRupiah(row.startingPrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400">Last Price</p>
                      <p className="font-bold text-emerald-700">
                        {formatRupiah(row.lastPrice)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400">Pemenang</p>
                      <p className="font-semibold text-slate-900">
                        {row.winnerAlias ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
