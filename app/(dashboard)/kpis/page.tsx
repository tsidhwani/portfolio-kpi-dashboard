import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { canManageKpiTemplates } from "@/lib/rbac";
import { listKpiDefinitions } from "@/lib/admin";
import { KpiPanel } from "./kpi-panel";
import { PageHeader } from "../ui";

export const dynamic = "force-dynamic";

export default async function KpisPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canManageKpiTemplates(user)) redirect("/");

  const kpis = await listKpiDefinitions(user);

  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="KPI template library"
        meta="Reporting keys on the KPI name, so a rename re-labels it everywhere. Retiring a KPI hides it from entry and reporting but keeps its history; definitions are never deleted once values exist."
      />
      <KpiPanel kpis={kpis} />
    </div>
  );
}
