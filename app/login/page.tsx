import { redirect } from "next/navigation";
import { auth, signIn, DEMO_LOGIN_ENABLED } from "@/lib/auth";

const ERROR_COPY: Record<string, string> = {
  AccessDenied:
    "This account isn't provisioned for the dashboard. Ask an Admin to add you.",
  Configuration: "Sign-in is misconfigured. Contact the deal team.",
  default: "Sign-in failed. Please try again.",
};

const GOOGLE_CONFIGURED = !!process.env.GOOGLE_CLIENT_ID;

const DEMO_ROLES = [
  { role: "Admin", blurb: "users, KPI library, everything" },
  { role: "Partner", blurb: "read-only roll-ups + notes" },
  { role: "Deal team", blurb: "enter KPIs, upload, comment" },
  { role: "CFO", blurb: "one company, submit only" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error, callbackUrl } = await searchParams;
  const to = callbackUrl ?? "/";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="eyebrow mb-3">Meridian Capital</div>
        <h1 className="font-serif text-[2rem] leading-tight text-ink">
          Portfolio KPI Dashboard
        </h1>
        <p className="mt-2 text-[0.8125rem] text-ink-soft">
          Internal monitoring for portfolio financials, operating KPIs, and
          commentary. Access is provisioned by an administrator.
        </p>

        {error && (
          <p className="mt-5 border-l-2 border-flag-red pl-3 text-[0.8125rem] text-flag-red">
            {ERROR_COPY[error] ?? ERROR_COPY.default}
          </p>
        )}

        {GOOGLE_CONFIGURED && (
          <form
            className="mt-7"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: to });
            }}
          >
            <button className="btn btn-primary w-full py-2.5">
              Continue with Google
            </button>
          </form>
        )}

        {DEMO_LOGIN_ENABLED && (
          <div className={GOOGLE_CONFIGURED ? "mt-6 border-t border-line pt-5" : "mt-7"}>
            <div className="eyebrow mb-2">
              {GOOGLE_CONFIGURED ? "Or explore with demo data" : "Demo — no account needed"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ROLES.map(({ role, blurb }) => (
                <form
                  key={role}
                  action={async (formData: FormData) => {
                    "use server";
                    await signIn("demo", {
                      role: String(formData.get("role")),
                      redirectTo: to,
                    });
                  }}
                >
                  <input type="hidden" name="role" value={role} />
                  <button className="btn w-full flex-col items-start !py-2 text-left">
                    <span className="text-[0.8125rem] font-medium text-ink">
                      {role}
                    </span>
                    <span className="text-[0.625rem] font-normal text-ink-faint">
                      {blurb}
                    </span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}

        <p className="mt-8 border-t border-line pt-4 text-[0.6875rem] text-ink-faint">
          OAuth only — no passwords are stored. Every change to financial data,
          commentary, and documents is recorded in an append-only audit log.
        </p>
      </div>
    </main>
  );
}
