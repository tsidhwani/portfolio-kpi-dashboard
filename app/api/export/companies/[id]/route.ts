import { getSessionUser } from "@/lib/session";
import { getCompanyDetail } from "@/lib/reporting";
import { toCsv, csvResponse, companyHistoryRows, slug } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const months = Number(new URL(req.url).searchParams.get("months")) || 6;

  // getCompanyDetail runs canAccessCompany() and returns null when denied.
  const detail = await getCompanyDetail(user, id, months);
  if (!detail) return new Response("Not found", { status: 404 });

  return csvResponse(
    `${slug(detail.name)}-kpi-history.csv`,
    toCsv(companyHistoryRows(detail)),
  );
}
