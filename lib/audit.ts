import { PrismaClient, AuditAction } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Call this from inside the same transaction as any create/update/delete
 * on financial data, commentary, or documents. This table has no update
 * or delete path exposed anywhere in the app, including for Admins —
 * that's the whole point per PRD Sec 8.1.
 */
export async function logAudit(params: {
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  return prisma.auditLogEntry.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeValue: params.before as any,
      afterValue: params.after as any,
    },
  });
}
