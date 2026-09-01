/**
 * CSV export (CLAUDE.md build order #7). Pure serialisation + row builders
 * over the shapes lib/reporting.ts already returns, so this stays testable
 * without a request context. PDF export is the browser's Print-to-PDF on the
 * dedicated /report views — no server-side PDF dependency in Phase 1.
 */
import type { FundRollup, FundDetail, CompanyDetail } from "./reporting";
import { periodLabel, periodShortLabel } from "./periods";
import { variancePct } from "./format";

type Cell = string | number | null | undefined;

/** RFC 4180 CSV. Quotes any field containing a comma, quote, or newline. */
export function toCsv(rows: Cell[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell == null ? "" : String(cell);
          return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

/** A downloadable text/csv response. Leading BOM so Excel reads UTF-8. */
export function csvResponse(filename: string, csv: string): Response {
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const varPct = (a: number | null, b: number | null) => {
  const v = variancePct(a, b);
  return v == null ? "" : round2(v);
};

/** `/funds` roll-up: one row per fund, raw numbers (no $/M formatting). */
export function fundRollupRows(rollups: FundRollup[], periodKey: string): Cell[][] {
  return [
    [`Fund roll-up — as of ${periodLabel(periodKey)}`],
    [
      "Fund",
      "Vintage",
      "Companies",
      "Green",
      "Yellow",
      "Red",
      "Revenue",
      "EBITDA",
      "Net Debt",
      "Headcount",
    ],
    ...rollups.map((f) => [
      f.name,
      f.vintageYear,
      f.companyCount,
      f.statusCounts.GREEN,
      f.statusCounts.YELLOW,
      f.statusCounts.RED,
      f.revenue ?? "",
      f.ebitda ?? "",
      f.netDebt ?? "",
      f.headcount ?? "",
    ]),
  ];
}

const FUND_DETAIL_METRICS = [
  "Revenue",
  "EBITDA",
  "EBITDA Margin",
  "Net Debt",
  "Headcount",
];

/** `/funds/[id]`: one row per company with actual/budget/variance per metric. */
export function fundDetailRows(fund: FundDetail): Cell[][] {
  const header = [
    "Company",
    "Industry",
    "Status",
    "Ownership %",
    ...FUND_DETAIL_METRICS.flatMap((m) => [`${m} Actual`, `${m} Budget`, `${m} Var %`]),
  ];
  const body = fund.companies.map((c) => [
    c.name,
    c.industry,
    c.computedStatus,
    c.ownershipPct,
    ...FUND_DETAIL_METRICS.flatMap((m) => {
      const cell = c.metrics[m];
      return [cell?.actual ?? "", cell?.budget ?? "", varPct(cell?.actual ?? null, cell?.budget ?? null)];
    }),
  ]);
  return [
    [`${fund.name} — as of ${periodLabel(fund.periodKey)}`],
    header,
    ...body,
  ];
}

/** `/companies/[id]`: long format — one row per metric × period. */
export function companyHistoryRows(d: CompanyDetail): Cell[][] {
  const rows: Cell[][] = [
    [`${d.name} — KPI history (${d.fund.name})`],
    ["Metric", "Unit", "Period", "Actual", "Budget", "Variance %", "Flag"],
  ];
  for (const kpi of d.kpiDefs) {
    for (const key of d.periodKeys) {
      const cell = d.grid[kpi.id]?.[key];
      if (!cell || (cell.actual == null && cell.budget == null)) continue;
      rows.push([
        kpi.name,
        kpi.unit,
        periodShortLabel(key),
        cell.actual ?? "",
        cell.budget ?? "",
        varPct(cell.actual, cell.budget),
        cell.flag ?? "",
      ]);
    }
  }
  return rows;
}

/** Safe-ish filename fragment from a display name. */
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
