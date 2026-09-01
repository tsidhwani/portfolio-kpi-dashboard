"use server";

import { requireSessionUser } from "@/lib/session";
import { upsertUser, type AdminResult } from "@/lib/admin";

/**
 * Client-callable entry points for user management. Resolves the request
 * session to a SessionUser and hands off to lib/admin.ts, which does the
 * canManageUsers() check + transactional write + audit. Keep exports here
 * limited to real server actions — anything exported is client-callable.
 * (KPI-template writes live in app/(dashboard)/kpis/actions.ts.)
 */
export async function saveUser(raw: unknown): Promise<AdminResult<{ id: string }>> {
  const actor = await requireSessionUser();
  return upsertUser(actor, raw);
}
