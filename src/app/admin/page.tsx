import { requireStaff } from "@/lib/auth";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";
import { emptyCompanyAssetTotals } from "@/lib/admin-dashboard";

export default async function AdminDashboard() {
  await requireStaff();

  // Stats load client-side from Express API (AdminDashboardClient).
  return (
    <AdminDashboardClient
      initialTotals={emptyCompanyAssetTotals()}
      initialPeriods={[]}
      initialStats={{
        itemCount: 0,
        bidCount: 0,
        periodCount: 0,
        bidderCount: 0,
      }}
    />
  );
}
