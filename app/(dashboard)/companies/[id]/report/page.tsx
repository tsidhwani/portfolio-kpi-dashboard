import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getCompanyDetail } from "@/lib/reporting";
import { periodLabel, periodShortLabel } from "@/lib/periods";
import { formatByUnit } from "@/lib/format";
import { StatusBadge, flagTextClass } from "../../../ui";
import { PrintButton } from "../../../print-button";

export const dynamic = "force-dynamic";

const utcDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const generatedOn = () =>
  new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function CompanyReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const d = await getCompanyDetail(user, id, 12);
  if (!d) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{d.name} — monthly report</h1>
        <div className="flex gap-2">
          <a
            href={`/api/export/companies/${d.id}?months=12`}
            className="no-print rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Download CSV
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <StatusBadge status={d.computedStatus} />
        <p className="text-sm text-gray-500">
          {d.industry} · {d.fund.name} · {d.ownershipPct}% owned · invested{" "}
          {utcDate(d.investmentDate)}
        </p>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        KPI history, last {d.periodKeys.length} months · generated {generatedOn()}
      </p>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 text-left">
            <th className="py-2 pr-4 font-semibold">Metric</th>
            {d.periodKeys.map((k) => (
              <th key={k} className="py-2 pr-4 text-right font-semibold whitespace-nowrap">
                {periodShortLabel(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.kpiDefs.map((kpi) => (
            <tr key={kpi.id} className="border-b">
              <td className="py-2 pr-4 whitespace-nowrap">
                {kpi.name} <span className="text-gray-400">({kpi.unit})</span>
              </td>
              {d.periodKeys.map((k) => {
                const cell = d.grid[kpi.id]?.[k];
                return (
                  <td key={k} className="py-2 pr-4 text-right whitespace-nowrap">
                    {cell && (cell.actual != null || cell.budget != null) ? (
                      <>
                        <div className={flagTextClass(cell.flag)}>
                          {formatByUnit(cell.actual, kpi.unit)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatByUnit(cell.budget, kpi.unit)}
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-400">
        Actual over budget. Colour is the variance flag vs. budget.
      </p>

      <h2 className="mt-6 text-sm font-semibold text-gray-700">Commentary</h2>
      {d.commentary.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">No commentary.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {d.commentary.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="text-xs text-gray-400">
                {periodLabel(c.periodKey)} · {c.author}
              </div>
              <div>{c.body}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
