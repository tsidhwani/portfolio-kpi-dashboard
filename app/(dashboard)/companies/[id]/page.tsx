import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getCompanyDetail } from "@/lib/reporting";
import { periodLabel, periodShortLabel } from "@/lib/periods";
import { formatByUnit } from "@/lib/format";
import { StatusBadge, VarianceLegend, flagTextClass } from "../../ui";

export const dynamic = "force-dynamic";

const utcDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const d = await getCompanyDetail(user, id, 6);
  if (!d) notFound();

  const firmWide = user.role !== "CFO";

  return (
    <div className="mx-auto max-w-4xl">
      {firmWide && (
        <Link href="/funds" className="text-sm text-blue-600 hover:underline">
          ← Funds
        </Link>
      )}
      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{d.name}</h1>
          <StatusBadge status={d.computedStatus} />
        </div>
        <div className="flex gap-3 text-sm">
          <a
            href={`/api/export/companies/${d.id}`}
            className="text-blue-600 hover:underline"
          >
            Export CSV
          </a>
          <Link
            href={`/companies/${d.id}/report`}
            className="text-blue-600 hover:underline"
          >
            Printable report
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {d.industry} ·{" "}
        {firmWide ? (
          <Link href={`/funds/${d.fund.id}`} className="text-blue-600 hover:underline">
            {d.fund.name}
          </Link>
        ) : (
          d.fund.name
        )}{" "}
        · {d.ownershipPct}% owned · invested {utcDate(d.investmentDate)}
      </p>

      <h2 className="mt-6 text-sm font-semibold text-gray-700">
        KPI history — actual over budget, last {d.periodKeys.length} months
      </h2>
      <div className="mt-1">
        <VarianceLegend />
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Metric</th>
              {d.periodKeys.map((k) => (
                <th
                  key={k}
                  className="py-2 pr-4 text-right font-medium whitespace-nowrap"
                >
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
                    <td
                      key={k}
                      className="py-2 pr-4 text-right whitespace-nowrap"
                    >
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
      </div>

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

      <h2 className="mt-6 text-sm font-semibold text-gray-700">Documents</h2>
      {d.documents.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">No documents.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {d.documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                {doc.category}
              </span>
              <span>{doc.filename}</span>
              <span className="text-xs text-gray-400">
                {utcDate(doc.uploadedAt)} · {doc.uploader}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
