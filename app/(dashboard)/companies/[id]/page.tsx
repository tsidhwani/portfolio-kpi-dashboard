import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { canEditCommentary, canUploadDocuments } from "@/lib/rbac";
import { getCompanyDetail } from "@/lib/reporting";
import { periodLabel, periodShortLabel } from "@/lib/periods";
import { formatByUnit, formatSignedPct } from "@/lib/format";
import { PageHeader, StatusBadge, VarianceLegend, flagTextClass } from "../../ui";
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
  return (
    <div className="mt-0.5 text-[0.6875rem] font-normal text-ink-faint">
      {parts.join("  ·  ")}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 border-b border-line pb-2 text-lg">{children}</h2>
  );
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
    <div>
      {firmWide && (
        <Link
          href={`/funds/${d.fund.id}`}
          className="text-[0.8125rem] text-ink-soft no-underline hover:text-ink"
        >
          ← {d.fund.name}
        </Link>
      )}

      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={d.computedStatus} />
          </span>
        }
        title={d.name}
        meta={
          <>
            {d.industry} · {firmWide ? d.fund.name : d.fund.name} ·{" "}
            {d.ownershipPct}% owned · invested {utcDate(d.investmentDate)}
          </>
        }
        actions={
          <>
            <a href={`/api/export/companies/${d.id}`} className="btn">
              Export CSV
            </a>
            <Link href={`/companies/${d.id}/report`} className="btn no-underline">
              Printable report
            </Link>
          </>
        }
      />

      <div className="flex items-baseline justify-between">
        <h2 className="text-lg">KPI history</h2>
        <span className="text-[0.75rem] text-ink-faint">
          actual over budget · last {d.periodKeys.length} months
        </span>
      </div>
      <div className="mt-1.5">
        <VarianceLegend />
      </div>

      <div className="card mt-3 overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th className="pl-4">Metric</th>
              {d.periodKeys.map((k) => (
                <th key={k} className="num">
                  {periodShortLabel(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.kpiDefs.map((kpi) => (
              <tr key={kpi.id}>
                <td className="pl-4 align-top">
                  <span className="font-medium text-ink">{kpi.name}</span>{" "}
                  <span className="text-ink-faint">({kpi.unit})</span>
                  <TrendLine t={d.trend[kpi.id]} />
                </td>
                {d.periodKeys.map((k) => {
                  const cell = d.grid[kpi.id]?.[k];
                  return (
                    <td key={k} className="num align-top">
                      {cell && (cell.actual != null || cell.budget != null) ? (
                        <>
                          <div className={flagTextClass(cell.flag)}>
                            {formatByUnit(cell.actual, kpi.unit)}
                          </div>
                          <div className="text-[0.6875rem] text-ink-faint">
                            {formatByUnit(cell.budget, kpi.unit)}
                          </div>
                        </>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.6875rem] text-ink-faint">
        MoM / QoQ / YoY compare the latest month&apos;s actual to 1 / 3 / 12 months prior.
      </p>

      <SectionHeading>Commentary</SectionHeading>
      {mayComment && (
        <CommentaryEditor companyId={d.id} periods={commentPeriods} myNotes={myNotes} />
      )}
      {d.commentary.length === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-ink-faint">No commentary.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {d.commentary.map((c) => (
            <li key={c.id} className="border-l-2 border-line-strong pl-3 text-[0.8125rem]">
              <div className="eyebrow mb-1">
                {periodLabel(c.periodKey)} · {c.author}
              </div>
              <div className="whitespace-pre-wrap text-ink">{c.body}</div>
            </li>
          ))}
        </ul>
      )}

      <SectionHeading>Documents</SectionHeading>
      {mayUpload && <DocumentUpload companyId={d.id} />}
      {d.documents.length === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-ink-faint">No documents.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line card">
          {d.documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[0.8125rem]">
              <span className="eyebrow w-20 shrink-0">{doc.category.replace("_", " ")}</span>
              <a
                href={`/api/documents/${doc.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-ink no-underline hover:underline"
              >
                {doc.filename}
              </a>
              <span className="ml-auto text-[0.6875rem] text-ink-faint">
                {utcDate(doc.uploadedAt)} · {doc.uploader}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
