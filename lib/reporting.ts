import type { CompanyStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { canAccessCompany, canViewFirmWide, type SessionUser } from "./rbac";
import { dateToPeriodKey, periodKeyToDate, recentPeriodKeys } from "./periods";
import { variancePct } from "./format";
import { getKpiDefsFor } from "./kpi-defs";
import {
  flagForVariance,
  kpiHigherIsBetter,
  rollUpFlags,
  type VarianceFlag,
} from "./variance";

const num = (d: unknown): number | null =>
  d == null ? null : Number(d as number);

/**
 * Traffic-light flag for a company in one period: worst variance flag across
 * its FINANCIAL KPIs (operational metrics are shown flagged per-cell but
 * don't drive the roll-up). Falls back to the stored status when the period
 * has no financial data to flag on.
 */
function companyPeriodFlag(
  kpiValues: {
    actual: unknown;
    budget: unknown;
    kpiDefinition: { name: string; category: string };
  }[],
  fallback: CompanyStatus,
): CompanyStatus {
  const flags = kpiValues
    .filter((v) => v.kpiDefinition.category === "FINANCIAL")
    .map((v) =>
      flagForVariance(
        variancePct(num(v.actual), num(v.budget)),
        kpiHigherIsBetter(v.kpiDefinition.name),
      ),
    );
  return rollUpFlags(flags) ?? fallback;
}

/**
 * The period to roll up "as of": the most recent month that has KPI data
 * for every portfolio company. Partially-entered months (a deal team member
 * mid-entry) are skipped so fund totals aren't misleadingly low. Falls back
 * to the absolute latest period if no month is complete.
 */
export async function reportingPeriodKey(): Promise<string | null> {
  const [rows, companyCount] = await Promise.all([
    prisma.kpiValue.findMany({ select: { period: true, companyId: true } }),
    prisma.portfolioCompany.count(),
  ]);
  if (rows.length === 0 || companyCount === 0) return null;

  const byPeriod = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = dateToPeriodKey(r.period);
    (byPeriod.get(k) ?? byPeriod.set(k, new Set()).get(k)!).add(r.companyId);
  }
  const keys = [...byPeriod.keys()].sort().reverse();
  const complete = keys.find((k) => (byPeriod.get(k)?.size ?? 0) >= companyCount);
  return complete ?? keys[0] ?? null;
}

/** Latest period that has data for one specific company. */
async function companyLatestPeriodKey(companyId: string): Promise<string | null> {
  const agg = await prisma.kpiValue.aggregate({
    where: { companyId },
    _max: { period: true },
  });
  return agg._max.period ? dateToPeriodKey(agg._max.period) : null;
}

type StatusCounts = Record<CompanyStatus, number>;
const zeroStatus = (): StatusCounts => ({ GREEN: 0, YELLOW: 0, RED: 0 });

export type FundRollup = {
  id: string;
  name: string;
  vintageYear: number;
  companyCount: number;
  statusCounts: StatusCounts;
  // additive USD/headcount totals across the fund's companies for the period
  revenue: number | null;
  ebitda: number | null;
  netDebt: number | null;
  headcount: number | null;
};

/** Firm-level roll-up per fund for a given period. Empty for CFOs. */
export async function getFundRollups(
  user: SessionUser,
  periodKey: string,
): Promise<FundRollup[]> {
  if (!canViewFirmWide(user)) return [];
  const period = periodKeyToDate(periodKey);

  const funds = await prisma.fund.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      vintageYear: true,
      companies: {
        select: {
          status: true,
          kpiValues: {
            where: { period, kpiDefinition: { retired: false } },
            select: {
              actual: true,
              budget: true,
              kpiDefinition: { select: { name: true, category: true } },
            },
          },
        },
      },
    },
  });

  return funds.map((f) => {
    const statusCounts = zeroStatus();
    const acc: Record<string, { sum: number; seen: boolean }> = {
      Revenue: { sum: 0, seen: false },
      EBITDA: { sum: 0, seen: false },
      "Net Debt": { sum: 0, seen: false },
      Headcount: { sum: 0, seen: false },
    };

    for (const c of f.companies) {
      statusCounts[companyPeriodFlag(c.kpiValues, c.status)] += 1;
      for (const v of c.kpiValues) {
        const bucket = acc[v.kpiDefinition.name];
        if (!bucket || v.actual == null) continue;
        bucket.sum += Number(v.actual);
        bucket.seen = true;
      }
    }

    return {
      id: f.id,
      name: f.name,
      vintageYear: f.vintageYear,
      companyCount: f.companies.length,
      statusCounts,
      revenue: acc.Revenue.seen ? acc.Revenue.sum : null,
      ebitda: acc.EBITDA.seen ? acc.EBITDA.sum : null,
      netDebt: acc["Net Debt"].seen ? acc["Net Debt"].sum : null,
      headcount: acc.Headcount.seen ? acc.Headcount.sum : null,
    };
  });
}

export type FundCompanyRow = {
  id: string;
  name: string;
  industry: string;
  status: CompanyStatus; // stored/manual status
  computedStatus: CompanyStatus; // from this period's variance, stored status as fallback
  ownershipPct: number;
  metrics: Record<
    string,
    {
      actual: number | null;
      budget: number | null;
      unit: string;
      flag: VarianceFlag | null;
    }
  >;
};

export type FundDetail = {
  id: string;
  name: string;
  vintageYear: number;
  fundSize: number;
  status: string;
  periodKey: string;
  companies: FundCompanyRow[];
};

export async function getFundDetail(
  user: SessionUser,
  fundId: string,
  periodKey: string,
): Promise<FundDetail | null> {
  if (!canViewFirmWide(user)) return null;

  const fund = await prisma.fund.findUnique({
    where: { id: fundId },
    select: { id: true, name: true, vintageYear: true, fundSize: true, status: true },
  });
  if (!fund) return null;

  const period = periodKeyToDate(periodKey);
  const companies = await prisma.portfolioCompany.findMany({
    where: { fundId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      industry: true,
      status: true,
      ownershipPct: true,
      kpiValues: {
        where: { period, kpiDefinition: { retired: false } },
        select: {
          actual: true,
          budget: true,
          kpiDefinition: { select: { name: true, unit: true, category: true } },
        },
      },
    },
  });

  return {
    id: fund.id,
    name: fund.name,
    vintageYear: fund.vintageYear,
    fundSize: Number(fund.fundSize),
    status: fund.status,
    periodKey,
    companies: companies.map((c) => {
      const metrics: FundCompanyRow["metrics"] = {};
      for (const v of c.kpiValues) {
        const actual = num(v.actual);
        const budget = num(v.budget);
        metrics[v.kpiDefinition.name] = {
          actual,
          budget,
          unit: v.kpiDefinition.unit,
          flag: flagForVariance(
            variancePct(actual, budget),
            kpiHigherIsBetter(v.kpiDefinition.name),
          ),
        };
      }
      return {
        id: c.id,
        name: c.name,
        industry: c.industry,
        status: c.status,
        computedStatus: companyPeriodFlag(c.kpiValues, c.status),
        ownershipPct: Number(c.ownershipPct),
        metrics,
      };
    }),
  };
}

export type CompanyDetail = {
  id: string;
  name: string;
  industry: string;
  status: CompanyStatus; // stored/manual status
  computedStatus: CompanyStatus; // from the latest period's variance, stored status as fallback
  ownershipPct: number;
  investmentDate: Date;
  fund: { id: string; name: string };
  kpiDefs: { id: string; name: string; unit: string; category: string }[];
  periodKeys: string[]; // newest first
  // grid[kpiDefId][periodKey] = { actual, budget, flag }
  grid: Record<
    string,
    Record<
      string,
      { actual: number | null; budget: number | null; flag: VarianceFlag | null }
    >
  >;
  // Actual-vs-prior-period % change of the latest month (PRD 6.1).
  trend: Record<
    string,
    { mom: number | null; qoq: number | null; yoy: number | null }
  >;
  commentary: {
    id: string;
    periodKey: string;
    body: string;
    author: string;
    authorId: string;
  }[];
  documents: {
    id: string;
    filename: string;
    category: string;
    uploadedAt: Date;
    uploader: string;
  }[];
};

export async function getCompanyDetail(
  user: SessionUser,
  companyId: string,
  months = 6,
): Promise<CompanyDetail | null> {
  if (!canAccessCompany(user, companyId)) return null;

  const company = await prisma.portfolioCompany.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      industry: true,
      status: true,
      ownershipPct: true,
      investmentDate: true,
      fund: { select: { id: true, name: true } },
    },
  });
  if (!company) return null;

  const anchorKey =
    (await companyLatestPeriodKey(companyId)) ??
    (await reportingPeriodKey()) ??
    dateToPeriodKey(new Date());
  const periodKeys = recentPeriodKeys(months, periodKeyToDate(anchorKey));
  // Always pull >= 13 months so MoM/QoQ/YoY deltas can be computed.
  const trendKeys = recentPeriodKeys(13, periodKeyToDate(anchorKey));
  const oldest = periodKeyToDate(
    [...periodKeys, ...trendKeys].sort()[0],
  );

  const [kpiDefs, values, commentary, documents] = await Promise.all([
    getKpiDefsFor(company),
    prisma.kpiValue.findMany({
      where: { companyId, period: { gte: oldest } },
      select: { kpiDefId: true, period: true, actual: true, budget: true },
    }),
    prisma.commentary.findMany({
      where: { companyId },
      orderBy: { period: "desc" },
      take: 24,
      select: {
        id: true,
        period: true,
        body: true,
        authorId: true,
        author: { select: { name: true } },
      },
    }),
    prisma.document.findMany({
      where: { companyId },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        filename: true,
        category: true,
        uploadedAt: true,
        uploader: { select: { name: true } },
      },
    }),
  ]);

  const defById = new Map(kpiDefs.map((d) => [d.id, d]));

  const grid: CompanyDetail["grid"] = {};
  for (const d of kpiDefs) grid[d.id] = {};
  for (const v of values) {
    const key = dateToPeriodKey(v.period);
    const actual = num(v.actual);
    const budget = num(v.budget);
    if (!grid[v.kpiDefId]) grid[v.kpiDefId] = {};
    grid[v.kpiDefId][key] = {
      actual,
      budget,
      flag: flagForVariance(
        variancePct(actual, budget),
        kpiHigherIsBetter(defById.get(v.kpiDefId)?.name ?? ""),
      ),
    };
  }

  // Company flag = worst FINANCIAL-KPI flag in the most recent period shown,
  // stored status as the fallback when that period has nothing to flag on.
  const latestKey = periodKeys[0];
  const computedStatus =
    rollUpFlags(
      kpiDefs
        .filter((d) => d.category === "FINANCIAL")
        .map((d) => grid[d.id]?.[latestKey]?.flag ?? null),
    ) ?? company.status;

  // MoM / QoQ / YoY: latest actual vs. the actual 1 / 3 / 12 months back.
  const pctChange = (cur: number | null, prev: number | null) =>
    cur == null || prev == null || prev === 0
      ? null
      : ((cur - prev) / Math.abs(prev)) * 100;
  const trend: CompanyDetail["trend"] = {};
  for (const d of kpiDefs) {
    const at = (k: string) => grid[d.id]?.[k]?.actual ?? null;
    const cur = at(trendKeys[0]);
    trend[d.id] = {
      mom: pctChange(cur, at(trendKeys[1])),
      qoq: pctChange(cur, at(trendKeys[3])),
      yoy: pctChange(cur, at(trendKeys[12])),
    };
  }

  return {
    id: company.id,
    name: company.name,
    industry: company.industry,
    status: company.status,
    computedStatus,
    ownershipPct: Number(company.ownershipPct),
    investmentDate: company.investmentDate,
    fund: company.fund,
    kpiDefs,
    periodKeys,
    grid,
    trend,
    commentary: commentary.map((c) => ({
      id: c.id,
      periodKey: dateToPeriodKey(c.period),
      body: c.body,
      author: c.author.name,
      authorId: c.authorId,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      category: d.category,
      uploadedAt: d.uploadedAt,
      uploader: d.uploader.name,
    })),
  };
}

export type TriageRow = {
  id: string;
  name: string;
  fundId: string;
  fundName: string;
  industry: string;
  status: CompanyStatus;
  // most unfavourable financial KPIs this period, worst first
  drivers: { kpi: string; variancePct: number; flag: VarianceFlag }[];
};

/**
 * Every company the user can see, worst-flagged first (PRD 6.5 — "surfaces
 * flagged companies first so partners can triage quickly"). CFOs get their
 * own company only, which makes this a no-op for them.
 */
export async function getPortfolioTriage(
  user: SessionUser,
  periodKey: string,
): Promise<TriageRow[]> {
  const companies = await prisma.portfolioCompany.findMany({
    orderBy: [{ fund: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      industry: true,
      status: true,
      fundId: true,
      fund: { select: { name: true } },
      kpiValues: {
        where: { period: periodKeyToDate(periodKey), kpiDefinition: { retired: false } },
        select: {
          actual: true,
          budget: true,
          kpiDefinition: { select: { name: true, category: true } },
        },
      },
    },
  });

  const rank: Record<CompanyStatus, number> = { RED: 0, YELLOW: 1, GREEN: 2 };

  return companies
    .filter((c) => canAccessCompany(user, c.id))
    .map((c) => {
      const fin = c.kpiValues.filter((v) => v.kpiDefinition.category === "FINANCIAL");
      const scored = fin.map((v) => {
        const higher = kpiHigherIsBetter(v.kpiDefinition.name);
        const vp = variancePct(num(v.actual), num(v.budget));
        const unfavorable = vp == null ? null : higher ? -vp : vp;
        return { kpi: v.kpiDefinition.name, vp, unfavorable, flag: flagForVariance(vp, higher) };
      });
      const status = rollUpFlags(scored.map((s) => s.flag)) ?? c.status;
      const drivers = scored
        .filter((s) => s.unfavorable != null && s.unfavorable > 0 && s.flag && s.flag !== "GREEN")
        .sort((a, b) => (b.unfavorable as number) - (a.unfavorable as number))
        .slice(0, 3)
        .map((s) => ({
          kpi: s.kpi,
          variancePct: s.vp as number,
          flag: s.flag as VarianceFlag,
        }));
      return {
        id: c.id,
        name: c.name,
        fundId: c.fundId,
        fundName: c.fund.name,
        industry: c.industry,
        status,
        drivers,
      };
    })
    .sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name));
}
