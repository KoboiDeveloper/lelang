import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/be-proxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, "/api/auth/me", { method: "GET" });
}
