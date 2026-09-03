import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getEditableCompanies } from "@/lib/companies";
import { getKpiDefsFor } from "@/lib/kpi-defs";
import {
  periodKeyToDate,
  periodLabel,
  recentPeriodKeys,
} from "@/lib/periods";
import { EntryGrid } from "./entry-grid";
import { PageHeader } from "../ui";

export const dynamic = "force-dynamic";

type Search = { company?: string; period?: string };

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // CFOs use the dedicated single-company submission view.
  if (user.role === "CFO") redirect("/submit");

  const companies = await getEditableCompanies(user);
  if (companies.length === 0) {
    return (
      <p className="text-[0.8125rem] text-ink-soft">
        You don&apos;t have edit access to any company.
      </p>
    );
  }

  const periods = recentPeriodKeys(15);
  const sp = await searchParams;
  const companyId = companies.some((c) => c.id === sp.company)
    ? sp.company!
    : companies[0].id;
  const periodKey = periods.includes(sp.period ?? "") ? sp.period! : periods[0];

  const company = companies.find((c) => c.id === companyId)!;
  const kpiDefs = await getKpiDefsFor(company);

  const existing = await prisma.kpiValue.findMany({
    where: { companyId, period: periodKeyToDate(periodKey) },
    select: { kpiDefId: true, actual: true, budget: true },
  });
  const initialValues: Record<string, { actual: string; budget: string }> = {};
  for (const v of existing) {
    initialValues[v.kpiDefId] = {
      actual: v.actual == null ? "" : v.actual.toString(),
      budget: v.budget == null ? "" : v.budget.toString(),
    };
  }

  return (
    <div>
      <PageHeader
        eyebrow="Deal team"
        title="Monthly Entry"
        meta={`${company.name} · ${periodLabel(periodKey)}`}
      />

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Company</span>
          <select name="company" defaultValue={companyId} className="field">
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.fundName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Month</span>
          <select name="period" defaultValue={periodKey} className="field">
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <button className="btn">Load</button>
      </form>

      <EntryGrid
        key={`${companyId}:${periodKey}`}
        companyId={companyId}
        period={periodKey}
        kpiDefs={kpiDefs}
        initialValues={initialValues}
      />
    </div>
  );
}
