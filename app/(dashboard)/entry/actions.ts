"use server";

import { requireSessionUser } from "@/lib/session";
import { applyKpiEntry, type SaveResult } from "@/lib/kpi-entry";

/**
 * The only client-callable entry point for KPI writes. It turns the request
 * session into a SessionUser, then hands off to applyKpiEntry() which does
 * the RBAC check + transactional write. Keep this file's exports limited to
 * real server actions — anything exported here is callable from the client.
 */
export async function saveKpiValues(raw: unknown): Promise<SaveResult> {
  const user = await requireSessionUser();
  return applyKpiEntry(user, raw);
}
