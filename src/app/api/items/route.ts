import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/be-proxy";

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search;
  return proxyToBackend(request, `/api/items${qs}`, { method: "GET" });
}

export async function POST(request: NextRequest) {
  return proxyToBackend(request, "/api/items");
}
