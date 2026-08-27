import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Augments the Auth.js session/token with the fields lib/auth.ts attaches
 * from the User row. Keep in sync with the SessionUser type in lib/rbac.ts.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      fundIds: string[];
      companyIds: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    fundIds?: string[];
    companyIds?: string[];
  }
}
