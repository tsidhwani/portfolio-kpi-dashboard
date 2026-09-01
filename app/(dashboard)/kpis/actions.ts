"use server";

import { requireSessionUser } from "@/lib/session";
import { upsertKpiDefinition, type AdminResult } from "@/lib/admin";

/**
 * KPI template library write path. PRD Sec 4 grants template management to
 * Partner / Deal Team / Admin (everyone except CFO) — lib/admin.ts re-checks
 * canManageKpiTemplates().
 */
export async function saveKpiDefinition(
  raw: unknown,
): Promise<AdminResult<{ id: string }>> {
  const actor = await requireSessionUser();
  return upsertKpiDefinition(actor, raw);
}
