"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCommentary } from "./actions";

type PeriodOpt = { key: string; label: string };

export function CommentaryEditor({
  companyId,
  periods,
  myNotes,
}: {
  companyId: string;
  periods: PeriodOpt[];
  myNotes: Record<string, string>; // periodKey -> body (this user's note)
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [periodKey, setPeriodKey] = useState(periods[0]?.key ?? "");
  const [body, setBody] = useState(myNotes[periods[0]?.key ?? ""] ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pickPeriod(k: string) {
    setPeriodKey(k);
    setBody(myNotes[k] ?? "");
    setMsg(null);
    setError(null);
  }

  function submit() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await saveCommentary({ companyId, period: periodKey, body });
      if (res.status === "error") {
        setError(res.message);
        return;
      }
      setMsg(res.status === "deleted" ? "Note cleared." : "Saved.");
      router.refresh();
    });
  }

  const existing = (myNotes[periodKey] ?? "") !== "";
  const dirty = body !== (myNotes[periodKey] ?? "");

  return (
    <div className="mt-3 rounded border bg-gray-50 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-gray-700">
          {existing ? "Edit your note" : "Add a note"}
        </span>
        <label className="ml-auto flex items-center gap-1 text-gray-500">
          Period
          <select
            value={periodKey}
            onChange={(e) => pickPeriod(e.target.value)}
            className="rounded border px-2 py-1"
          >
            {periods.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Free-form commentary for this reporting period…"
        className="mt-2 w-full rounded border px-2 py-1 text-sm"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={pending || !dirty}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : existing ? "Update" : "Save"}
        </button>
        {existing && (
          <button
            onClick={() => {
              setBody("");
              startTransition(async () => {
                const res = await saveCommentary({ companyId, period: periodKey, body: "" });
                if (res.status === "error") setError(res.message);
                else {
                  setMsg("Note cleared.");
                  router.refresh();
                }
              });
            }}
            disabled={pending}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          >
            Clear
          </button>
        )}
        {msg && <span className="text-xs text-green-700">{msg}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
