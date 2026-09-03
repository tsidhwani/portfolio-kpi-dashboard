"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveKpiValues } from "./actions";

type KpiDef = { id: string; name: string; unit: string; category: string };
type Cell = { actual: string; budget: string };
type ValueMap = Record<string, Cell>;

function normalize(defs: KpiDef[], vals: ValueMap): ValueMap {
  const out: ValueMap = {};
  for (const d of defs) out[d.id] = vals[d.id] ?? { actual: "", budget: "" };
  return out;
}

export function EntryGrid({
  companyId,
  period,
  kpiDefs,
  initialValues,
}: {
  companyId: string;
  period: string;
  kpiDefs: KpiDef[];
  initialValues: ValueMap;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<ValueMap>(() => normalize(kpiDefs, initialValues));
  const [rows, setRows] = useState<ValueMap>(() => normalize(kpiDefs, initialValues));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = kpiDefs.some(
    (k) =>
      rows[k.id].actual !== baseline[k.id].actual ||
      rows[k.id].budget !== baseline[k.id].budget,
  );

  function edit(kpiId: string, field: keyof Cell, value: string) {
    setRows((r) => ({ ...r, [kpiId]: { ...r[kpiId], [field]: value } }));
    setMessage(null);
    setError(null);
  }

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await saveKpiValues({
        companyId,
        period,
        rows: kpiDefs.map((k) => ({
          kpiDefId: k.id,
          actual: rows[k.id].actual.trim() === "" ? null : rows[k.id].actual.trim(),
          budget: rows[k.id].budget.trim() === "" ? null : rows[k.id].budget.trim(),
        })),
      });

      if (res.status === "saved") {
        setBaseline(rows);
        setMessage(
          res.count === 0
            ? "No changes to save."
            : `Saved ${res.count} metric${res.count === 1 ? "" : "s"}.`,
        );
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="mt-6">
      <div className="card overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th className="pl-4">Metric</th>
              <th className="num">Actual</th>
              <th className="num pr-4">Budget</th>
            </tr>
          </thead>
          <tbody>
            {kpiDefs.map((k) => (
              <tr key={k.id}>
                <td className="pl-4">
                  <span className="font-medium text-ink">{k.name}</span>{" "}
                  <span className="text-ink-faint">({k.unit})</span>
                </td>
                <td className="num">
                  <input
                    inputMode="decimal"
                    className="field w-36 text-right"
                    value={rows[k.id].actual}
                    onChange={(e) => edit(k.id, "actual", e.target.value)}
                  />
                </td>
                <td className="num pr-4">
                  <input
                    inputMode="decimal"
                    className="field w-36 text-right"
                    value={rows[k.id].budget}
                    onChange={(e) => edit(k.id, "budget", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={pending || !dirty} className="btn btn-primary">
          {pending ? "Saving…" : "Save"}
        </button>
        {message && <span className="text-[0.8125rem] text-flag-green">{message}</span>}
        {error && <span className="text-[0.8125rem] text-flag-red">{error}</span>}
      </div>
    </div>
  );
}
