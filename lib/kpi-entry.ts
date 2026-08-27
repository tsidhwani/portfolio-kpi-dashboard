import { z } from "zod";
import { AuditAction, KpiSource, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { canEditFinancials, type SessionUser } from "./rbac";
import { periodKeyToDate } from "./periods";
import { logAudit } from "./audit";

const numeric = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, "values must be plain numbers (no commas or symbols)")
  .nullable();

const Input = z.object({
  companyId: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/, "bad period"),
  rows: z
    .array(
      z.object({
        kpiDefId: z.string().min(1),
        actual: numeric,
        budget: numeric,
      }),
    )
    .min(1),
});

export type KpiEntryInput = z.infer<typeof Input>;

// String discriminant (not a boolean) so it narrows with strictNullChecks off.
export type SaveResult =
  | { status: "saved"; count: number }
  | { status: "error"; message: string };

const toDecimal = (s: string | null) => (s === null ? null : new Prisma.Decimal(s));
const sameDecimal = (a: Prisma.Decimal | null, b: Prisma.Decimal | null) =>
  (a === null && b === null) || (!!a && !!b && a.equals(b));

/**
 * Core write path (CLAUDE.md build order #2). Takes the acting user
 * explicitly so it can be tested without a request context — the
 * "use server" wrapper in app/(dashboard)/entry/actions.ts is the only
 * thing that turns a session into a SessionUser. Every mutation:
 *  - checks canEditFinancials() for the target company (rule #2),
 *  - writes KpiValue + AuditLogEntry in one transaction (rule #1).
 * Only changed metrics are written; empty rows that don't already exist
 * are skipped rather than stored as null/null.
 */
export async function applyKpiEntry(user: SessionUser, raw: unknown): Promise<SaveResult> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { companyId, period, rows } = parsed.data;

  if (!canEditFinancials(user, companyId)) {
    return { status: "error", message: "You don't have permission to edit this company." };
  }

  const company = await prisma.portfolioCompany.findUnique({ where: { id: companyId } });
  if (!company) return { status: "error", message: "Unknown company." };

  const periodDate = periodKeyToDate(period);

  const validKpiIds = new Set(
    (await prisma.kpiDefinition.findMany({ select: { id: true } })).map((k) => k.id),
  );
  const unknown = rows.find((r) => !validKpiIds.has(r.kpiDefId));
  if (unknown) return { status: "error", message: `Unknown metric: ${unknown.kpiDefId}` };

  const source = user.role === "CFO" ? KpiSource.CFO_SUBMISSION : KpiSource.MANUAL_ENTRY;

  const existing = await prisma.kpiValue.findMany({ where: { companyId, period: periodDate } });
  const byKpi = new Map(existing.map((v) => [v.kpiDefId, v]));

  const changed = rows.filter((r) => {
    const prev = byKpi.get(r.kpiDefId);
    const nextActual = toDecimal(r.actual);
    const nextBudget = toDecimal(r.budget);
    if (!prev) return !(nextActual === null && nextBudget === null);
    return !sameDecimal(prev.actual, nextActual) || !sameDecimal(prev.budget, nextBudget);
  });

  if (changed.length === 0) return { status: "saved", count: 0 };

  await prisma.$transaction(async (tx) => {
    for (const r of changed) {
      const prev = byKpi.get(r.kpiDefId);
      const data = { actual: toDecimal(r.actual), budget: toDecimal(r.budget), source };

      const saved = await tx.kpiValue.upsert({
        where: {
          companyId_kpiDefId_period: { companyId, kpiDefId: r.kpiDefId, period: periodDate },
        },
        create: { companyId, kpiDefId: r.kpiDefId, period: periodDate, ...data },
        update: data,
      });

      await logAudit(
        {
          actorId: user.id,
          action: prev ? AuditAction.UPDATE : AuditAction.CREATE,
          entityType: "KpiValue",
          entityId: saved.id,
          before: prev ? { actual: prev.actual, budget: prev.budget } : undefined,
          after: { actual: saved.actual, budget: saved.budget },
        },
        tx,
      );
    }
  });

  return { status: "saved", count: changed.length };
}
