import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getEditableCompanies } from "@/lib/companies";
import { getKpiDefsFor } from "@/lib/kpi-defs";
import {
  dateToPeriodKey,
  periodKeyToDate,
  periodLabel,
  recentPeriodKeys,
} from "@/lib/periods";
import { EntryGrid } from "../entry/entry-grid";
import { PageHeader } from "../ui";

export const dynamic = "force-dynamic";

/**
 * Restricted submission view for a Portfolio Co. CFO — one company, no
 * picker, no fund/firm chrome. Hard scoping lives in lib/rbac.ts: the
 * shared saveKpiValues action re-checks canEditFinancials() against the
 * company id, so a tampered request for another company is rejected server
 * side regardless of what this page renders.
 */
export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "CFO") redirect("/entry");

  const editable = await getEditableCompanies(user);
  if (editable.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        No company is assigned to your account. Contact the deal team.
      </p>
    );
  }
  const company = editable[0];

  const periods = recentPeriodKeys(15);
  const filled = new Set(
    (
      await prisma.kpiValue.findMany({
        where: { companyId: company.id },
        select: { period: true },
      })
    ).map((v) => dateToPeriodKey(v.period)),
  );

  const sp = await searchParams;
  const periodKey = periods.includes(sp.period ?? "")
    ? sp.period!
    : periods.find((p) => !filled.has(p)) ?? periods[0];

  const kpiDefs = await getKpiDefsFor(company);
  const existing = await prisma.kpiValue.findMany({
    where: { companyId: company.id, period: periodKeyToDate(periodKey) },
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
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={`${company.name} · ${company.fundName}`}
        title="Submit financials"
        meta={
          existing.length > 0
            ? `${periodLabel(periodKey)} — already submitted, editing`
            : periodLabel(periodKey)
        }
      />

      <form method="GET" className="flex items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Reporting month</span>
          <select name="period" defaultValue={periodKey} className="field">
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
                {filled.has(p) ? " — submitted" : ""}
              </option>
            ))}
          </select>
        </label>
        <button className="btn">Load</button>
      </form>

      <EntryGrid
        key={`${company.id}:${periodKey}`}
        companyId={company.id}
        period={periodKey}
        kpiDefs={kpiDefs}
        initialValues={initialValues}
      />

      <p className="mt-4 text-[0.6875rem] text-ink-faint">
        Your entries are recorded as CFO submissions and reviewed by the deal team.
      </p>
    </div>
  );
}
