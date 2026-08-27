import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { name, email, role, fundIds, companyIds } = session.user;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Portfolio KPI Dashboard</h1>

      <div className="flex flex-col items-center gap-1 text-sm">
        <p>
          Signed in as <span className="font-medium">{name ?? email}</span>
        </p>
        <p className="text-gray-500">
          Role: {role}
          {role === "CFO" && companyIds.length > 0 && (
            <> · company {companyIds.join(", ")}</>
          )}
          {fundIds.length > 0 && <> · funds {fundIds.join(", ")}</>}
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button className="rounded bg-gray-800 px-4 py-2 text-white">Sign out</button>
      </form>
    </main>
  );
}
