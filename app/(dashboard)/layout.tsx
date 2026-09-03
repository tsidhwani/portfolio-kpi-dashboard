import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { NavLinks } from "./nav";

/**
 * Authenticated app shell. Auth is guarded here so every page in the group
 * can assume a signed-in user; data-level access is still checked per action
 * against lib/rbac.ts.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const cfo = user.role === "CFO";
  const items = cfo
    ? [
        { href: "/submit", label: "Submit" },
        ...(user.companyIds[0]
          ? [{ href: `/companies/${user.companyIds[0]}`, label: "My Company" }]
          : []),
      ]
    : [
        { href: "/", label: "Overview" },
        { href: "/funds", label: "Funds" },
        { href: "/entry", label: "Entry" },
        { href: "/kpis", label: "KPI Library" },
        { href: "/audit", label: "Audit Log" },
        ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
      ];

  const roleLabel = user.role.replace("_", " ").toLowerCase();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto max-w-shell px-6">
          <div className="flex items-center justify-between pt-4">
            <Link href={cfo ? "/submit" : "/"} className="no-underline">
              <span className="font-serif text-[1.0625rem] tracking-[0.18em] text-ink">
                MERIDIAN
              </span>
              <span className="ml-3 border-l border-line-strong pl-3 text-[0.75rem] text-ink-faint">
                Portfolio KPI Dashboard
              </span>
            </Link>
            <div className="flex items-center gap-3 text-[0.75rem] text-ink-faint">
              <span className="capitalize">{roleLabel}</span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button className="text-ink-soft hover:text-ink">Sign out</button>
              </form>
            </div>
          </div>
          <NavLinks items={items} />
        </div>
      </header>

      <main className="mx-auto max-w-shell px-6 py-8">{children}</main>
    </div>
  );
}
