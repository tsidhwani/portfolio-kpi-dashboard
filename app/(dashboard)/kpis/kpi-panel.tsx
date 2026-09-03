"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveKpiDefinition } from "./actions";

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
  retired: boolean;
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
  retired: boolean;
};

const blank = (): Draft => ({
  id: null,
  name: "",
  category: "FINANCIAL",
  unit: "",
  cadence: "monthly",
  appliesTo: "",
  isCustom: true,
  retired: false,
});

const toDraft = (k: KpiRow): Draft => ({
  id: k.id,
  name: k.name,
  category: k.category,
  unit: k.unit,
  cadence: k.cadence,
  appliesTo: k.appliesTo ?? "",
  isCustom: k.isCustom,
  retired: k.retired,
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

  function save(d: Draft) {
    setError(null);
    startTransition(async () => {
      const res = await saveKpiDefinition(d);
      if (res.status === "error") {
        setError(res.message);
        return;
      }
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <div className="mt-2">
      <div className="flex justify-end">
        <button onClick={() => open(blank())} className="btn">
          + Add KPI
        </button>
      </div>

      <div className="card mt-2 overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th className="pl-4">Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Cadence</th>
              <th>Applies to</th>
              <th className="num">Values</th>
              <th className="pr-4" />
            </tr>
          </thead>
          <tbody>
            {kpis.map((k) => (
              <tr key={k.id} className={k.retired ? "text-ink-faint" : ""}>
                <td className="pl-4">
                  <span className={k.retired ? "" : "font-medium text-ink"}>{k.name}</span>
                  {k.isCustom && <span className="ml-1.5 text-[0.6875rem] text-ink-faint">custom</span>}
                  {k.retired && <span className="ml-1.5 text-[0.6875rem] text-ink-faint">· retired</span>}
                </td>
                <td className="text-ink-soft">{k.category}</td>
                <td className="text-ink-soft">{k.unit}</td>
                <td className="text-ink-soft">{k.cadence}</td>
                <td className="text-ink-soft">{k.appliesTo ?? "all"}</td>
                <td className="num text-ink-soft">{k.valueCount}</td>
                <td className="num whitespace-nowrap pr-4">
                  <button onClick={() => open(toDraft(k))} className="text-link hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => save({ ...toDraft(k), retired: !k.retired })}
                    disabled={pending}
                    className="ml-3 text-link hover:underline disabled:opacity-50"
                  >
                    {k.retired ? "Restore" : "Retire"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <div className="card mt-5 p-4">
          <div className="eyebrow">{draft.id ? "Edit KPI" : "New KPI"}</div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="field"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Category</span>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
                className="field"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Unit</span>
              <input
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                placeholder="USD, %, FTEs, count"
                className="field"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Cadence</span>
              <input
                value={draft.cadence}
                onChange={(e) => setDraft({ ...draft, cadence: e.target.value })}
                className="field"
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="eyebrow">Applies to industry (blank = all)</span>
              <input
                value={draft.appliesTo}
                onChange={(e) => setDraft({ ...draft, appliesTo: e.target.value })}
                placeholder="e.g. Fintech"
                className="field"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-col gap-2 text-[0.8125rem]">
            {!draft.id && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.isCustom}
                  onChange={(e) => setDraft({ ...draft, isCustom: e.target.checked })}
                />
                <span>Mark as custom (firm-added, not part of the base template)</span>
              </label>
            )}
            {draft.id && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.retired}
                  onChange={(e) => setDraft({ ...draft, retired: e.target.checked })}
                />
                <span>Retired (hidden from entry &amp; reporting, history kept)</span>
              </label>
            )}
          </div>

          {error && <p className="mt-3 text-[0.8125rem] text-flag-red">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button onClick={() => draft && save(draft)} disabled={pending} className="btn btn-primary">
              {pending ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setDraft(null)} disabled={pending} className="btn">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
