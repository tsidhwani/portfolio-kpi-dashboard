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
    <div className="mt-5">
      <div className="flex justify-end">
        <button
          onClick={() => open(blank())}
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
        >
          + Add user
        </button>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Access</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium" />
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
                <tr key={u.id} className="border-b align-top">
                  <td className="py-2 pr-4">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-1 text-xs text-gray-400">(you)</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{u.email}</td>
                  <td className="py-2 pr-4">{u.role}</td>
                  <td className="py-2 pr-4 text-gray-600">{scope}</td>
                  <td className="py-2 pr-4">
                    <span className={u.active ? "text-green-700" : "text-gray-400"}>
                      {u.active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => open(toDraft(u))}
                      className="text-blue-600 hover:underline"
                    >
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
        <div className="mt-5 rounded border bg-gray-50 p-4">
          <h2 className="text-sm font-semibold">
            {draft.id ? "Edit user" : "New user"}
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
              <span className="text-gray-500">Email</span>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="rounded border px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Role</span>
              <select
                value={draft.role}
                disabled={editingSelf}
                onChange={(e) =>
                  setDraft({ ...draft, role: e.target.value as Role })
                }
                className="rounded border px-2 py-1 disabled:opacity-50"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end text-sm">
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
            <p className="mt-2 text-xs text-gray-400">
              You can&apos;t change your own role or deactivate yourself.
            </p>
          )}

          <fieldset className="mt-4">
            <legend className="text-xs font-medium text-gray-500">
              {draft.role === "CFO"
                ? "Company (CFO must have exactly one)"
                : "Company access"}
            </legend>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {companies.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.companyIds.includes(c.id)}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        companyIds: toggle(draft.companyIds, c.id),
                      })
                    }
                  />
                  <span>
                    {c.name}
                    <span className="text-gray-400"> · {c.fundName}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {draft.role !== "CFO" && (
            <fieldset className="mt-3">
              <legend className="text-xs font-medium text-gray-500">
                Fund access
              </legend>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {funds.map((f) => (
                  <label key={f.id} className="flex items-center gap-1.5 text-sm">
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
              <p className="mt-1 text-xs text-gray-400">
                Leave everything unchecked for firm-wide access. Per-fund scoping
                for Partner / Deal Team is stored but not yet enforced (see
                CLAUDE.md open decision).
              </p>
            </fieldset>
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
