import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { canViewAuditLog } from "@/lib/rbac";
import { listAuditEntries } from "@/lib/audit-log";
import { PageHeader } from "../ui";

export const dynamic = "force-dynamic";

const stamp = (d: Date) =>
  d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

const preview = (v: unknown) => {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 140 ? s.slice(0, 139) + "…" : s;
};

const ACTION_STYLE: Record<string, string> = {
  CREATE: "text-flag-green",
  UPDATE: "text-link",
  DELETE: "text-flag-red",
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
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        meta="Append-only record of every create / edit / delete on financial data, commentary, and documents. Read-only — no one, including Admins, can alter entries."
      />

      <div className="mb-4 flex flex-wrap gap-2 text-[0.75rem]">
        <Link
          href="/audit"
          className={`rounded-sm border px-2 py-1 no-underline ${
            !sp.type
              ? "border-accent bg-accent text-white"
              : "border-line-strong text-ink-soft hover:bg-paper"
          }`}
        >
          All
        </Link>
        {entityTypes.map((t) => (
          <Link
            key={t}
            href={`/audit?type=${t}`}
            className={`rounded-sm border px-2 py-1 no-underline ${
              sp.type === t
                ? "border-accent bg-accent text-white"
                : "border-line-strong text-ink-soft hover:bg-paper"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th className="pl-4">When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th className="pr-4">Before → After</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-ink-faint">
                  No entries.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap pl-4 text-ink-soft">
                    {stamp(e.timestamp)}
                  </td>
                  <td className="whitespace-nowrap">{e.actor}</td>
                  <td className={`font-medium ${ACTION_STYLE[e.action] ?? ""}`}>
                    {e.action}
                  </td>
                  <td className="whitespace-nowrap">
                    {e.entityType}
                    <span className="ml-1 text-[0.6875rem] text-ink-faint">{e.entityId}</span>
                  </td>
                  <td className="pr-4 text-[0.6875rem] text-ink-soft">
                    {e.before != null && (
                      <div className="text-ink-faint">− {preview(e.before)}</div>
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
          <Link href={qs({ cursor: nextCursor })} className="btn no-underline">
            Older →
          </Link>
        </div>
      )}
    </div>
  );
}
