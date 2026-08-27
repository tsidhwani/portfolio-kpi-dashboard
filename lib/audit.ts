import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Append-only audit write. This table has no update or delete path exposed
 * anywhere in the app, including for Admins (CLAUDE.md rule #1).
 *
 * Pass the transaction client so the audit row commits or rolls back with
 * the mutation it records:
 *
 *   await prisma.$transaction(async (tx) => {
 *     const value = await tx.kpiValue.update(...);
 *     await logAudit({ ... }, tx);
 *   });
 */
export async function logAudit(
  params: {
    actorId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
  db: Db = prisma,
) {
  return db.auditLogEntry.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeValue: params.before as Prisma.InputJsonValue,
      afterValue: params.after as Prisma.InputJsonValue,
    },
  });
}
