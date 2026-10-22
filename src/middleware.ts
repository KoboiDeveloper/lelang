import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE } from "@/lib/api-client";
import { normalizeAuthToken } from "@/lib/auth-cookie";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? atob(payload)
        : Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const token = normalizeAuthToken(request.cookies.get(TOKEN_COOKIE)?.value);
  const path = request.nextUrl.pathname;

  if (path.startsWith("/admin")) {
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }

    const payload = decodeJwtPayload(token);
    if (!payload?.id) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", path);
      const res = NextResponse.redirect(url);
      res.cookies.set(TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/daftar"],
};
