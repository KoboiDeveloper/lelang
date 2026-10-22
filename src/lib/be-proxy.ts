import { NextRequest, NextResponse } from "next/server";
import { getApiBase, TOKEN_COOKIE } from "@/lib/api-client";

/** Proxy a Next.js route handler request to lelang-be. */
export async function proxyToBackend(
  request: NextRequest,
  bePath: string,
  init?: { method?: string; body?: BodyInit | null; formData?: boolean }
) {
  const base = getApiBase();
  const url = `${base}${bePath.startsWith("/") ? bePath : `/${bePath}`}`;
  const token =
    request.cookies.get(TOKEN_COOKIE)?.value ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null;

  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const method = init?.method ?? request.method;
  let body: BodyInit | null | undefined = init?.body;

  if (body === undefined && method !== "GET" && method !== "HEAD") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      body = await request.formData();
    } else {
      const text = await request.text();
      body = text || undefined;
      if (text && !headers.has("Content-Type")) {
        headers.set("Content-Type", contentType || "application/json");
      }
    }
  } else if (typeof body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const upstream = await fetch(url, { method, headers, body });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gagal menghubungi API backend",
      },
      { status: 502 }
    );
  }
}
