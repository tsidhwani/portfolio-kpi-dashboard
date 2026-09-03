import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getFundDetail, reportingPeriodKey } from "@/lib/reporting";
import { periodLabel } from "@/lib/periods";
import { formatByUnit, formatSignedPct, variancePct } from "@/lib/format";
import { PageHeader, StatusBadge, VarianceLegend, flagTextClass } from "../../ui";

export const dynamic = "force-dynamic";

const COLUMNS = ["Revenue", "EBITDA", "EBITDA Margin", "Net Debt", "Headcount"];

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
    <div>
      <Link href="/funds" className="text-[0.8125rem] text-ink-soft no-underline hover:text-ink">
        ← Funds
      </Link>

      <PageHeader
        eyebrow={`Vintage ${fund.vintageYear} · ${fund.status}`}
        title={fund.name}
        meta={`${formatByUnit(fund.fundSize, "USD")} committed · as of ${periodLabel(periodKey)}`}
        actions={
          <a href={`/api/export/funds/${fund.id}`} className="btn">
            Export CSV
          </a>
        }
      />

      <div className="card overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th className="pl-4">Company</th>
              <th>Status</th>
              {COLUMNS.map((c) => (
                <th key={c} className="num">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fund.companies.map((c) => (
              <tr key={c.id}>
                <td className="pl-4">
                  <Link
                    href={`/companies/${c.id}`}
                    className="font-medium text-ink no-underline hover:underline"
                  >
                    {c.name}
                  </Link>
                  <div className="mt-0.5 text-[0.6875rem] text-ink-faint">
                    {c.industry} · {c.ownershipPct}% owned
                  </div>
                </td>
                <td>
                  <StatusBadge status={c.computedStatus} />
                </td>
                {COLUMNS.map((col) => {
                  const m = c.metrics[col];
                  const v = m ? variancePct(m.actual, m.budget) : null;
                  return (
                    <td key={col} className="num">
                      <div>{formatByUnit(m?.actual ?? null, m?.unit ?? "")}</div>
                      {v != null && (
                        <div className={`text-[0.6875rem] ${flagTextClass(m?.flag)}`}>
                          {formatSignedPct(v)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <VarianceLegend />
      </div>
      <p className="mt-2 text-[0.6875rem] text-ink-faint">
        Figures are the period actual with variance to budget beneath. Status is
        the worst financial-KPI flag for the period.
      </p>
    </div>
  );
}
