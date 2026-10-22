export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format angka tanpa simbol mata uang, e.g. 17000000 → "17.000.000" */
export function formatNumberId(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Parse string input ke integer, hapus titik/koma/spasi */
export function parseRupiahInput(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function getPhotoUrl(storagePath: string): string {
  const base = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100"
  ).replace(/\/$/, "");
  const path = storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
  // Dropbox paths (e.g. /uploads/lelang/...) are served via BE proxy
  if (path.startsWith("/uploads/") || path.includes("/lelang/")) {
    return `${base}/api/files/proxy?path=${encodeURIComponent(path)}`;
  }
  // Legacy relative storage keys — still proxy through BE
  return `${base}/api/files/proxy?path=${encodeURIComponent(path)}`;
}
