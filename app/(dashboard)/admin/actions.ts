"use server";

import { requireSessionUser } from "@/lib/session";
import {
  upsertUser,
  upsertKpiDefinition,
  type AdminResult,
} from "@/lib/admin";

/**
 * Client-callable entry points for the admin surface. Each one resolves the
 * request session to a SessionUser and hands off to lib/admin.ts, which does
 * the canManageUsers() check + transactional write + audit. Keep exports
 * here limited to real server actions — anything exported is client-callable.
 */

export async function saveUser(raw: unknown): Promise<AdminResult<{ id: string }>> {
  const actor = await requireSessionUser();
  return upsertUser(actor, raw);
}

export async function saveKpiDefinition(
  raw: unknown,
): Promise<AdminResult<{ id: string }>> {
  const actor = await requireSessionUser();
  return upsertKpiDefinition(actor, raw);
}
