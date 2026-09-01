import { getSessionUser } from "@/lib/session";
import { canViewFirmWide } from "@/lib/rbac";
import { getFundRollups, reportingPeriodKey } from "@/lib/reporting";
import { toCsv, csvResponse, fundRollupRows } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canViewFirmWide(user)) return new Response("Forbidden", { status: 403 });

  const periodKey = await reportingPeriodKey();
  if (!periodKey) return new Response("No KPI data yet.", { status: 404 });

  const rollups = await getFundRollups(user, periodKey);
  return csvResponse(
    `fund-rollup-${periodKey}.csv`,
    toCsv(fundRollupRows(rollups, periodKey)),
  );
}
