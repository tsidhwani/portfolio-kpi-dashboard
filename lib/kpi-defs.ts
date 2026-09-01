import { prisma } from "./prisma";

export type KpiDef = {
  id: string;
  name: string;
  unit: string;
  category: string;
};

/**
 * The KPI definitions that apply to a company right now: not retired, and
 * either global (`appliesTo` null) or matching the company's industry
 * (PRD 6.1 — "configurable KPIs so each company tracks what matters").
 * Pass `null` for the firm-wide set (all non-retired definitions).
 */
export async function getKpiDefsFor(
  company: { industry: string } | null,
): Promise<KpiDef[]> {
  const rows = await prisma.kpiDefinition.findMany({
    where: {
      retired: false,
      ...(company
        ? { OR: [{ appliesTo: null }, { appliesTo: company.industry }] }
        : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, unit: true, category: true },
  });
  return rows;
}
