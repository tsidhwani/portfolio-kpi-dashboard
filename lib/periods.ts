/**
 * Reporting periods are stored as the first day of the month at UTC
 * midnight (see prisma KpiValue.period). In the UI and URLs we pass them
 * around as "YYYY-MM" strings.
 */
export function periodKeyToDate(key: string): Date {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`bad period key: ${key}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`bad month in period key: ${key}`);
  return new Date(Date.UTC(year, month - 1, 1));
}

export function dateToPeriodKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodLabel(key: string): string {
  return periodKeyToDate(key).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Most recent `count` months as period keys, newest first. */
export function recentPeriodKeys(count = 15, anchor = new Date()): string[] {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(dateToPeriodKey(new Date(Date.UTC(y, m - i, 1))));
  }
  return keys;
}
