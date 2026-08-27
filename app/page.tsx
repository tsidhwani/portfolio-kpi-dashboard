import { auth, signIn, signOut } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-semibold">Portfolio KPI Dashboard</h1>
      {session?.user ? (
        <div className="flex flex-col items-center gap-2">
          <p>Signed in as {session.user.email}</p>
          <form action={async () => { "use server"; await signOut(); }}>
            <button className="px-4 py-2 bg-gray-800 text-white rounded">Sign out</button>
          </form>
        </div>
      ) : (
        <form action={async () => { "use server"; await signIn("google"); }}>
          <button className="px-4 py-2 bg-blue-600 text-white rounded">Sign in with Google</button>
        </form>
      )}
    </main>
  );
}
