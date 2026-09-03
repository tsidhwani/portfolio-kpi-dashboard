import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getFundRollups, reportingPeriodKey } from "@/lib/reporting";
import { periodLabel } from "@/lib/periods";
import { formatByUnit } from "@/lib/format";
import { PageHeader, VarianceLegend } from "../ui";

export const dynamic = "force-dynamic";

export default async function FundsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "CFO") {
    redirect(user.companyIds[0] ? `/companies/${user.companyIds[0]}` : "/");
  }

  const periodKey = await reportingPeriodKey();
  const rollups = periodKey ? await getFundRollups(user, periodKey) : [];

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Funds"
        meta={
          periodKey ? `Roll-up as of ${periodLabel(periodKey)}.` : "No KPI data yet."
        }
        actions={
          periodKey && (
            <>
              <a href="/api/export/funds" className="btn">
                Export CSV
              </a>
              <Link href="/funds/report" className="btn no-underline">
                Printable report
              </Link>
            </>
          )
        }
      />

      {periodKey && <VarianceLegend />}

      <div className="card mt-4 overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th className="pl-4">Fund</th>
              <th>Vintage</th>
              <th>Cos.</th>
              <th>On plan / Watch / Off</th>
              <th className="num">Revenue</th>
              <th className="num">EBITDA</th>
              <th className="num">Net Debt</th>
              <th className="num pr-4">Headcount</th>
            </tr>
          </thead>
          <tbody>
            {rollups.map((f) => (
              <tr key={f.id}>
                <td className="pl-4">
                  <Link
                    href={`/funds/${f.id}`}
                    className="font-medium text-ink no-underline hover:underline"
                  >
                    {f.name}
                  </Link>
                </td>
                <td className="text-ink-soft">{f.vintageYear}</td>
                <td className="text-ink-soft">{f.companyCount}</td>
                <td className="whitespace-nowrap tabular-nums">
                  <span className="text-flag-green">{f.statusCounts.GREEN}</span>
                  <span className="text-ink-faint"> / </span>
                  <span className="text-flag-amber">{f.statusCounts.YELLOW}</span>
                  <span className="text-ink-faint"> / </span>
                  <span className="text-flag-red">{f.statusCounts.RED}</span>
                </td>
                <td className="num">{formatByUnit(f.revenue, "USD")}</td>
                <td className="num">{formatByUnit(f.ebitda, "USD")}</td>
                <td className="num">{formatByUnit(f.netDebt, "USD")}</td>
                <td className="num pr-4">{formatByUnit(f.headcount, "FTEs")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
