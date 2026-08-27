import { auth } from "./auth";
import type { SessionUser } from "./rbac";

/**
 * The current user as the RBAC helpers expect them, or null if not signed
 * in / not provisioned. Use this in server components and read paths.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    fundIds: session.user.fundIds ?? [],
    companyIds: session.user.companyIds ?? [],
  };
}

/**
 * Same, but throws when there is no authenticated user. Use at the top of
 * API routes and server actions — pair with the lib/rbac.ts checks before
 * touching company data (CLAUDE.md rule #2).
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
