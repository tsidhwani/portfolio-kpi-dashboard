"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument } from "./actions";

const CATEGORIES = [
  { value: "board_deck", label: "Board deck" },
  { value: "report", label: "Monthly report" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
];

export function DocumentUpload({ companyId }: { companyId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    const form = new FormData(e.currentTarget);
    form.set("companyId", companyId);
    startTransition(async () => {
      const res = await uploadDocument(form);
      if (res.status === "error") {
        setError(res.message);
        return;
      }
      setMsg("Uploaded.");
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="mt-3 flex flex-wrap items-center gap-2 rounded border bg-gray-50 p-3 text-sm"
    >
      <input
        type="file"
        name="file"
        required
        className="max-w-[16rem] text-xs"
      />
      <select name="category" defaultValue="report" className="rounded border px-2 py-1">
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <button
        disabled={pending}
        className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
      <span className="text-xs text-gray-400">PDF/Office/CSV/image, ≤ 20 MB</span>
      {msg && <span className="text-xs text-green-700">{msg}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
