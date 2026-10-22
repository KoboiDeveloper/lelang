import { apiFetchServer } from "@/lib/api-client";
import { Profile, UserRole } from "@/lib/database.types";
import { STAFF_ROLES } from "@/lib/roles";
import { redirect } from "next/navigation";

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

function toProfile(user: NonNullable<MeResponse["user"]>): Profile {
  return {
    id: user.id,
    username: user.username,
    full_name: user.fullName,
    employee_nik: null,
    role: user.role,
    company_id: user.companyId ?? "",
    is_active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

export async function getStaffProfile(): Promise<Profile | null> {
  const res = await apiFetchServer<MeResponse>("/api/auth/me", {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok || !res.data?.user) return null;
  return toProfile(res.data.user);
}

export async function requireStaff(allowedRoles: UserRole[] = STAFF_ROLES) {
  const profile = await getStaffProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!allowedRoles.includes(profile.role as UserRole)) {
    redirect("/");
  }

  return profile;
}
