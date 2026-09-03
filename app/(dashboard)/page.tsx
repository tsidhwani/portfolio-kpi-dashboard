import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getPortfolioTriage, getFundRollups, reportingPeriodKey } from "@/lib/reporting";
import { periodLabel } from "@/lib/periods";
import { formatSignedPct } from "@/lib/format";
import { PageHeader, StatusDot, flagTextClass } from "./ui";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 font-serif text-2xl text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[0.75rem] text-ink-faint">{sub}</div>}
    </div>
  );
}

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "CFO") redirect("/submit");

  const periodKey = await reportingPeriodKey();
  const [triage, rollups] = await Promise.all([
    periodKey ? getPortfolioTriage(user, periodKey) : Promise.resolve([]),
    periodKey ? getFundRollups(user, periodKey) : Promise.resolve([]),
  ]);

  const flagged = triage.filter((c) => c.status !== "GREEN");
  const green = triage.length - flagged.length;

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Overview"
        meta={
          periodKey
            ? `Status and variance as of ${periodLabel(periodKey)}.`
            : "No KPI data yet."
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Funds" value={String(rollups.length)} />
        <Stat label="Companies" value={String(triage.length)} />
        <Stat
          label="Flagged"
          value={String(flagged.length)}
          sub={flagged.length ? "watch / off plan" : "none"}
        />
        <Stat label="On plan" value={String(green)} />
      </div>

      <div className="mt-9">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg">Needs attention</h2>
          <Link href="/funds" className="text-[0.8125rem]">
            Fund roll-up →
          </Link>
        </div>

        {flagged.length === 0 ? (
          <p className="card px-4 py-6 text-center text-[0.8125rem] text-ink-faint">
            {triage.length === 0
              ? "No KPI data yet."
              : `Nothing flagged — all ${green} companies on plan this period.`}
          </p>
        ) : (
          <div className="card overflow-hidden">
            <table className="dt">
              <thead>
                <tr>
                  <th className="pl-4">Company</th>
                  <th>Fund</th>
                  <th>Drivers vs. budget</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((c) => (
                  <tr key={c.id}>
                    <td className="pl-4">
                      <span className="inline-flex items-center gap-2">
                        <StatusDot status={c.status} />
                        <Link href={`/companies/${c.id}`} className="font-medium text-ink no-underline hover:underline">
                          {c.name}
                        </Link>
                      </span>
                      <div className="mt-0.5 pl-[15px] text-[0.6875rem] text-ink-faint">
                        {c.industry}
                      </div>
                    </td>
                    <td className="text-ink-soft">{c.fundName}</td>
                    <td>
                      <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-[0.75rem]">
                        {c.drivers.map((d) => (
                          <span key={d.kpi}>
                            <span className="text-ink-soft">{d.kpi}</span>{" "}
                            <span className={flagTextClass(d.flag)}>
                              {formatSignedPct(d.variancePct)}
                            </span>
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {flagged.length > 0 && green > 0 && (
          <p className="mt-2 text-[0.75rem] text-ink-faint">
            + {green} more on plan.
          </p>
        )}
      </div>
    </div>
  );
}
