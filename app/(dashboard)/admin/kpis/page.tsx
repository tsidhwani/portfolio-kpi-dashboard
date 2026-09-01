import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { canManageUsers } from "@/lib/rbac";
import { listKpiDefinitions } from "@/lib/admin";
import { KpiPanel } from "./kpi-panel";

export const dynamic = "force-dynamic";

export default async function AdminKpisPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canManageUsers(user)) redirect("/");

  const kpis = await listKpiDefinitions(user);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin · KPI template library</h1>
        <Link href="/admin" className="text-sm text-blue-600 hover:underline">
          ← Users
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        The metric definitions every company reports against. Reporting keys on
        the name (Revenue, EBITDA, …), so renaming one re-labels it everywhere.
        Definitions can&apos;t be deleted once values exist against them.
      </p>

      <KpiPanel kpis={kpis} />
    </div>
  );
}
