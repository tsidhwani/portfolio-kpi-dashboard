import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // CFOs have no firm-level landing — send them to their submission view.
  if (user.role === "CFO") redirect("/submit");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">Portfolio KPI Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Signed in as {user.role}.</p>

      <ul className="mt-6 space-y-3">
        <li>
          <Link href="/funds" className="text-blue-600 hover:underline">
            Funds
          </Link>
          <span className="ml-2 text-sm text-gray-500">
            Fund-level roll-ups; drill into any company.
          </span>
        </li>
        <li>
          <Link href="/entry" className="text-blue-600 hover:underline">
            Monthly Entry
          </Link>
          <span className="ml-2 text-sm text-gray-500">
            Enter actuals &amp; budget by company and month.
          </span>
        </li>
      </ul>
    </div>
  );
}
