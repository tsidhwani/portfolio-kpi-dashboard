import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
// import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"; // add if firm uses O365

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow sign-in if this email has been provisioned by an Admin.
      // CFO accounts are manually provisioned per PRD 5.2 — no self-serve signup.
      // TODO: look up user by email in Prisma, reject if not found.
      return true;
    },
    async session({ session, token }) {
      // TODO: attach role, fundIds, companyIds from DB onto session.user
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
