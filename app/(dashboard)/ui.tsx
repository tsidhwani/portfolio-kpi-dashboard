import type { ReactNode } from "react";
import { VARIANCE_LEGEND, type VarianceFlag } from "@/lib/variance";

/* --- section label ----------------------------------------------------- */

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

/* --- page header ----------------------------------------------------- */

export function PageHeader({
  title,
  eyebrow,
  meta,
  actions,
}: {
  title: string;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 border-b border-line-strong pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
          <h1 className="text-2xl leading-tight">{title}</h1>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>
        )}
      </div>
      {meta && <p className="mt-2 text-[0.8125rem] text-ink-soft">{meta}</p>}
    </header>
  );
}

/* --- status flag ----------------------------------------------------- */

const FLAG_LABEL: Record<VarianceFlag, string> = {
  GREEN: "On plan",
  YELLOW: "Watch",
  RED: "Off plan",
};
const FLAG_DOT: Record<VarianceFlag, string> = {
  GREEN: "bg-flag-green",
  YELLOW: "bg-flag-amber",
  RED: "bg-flag-red",
};
const FLAG_TEXT: Record<VarianceFlag, string> = {
  GREEN: "text-flag-green",
  YELLOW: "text-flag-amber",
  RED: "text-flag-red",
};

/** Dot + word. Muted, not a loud pill. */
export function StatusBadge({ status }: { status: string }) {
  const flag = (["GREEN", "YELLOW", "RED"].includes(status) ? status : "GREEN") as VarianceFlag;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8125rem] text-ink">
      <span className={`h-[7px] w-[7px] rounded-full ${FLAG_DOT[flag]}`} />
      {FLAG_LABEL[flag]}
    </span>
  );
}

/** Just the dot — for dense rows. */
export function StatusDot({ status }: { status: string }) {
  const flag = (["GREEN", "YELLOW", "RED"].includes(status) ? status : "GREEN") as VarianceFlag;
  return (
    <span
      title={FLAG_LABEL[flag]}
      className={`inline-block h-[7px] w-[7px] rounded-full ${FLAG_DOT[flag]}`}
    />
  );
}

/** Tailwind text-colour class for a variance flag; muted grey when null. */
export function flagTextClass(flag: VarianceFlag | null | undefined): string {
  return flag ? FLAG_TEXT[flag] : "text-ink-faint";
}

/** Threshold key for the traffic-light flags. */
export function VarianceLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.6875rem] text-ink-faint">
      {VARIANCE_LEGEND.map((row) => (
        <span key={row.flag} className="inline-flex items-center gap-1.5">
          <span className={`h-[6px] w-[6px] rounded-full ${FLAG_DOT[row.flag]}`} />
          {row.label}
        </span>
      ))}
    </div>
  );
}
