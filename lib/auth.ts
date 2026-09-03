import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * OAuth only in production (CLAUDE.md rule #3) — no credentials table, no
 * password reset. No database adapter: sessions are stateless JWTs. The User
 * row is the source of truth for identity + access; a user must be
 * provisioned by an Admin before they can sign in.
 *
 * DEMO LOGIN: when enabled (dev by default, or DEMO_LOGIN=1 anywhere), a
 * second "provider" lets you sign in as one of the seeded users by role,
 * with no Google account — so a reviewer can open the app and click around.
 * It only ever resolves to a user that already exists in the DB, so against
 * a real (non-mock) dataset the buttons simply do nothing.
 *
 * Route/server-action code should not read the raw session — use
 * getSessionUser()/requireSessionUser() from lib/session.ts.
 */

export const DEMO_LOGIN_ENABLED =
  process.env.DEMO_LOGIN === "1" ||
  (process.env.DEMO_LOGIN !== "0" && process.env.NODE_ENV !== "production");

const GOOGLE_CONFIGURED = !!process.env.GOOGLE_CLIENT_ID;

const DEMO_ROLES: Role[] = ["ADMIN", "PARTNER", "DEAL_TEAM", "CFO"];

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    ...(GOOGLE_CONFIGURED
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Every account is manually provisioned, so don't auto-link by email.
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
    ...(DEMO_LOGIN_ENABLED
      ? [
          Credentials({
            id: "demo",
            name: "Demo",
            credentials: { role: {} },
            async authorize(creds) {
              const raw = String(creds?.role ?? "")
                .toUpperCase()
                .replace(/\s+/g, "_");
              if (!DEMO_ROLES.includes(raw as Role)) return null;
              // First active user with that role — no email coupling.
              const u = await prisma.user.findFirst({
                where: { role: raw as Role, active: true },
                orderBy: { createdAt: "asc" },
              });
              if (!u) return null;
              return { id: u.id, email: u.email, name: u.name };
            },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /**
     * Gate: only emails that already exist in the User table may sign in.
     * Unknown / inactive -> deny -> /login?error=AccessDenied.
     */
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const dbUser = await prisma.user.findUnique({ where: { email } });
      if (!dbUser || !dbUser.active) return false;

      // Record the real OAuth subject the first time we see this user
      // (the seed writes a placeholder). Never for the demo provider.
      if (account && account.provider !== "demo") {
        const providerId = `${account.provider}|${account.providerAccountId}`;
        if (dbUser.authProviderId !== providerId) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { authProviderId: providerId },
          });
        }
      }
      return true;
    },

    /**
     * Attach identity + access to the token. Re-read from the DB on every
     * call so an Admin's role/access change takes effect on the user's next
     * request without forcing a re-login. Fine at this app's scale.
     */
    async jwt({ token, user }) {
      const email = (user?.email ?? token.email)?.toLowerCase();
      if (!email) return token;

      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          role: true,
          active: true,
          fundAccess: { select: { fundId: true } },
          companyAccess: { select: { companyId: true } },
        },
      });

      if (dbUser && dbUser.active) {
        token.email = dbUser.email; // persist for subsequent calls
        token.uid = dbUser.id;
        token.role = dbUser.role;
        token.fundIds = dbUser.fundAccess.map((f) => f.fundId);
        token.companyIds = dbUser.companyAccess.map((c) => c.companyId);
      } else {
        // User was de-provisioned or deactivated mid-session — strip access.
        delete token.uid;
        delete token.role;
        delete token.fundIds;
        delete token.companyIds;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
        session.user.fundIds = (token.fundIds as string[]) ?? [];
        session.user.companyIds = (token.companyIds as string[]) ?? [];
      }
      return session;
    },
  },
});
