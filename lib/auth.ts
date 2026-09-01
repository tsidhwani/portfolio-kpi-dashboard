import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * OAuth only (CLAUDE.md rule #3) — no credentials table, no password reset.
 * No database adapter: sessions are stateless JWTs. The User row is the
 * source of truth for identity + access; a user must be provisioned by an
 * Admin before they can sign in (CLAUDE.md "Users" — CFOs especially).
 *
 * Route/server-action code should not read the raw session — use
 * getSessionUser()/requireSessionUser() from lib/session.ts, which returns
 * the SessionUser shape lib/rbac.ts expects.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Every account is manually provisioned, so don't auto-link by email.
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /**
     * Gate: only emails that already exist in the User table may sign in.
     * Unknown email -> deny -> redirected to /login?error=AccessDenied.
     */
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const dbUser = await prisma.user.findUnique({ where: { email } });
      if (!dbUser || !dbUser.active) return false;

      // Record the real OAuth subject the first time we see this user
      // (the seed writes a placeholder authProviderId).
      if (account) {
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
     * request without forcing a re-login. Fine at this app's scale (~30
     * users); revisit with a short TTL if the User table grows.
     */
    async jwt({ token }) {
      const email = token.email?.toLowerCase();
      if (!email) return token;

      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          role: true,
          active: true,
          fundAccess: { select: { fundId: true } },
          companyAccess: { select: { companyId: true } },
        },
      });

      if (dbUser && dbUser.active) {
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
