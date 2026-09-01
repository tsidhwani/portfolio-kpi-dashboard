/**
 * Provision (or update) a real user so they can sign in during local dev.
 * The OAuth gate in lib/auth.ts only admits emails that already exist in
 * the User table — this is how you add yourself or a teammate.
 *
 *   npm run db:grant -- <email> <PARTNER|DEAL_TEAM|CFO|ADMIN> [companyId...]
 *
 * Examples:
 *   npm run db:grant -- tapan.sidhwani@gmail.com ADMIN
 *   npm run db:grant -- me@gmail.com CFO co_northwind
 *
 * CFO requires at least one companyId (that's the whole point of the role).
 * Re-running updates the role / replaces company access. The real
 * authProviderId is written on first sign-in; a placeholder is fine here.
 */
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [email, roleArg, ...companyIds] = process.argv.slice(2);

  if (!email || !roleArg) {
    console.error(
      "usage: npm run db:grant -- <email> <PARTNER|DEAL_TEAM|CFO|ADMIN> [companyId...]",
    );
    process.exit(1);
  }

  const role = roleArg.toUpperCase() as Role;
  if (!Object.values(Role).includes(role)) {
    console.error(`invalid role "${roleArg}". one of: ${Object.values(Role).join(", ")}`);
    process.exit(1);
  }
  if (role === Role.CFO && companyIds.length === 0) {
    console.error("CFO needs at least one companyId, e.g. co_northwind");
    process.exit(1);
  }

  const normalized = email.toLowerCase();

  if (companyIds.length > 0) {
    const found = await prisma.portfolioCompany.findMany({
      where: { id: { in: companyIds } },
      select: { id: true },
    });
    const missing = companyIds.filter((id) => !found.some((c) => c.id === id));
    if (missing.length) {
      console.error(`unknown companyId(s): ${missing.join(", ")}`);
      process.exit(1);
    }
  }

  const user = await prisma.user.upsert({
    where: { email: normalized },
    update: { role, active: true }, // granting access also re-activates
    create: {
      email: normalized,
      name: normalized.split("@")[0],
      role,
      authProviderId: `pending|${normalized}`,
    },
  });

  // Replace company access with exactly what was passed.
  await prisma.companyAccess.deleteMany({ where: { userId: user.id } });
  if (companyIds.length > 0) {
    await prisma.companyAccess.createMany({
      data: companyIds.map((companyId) => ({ userId: user.id, companyId })),
    });
  }

  console.log(
    `${user.email} -> ${user.role}` +
      (companyIds.length ? ` (companies: ${companyIds.join(", ")})` : " (firm-wide)"),
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
