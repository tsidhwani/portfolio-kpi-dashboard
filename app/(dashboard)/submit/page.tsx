import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getEditableCompanies } from "@/lib/companies";
import {
  dateToPeriodKey,
  periodKeyToDate,
  periodLabel,
  recentPeriodKeys,
} from "@/lib/periods";
import { EntryGrid } from "../entry/entry-grid";

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

  const kpiDefs = await prisma.kpiDefinition.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, unit: true, category: true },
  });
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
      <h1 className="text-xl font-semibold">Submit financials</h1>
      <p className="mt-1 text-sm text-gray-500">
        {company.name} · {company.fundName}
      </p>

      <form method="GET" className="mt-4 flex items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Reporting month</span>
          <select
            name="period"
            defaultValue={periodKey}
            className="rounded border px-2 py-1"
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
                {filled.has(p) ? " — submitted" : ""}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded border px-3 py-1 hover:bg-gray-50">Load</button>
      </form>

      <p className="mt-4 text-sm text-gray-500">
        {periodLabel(periodKey)}
        {existing.length > 0 && (
          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
            already submitted — editing
          </span>
        )}
      </p>

      <EntryGrid
        key={`${company.id}:${periodKey}`}
        companyId={company.id}
        period={periodKey}
        kpiDefs={kpiDefs}
        initialValues={initialValues}
      />

      <p className="mt-4 text-xs text-gray-400">
        Your entries are recorded as CFO submissions and reviewed by the deal team.
      </p>
    </div>
  );
}
