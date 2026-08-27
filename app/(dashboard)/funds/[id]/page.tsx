import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getFundDetail, reportingPeriodKey } from "@/lib/reporting";
import { periodLabel } from "@/lib/periods";
import { formatByUnit, formatSignedPct, variancePct } from "@/lib/format";
import { StatusBadge } from "../../ui";

export const dynamic = "force-dynamic";

const COLUMNS = ["Revenue", "EBITDA", "Gross Margin", "Headcount"];

export default async function FundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const periodKey = await reportingPeriodKey();
  const fund = periodKey ? await getFundDetail(user, id, periodKey) : null;
  if (!fund || !periodKey) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/funds" className="text-sm text-blue-600 hover:underline">
        ← Funds
      </Link>
      <h1 className="mt-1 text-xl font-semibold">{fund.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        Vintage {fund.vintageYear} · {formatByUnit(fund.fundSize, "USD")} committed ·{" "}
        {fund.status} · as of {periodLabel(periodKey)}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Company</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              {COLUMNS.map((c) => (
                <th key={c} className="py-2 pr-4 text-right font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fund.companies.map((c) => (
              <tr key={c.id} className="border-b align-top">
                <td className="py-2 pr-4">
                  <Link
                    href={`/companies/${c.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <div className="text-xs text-gray-400">
                    {c.industry} · {c.ownershipPct}% owned
                  </div>
                </td>
                <td className="py-2 pr-4">
                  <StatusBadge status={c.status} />
                </td>
                {COLUMNS.map((col) => {
                  const m = c.metrics[col];
                  const v = m ? variancePct(m.actual, m.budget) : null;
                  return (
                    <td key={col} className="py-2 pr-4 text-right whitespace-nowrap">
                      {formatByUnit(m?.actual ?? null, m?.unit ?? "")}
                      {v != null && (
                        <span
                          className={`ml-1 text-xs ${
                            v < 0 ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {formatSignedPct(v)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Percentages are actual vs. budget for the period.
      </p>
    </div>
  );
}
