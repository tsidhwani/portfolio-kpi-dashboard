import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

const ERROR_COPY: Record<string, string> = {
  AccessDenied:
    "This account isn't provisioned for the dashboard. Ask an Admin to add you.",
  Configuration: "Sign-in is misconfigured. Contact the deal team.",
  default: "Sign-in failed. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error, callbackUrl } = await searchParams;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-semibold">Portfolio KPI Dashboard</h1>
      <p className="text-sm text-gray-500">Meridian Capital — internal</p>

      {error && (
        <p className="max-w-sm text-center text-sm text-red-600">
          {ERROR_COPY[error] ?? ERROR_COPY.default}
        </p>
      )}

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: callbackUrl ?? "/" });
        }}
      >
        <button className="rounded bg-blue-600 px-4 py-2 text-white">
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
