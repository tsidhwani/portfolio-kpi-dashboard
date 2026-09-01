import { z } from "zod";
import { AuditAction, KpiCategory, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { canManageUsers, canManageKpiTemplates, type SessionUser } from "./rbac";
import { logAudit } from "./audit";

/**
 * Admin surface (CLAUDE.md build order #6): user management + the KPI
 * template library. Same shape as lib/kpi-entry.ts — the acting user is
 * passed in explicitly, every entry point re-checks canManageUsers(), and
 * writes go through a transaction that also appends an AuditLogEntry.
 *
 * The "use server" wrappers in app/(dashboard)/admin/actions.ts are the
 * only things that turn a request session into a SessionUser.
 */

// String discriminant so it narrows with strictNullChecks off (see SaveResult
// in lib/kpi-entry.ts for the same trick).
export type AdminResult<T = undefined> =
  | { status: "ok"; data?: T }
  | { status: "error"; message: string };

const ok = <T>(data?: T): AdminResult<T> => ({ status: "ok", data });
const err = (message: string): AdminResult<never> => ({ status: "error", message });

// --- reads ------------------------------------------------------------------

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  fundIds: string[];
  companyIds: string[];
};

export async function listUsers(user: SessionUser): Promise<AdminUserRow[]> {
  if (!canManageUsers(user)) return [];
  const rows = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      fundAccess: { select: { fundId: true } },
      companyAccess: { select: { companyId: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    active: r.active,
    fundIds: r.fundAccess.map((f) => f.fundId),
    companyIds: r.companyAccess.map((c) => c.companyId),
  }));
}

export type ScopeOptions = {
  funds: { id: string; name: string }[];
  companies: { id: string; name: string; fundId: string; fundName: string }[];
};

/** Funds + companies for the access-assignment pickers. */
export async function getScopeOptions(user: SessionUser): Promise<ScopeOptions> {
  if (!canManageUsers(user)) return { funds: [], companies: [] };
  const [funds, companies] = await Promise.all([
    prisma.fund.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.portfolioCompany.findMany({
      orderBy: [{ fund: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, fundId: true, fund: { select: { name: true } } },
    }),
  ]);
  return {
    funds,
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      fundId: c.fundId,
      fundName: c.fund.name,
    })),
  };
}

export type AdminKpiRow = {
  id: string;
  name: string;
  category: KpiCategory;
  unit: string;
  cadence: string;
  appliesTo: string | null;
  isCustom: boolean;
  retired: boolean;
  valueCount: number;
};

export async function listKpiDefinitions(user: SessionUser): Promise<AdminKpiRow[]> {
  if (!canManageKpiTemplates(user)) return [];
  const rows = await prisma.kpiDefinition.findMany({
    orderBy: [{ retired: "asc" }, { category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      unit: true,
      cadence: true,
      appliesTo: true,
      isCustom: true,
      retired: true,
      _count: { select: { values: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    cadence: r.cadence,
    appliesTo: r.appliesTo,
    isCustom: r.isCustom,
    retired: r.retired,
    valueCount: r._count.values,
  }));
}

// --- user create / update -------------------------------------------------

const emptyToNull = (s: string | null | undefined) => {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};

const UserInput = z.object({
  id: z.string().min(1).nullish(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  name: z.string().trim().min(1, "Name is required."),
  role: z.nativeEnum(Role),
  active: z.boolean(),
  fundIds: z.array(z.string().min(1)).default([]),
  companyIds: z.array(z.string().min(1)).default([]),
});
export type UserInput = z.input<typeof UserInput>;

export async function upsertUser(
  actor: SessionUser,
  raw: unknown,
): Promise<AdminResult<{ id: string }>> {
  if (!canManageUsers(actor)) return err("You don't have permission to manage users.");

  const parsed = UserInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  const input = parsed.data;

  const existing = input.id
    ? await prisma.user.findUnique({ where: { id: input.id } })
    : null;
  if (input.id && !existing) return err("User not found.");

  // Email uniqueness (Prisma would throw, but a clean message is nicer).
  const byEmail = await prisma.user.findUnique({ where: { email: input.email } });
  if (byEmail && byEmail.id !== existing?.id) {
    return err(`Another user already has the email ${input.email}.`);
  }

  // CFO is defined by owning exactly one company's submissions.
  if (input.role === Role.CFO && input.companyIds.length === 0) {
    return err("A CFO must be scoped to at least one company.");
  }

  // Lockout guards: an admin can't lock themselves out.
  if (existing && existing.id === actor.id) {
    if (input.role !== Role.ADMIN) return err("You can't change your own role.");
    if (!input.active) return err("You can't deactivate your own account.");
  }

  const validFundIds = new Set(
    (
      await prisma.fund.findMany({
        where: { id: { in: input.fundIds } },
        select: { id: true },
      })
    ).map((f) => f.id),
  );
  const badFund = input.fundIds.find((id) => !validFundIds.has(id));
  if (badFund) return err(`Unknown fund: ${badFund}`);

  const validCompanyIds = new Set(
    (
      await prisma.portfolioCompany.findMany({
        where: { id: { in: input.companyIds } },
        select: { id: true },
      })
    ).map((c) => c.id),
  );
  const badCompany = input.companyIds.find((id) => !validCompanyIds.has(id));
  if (badCompany) return err(`Unknown company: ${badCompany}`);

  const before = existing
    ? {
        role: existing.role,
        active: existing.active,
        name: existing.name,
        email: existing.email,
      }
    : undefined;

  const savedId = await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            name: input.name,
            email: input.email,
            role: input.role,
            active: input.active,
          },
        })
      : await tx.user.create({
          data: {
            name: input.name,
            email: input.email,
            role: input.role,
            active: input.active,
            // Real subject claim is written on first OAuth sign-in
            // (see lib/auth.ts); placeholder keeps the unique constraint happy.
            authProviderId: `pending|${input.email}`,
          },
        });

    // Replace scope rows with exactly what was submitted.
    await tx.fundAccess.deleteMany({ where: { userId: user.id } });
    if (input.fundIds.length) {
      await tx.fundAccess.createMany({
        data: input.fundIds.map((fundId) => ({ userId: user.id, fundId })),
      });
    }
    await tx.companyAccess.deleteMany({ where: { userId: user.id } });
    if (input.companyIds.length) {
      await tx.companyAccess.createMany({
        data: input.companyIds.map((companyId) => ({ userId: user.id, companyId })),
      });
    }

    await logAudit(
      {
        actorId: actor.id,
        action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
        entityType: "User",
        entityId: user.id,
        before,
        after: {
          role: user.role,
          active: user.active,
          name: user.name,
          email: user.email,
          fundIds: input.fundIds,
          companyIds: input.companyIds,
        },
      },
      tx,
    );

    return user.id;
  });

  return ok({ id: savedId });
}

// --- KPI definition create / update -------------------------------------

const KpiInput = z.object({
  id: z.string().min(1).nullish(),
  name: z.string().trim().min(1, "Name is required."),
  category: z.nativeEnum(KpiCategory),
  unit: z.string().trim().min(1, "Unit is required (e.g. USD, %, FTEs, count)."),
  cadence: z.string().trim().min(1).default("monthly"),
  appliesTo: z.string().trim().nullish(),
  isCustom: z.boolean().default(true),
  retired: z.boolean().default(false),
});
export type KpiInput = z.input<typeof KpiInput>;

export async function upsertKpiDefinition(
  actor: SessionUser,
  raw: unknown,
): Promise<AdminResult<{ id: string }>> {
  if (!canManageKpiTemplates(actor)) {
    return err("You don't have permission to manage the KPI library.");
  }

  const parsed = KpiInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  const input = parsed.data;
  const appliesTo = emptyToNull(input.appliesTo);

  const existing = input.id
    ? await prisma.kpiDefinition.findUnique({ where: { id: input.id } })
    : null;
  if (input.id && !existing) return err("KPI definition not found.");

  // Name is what the reporting layer keys on (Revenue / EBITDA / …) — keep
  // it unique so a rename or a new metric can't collide with another.
  const byName = await prisma.kpiDefinition.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
  });
  if (byName && byName.id !== existing?.id) {
    return err(`A KPI named "${input.name}" already exists.`);
  }

  const before = existing
    ? {
        name: existing.name,
        category: existing.category,
        unit: existing.unit,
        cadence: existing.cadence,
        appliesTo: existing.appliesTo,
        isCustom: existing.isCustom,
        retired: existing.retired,
      }
    : undefined;

  const savedId = await prisma.$transaction(async (tx) => {
    const def = existing
      ? await tx.kpiDefinition.update({
          where: { id: existing.id },
          data: {
            name: input.name,
            category: input.category,
            unit: input.unit,
            cadence: input.cadence,
            appliesTo,
            retired: input.retired,
          },
        })
      : await tx.kpiDefinition.create({
          data: {
            name: input.name,
            category: input.category,
            unit: input.unit,
            cadence: input.cadence,
            appliesTo,
            isCustom: input.isCustom,
            retired: input.retired,
          },
        });

    await logAudit(
      {
        actorId: actor.id,
        action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
        entityType: "KpiDefinition",
        entityId: def.id,
        before,
        after: {
          name: def.name,
          category: def.category,
          unit: def.unit,
          cadence: def.cadence,
          appliesTo: def.appliesTo,
          isCustom: def.isCustom,
          retired: def.retired,
        },
      },
      tx,
    );

    return def.id;
  });

  return ok({ id: savedId });
}
