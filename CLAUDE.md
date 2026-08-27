# Portfolio KPI Dashboard — project context for Claude Code

## What this is
Internal web app for a private equity firm. Centralizes monthly financials,
operating KPIs, and commentary across every portfolio company in every fund.
Phase 1 builds the full app against mock data only — no live accounting/fund
admin integrations yet, that's a separate future scope.

## Users (do not blur these roles together)
- **Partner** — reads fund/company roll-ups, drills into companies, leaves notes.
- **Deal Team** — enters financials/KPIs, uploads docs, writes commentary, chases CFOs.
- **Portfolio Co. CFO** — submits only their own company's numbers. Must never
  be able to see or fetch another company's data, another fund, or firm-level
  views, even via direct API call. This is enforced in `lib/rbac.ts`, not the UI.
- **Admin** — manages users, role/access assignment, KPI template library.

## Tech stack
Next.js (App Router) + TypeScript, Prisma + Postgres, Auth.js (OAuth only,
no password store), Tailwind + shadcn/ui, Vercel for hosting, Vercel Blob
(or S3-compatible) for documents.

## Schema
Source of truth is `prisma/schema.prisma`. Key entities: Fund, PortfolioCompany,
KpiDefinition, KpiValue, Commentary, Document, User, AuditLogEntry, plus
FundAccess/CompanyAccess join tables for scoping. Don't add ad hoc fields
outside this file — extend the schema first, then run `npm run db:push`.

## Non-negotiable rules
1. **Audit log is append-only.** No update/delete path on `AuditLogEntry`,
   including for Admins. Every create/update/delete on financial data,
   commentary, or documents must call `logAudit()` from `lib/audit.ts` inside
   the same transaction as the mutation.
2. **RBAC is enforced at the API/server-action layer**, never just hidden in
   the UI. Every route touching company data calls the helpers in
   `lib/rbac.ts` first.
3. **OAuth only.** No credentials table, no password reset flow.
4. **This is a monitoring dashboard, not a valuation/fund-accounting system.**
   Don't add waterfall or valuation modeling — that's explicitly out of scope.

## Open decision — resolve before real data goes in
`lib/rbac.ts` currently treats Partner/Deal Team/Admin as firm-wide access
(can see all funds/companies) and CFO as scoped to their own company only.
This was left open in the original PRD because SEC-audit posture usually
expects access scoped to a documented "need," not blanket firm-wide access.
If that gets resolved to "scope Deal Team by coverage," the fix is: add a
coverage check in `canAccessCompany`/`canEditFinancials` using the existing
`FundAccess`/`CompanyAccess` tables (already modeled, just not enforced for
those two roles yet).

## Commands
- `npm run dev` — local dev server
- `npm run db:push` — sync Prisma schema to Postgres (no migration files yet,
  fine for this stage; switch to `prisma migrate` once schema stabilizes)
- `npm run db:studio` — visual DB browser

## Build order (recommended)
1. Fund/company data model + seed script with mock data
2. Monthly entry grid (Deal Team) — this is the core write path everything else reads from
3. Fund-level roll-up + company detail view (Partner read path)
4. CFO restricted submission view
5. Variance flagging (green/yellow/red)
6. Admin: user management + KPI template library
7. PDF/CSV export

## Decisions Log
(Record any open question from this file, once resolved, as a dated one-line
entry here. Example: "2026-08-27 — RBAC scoping: Partner/Deal Team stay
firm-wide, CFO restricted to own company. Confirmed by Tapan.")

## Progress Log
(One line per completed feature or session, most recent at the top. Keep
entries terse — what was built, not how. Example: "2026-08-27 — Auth wired,
Google OAuth login working, no User/role attachment yet.")

## Working agreement for future sessions
- Read this whole file before starting any task.
- Before ending a session, append one line to Progress Log summarizing what
  changed, and add to Decisions Log if any open question got resolved.
- If Progress Log passes ~15 entries, condense the oldest ones into a single
  summary line instead of deleting them, so the file doesn't bloat.
- Never remove or contradict a Decisions Log entry without flagging it to
  Tapan explicitly first — those are settled unless he says otherwise.
