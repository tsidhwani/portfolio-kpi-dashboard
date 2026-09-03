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
      className="card mt-3 flex flex-wrap items-center gap-2 p-3.5 text-[0.8125rem]"
    >
      <input type="file" name="file" required className="max-w-[16rem] text-[0.75rem]" />
      <select name="category" defaultValue="report" className="field">
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <button disabled={pending} className="btn btn-primary">
        {pending ? "Uploading…" : "Upload"}
      </button>
      <span className="text-[0.6875rem] text-ink-faint">PDF / Office / CSV / image, ≤ 20 MB</span>
      {msg && <span className="text-[0.75rem] text-flag-green">{msg}</span>}
      {error && <span className="text-[0.75rem] text-flag-red">{error}</span>}
    </form>
  );
}
