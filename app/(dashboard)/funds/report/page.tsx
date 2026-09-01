import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getFundRollups, reportingPeriodKey } from "@/lib/reporting";
import { periodLabel } from "@/lib/periods";
import { formatByUnit } from "@/lib/format";
import { PrintButton } from "../../print-button";

export const dynamic = "force-dynamic";

const generatedOn = () =>
  new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default async function FundsReportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "CFO") redirect("/submit");

  const periodKey = await reportingPeriodKey();
  const rollups = periodKey ? await getFundRollups(user, periodKey) : [];

  const totals = rollups.reduce(
    (acc, f) => ({
      companies: acc.companies + f.companyCount,
      green: acc.green + f.statusCounts.GREEN,
      yellow: acc.yellow + f.statusCounts.YELLOW,
      red: acc.red + f.statusCounts.RED,
      revenue: acc.revenue + (f.revenue ?? 0),
      ebitda: acc.ebitda + (f.ebitda ?? 0),
      netDebt: acc.netDebt + (f.netDebt ?? 0),
      headcount: acc.headcount + (f.headcount ?? 0),
    }),
    { companies: 0, green: 0, yellow: 0, red: 0, revenue: 0, ebitda: 0, netDebt: 0, headcount: 0 },
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Portfolio roll-up</h1>
        <div className="flex gap-2">
          <a
            href="/api/export/funds"
            className="no-print rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Download CSV
          </a>
          <PrintButton />
        </div>
      </div>

      <p className="text-sm text-gray-500">
        {periodKey ? `As of ${periodLabel(periodKey)}` : "No KPI data yet."} ·
        generated {generatedOn()}
      </p>

      {periodKey && (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 text-left">
              <th className="py-2 pr-4 font-semibold">Fund</th>
              <th className="py-2 pr-4 font-semibold">Vintage</th>
              <th className="py-2 pr-4 font-semibold">Cos.</th>
              <th className="py-2 pr-4 font-semibold">G / Y / R</th>
              <th className="py-2 pr-4 text-right font-semibold">Revenue</th>
              <th className="py-2 pr-4 text-right font-semibold">EBITDA</th>
              <th className="py-2 pr-4 text-right font-semibold">Net Debt</th>
              <th className="py-2 text-right font-semibold">Headcount</th>
            </tr>
          </thead>
          <tbody>
            {rollups.map((f) => (
              <tr key={f.id} className="border-b">
                <td className="py-2 pr-4">{f.name}</td>
                <td className="py-2 pr-4">{f.vintageYear}</td>
                <td className="py-2 pr-4">{f.companyCount}</td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {f.statusCounts.GREEN} / {f.statusCounts.YELLOW} / {f.statusCounts.RED}
                </td>
                <td className="py-2 pr-4 text-right">{formatByUnit(f.revenue, "USD")}</td>
                <td className="py-2 pr-4 text-right">{formatByUnit(f.ebitda, "USD")}</td>
                <td className="py-2 pr-4 text-right">{formatByUnit(f.netDebt, "USD")}</td>
                <td className="py-2 text-right">{formatByUnit(f.headcount, "FTEs")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold">
              <td className="py-2 pr-4">Total</td>
              <td className="py-2 pr-4" />
              <td className="py-2 pr-4">{totals.companies}</td>
              <td className="py-2 pr-4 whitespace-nowrap">
                {totals.green} / {totals.yellow} / {totals.red}
              </td>
              <td className="py-2 pr-4 text-right">{formatByUnit(totals.revenue, "USD")}</td>
              <td className="py-2 pr-4 text-right">{formatByUnit(totals.ebitda, "USD")}</td>
              <td className="py-2 pr-4 text-right">{formatByUnit(totals.netDebt, "USD")}</td>
              <td className="py-2 text-right">{formatByUnit(totals.headcount, "FTEs")}</td>
            </tr>
          </tfoot>
        </table>
      )}

      <p className="mt-6 text-xs text-gray-400">
        Roll-up totals are additive across companies with data for the period.
        Status counts use the variance flag (worst financial KPI vs. budget),
        manual status as fallback.
      </p>
    </div>
  );
}
