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
    <div className="mt-3">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 font-medium">Metric</th>
            <th className="py-2 font-medium">Actual</th>
            <th className="py-2 font-medium">Budget</th>
          </tr>
        </thead>
        <tbody>
          {kpiDefs.map((k) => (
            <tr key={k.id} className="border-b">
              <td className="py-2 pr-4">
                {k.name} <span className="text-gray-400">({k.unit})</span>
              </td>
              <td className="py-1 pr-2">
                <input
                  inputMode="decimal"
                  className="w-36 rounded border px-2 py-1"
                  value={rows[k.id].actual}
                  onChange={(e) => edit(k.id, "actual", e.target.value)}
                />
              </td>
              <td className="py-1">
                <input
                  inputMode="decimal"
                  className="w-36 rounded border px-2 py-1"
                  value={rows[k.id].budget}
                  onChange={(e) => edit(k.id, "budget", e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending || !dirty}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {message && <span className="text-sm text-green-600">{message}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
