/**
 * Mock-data seed for local dev (Phase 1 — no live integrations).
 *
 * Deterministic: uses a fixed PRNG seed and a fixed date anchor, so
 * re-running produces identical data. Safe to run repeatedly — it wipes
 * every table first (FK-safe order) and rebuilds from scratch.
 *
 *   npm run db:seed        # reseed into the current schema
 *   npm run db:reset       # drop + recreate schema, then reseed
 *
 * Firm-wide access is the current default (see lib/rbac.ts / CLAUDE.md
 * open decision), so FundAccess/CompanyAccess rows are only created for
 * the CFO users, who are always company-scoped.
 */
import {
  PrismaClient,
  Role,
  CompanyStatus,
  KpiCategory,
  KpiSource,
  AuditAction,
} from "@prisma/client";
import { variancePct } from "../lib/format";
import { flagForVariance, rollUpFlags } from "../lib/variance";

const prisma = new PrismaClient();

// --- deterministic PRNG (mulberry32) ---------------------------------------
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260827);
const jitter = (amp: number) => (rand() - 0.5) * 2 * amp;

// --- reporting periods: 15 complete months ending 2026-07 ----------------
// 15 (not 12) so the latest few months have a full year of prior history
// for YoY trend (PRD 6.1).
const ANCHOR_YEAR = 2026;
const ANCHOR_MONTH = 7; // 0-indexed → August; last complete month is July
const periods: Date[] = [];
for (let i = 15; i >= 1; i--) {
  periods.push(new Date(Date.UTC(ANCHOR_YEAR, ANCHOR_MONTH - i, 1)));
}
const latest = periods[periods.length - 1];
const monthLabel = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

// --- static reference data ----------------------------------------------------
const USERS = [
  { id: "usr_partner", name: "Dana Whitfield", email: "dana.whitfield@meridiancap.example", role: Role.PARTNER },
  { id: "usr_deal1", name: "Marcus Lee", email: "marcus.lee@meridiancap.example", role: Role.DEAL_TEAM },
  { id: "usr_deal2", name: "Priya Raman", email: "priya.raman@meridiancap.example", role: Role.DEAL_TEAM },
  { id: "usr_admin", name: "Sam Ortiz", email: "sam.ortiz@meridiancap.example", role: Role.ADMIN },
  { id: "usr_cfo_northwind", name: "Jane Koch", email: "jane.koch@northwindlogistics.example", role: Role.CFO },
  { id: "usr_cfo_helix", name: "Raj Patel", email: "raj.patel@helixbio.example", role: Role.CFO },
];

const FUNDS = [
  { id: "fund_gf2", name: "Meridian Growth Fund II", vintageYear: 2017, fundSize: 450_000_000, status: "Harvesting" },
  { id: "fund_gf3", name: "Meridian Growth Fund III", vintageYear: 2021, fundSize: 780_000_000, status: "Investing" },
  { id: "fund_of1", name: "Meridian Opportunities Fund I", vintageYear: 2022, fundSize: 300_000_000, status: "Investing" },
];

type Base = {
  revenue: number;
  ebitda: number;
  ebitdaMargin: number; // %
  netDebt: number; // USD; negative = net cash
  cash: number;
  headcount: number;
  customers: number;
};
const COMPANIES: {
  id: string;
  name: string;
  fundId: string;
  industry: string;
  investmentDate: string;
  ownershipPct: number;
  status: CompanyStatus;
  dealOwner: string;
  cfo?: string;
  base: Base;
}[] = [
  {
    id: "co_northwind", name: "Northwind Logistics", fundId: "fund_gf2", industry: "Logistics",
    investmentDate: "2018-03-01", ownershipPct: 62, status: CompanyStatus.YELLOW,
    dealOwner: "usr_deal1", cfo: "usr_cfo_northwind",
    base: { revenue: 8_200_000, ebitda: 900_000, ebitdaMargin: 11, netDebt: 35_000_000, cash: 4_500_000, headcount: 540, customers: 320 },
  },
  {
    id: "co_brightpath", name: "BrightPath Education", fundId: "fund_gf2", industry: "Education Tech",
    investmentDate: "2019-06-15", ownershipPct: 55, status: CompanyStatus.GREEN,
    dealOwner: "usr_deal1",
    base: { revenue: 3_100_000, ebitda: 620_000, ebitdaMargin: 20, netDebt: 8_000_000, cash: 9_000_000, headcount: 210, customers: 1_400 },
  },
  {
    id: "co_summit", name: "Summit Fabrication", fundId: "fund_gf2", industry: "Industrial Manufacturing",
    investmentDate: "2017-11-01", ownershipPct: 70, status: CompanyStatus.RED,
    dealOwner: "usr_deal1",
    base: { revenue: 5_600_000, ebitda: 210_000, ebitdaMargin: 4, netDebt: 22_000_000, cash: 1_200_000, headcount: 380, customers: 45 },
  },
  {
    id: "co_helix", name: "Helix Bio", fundId: "fund_gf3", industry: "Life Sciences",
    investmentDate: "2021-09-01", ownershipPct: 48, status: CompanyStatus.GREEN,
    dealOwner: "usr_deal2", cfo: "usr_cfo_helix",
    base: { revenue: 2_400_000, ebitda: -300_000, ebitdaMargin: -13, netDebt: -18_000_000, cash: 22_000_000, headcount: 130, customers: 12 },
  },
  {
    id: "co_cobalt", name: "Cobalt Payments", fundId: "fund_gf3", industry: "Fintech",
    investmentDate: "2022-02-01", ownershipPct: 40, status: CompanyStatus.GREEN,
    dealOwner: "usr_deal2",
    base: { revenue: 4_800_000, ebitda: 1_100_000, ebitdaMargin: 23, netDebt: 5_000_000, cash: 15_000_000, headcount: 240, customers: 8_600 },
  },
  {
    id: "co_verdant", name: "Verdant AgriData", fundId: "fund_gf3", industry: "AgTech",
    investmentDate: "2022-08-01", ownershipPct: 51, status: CompanyStatus.YELLOW,
    dealOwner: "usr_deal2",
    base: { revenue: 1_900_000, ebitda: -150_000, ebitdaMargin: -8, netDebt: -4_000_000, cash: 6_500_000, headcount: 95, customers: 480 },
  },
  {
    id: "co_lumen", name: "Lumen Health", fundId: "fund_of1", industry: "Healthcare Services",
    investmentDate: "2023-01-15", ownershipPct: 45, status: CompanyStatus.GREEN,
    dealOwner: "usr_deal2",
    base: { revenue: 6_300_000, ebitda: 780_000, ebitdaMargin: 12, netDebt: 24_000_000, cash: 8_800_000, headcount: 410, customers: 260 },
  },
  {
    id: "co_atlas", name: "Atlas Freight", fundId: "fund_of1", industry: "Logistics",
    investmentDate: "2023-05-01", ownershipPct: 58, status: CompanyStatus.YELLOW,
    dealOwner: "usr_deal1",
    base: { revenue: 7_100_000, ebitda: 640_000, ebitdaMargin: 9, netDebt: 20_000_000, cash: 3_900_000, headcount: 470, customers: 210 },
  },
];

type KpiKind = "growth" | "level";
const KPIS: {
  id: string;
  name: string;
  category: KpiCategory;
  unit: string;
  kind: KpiKind;
  growth?: number;
  noise: number;
  integer?: boolean;
  isCustom?: boolean;
  appliesTo?: string; // industry filter; undefined = all
  lowerIsBetter?: boolean; // e.g. Net Debt — under budget is favourable
  baseKey: keyof Base;
}[] = [
  { id: "kpi_revenue", name: "Revenue", category: KpiCategory.FINANCIAL, unit: "USD", kind: "growth", growth: 0.015, noise: 0.03, baseKey: "revenue" },
  { id: "kpi_ebitda", name: "EBITDA", category: KpiCategory.FINANCIAL, unit: "USD", kind: "growth", growth: 0.018, noise: 0.06, baseKey: "ebitda" },
  { id: "kpi_ebitda_margin", name: "EBITDA Margin", category: KpiCategory.FINANCIAL, unit: "%", kind: "level", noise: 1.2, baseKey: "ebitdaMargin" },
  { id: "kpi_net_debt", name: "Net Debt", category: KpiCategory.FINANCIAL, unit: "USD", kind: "growth", growth: -0.004, noise: 0.03, lowerIsBetter: true, baseKey: "netDebt" },
  { id: "kpi_cash_balance", name: "Cash Balance", category: KpiCategory.FINANCIAL, unit: "USD", kind: "growth", growth: 0.005, noise: 0.04, baseKey: "cash" },
  { id: "kpi_headcount", name: "Headcount", category: KpiCategory.OPERATIONAL, unit: "FTEs", kind: "growth", growth: 0.01, noise: 0.012, integer: true, baseKey: "headcount" },
  { id: "kpi_customer_count", name: "Customer Count", category: KpiCategory.OPERATIONAL, unit: "count", kind: "growth", growth: 0.02, noise: 0.02, integer: true, baseKey: "customers" },
];

// Mean performance of actual vs. budget, keyed by the *designed* narrative
// status. This drives how far a company runs from plan; the traffic-light
// flag itself is then computed from the resulting variance (PRD 6.5) and
// written back to PortfolioCompany.status below — nothing hand-sets it.
const PERF: Record<CompanyStatus, { growth: number; levelPts: number }> = {
  [CompanyStatus.GREEN]: { growth: 0.02, levelPts: 0.4 },
  [CompanyStatus.YELLOW]: { growth: -0.05, levelPts: -1.0 },
  [CompanyStatus.RED]: { growth: -0.14, levelPts: -2.6 },
};

const round = (n: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

async function wipe() {
  // FK-safe order: children first.
  await prisma.auditLogEntry.deleteMany();
  await prisma.document.deleteMany();
  await prisma.commentary.deleteMany();
  await prisma.kpiValue.deleteMany();
  await prisma.companyAccess.deleteMany();
  await prisma.fundAccess.deleteMany();
  await prisma.kpiDefinition.deleteMany();
  await prisma.portfolioCompany.deleteMany();
  await prisma.fund.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await wipe();

  // Users — authProviderId stands in for the OAuth subject claim.
  await prisma.user.createMany({
    data: USERS.map((u) => ({ ...u, authProviderId: `mock-oauth|${u.id}` })),
  });

  await prisma.fund.createMany({ data: FUNDS });

  await prisma.portfolioCompany.createMany({
    data: COMPANIES.map((c) => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      investmentDate: new Date(`${c.investmentDate}T00:00:00Z`),
      ownershipPct: c.ownershipPct,
      status: c.status,
      fundId: c.fundId,
    })),
  });

  // CFOs are company-scoped; everyone else is firm-wide (no rows needed).
  await prisma.companyAccess.createMany({
    data: COMPANIES.filter((c) => c.cfo).map((c) => ({ userId: c.cfo!, companyId: c.id })),
  });

  await prisma.kpiDefinition.createMany({
    data: KPIS.map((k) => ({
      id: k.id,
      name: k.name,
      category: k.category,
      unit: k.unit,
      cadence: "monthly",
      appliesTo: k.appliesTo ?? null,
      isCustom: !!k.isCustom,
    })),
  });

  // KPI values: 8 companies × 7 KPIs × 15 months.
  const kpiRows: {
    companyId: string;
    kpiDefId: string;
    period: Date;
    actual: number;
    budget: number;
    source: KpiSource;
  }[] = [];

  for (const co of COMPANIES) {
    const cfoSubmits = !!co.cfo;
    for (const kpi of KPIS) {
      const base = co.base[kpi.baseKey];
      const perf = PERF[co.status];
      periods.forEach((period, t) => {
        let budget: number;
        let actual: number;

        // For "lower is better" KPIs (Net Debt) a GREEN company should come
        // in *under* budget, so flip the performance delta's sign.
        const perfSign = kpi.lowerIsBetter ? -1 : 1;

        if (kpi.kind === "growth") {
          const g = kpi.growth ?? 0;
          // negative base = burn; trend it toward zero instead of compounding down
          const factor = base < 0 ? (1 - g) ** t : (1 + g) ** t;
          budget = base * factor;
          const perfDelta = (perf.growth + jitter(kpi.noise)) * perfSign;
          actual = budget * (1 + (base < 0 ? -perfDelta : perfDelta));
        } else {
          budget = base;
          actual = base + (perf.levelPts + jitter(kpi.noise)) * perfSign;
        }

        const dp = kpi.integer ? 0 : kpi.unit === "%" ? 1 : 0;
        kpiRows.push({
          companyId: co.id,
          kpiDefId: kpi.id,
          period,
          budget: round(budget, dp),
          actual: round(actual, dp),
          source: cfoSubmits ? KpiSource.CFO_SUBMISSION : KpiSource.MANUAL_ENTRY,
        });
      });
    }
  }
  await prisma.kpiValue.createMany({ data: kpiRows });

  // Derive the traffic-light flag from the latest period's financial-KPI
  // variance and store it (PRD 6.5 — the flag is automatic, not hand-set).
  const finById = new Map(KPIS.map((k) => [k.id, k]));
  for (const co of COMPANIES) {
    const flags = kpiRows
      .filter(
        (r) =>
          r.companyId === co.id &&
          r.period.getTime() === latest.getTime() &&
          finById.get(r.kpiDefId)?.category === KpiCategory.FINANCIAL,
      )
      .map((r) =>
        flagForVariance(
          variancePct(r.actual, r.budget),
          !finById.get(r.kpiDefId)?.lowerIsBetter,
        ),
      );
    const status = (rollUpFlags(flags) ?? CompanyStatus.GREEN) as CompanyStatus;
    await prisma.portfolioCompany.update({ where: { id: co.id }, data: { status } });
  }

  // Commentary — last 3 periods per company, plus a CFO note on the latest.
  const commentaryByStatus: Record<CompanyStatus, string> = {
    [CompanyStatus.GREEN]:
      "Tracking ahead of plan. Revenue and margin both in line or better; no material concerns this period.",
    [CompanyStatus.YELLOW]:
      "Slight miss to budget on revenue, driven by slower new-logo activity. Management has a recovery plan for next quarter; watching closely.",
    [CompanyStatus.RED]:
      "Continued underperformance. Revenue and EBITDA well below plan and cash runway is tightening. Escalated to the deal partner; turnaround options under review.",
  };

  const commentaryRows: { companyId: string; period: Date; authorId: string; body: string }[] = [];
  for (const co of COMPANIES) {
    for (const period of periods.slice(-3)) {
      commentaryRows.push({
        companyId: co.id,
        period,
        authorId: co.dealOwner,
        body: `${monthLabel(period)}: ${commentaryByStatus[co.status]}`,
      });
    }
    if (co.cfo) {
      commentaryRows.push({
        companyId: co.id,
        period: latest,
        authorId: co.cfo,
        body: `${monthLabel(latest)}: Numbers submitted and reconciled to the month-end close. Happy to walk through the bridge on our next call.`,
      });
    }
  }
  await prisma.commentary.createMany({ data: commentaryRows });

  // Documents — a board deck and a monthly report per company.
  const documentRows: {
    companyId: string;
    filename: string;
    blobUrl: string;
    uploaderId: string;
    category: string;
  }[] = [];
  for (const co of COMPANIES) {
    documentRows.push(
      {
        companyId: co.id,
        filename: `${co.name} — Board Deck (${monthLabel(latest)}).pdf`,
        blobUrl: `https://blob.example/${co.id}/board-deck-latest.pdf`,
        uploaderId: co.dealOwner,
        category: "board_deck",
      },
      {
        companyId: co.id,
        filename: `${co.name} — Monthly Report (${monthLabel(latest)}).pdf`,
        blobUrl: `https://blob.example/${co.id}/monthly-report-latest.pdf`,
        uploaderId: co.cfo ?? co.dealOwner,
        category: "report",
      },
    );
  }
  await prisma.document.createMany({ data: documentRows });

  // Audit log — one CREATE per company for the latest KPI batch, plus the
  // latest commentary. Mirrors what logAudit() would write at runtime.
  const auditRows: {
    actorId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    afterValue: object;
  }[] = [];
  for (const co of COMPANIES) {
    const actor = co.cfo ?? co.dealOwner;
    auditRows.push(
      {
        actorId: actor,
        action: AuditAction.CREATE,
        entityType: "KpiValue",
        entityId: `${co.id}:${latest.toISOString().slice(0, 10)}`,
        afterValue: { companyId: co.id, period: latest.toISOString().slice(0, 10), kpis: KPIS.length },
      },
      {
        actorId: co.dealOwner,
        action: AuditAction.CREATE,
        entityType: "Commentary",
        entityId: `${co.id}:${latest.toISOString().slice(0, 10)}`,
        afterValue: { companyId: co.id, period: latest.toISOString().slice(0, 10) },
      },
    );
  }
  await prisma.auditLogEntry.createMany({ data: auditRows });

  // --- summary ---
  const counts = {
    users: await prisma.user.count(),
    funds: await prisma.fund.count(),
    companies: await prisma.portfolioCompany.count(),
    kpiDefinitions: await prisma.kpiDefinition.count(),
    kpiValues: await prisma.kpiValue.count(),
    commentary: await prisma.commentary.count(),
    documents: await prisma.document.count(),
    companyAccess: await prisma.companyAccess.count(),
    auditLogEntries: await prisma.auditLogEntry.count(),
  };
  console.table(counts);
  console.log(
    `Periods: ${monthLabel(periods[0])} … ${monthLabel(latest)} (${periods.length} months)`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
