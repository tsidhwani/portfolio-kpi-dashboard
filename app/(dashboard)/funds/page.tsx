import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getFundRollups, reportingPeriodKey } from "@/lib/reporting";
import { periodLabel } from "@/lib/periods";
import { formatByUnit } from "@/lib/format";
import { VarianceLegend } from "../ui";

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
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Funds</h1>
        {periodKey && (
          <div className="flex gap-3 text-sm">
            <a href="/api/export/funds" className="text-blue-600 hover:underline">
              Export CSV
            </a>
            <Link href="/funds/report" className="text-blue-600 hover:underline">
              Printable report
            </Link>
          </div>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {periodKey ? `Roll-up as of ${periodLabel(periodKey)}` : "No KPI data yet."}
      </p>
      {periodKey && (
        <div className="mt-2">
          <VarianceLegend />
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Fund</th>
              <th className="py-2 pr-4 font-medium">Vintage</th>
              <th className="py-2 pr-4 font-medium">Companies</th>
              <th className="py-2 pr-4 font-medium">G / Y / R</th>
              <th className="py-2 pr-4 text-right font-medium">Revenue</th>
              <th className="py-2 pr-4 text-right font-medium">EBITDA</th>
              <th className="py-2 text-right font-medium">Headcount</th>
            </tr>
          </thead>
          <tbody>
            {rollups.map((f) => (
              <tr key={f.id} className="border-b">
                <td className="py-2 pr-4">
                  <Link href={`/funds/${f.id}`} className="text-blue-600 hover:underline">
                    {f.name}
                  </Link>
                </td>
                <td className="py-2 pr-4">{f.vintageYear}</td>
                <td className="py-2 pr-4">{f.companyCount}</td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  <span className="text-green-700">{f.statusCounts.GREEN}</span>
                  {" / "}
                  <span className="text-yellow-700">{f.statusCounts.YELLOW}</span>
                  {" / "}
                  <span className="text-red-700">{f.statusCounts.RED}</span>
                </td>
                <td className="py-2 pr-4 text-right">{formatByUnit(f.revenue, "USD")}</td>
                <td className="py-2 pr-4 text-right">{formatByUnit(f.ebitda, "USD")}</td>
                <td className="py-2 text-right">{formatByUnit(f.headcount, "FTEs")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
