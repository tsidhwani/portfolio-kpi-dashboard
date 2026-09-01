import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { canViewAuditLog } from "@/lib/rbac";
import { listAuditEntries } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const stamp = (d: Date) =>
  d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

const preview = (v: unknown) => {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 140 ? s.slice(0, 139) + "…" : s;
};

const ACTION_STYLE: Record<string, string> = {
  CREATE: "text-green-700",
  UPDATE: "text-blue-700",
  DELETE: "text-red-700",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; cursor?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canViewAuditLog(user)) redirect("/");

  const sp = await searchParams;
  const { entries, entityTypes, nextCursor } = await listAuditEntries(user, {
    entityType: sp.type,
    cursor: sp.cursor,
  });

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (sp.type) p.set("type", sp.type);
    for (const [k, v] of Object.entries(extra)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `/audit?${s}` : "/audit";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">Audit log</h1>
      <p className="mt-1 text-sm text-gray-500">
        Append-only record of every create / edit / delete on financial data,
        commentary, and documents (PRD 8.1). Read-only — no one, including
        Admins, can alter entries.
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <Link
          href="/audit"
          className={`rounded border px-2 py-1 ${!sp.type ? "bg-gray-900 text-white" : "hover:bg-gray-50"}`}
        >
          All
        </Link>
        {entityTypes.map((t) => (
          <Link
            key={t}
            href={`/audit?type=${t}`}
            className={`rounded border px-2 py-1 ${sp.type === t ? "bg-gray-900 text-white" : "hover:bg-gray-50"}`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">When</th>
              <th className="py-2 pr-4 font-medium">Actor</th>
              <th className="py-2 pr-4 font-medium">Action</th>
              <th className="py-2 pr-4 font-medium">Entity</th>
              <th className="py-2 pr-4 font-medium">Before → After</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">
                  No entries.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-b align-top">
                  <td className="py-2 pr-4 whitespace-nowrap text-gray-600">
                    {stamp(e.timestamp)}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{e.actor}</td>
                  <td className={`py-2 pr-4 font-medium ${ACTION_STYLE[e.action] ?? ""}`}>
                    {e.action}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {e.entityType}
                    <span className="ml-1 text-xs text-gray-400">{e.entityId}</span>
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-600">
                    {e.before != null && (
                      <div className="text-gray-400">− {preview(e.before)}</div>
                    )}
                    {e.after != null && <div>+ {preview(e.after)}</div>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-4">
          <Link
            href={qs({ cursor: nextCursor })}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Older →
          </Link>
        </div>
      )}
    </div>
  );
}
