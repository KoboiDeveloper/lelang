import { NextRequest, NextResponse } from "next/server";
import { getBackendBase } from "@/lib/api-client";
import { authCookieOptions, TOKEN_COOKIE } from "@/lib/auth-cookie";

export async function POST(request: NextRequest) {
  const base = getBackendBase();
  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyText || undefined,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Gagal menghubungi API backend",
      },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let parsed: { token?: string; user?: unknown; error?: string } | null = null;
  try {
    parsed = text ? (JSON.parse(text) as typeof parsed) : null;
  } catch {
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = NextResponse.json(parsed ?? {}, { status: upstream.status });

  // Set cookie on the FE host so middleware / SSR see the session after redirect.
  if (upstream.ok && parsed?.token) {
    const secure =
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https";
    res.cookies.set(TOKEN_COOKIE, parsed.token, authCookieOptions(secure));
  }

  return res;
}
