import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { canEditCommentary, canUploadDocuments } from "@/lib/rbac";
import { getCompanyDetail } from "@/lib/reporting";
import { periodLabel, periodShortLabel } from "@/lib/periods";
import { formatByUnit, formatSignedPct } from "@/lib/format";
import { StatusBadge, VarianceLegend, flagTextClass } from "../../ui";
import { CommentaryEditor } from "./commentary-editor";
import { DocumentUpload } from "./document-upload";

export const dynamic = "force-dynamic";

const utcDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function TrendLine({
  t,
}: {
  t: { mom: number | null; qoq: number | null; yoy: number | null } | undefined;
}) {
  if (!t || (t.mom == null && t.qoq == null && t.yoy == null)) return null;
  const parts: string[] = [];
  if (t.mom != null) parts.push(`MoM ${formatSignedPct(t.mom)}`);
  if (t.qoq != null) parts.push(`QoQ ${formatSignedPct(t.qoq)}`);
  if (t.yoy != null) parts.push(`YoY ${formatSignedPct(t.yoy)}`);
  return <div className="text-xs font-normal text-gray-400">{parts.join(" · ")}</div>;
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const d = await getCompanyDetail(user, id, 12);
  if (!d) notFound();

  const firmWide = user.role !== "CFO";
  const mayComment = canEditCommentary(user, d.id);
  const mayUpload = canUploadDocuments(user, d.id);

  const myNotes: Record<string, string> = {};
  for (const c of d.commentary) {
    if (c.authorId === user.id) myNotes[c.periodKey] = c.body;
  }
  const commentPeriods = d.periodKeys.map((k) => ({ key: k, label: periodLabel(k) }));

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
                <td className="py-2 pr-4 whitespace-nowrap font-medium">
                  {kpi.name} <span className="text-gray-400">({kpi.unit})</span>
                  <TrendLine t={d.trend[kpi.id]} />
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
      <p className="mt-2 text-xs text-gray-400">
        MoM / QoQ / YoY compare the latest month&apos;s actual to 1 / 3 / 12 months prior.
      </p>

      <h2 className="mt-6 text-sm font-semibold text-gray-700">Commentary</h2>
      {mayComment && (
        <CommentaryEditor
          companyId={d.id}
          periods={commentPeriods}
          myNotes={myNotes}
        />
      )}
      {d.commentary.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">No commentary.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {d.commentary.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="text-xs text-gray-400">
                {periodLabel(c.periodKey)} · {c.author}
              </div>
              <div className="whitespace-pre-wrap">{c.body}</div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-sm font-semibold text-gray-700">Documents</h2>
      {mayUpload && <DocumentUpload companyId={d.id} />}
      {d.documents.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">No documents.</p>
      ) : (
        <ul className="mt-3 space-y-1 text-sm">
          {d.documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                {doc.category}
              </span>
              <a
                href={`/api/documents/${doc.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                {doc.filename}
              </a>
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
