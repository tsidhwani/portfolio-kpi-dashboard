import { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  role: Role;
  fundIds: string[];
  companyIds: string[];
};

/**
 * Central access check. Call this in every API route and server action
 * before touching financial data — never rely on the UI hiding a link.
 *
 * PRD Sec 9 leaves fund/company scoping as an open question for
 * Partner/Deal Team roles. Default here is FIRM-WIDE for those two
 * roles (matches "everyone should be able to edit" instruction) with
 * CFO always restricted to their own company. Flip `firmWideRoles`
 * below if you decide to scope Partner/Deal Team by coverage instead —
 * that's the one open question worth resolving before this ships.
 */
const firmWideRoles: Role[] = ["PARTNER", "DEAL_TEAM", "ADMIN"];

export function canAccessCompany(user: SessionUser, companyId: string): boolean {
  if (firmWideRoles.includes(user.role)) return true;
  if (user.role === "CFO") return user.companyIds.includes(companyId);
  return false;
}

export function canEditFinancials(user: SessionUser, companyId: string): boolean {
  if (user.role === "CFO") return user.companyIds.includes(companyId);
  return firmWideRoles.includes(user.role);
}

export function canManageUsers(user: SessionUser): boolean {
  return user.role === "ADMIN";
}

export function canViewAuditLog(user: SessionUser): boolean {
  return user.role === "ADMIN" || user.role === "PARTNER" || user.role === "DEAL_TEAM";
}
