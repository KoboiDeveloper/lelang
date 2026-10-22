import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookieOptions, TOKEN_COOKIE } from "@/lib/auth-cookie";

export async function POST(request: NextRequest) {
  const secure =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TOKEN_COOKIE, "", clearAuthCookieOptions(secure));
  return res;
}
