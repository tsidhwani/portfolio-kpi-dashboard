import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";

/**
 * Shell for the authenticated app (Partner / Deal Team / Admin — and CFO
 * until their dedicated view exists). Auth is guarded here so every page in
 * the group can assume a signed-in user; data-level access is still checked
 * per action against lib/rbac.ts.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold">
            Portfolio KPI
          </Link>
          <nav className="flex gap-4 text-sm text-gray-600">
            {user.role === "CFO" ? (
              <>
                <Link href="/submit" className="hover:text-gray-900">
                  Submit
                </Link>
                {user.companyIds[0] && (
                  <Link
                    href={`/companies/${user.companyIds[0]}`}
                    className="hover:text-gray-900"
                  >
                    My Company
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href="/funds" className="hover:text-gray-900">
                  Funds
                </Link>
                <Link href="/entry" className="hover:text-gray-900">
                  Monthly Entry
                </Link>
                <Link href="/kpis" className="hover:text-gray-900">
                  KPI Library
                </Link>
                <Link href="/audit" className="hover:text-gray-900">
                  Audit Log
                </Link>
                {user.role === "ADMIN" && (
                  <Link href="/admin" className="hover:text-gray-900">
                    Admin
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{user.role}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="rounded border px-2 py-1 hover:bg-gray-50">Sign out</button>
          </form>
        </div>
      </header>
      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
