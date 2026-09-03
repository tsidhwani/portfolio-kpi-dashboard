"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveUser } from "./actions";

type Role = "PARTNER" | "DEAL_TEAM" | "CFO" | "ADMIN";
const ROLES: Role[] = ["PARTNER", "DEAL_TEAM", "CFO", "ADMIN"];

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  fundIds: string[];
  companyIds: string[];
};
type Fund = { id: string; name: string };
type Company = { id: string; name: string; fundId: string; fundName: string };

type Draft = {
  id: string | null;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  fundIds: string[];
  companyIds: string[];
};

const blank = (): Draft => ({
  id: null,
  name: "",
  email: "",
  role: "DEAL_TEAM",
  active: true,
  fundIds: [],
  companyIds: [],
});

const toDraft = (u: UserRow): Draft => ({ ...u });

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function UsersPanel({
  currentUserId,
  users,
  funds,
  companies,
}: {
  currentUserId: string;
  users: UserRow[];
  funds: Fund[];
  companies: Company[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editingSelf = draft?.id != null && draft.id === currentUserId;

  function open(next: Draft) {
    setError(null);
    setDraft(next);
  }

  function submit() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const res = await saveUser(draft);
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
          + Add user
        </button>
      </div>

      <div className="card mt-2 overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th className="pl-4">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Access</th>
              <th>Status</th>
              <th className="pr-4" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const scope =
                u.role === "CFO"
                  ? `${u.companyIds.length} company`
                  : u.fundIds.length === 0 && u.companyIds.length === 0
                    ? "firm-wide"
                    : `${u.fundIds.length} fund / ${u.companyIds.length} company`;
              return (
                <tr key={u.id}>
                  <td className="pl-4 font-medium text-ink">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-1.5 text-[0.6875rem] font-normal text-ink-faint">(you)</span>
                    )}
                  </td>
                  <td className="text-ink-soft">{u.email}</td>
                  <td className="text-ink-soft">{u.role}</td>
                  <td className="text-ink-soft">{scope}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-[0.8125rem]">
                      <span
                        className={`h-[7px] w-[7px] rounded-full ${u.active ? "bg-flag-green" : "bg-ink-faint"}`}
                      />
                      {u.active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="num pr-4">
                    <button onClick={() => open(toDraft(u))} className="text-link hover:underline">
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {draft && (
        <div className="card mt-5 p-4">
          <div className="eyebrow">{draft.id ? "Edit user" : "New user"}</div>

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
              <span className="eyebrow">Email</span>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="field"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Role</span>
              <select
                value={draft.role}
                disabled={editingSelf}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
                className="field disabled:opacity-50"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end text-[0.8125rem]">
              <input
                type="checkbox"
                checked={draft.active}
                disabled={editingSelf}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              <span>Active (can sign in)</span>
            </label>
          </div>

          {editingSelf && (
            <p className="mt-2 text-[0.6875rem] text-ink-faint">
              You can&apos;t change your own role or deactivate yourself.
            </p>
          )}

          <fieldset className="mt-4">
            <legend className="eyebrow">
              {draft.role === "CFO"
                ? "Company (CFO must have exactly one)"
                : "Company access"}
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]">
              {companies.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draft.companyIds.includes(c.id)}
                    onChange={() =>
                      setDraft({ ...draft, companyIds: toggle(draft.companyIds, c.id) })
                    }
                  />
                  <span>
                    {c.name}
                    <span className="text-ink-faint"> · {c.fundName}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {draft.role !== "CFO" && (
            <fieldset className="mt-3">
              <legend className="eyebrow">Fund access</legend>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]">
                {funds.map((f) => (
                  <label key={f.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={draft.fundIds.includes(f.id)}
                      onChange={() =>
                        setDraft({ ...draft, fundIds: toggle(draft.fundIds, f.id) })
                      }
                    />
                    <span>{f.name}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-[0.6875rem] text-ink-faint">
                Leave everything unchecked for firm-wide access. Per-fund scoping
                for Partner / Deal Team is stored but not yet enforced (see
                CLAUDE.md).
              </p>
            </fieldset>
          )}

          {error && <p className="mt-3 text-[0.8125rem] text-flag-red">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button onClick={submit} disabled={pending} className="btn btn-primary">
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
