import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getPortfolioTriage, reportingPeriodKey } from "@/lib/reporting";
import { periodLabel } from "@/lib/periods";
import { formatSignedPct } from "@/lib/format";
import { StatusBadge } from "./ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // CFOs have no firm-level landing — send them to their submission view.
  if (user.role === "CFO") redirect("/submit");

  const periodKey = await reportingPeriodKey();
  const triage = periodKey ? await getPortfolioTriage(user, periodKey) : [];
  const flagged = triage.filter((c) => c.status !== "GREEN");
  const green = triage.length - flagged.length;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">Portfolio KPI Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Signed in as {user.role}.
        {periodKey ? ` Flags as of ${periodLabel(periodKey)}.` : ""}
      </p>

      <h2 className="mt-6 text-sm font-semibold text-gray-700">Needs attention</h2>
      {flagged.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">
          {triage.length === 0
            ? "No KPI data yet."
            : `Nothing flagged — all ${green} companies green this period.`}
        </p>
      ) : (
        <ul className="mt-2 divide-y rounded border">
          {flagged.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
              <StatusBadge status={c.status} />
              <Link
                href={`/companies/${c.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {c.name}
              </Link>
              <span className="text-xs text-gray-400">{c.fundName}</span>
              <span className="ml-auto flex flex-wrap gap-x-3 text-xs text-gray-500">
                {c.drivers.map((d) => (
                  <span key={d.kpi}>
                    {d.kpi} {formatSignedPct(d.variancePct)}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {flagged.length > 0 && green > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          + {green} more tracking green.{" "}
          <Link href="/funds" className="text-blue-600 hover:underline">
            Full fund roll-up →
          </Link>
        </p>
      )}

      <h2 className="mt-8 text-sm font-semibold text-gray-700">Go to</h2>
      <ul className="mt-2 space-y-2 text-sm">
        <li>
          <Link href="/funds" className="text-blue-600 hover:underline">
            Funds
          </Link>
          <span className="ml-2 text-gray-500">Fund-level roll-ups; drill into any company.</span>
        </li>
        <li>
          <Link href="/entry" className="text-blue-600 hover:underline">
            Monthly Entry
          </Link>
          <span className="ml-2 text-gray-500">Enter actuals &amp; budget by company and month.</span>
        </li>
        <li>
          <Link href="/kpis" className="text-blue-600 hover:underline">
            KPI Library
          </Link>
          <span className="ml-2 text-gray-500">Add, edit, or retire the metric templates.</span>
        </li>
        <li>
          <Link href="/audit" className="text-blue-600 hover:underline">
            Audit Log
          </Link>
          <span className="ml-2 text-gray-500">Every change to data, commentary, and documents.</span>
        </li>
        {user.role === "ADMIN" && (
          <li>
            <Link href="/admin" className="text-blue-600 hover:underline">
              Admin
            </Link>
            <span className="ml-2 text-gray-500">Manage users and access.</span>
          </li>
        )}
      </ul>
    </div>
  );
}
