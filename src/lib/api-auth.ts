import { NextResponse } from "next/server";
import { apiFetchServer } from "@/lib/api-client";
import { Profile, UserRole } from "@/lib/database.types";
import { STAFF_ROLES } from "@/lib/roles";

type MeResponse = {
  user?: {
    id: string;
    email: string;
    role: string;
    companyId: string | null;
    fullName: string;
    username: string;
  };
};

function toProfile(user: NonNullable<MeResponse["user"]>): Pick<
  Profile,
  "role" | "full_name" | "company_id"
> & { id: string } {
  return {
    id: user.id,
    role: user.role,
    full_name: user.fullName,
    company_id: user.companyId ?? "",
  };
}

export async function requireStaffApi(
  allowedRoles: UserRole[] = STAFF_ROLES
) {
  const res = await apiFetchServer<MeResponse>("/api/auth/me", {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok || !res.data?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  const profile = toProfile(res.data.user);

  if (!allowedRoles.includes(profile.role as UserRole)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }

  return {
    profile,
    user: { id: res.data.user.id, email: res.data.user.email },
  } as const;
}

export async function requireAmsStaffApi(
  allowedRoles: UserRole[] = STAFF_ROLES
) {
  const auth = await requireStaffApi(allowedRoles);
  if ("error" in auth) return auth;

  const companies = await apiFetchServer<{
    companies: { id: string; code: string }[];
  }>("/api/catalog/companies", { method: "GET", cache: "no-store" });

  const company = companies.data?.companies?.find(
    (c) => c.id === auth.profile.company_id
  );

  if (company?.code !== "ams") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }

  return auth;
}
