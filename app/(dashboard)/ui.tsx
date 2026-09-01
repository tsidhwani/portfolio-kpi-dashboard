import { VARIANCE_LEGEND, type VarianceFlag } from "@/lib/variance";

const STATUS_STYLES: Record<string, string> = {
  GREEN: "bg-green-100 text-green-800",
  YELLOW: "bg-yellow-100 text-yellow-800",
  RED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}

const FLAG_TEXT: Record<VarianceFlag, string> = {
  GREEN: "text-green-600",
  YELLOW: "text-yellow-700",
  RED: "text-red-600",
};

/** Tailwind text-colour class for a variance flag; muted grey when null. */
export function flagTextClass(flag: VarianceFlag | null | undefined): string {
  return flag ? FLAG_TEXT[flag] : "text-gray-400";
}

const FLAG_DOT: Record<VarianceFlag, string> = {
  GREEN: "bg-green-500",
  YELLOW: "bg-yellow-500",
  RED: "bg-red-500",
};

/** Threshold key for the traffic-light flags. */
export function VarianceLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
      {VARIANCE_LEGEND.map((row) => (
        <span key={row.flag} className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${FLAG_DOT[row.flag]}`} />
          {row.label}
        </span>
      ))}
    </div>
  );
}
