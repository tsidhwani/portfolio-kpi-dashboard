/** Display formatting for KPI values. Storage stays raw numbers. */

export function formatUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatByUnit(value: number | null | undefined, unit: string): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (unit === "USD") return formatUsd(value);
  if (unit === "%") return `${value.toFixed(1)}%`;
  return value.toLocaleString("en-US");
}

/** actual vs. budget as a signed percentage of |budget|. */
export function variancePct(
  actual: number | null | undefined,
  budget: number | null | undefined,
): number | null {
  if (actual == null || budget == null || budget === 0) return null;
  return ((actual - budget) / Math.abs(budget)) * 100;
}

export function formatSignedPct(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}
