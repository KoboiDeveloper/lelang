import { NextRequest, NextResponse } from "next/server";
import { getBackendBase } from "@/lib/api-client";

/**
 * Keep FE query param `nomor_induk` working while BE expects `nik`.
 * Also preserves richer error shape when BE only returns raw employee API.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const nik =
    searchParams.get("nik")?.trim() ||
    searchParams.get("nomor_induk")?.trim() ||
    "";

  if (!nik) {
    return NextResponse.json(
      { error: "Parameter nomor_induk wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(
      `${getBackendBase()}/api/employee/by-nik?nik=${encodeURIComponent(nik)}`
    );
    const text = await upstream.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Normalize common employee API shapes for daftar-form
    if (upstream.ok && !data.matches && (data.data || data.employee)) {
      const raw = (data.data ?? data.employee) as Record<string, unknown>;
      const matches = Array.isArray(raw)
        ? raw
        : raw
          ? [raw]
          : [];
      return NextResponse.json({
        ok: true,
        nomorInduk: nik,
        fullName: (matches[0] as Record<string, unknown>)?.fullName ??
          (matches[0] as Record<string, unknown>)?.nama ??
          "",
        pt: (matches[0] as Record<string, unknown>)?.pt ?? "",
        matches: matches.map((m) => {
          const row = m as Record<string, unknown>;
          return {
            nomorInduk: String(row.nomorInduk ?? row.nomor_induk ?? nik),
            fullName: String(row.fullName ?? row.nama ?? row.full_name ?? ""),
            pt: String(row.pt ?? row.perusahaan ?? ""),
            companyId: row.companyId ?? row.company_id,
            companyCode: row.companyCode ?? row.company_code,
          };
        }),
        requiresPtSelection: matches.length > 1,
      });
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Gagal menghubungi employee API",
      },
      { status: 502 }
    );
  }
}
