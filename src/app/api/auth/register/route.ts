import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/be-proxy";

export async function POST(request: NextRequest) {
  return proxyToBackend(request, "/api/auth/register");
}
