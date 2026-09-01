/**
 * Traffic-light flagging from actual-vs-budget variance.
 *
 * Build order step 5. Pure functions only — the reporting layer feeds these
 * numbers in and the pages render the result. Flags reuse the CompanyStatus
 * literals (GREEN/YELLOW/RED) so `StatusBadge` renders them unchanged.
 */
import type { CompanyStatus } from "@prisma/client";

export type VarianceFlag = CompanyStatus; // "GREEN" | "YELLOW" | "RED"

/**
 * Thresholds on the *unfavorable* side of variance, as a signed percentage
 * of |budget| (see `variancePct` in lib/format.ts). An overshoot in the
 * favorable direction is always GREEN; only a shortfall trips YELLOW / RED.
 *
 * See CLAUDE.md Decisions Log (2026-08-27): within 5% of budget → GREEN,
 * 5–15% unfavorable → YELLOW, worse than 15% → RED.
 */
export const VARIANCE_THRESHOLDS = { yellow: 5, red: 15 } as const;

/**
 * KPIs where a number *below* budget is the favourable outcome — a shortfall
 * on these is good, an overshoot trips the flag. Matched by KPI name.
 */
const LOWER_IS_BETTER = new Set<string>(["Net Debt"]);

export function kpiHigherIsBetter(kpiName: string): boolean {
  return !LOWER_IS_BETTER.has(kpiName);
}

/** Flag a single actual-vs-budget variance. null when it can't be computed. */
export function flagForVariance(
  variancePct: number | null | undefined,
  higherIsBetter = true,
): VarianceFlag | null {
  if (variancePct == null || Number.isNaN(variancePct)) return null;
  // shortfall expressed as a positive number of percentage points
  const unfavorable = higherIsBetter ? -variancePct : variancePct;
  if (unfavorable >= VARIANCE_THRESHOLDS.red) return "RED";
  if (unfavorable >= VARIANCE_THRESHOLDS.yellow) return "YELLOW";
  return "GREEN";
}

const RANK: Record<VarianceFlag, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

/** Worst flag wins. null when there's nothing to roll up. */
export function rollUpFlags(flags: (VarianceFlag | null | undefined)[]): VarianceFlag | null {
  let worst: VarianceFlag | null = null;
  for (const f of flags) {
    if (f == null) continue;
    if (worst == null || RANK[f] > RANK[worst]) worst = f;
  }
  return worst;
}

/** Human-readable description of the threshold bands, for a UI legend. */
export const VARIANCE_LEGEND = [
  { flag: "GREEN" as const, label: `within ${VARIANCE_THRESHOLDS.yellow}% of budget` },
  {
    flag: "YELLOW" as const,
    label: `${VARIANCE_THRESHOLDS.yellow}–${VARIANCE_THRESHOLDS.red}% below budget`,
  },
  { flag: "RED" as const, label: `more than ${VARIANCE_THRESHOLDS.red}% below budget` },
];
