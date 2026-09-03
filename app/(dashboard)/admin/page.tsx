import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { canManageUsers } from "@/lib/rbac";
import { listUsers, getScopeOptions } from "@/lib/admin";
import { UsersPanel } from "./users-panel";
import { PageHeader } from "../ui";

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
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        meta="Provision accounts and assign role + access. A user must exist here before they can sign in. Deactivating blocks sign-in on the next request without deleting history."
        actions={
          <Link href="/kpis" className="btn no-underline">
            KPI template library →
          </Link>
        }
      />

      <UsersPanel
        currentUserId={user.id}
        users={users}
        funds={scope.funds}
        companies={scope.companies}
      />
    </div>
  );
}
