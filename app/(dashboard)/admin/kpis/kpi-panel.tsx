"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveKpiDefinition } from "../actions";

type Category = "FINANCIAL" | "OPERATIONAL";
const CATEGORIES: Category[] = ["FINANCIAL", "OPERATIONAL"];

type KpiRow = {
  id: string;
  name: string;
  category: Category;
  unit: string;
  cadence: string;
  appliesTo: string | null;
  isCustom: boolean;
  valueCount: number;
};

type Draft = {
  id: string | null;
  name: string;
  category: Category;
  unit: string;
  cadence: string;
  appliesTo: string;
  isCustom: boolean;
};

const blank = (): Draft => ({
  id: null,
  name: "",
  category: "FINANCIAL",
  unit: "",
  cadence: "monthly",
  appliesTo: "",
  isCustom: true,
});

const toDraft = (k: KpiRow): Draft => ({
  id: k.id,
  name: k.name,
  category: k.category,
  unit: k.unit,
  cadence: k.cadence,
  appliesTo: k.appliesTo ?? "",
  isCustom: k.isCustom,
});

export function KpiPanel({ kpis }: { kpis: KpiRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open(next: Draft) {
    setError(null);
    setDraft(next);
  }

  function submit() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const res = await saveKpiDefinition(draft);
      if (res.status === "error") {
        setError(res.message);
        return;
      }
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <div className="mt-5">
      <div className="flex justify-end">
        <button
          onClick={() => open(blank())}
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
        >
          + Add KPI
        </button>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 pr-4 font-medium">Unit</th>
              <th className="py-2 pr-4 font-medium">Cadence</th>
              <th className="py-2 pr-4 font-medium">Applies to</th>
              <th className="py-2 pr-4 font-medium">Values</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {kpis.map((k) => (
              <tr key={k.id} className="border-b">
                <td className="py-2 pr-4">
                  {k.name}
                  {k.isCustom && (
                    <span className="ml-1 text-xs text-gray-400">custom</span>
                  )}
                </td>
                <td className="py-2 pr-4">{k.category}</td>
                <td className="py-2 pr-4">{k.unit}</td>
                <td className="py-2 pr-4">{k.cadence}</td>
                <td className="py-2 pr-4 text-gray-600">{k.appliesTo ?? "all"}</td>
                <td className="py-2 pr-4 text-gray-500">{k.valueCount}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => open(toDraft(k))}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <div className="mt-5 rounded border bg-gray-50 p-4">
          <h2 className="text-sm font-semibold">
            {draft.id ? "Edit KPI" : "New KPI"}
          </h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="rounded border px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Category</span>
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as Category })
                }
                className="rounded border px-2 py-1"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Unit</span>
              <input
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                placeholder="USD, %, FTEs, count"
                className="rounded border px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Cadence</span>
              <input
                value={draft.cadence}
                onChange={(e) => setDraft({ ...draft, cadence: e.target.value })}
                className="rounded border px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-gray-500">
                Applies to industry <span className="text-gray-400">(blank = all)</span>
              </span>
              <input
                value={draft.appliesTo}
                onChange={(e) => setDraft({ ...draft, appliesTo: e.target.value })}
                placeholder="e.g. Fintech"
                className="rounded border px-2 py-1"
              />
            </label>
          </div>

          {!draft.id && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isCustom}
                onChange={(e) => setDraft({ ...draft, isCustom: e.target.checked })}
              />
              <span>Mark as custom (firm-added, not part of the base template)</span>
            </label>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              onClick={submit}
              disabled={pending}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setDraft(null)}
              disabled={pending}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
