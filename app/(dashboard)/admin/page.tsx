import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { canManageUsers } from "@/lib/rbac";
import { listUsers, getScopeOptions } from "@/lib/admin";
import { UsersPanel } from "./users-panel";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canManageUsers(user)) redirect("/");

  const [users, scope] = await Promise.all([
    listUsers(user),
    getScopeOptions(user),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin · Users</h1>
        <Link href="/kpis" className="text-sm text-blue-600 hover:underline">
          KPI template library →
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Provision accounts and assign role + access. A user must exist here
        before they can sign in. Deactivating blocks sign-in on the next
        request without deleting history.
      </p>

      <UsersPanel
        currentUserId={user.id}
        users={users}
        funds={scope.funds}
        companies={scope.companies}
      />
    </div>
  );
}
