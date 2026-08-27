# Portfolio KPI Dashboard — scaffold

Starter repo generated against the PRD's data model, roles, and NFRs.

## What's here
- `prisma/schema.prisma` — every entity from PRD Sec 7, plus `FundAccess`/`CompanyAccess`
  tables for scoping and an append-only `AuditLogEntry` table for Sec 8.1.
- `lib/rbac.ts` — the one place access rules live. Currently set to firm-wide
  access for Partner/Deal Team/Admin, CFO restricted to their own company.
  **This encodes the open question in PRD Sec 9 — confirm before real data goes in.**
- `lib/audit.ts` — call `logAudit()` inside the same transaction as any
  create/update/delete on financial data, commentary, or documents.
- `lib/auth.ts` — Auth.js, Google OAuth wired, Microsoft Entra ID commented out.
- `app/api/auth/[...nextauth]/route.ts` — route handler.
- Folder structure under `app/` split by persona: `(dashboard)` for
  Partner/Deal Team, `(cfo)` for restricted CFO submission view, `(admin)`
  for user/KPI-template management.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL` (Neon or
   Supabase free tier works fine at 30 users), a `NEXTAUTH_SECRET`, and a
   Google OAuth client ID/secret from Google Cloud Console.
3. `npm run db:push` to create the schema in your Postgres instance.
4. `npm run dev` and confirm it boots at localhost:3000.
5. Push this to a GitHub repo, then import it into Vercel — env vars go in
   the Vercel project settings, not committed.

## Where to build the rest
This scaffold is enough to unblock local dev. The actual feature build
(monthly entry grid, fund roll-ups, variance flagging, PDF export, the
CFO submission flow) is a multi-session job best done in Claude Code
against this repo, since it can run `npm run dev`, hit real Prisma
migrations, and iterate file-by-file with the codebase as context.
