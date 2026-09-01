import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { canManageKpiTemplates } from "@/lib/rbac";
import { listKpiDefinitions } from "@/lib/admin";
import { KpiPanel } from "./kpi-panel";

export const dynamic = "force-dynamic";

export default async function KpisPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canManageKpiTemplates(user)) redirect("/");

  const kpis = await listKpiDefinitions(user);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold">KPI template library</h1>
      <p className="mt-1 text-sm text-gray-500">
        The metric definitions every company reports against. Reporting keys on
        the name (Revenue, EBITDA, …), so renaming one re-labels it everywhere.
        Retiring a KPI hides it from entry and reporting but keeps its history;
        definitions are never deleted once values exist.
      </p>

      <KpiPanel kpis={kpis} />
    </div>
  );
}
