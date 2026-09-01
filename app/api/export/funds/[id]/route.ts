import { getSessionUser } from "@/lib/session";
import { canViewFirmWide } from "@/lib/rbac";
import { getFundDetail, reportingPeriodKey } from "@/lib/reporting";
import { toCsv, csvResponse, fundDetailRows, slug } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canViewFirmWide(user)) return new Response("Forbidden", { status: 403 });

  const periodKey = await reportingPeriodKey();
  const { id } = await params;
  const fund = periodKey ? await getFundDetail(user, id, periodKey) : null;
  if (!fund) return new Response("Not found", { status: 404 });

  return csvResponse(
    `${slug(fund.name)}-${fund.periodKey}.csv`,
    toCsv(fundDetailRows(fund)),
  );
}
