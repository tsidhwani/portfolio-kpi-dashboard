import { prisma } from "./prisma";
import { canAccessCompany, canEditFinancials, type SessionUser } from "./rbac";

export type CompanyListItem = {
  id: string;
  name: string;
  industry: string;
  status: string;
  fundId: string;
  fundName: string;
};

async function listAll(): Promise<CompanyListItem[]> {
  const rows = await prisma.portfolioCompany.findMany({
    orderBy: [{ fund: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      industry: true,
      status: true,
      fundId: true,
      fund: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    industry: r.industry,
    status: r.status,
    fundId: r.fundId,
    fundName: r.fund.name,
  }));
}

/**
 * Companies the user may read / edit. Filtering runs through the lib/rbac.ts
 * helpers so there's one source of truth for access rules — including
 * whatever the open "scope Deal Team by coverage" decision lands on.
 */
export async function getAccessibleCompanies(user: SessionUser): Promise<CompanyListItem[]> {
  return (await listAll()).filter((c) => canAccessCompany(user, c.id));
}

export async function getEditableCompanies(user: SessionUser): Promise<CompanyListItem[]> {
  return (await listAll()).filter((c) => canEditFinancials(user, c.id));
}
