import type { AuditAction } from "@prisma/client";
import { prisma } from "./prisma";
import { canViewAuditLog, type SessionUser } from "./rbac";

/**
 * Read side of the audit trail (PRD Sec 4 "View audit log / change history"
 * — Partner / Deal Team / Admin; never CFO). The log itself stays
 * append-only and is written only via logAudit() in lib/audit.ts.
 */

export type AuditEntryRow = {
  id: string;
  timestamp: Date;
  actor: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
};

export type AuditPage = {
  entries: AuditEntryRow[];
  entityTypes: string[];
  nextCursor: string | null;
};

const PAGE = 50;

export async function listAuditEntries(
  user: SessionUser,
  opts: { entityType?: string; cursor?: string } = {},
): Promise<AuditPage> {
  if (!canViewAuditLog(user)) return { entries: [], entityTypes: [], nextCursor: null };

  const where = opts.entityType ? { entityType: opts.entityType } : {};

  const [rows, grouped] = await Promise.all([
    prisma.auditLogEntry.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: PAGE + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        timestamp: true,
        action: true,
        entityType: true,
        entityId: true,
        beforeValue: true,
        afterValue: true,
        actor: { select: { name: true } },
      },
    }),
    prisma.auditLogEntry.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;

  return {
    entries: page.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      actor: r.actor?.name ?? "—",
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      before: r.beforeValue,
      after: r.afterValue,
    })),
    entityTypes: grouped.map((g) => g.entityType),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
