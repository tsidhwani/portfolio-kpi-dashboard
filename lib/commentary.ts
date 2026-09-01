import { z } from "zod";
import { AuditAction } from "@prisma/client";
import { prisma } from "./prisma";
import { canEditCommentary, type SessionUser } from "./rbac";
import { periodKeyToDate } from "./periods";
import { logAudit } from "./audit";

/**
 * Commentary write path (PRD 6.3 — free-form note per company per reporting
 * period, attributed + timestamped as part of the audit trail, PRD 8.1).
 * One editable note per author per company per period (schema
 * @@unique([companyId, period, authorId])). "Rich text" is stored as plain
 * multi-line text for the mock phase — rendered with preserved line breaks.
 *
 * Same shape as lib/kpi-entry.ts: acting user passed in explicitly, RBAC
 * re-checked here, KpiValue-style transaction that also writes the audit row.
 */

export type CommentaryResult =
  | { status: "saved"; id: string }
  | { status: "deleted" }
  | { status: "error"; message: string };

const Input = z.object({
  companyId: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/, "bad period"),
  body: z.string().trim().max(10_000),
});
export type CommentaryInput = z.infer<typeof Input>;

export async function saveCommentary(
  user: SessionUser,
  raw: unknown,
): Promise<CommentaryResult> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { companyId, period, body } = parsed.data;

  if (!canEditCommentary(user, companyId)) {
    return { status: "error", message: "You don't have permission to comment on this company." };
  }

  const company = await prisma.portfolioCompany.findUnique({ where: { id: companyId } });
  if (!company) return { status: "error", message: "Unknown company." };

  const periodDate = periodKeyToDate(period);
  const existing = await prisma.commentary.findUnique({
    where: {
      companyId_period_authorId: { companyId, period: periodDate, authorId: user.id },
    },
  });

  // Empty body = clear the note (delete + audit), if one exists.
  if (body === "") {
    if (!existing) return { status: "deleted" };
    await prisma.$transaction(async (tx) => {
      await tx.commentary.delete({ where: { id: existing.id } });
      await logAudit(
        {
          actorId: user.id,
          action: AuditAction.DELETE,
          entityType: "Commentary",
          entityId: existing.id,
          before: { body: existing.body },
        },
        tx,
      );
    });
    return { status: "deleted" };
  }

  if (existing && existing.body === body) return { status: "saved", id: existing.id };

  const savedId = await prisma.$transaction(async (tx) => {
    const row = await tx.commentary.upsert({
      where: {
        companyId_period_authorId: { companyId, period: periodDate, authorId: user.id },
      },
      create: { companyId, period: periodDate, authorId: user.id, body },
      update: { body },
    });
    await logAudit(
      {
        actorId: user.id,
        action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
        entityType: "Commentary",
        entityId: row.id,
        before: existing ? { body: existing.body } : undefined,
        after: { body: row.body, companyId, period },
      },
      tx,
    );
    return row.id;
  });

  return { status: "saved", id: savedId };
}
