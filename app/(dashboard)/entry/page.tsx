import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getEditableCompanies } from "@/lib/companies";
import {
  periodKeyToDate,
  periodLabel,
  recentPeriodKeys,
} from "@/lib/periods";
import { EntryGrid } from "./entry-grid";

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
      <p className="text-sm text-gray-600">
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

  const kpiDefs = await prisma.kpiDefinition.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, unit: true, category: true },
  });

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

  const company = companies.find((c) => c.id === companyId)!;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">Monthly Entry</h1>

      <form method="GET" className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Company</span>
          <select
            name="company"
            defaultValue={companyId}
            className="rounded border px-2 py-1"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.fundName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Month</span>
          <select
            name="period"
            defaultValue={periodKey}
            className="rounded border px-2 py-1"
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded border px-3 py-1 hover:bg-gray-50">Load</button>
      </form>

      <p className="mt-4 text-sm text-gray-500">
        {company.name} · {periodLabel(periodKey)} ·{" "}
        <span className="uppercase">{company.status}</span>
      </p>

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
